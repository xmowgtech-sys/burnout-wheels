/**
 * Durable product catalog.
 *
 * Vercel Functions run on an ephemeral filesystem, so the SQLite database in
 * `/tmp` is wiped on every cold start. Orders already survive through a Blob
 * store; this module does the same for the catalog so the owner can add, edit,
 * hide and delete products directly in the live admin.
 *
 * The snapshot is deliberately a full copy of every product (not just the ones
 * touched by the admin). That keeps prices, stock, photos and DRAFT/ARCHIVED
 * state identical on every instance. Seed products that are missing from the
 * snapshot are recorded as tombstones so a future cold start cannot resurrect
 * something the owner deleted.
 *
 * The snapshot contains no customer data. Product photos are stored in the same
 * private Blob store and served through `/api/files/[file]`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { getDb, nowIso, tx } from "./db";
import { allProductsForStore } from "./catalog";
import { SEED_PRODUCTS } from "./seed-catalog";
import type { Product } from "./types";

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_PATH = "catalog/v1/products.json";
const IMAGE_PREFIX = "catalog/v1/images/";
const HYDRATION_TTL_MS = 60_000;

export type CatalogStoreMode = "blob" | "local" | "off";

interface CatalogSnapshot {
  version: 1;
  updatedAt: string;
  products: Product[];
  /** Slugs the owner deleted. They must stay deleted after a cold start. */
  deletedSlugs: string[];
}

let lastAttemptAt = 0;
let lastAttemptOk = false;
let hydrationPromise: Promise<boolean> | null = null;
let localRootCache: string | null = null;

/* ------------------------------------------------------------------ */
/* Store selection                                                     */
/* ------------------------------------------------------------------ */

/**
 * The private Blob store used for orders is reused for the catalog. Local
 * development keeps using its persistent SQLite file, so the store is "off"
 * unless a token or an explicit `CATALOG_STORE_DIR` is provided.
 */
export function catalogStoreMode(): CatalogStoreMode {
  if (process.env.CATALOG_STORE_DISABLED === "1") return "off";
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  if (process.env.CATALOG_STORE_DIR) return "local";
  return "off";
}

export function catalogStoreLabel(): string {
  const mode = catalogStoreMode();
  if (mode === "blob") return "vercel-blob-private";
  if (mode === "local") return "local-files";
  return "not-configured";
}

function localRoot(): string {
  if (localRootCache) return localRootCache;
  const root = process.env.CATALOG_STORE_DIR
    ? path.resolve(process.env.CATALOG_STORE_DIR)
    : path.join(process.cwd(), "data", "catalog-store");
  localRootCache = root;
  return root;
}

function localPath(pathname: string): string {
  const root = localRoot();
  const full = path.resolve(root, pathname);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside the catalog store: ${pathname}`);
  }
  return full;
}

/* ------------------------------------------------------------------ */
/* Low-level storage                                                   */
/* ------------------------------------------------------------------ */

async function readText(pathname: string): Promise<string | null> {
  if (catalogStoreMode() === "blob") {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result?.stream) return null;
    return new Response(result.stream).text();
  }

  try {
    return await fs.readFile(localPath(pathname), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeText(pathname: string, text: string): Promise<void> {
  if (catalogStoreMode() === "blob") {
    await put(pathname, text, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }

  const full = localPath(pathname);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, text, "utf8");
}

/* ------------------------------------------------------------------ */
/* Snapshot parsing                                                    */
/* ------------------------------------------------------------------ */

function parseSnapshot(text: string): CatalogSnapshot | null {
  try {
    const data = JSON.parse(text) as Partial<CatalogSnapshot>;
    if (!data || data.version !== SNAPSHOT_VERSION || !Array.isArray(data.products)) return null;
    const products = data.products.filter(
      (product): product is Product =>
        Boolean(product && typeof product === "object" && typeof (product as Product).slug === "string")
    );
    const deletedSlugs = Array.isArray(data.deletedSlugs)
      ? data.deletedSlugs.filter((slug): slug is string => typeof slug === "string")
      : [];
    return {
      version: 1,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : nowIso(),
      products,
      deletedSlugs,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* SQLite reconciliation                                               */
/* ------------------------------------------------------------------ */

const PRODUCT_COLUMNS = [
  "slug", "name", "brand", "category", "scale", "condition", "description", "highlights",
  "tags", "images", "imageFit", "imagePosition", "priceSale", "priceCost", "feePercent",
  "stock", "lowStockThreshold", "status", "featured", "dropAt", "source",
  "shopifyVariantId", "createdAt", "updatedAt",
] as const;

const UPDATE_SQL = `UPDATE products SET ${PRODUCT_COLUMNS.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`;
const INSERT_SQL = `INSERT INTO products (${PRODUCT_COLUMNS.join(", ")}) VALUES (${PRODUCT_COLUMNS.map(() => "?").join(", ")})`;
const INSERT_WITH_ID_SQL = `INSERT INTO products (id, ${PRODUCT_COLUMNS.join(", ")}) VALUES (?, ${PRODUCT_COLUMNS
  .map(() => "?")
  .join(", ")})`;

function productValues(product: Product): (string | number | null)[] {
  return [
    product.slug,
    product.name,
    product.brand ?? null,
    product.category,
    product.scale ?? null,
    product.condition,
    product.description ?? "",
    JSON.stringify(product.highlights ?? []),
    (product.tags ?? []).join(","),
    JSON.stringify(product.images ?? []),
    product.imageFit ?? "cover",
    product.imagePosition ?? "center",
    product.priceSale,
    product.priceCost,
    product.feePercent,
    product.stock,
    product.lowStockThreshold,
    product.status,
    product.featured ? 1 : 0,
    product.dropAt ?? null,
    product.source ?? "LOCAL",
    product.shopifyVariantId ?? null,
    product.createdAt ?? nowIso(),
    product.updatedAt ?? nowIso(),
  ];
}

function applySnapshot(snapshot: CatalogSnapshot): void {
  const db = getDb();
  tx(db, () => {
    const bySlug = db.prepare("SELECT id FROM products WHERE slug = ?");
    const byId = db.prepare("SELECT slug FROM products WHERE id = ?");
    const update = db.prepare(UPDATE_SQL);
    const insert = db.prepare(INSERT_SQL);
    const insertWithId = db.prepare(INSERT_WITH_ID_SQL);
    const clearTombstone = db.prepare("DELETE FROM deleted_products WHERE slug = ?");

    for (const product of snapshot.products) {
      const values = productValues(product);
      const existing = bySlug.get(product.slug) as { id: number } | undefined;
      if (existing) {
        update.run(...values, existing.id);
      } else {
        const id = Number(product.id);
        const idTaken = Number.isInteger(id) && id > 0 ? byId.get(id) : undefined;
        if (Number.isInteger(id) && id > 0 && !idTaken) {
          insertWithId.run(id, ...values);
        } else {
          insert.run(...values);
        }
      }
      // If the owner re-listed a previously deleted item, its tombstone must go.
      clearTombstone.run(product.slug);
    }

    const detachItems = db.prepare("UPDATE orderItems SET productId = NULL WHERE productId = ?");
    const deleteWishlist = db.prepare("DELETE FROM wishlistItems WHERE productId = ?");
    const deleteReviews = db.prepare("DELETE FROM reviews WHERE productId = ?");
    const deleteRow = db.prepare("DELETE FROM products WHERE id = ?");
    const tombstone = db.prepare("INSERT OR REPLACE INTO deleted_products (slug, deletedAt) VALUES (?, ?)");

    for (const slug of snapshot.deletedSlugs) {
      const existing = bySlug.get(slug) as { id: number } | undefined;
      if (existing) {
        // Order history keeps its item snapshot; only the live link is cut.
        detachItems.run(existing.id);
        deleteWishlist.run(existing.id);
        deleteReviews.run(existing.id);
        deleteRow.run(existing.id);
      }
      tombstone.run(slug, snapshot.updatedAt || nowIso());
    }
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

async function hydrate(): Promise<boolean> {
  try {
    const stored = await readText(SNAPSHOT_PATH);
    if (!stored) {
      lastAttemptOk = true;
      lastAttemptAt = Date.now();
      return true;
    }

    const snapshot = parseSnapshot(stored);
    if (!snapshot) {
      console.error("[catalog] The durable catalog snapshot is corrupt; refusing to overwrite it.");
      lastAttemptOk = false;
      lastAttemptAt = Date.now();
      return false;
    }

    applySnapshot(snapshot);
    lastAttemptOk = true;
    lastAttemptAt = Date.now();
    return true;
  } catch (err) {
    console.error("[catalog] Could not load the durable catalog:", err);
    lastAttemptOk = false;
    lastAttemptAt = Date.now();
    return false;
  }
}

/**
 * Bring the Blob catalog into this instance's SQLite database.
 *
 * Returns true when it is safe to read/write the catalog. A false result means
 * the snapshot exists but could not be read, so product mutations should stop
 * instead of overwriting it with a partial seed-only catalog.
 */
export async function ensureCatalogHydrated(options: { force?: boolean } = {}): Promise<boolean> {
  if (catalogStoreMode() === "off") return true;
  if (hydrationPromise) return hydrationPromise;
  if (!options.force && Date.now() - lastAttemptAt < HYDRATION_TTL_MS) return lastAttemptOk;

  hydrationPromise = hydrate().finally(() => {
    hydrationPromise = null;
  });
  return hydrationPromise;
}

/** Write the current SQLite catalog to Blob. Safe to call after every mutation. */
export async function persistCatalogSnapshot(): Promise<boolean> {
  if (catalogStoreMode() === "off") return true;

  try {
    const products = allProductsForStore();
    const db = getDb();
    const present = new Set(products.map((product) => product.slug));
    const deleted = new Set(
      (db.prepare("SELECT slug FROM deleted_products").all() as { slug: string }[]).map((row) => row.slug)
    );

    // A seed product that is not in SQLite was deleted before tombstones were
    // introduced (or removed manually). Record it so the next cold start does
    // not bring it back.
    for (const seed of SEED_PRODUCTS) {
      if (!present.has(seed.slug)) deleted.add(seed.slug);
    }

    const snapshot: CatalogSnapshot = {
      version: SNAPSHOT_VERSION,
      updatedAt: nowIso(),
      products,
      deletedSlugs: [...deleted].sort(),
    };

    await writeText(SNAPSHOT_PATH, JSON.stringify(snapshot));
    lastAttemptAt = Date.now();
    lastAttemptOk = true;
    return true;
  } catch (err) {
    console.error("[catalog] Could not save the durable catalog:", err);
    return false;
  }
}

/** Blob pathname for an admin-uploaded image. */
export function catalogImagePath(file: string): string {
  return `${IMAGE_PREFIX}${file}`;
}
