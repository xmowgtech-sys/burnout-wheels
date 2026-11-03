import { getDb, run, nowIso, beginWrite } from "./db";
import type { Product, ProductStatus, Review } from "./types";
import type { ProductInput } from "./validation";
import { escapeLike, randomSuffix } from "./utils";

const COLS =
  "id, slug, name, brand, category, scale, condition, description, highlights, tags, images, imageFit, imagePosition, priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, source, shopifyVariantId, createdAt, updatedAt";

type ProductRow = Record<string, unknown> & {
  id: number; slug: string; name: string; brand: string | null; category: string; scale: string | null;
  condition: string; description: string; highlights: string; tags: string; images: string;
  imageFit: string | null; imagePosition: string | null;
  priceSale: number; priceCost: number; feePercent: number; stock: number; lowStockThreshold: number;
  status: string; featured: number; dropAt: string | null; source: string | null; shopifyVariantId: string | null; createdAt: string; updatedAt: string;
};

export function parseProduct(row: ProductRow): Product {
  const safeArr = (v: unknown): string[] => {
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v) as string[];
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return [];
      }
    }
    if (Array.isArray(v)) return v as string[];
    return [];
  };
  const parseTags = (): string[] => {
    const v = row.tags;
    if (typeof v === "string" && v.length) return v.split(",").map((t) => t.trim()).filter(Boolean);
    if (Array.isArray(v)) return v as string[];
    return [];
  };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand ?? null,
    category: row.category,
    scale: row.scale ?? null,
    condition: row.condition as Product["condition"],
    description: row.description ?? "",
    highlights: safeArr(row.highlights),
    tags: parseTags(),
    images: safeArr(row.images),
    imageFit: row.imageFit === "contain" ? "contain" : "cover",
    imagePosition:
      row.imagePosition === "top" || row.imagePosition === "bottom" || row.imagePosition === "left" || row.imagePosition === "right"
        ? row.imagePosition
        : "center",
    priceSale: row.priceSale,
    priceCost: row.priceCost,
    feePercent: row.feePercent,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    status: row.status as ProductStatus,
    featured: row.featured === 1,
    dropAt: row.dropAt ?? null,
    source: row.source ?? "LOCAL",
    shopifyVariantId: row.shopifyVariantId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface ProductQuery {
  q?: string;
  category?: string;
  condition?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "featured";
  inStock?: boolean;
  featured?: boolean;
  status?: ProductStatus | "ALL";
  limit?: number;
  offset?: number;
}

export function listProducts(query: ProductQuery = {}): Product[] {
  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];

  if (query.status && query.status !== "ALL") {
    where.push("status = ?");
    params.push(query.status);
  }
  if (query.q) {
    const like = `%${escapeLike(query.q).toLowerCase()}%`;
    where.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\' OR LOWER(brand) LIKE ? ESCAPE '\\' OR LOWER(tags) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\')");
    params.push(like, like, like, like, like);
  }
  if (query.category) {
    where.push("LOWER(category) = ?");
    params.push(query.category.toLowerCase());
  }
  if (query.condition) {
    where.push("condition = ?");
    params.push(query.condition);
  }
  if (query.inStock) {
    where.push("stock > 0");
  }
  if (query.featured) {
    where.push("featured = 1");
  }

  const order =
    query.sort === "price-asc"
      ? "priceSale ASC"
      : query.sort === "price-desc"
        ? "priceSale DESC"
        : query.sort === "featured"
          ? "featured DESC, createdAt DESC"
          : "createdAt DESC";

  const limit = query.limit ?? 60;
  const offset = query.offset ?? 0;
  const sql = `SELECT ${COLS} FROM products ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order}, id DESC LIMIT ? OFFSET ?`;
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params, limit, offset) as ProductRow[];
  return rows.map(parseProduct);
}

export function productCount(query: ProductQuery): number {
  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (query.status && query.status !== "ALL") {
    where.push("status = ?");
    params.push(query.status);
  }
  if (query.q) {
    const like = `%${escapeLike(query.q).toLowerCase()}%`;
    where.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\' OR LOWER(brand) LIKE ? ESCAPE '\\' OR LOWER(tags) LIKE ? ESCAPE '\\' OR LOWER(description) LIKE ? ESCAPE '\\')");
    params.push(like, like, like, like, like);
  }
  if (query.category) {
    where.push("LOWER(category) = ?");
    params.push(query.category.toLowerCase());
  }
  if (query.condition) {
    where.push("condition = ?");
    params.push(query.condition);
  }
  if (query.inStock) where.push("stock > 0");
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM products ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`)
    .get(...params) as { n: number };
  return row.n;
}

export function getProductBySlug(slug: string): Product | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLS} FROM products WHERE slug = ?`).get(slug) as ProductRow | undefined;
  return row ? parseProduct(row) : null;
}

export function getProductById(id: number): Product | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLS} FROM products WHERE id = ?`).get(id) as ProductRow | undefined;
  return row ? parseProduct(row) : null;
}

export function featuredProduct(): Product | null {
  const [product] = listProducts({ status: "ACTIVE", featured: true, limit: 1, sort: "newest" });
  return product ?? null;
}

export function relatedProducts(product: Product, limit = 3): Product[] {
  const all = listProducts({ status: "ACTIVE", limit: 24 });
  const sameCat = all.filter((p) => p.id !== product.id && p.category === product.category);
  const others = all.filter((p) => p.id !== product.id && p.category !== product.category);
  return [...sameCat, ...others].slice(0, limit);
}

export function categoryCounts(): { category: string; count: number }[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT category, COUNT(*) as n FROM products WHERE status = 'ACTIVE' GROUP BY category ORDER BY n DESC, category ASC")
    .all() as { category: string; n: number }[];
  return rows.map((r) => ({ category: r.category, count: r.n }));
}

export function uniqueSlug(desired: string, excludeId?: number): string {
  const db = getDb();
  let candidate = desired || `product-${randomSuffix(5).toLowerCase()}`;
  let i = 2;
  for (;;) {
    const hitRow = db.prepare("SELECT id FROM products WHERE slug = ?").get(candidate) as { id: number } | undefined;
    if (!hitRow || hitRow.id === excludeId) return candidate;
    candidate = `${desired}-${i++}`;
    if (i > 50) return `${desired}-${randomSuffix(5).toLowerCase()}`;
  }
}

export function createProduct(input: ProductInput): Product {
  const db = getDb();
  const ts = nowIso();
  const safeSlug = uniqueSlug(input.slug || input.name);
  const stmt = db.prepare(
    `INSERT INTO products (slug, name, brand, category, scale, condition, description, highlights, tags, images, imageFit, imagePosition,
      priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const res = run(
    stmt,
    safeSlug,
    input.name,
    input.brand || null,
    input.category,
    input.scale || null,
    input.condition,
    input.description,
    JSON.stringify(input.highlights),
    input.tags.join(","),
    JSON.stringify(input.images),
    input.imageFit,
    input.imagePosition,
    input.priceSale,
    input.priceCost,
    input.feePercent,
    input.stock,
    input.lowStockThreshold,
    input.status,
    input.featured ? 1 : 0,
    input.dropAt || null,
    ts,
    ts
  );
  // A deliberate re-listing clears the tombstone so future seed runs don't
  // treat this slug as permanently deleted.
  db.prepare("DELETE FROM deleted_products WHERE slug = ?").run(safeSlug);

  const product = getProductById(res.id);
  if (!product) throw new Error("Product insert failed");
  return product;
}

export function updateProduct(id: number, input: ProductInput, actor: string): Product | null {
  const db = getDb();
  beginWrite(db);
  try {
    // Re-check slug for collisions created between form load and save.
    const slug = uniqueSlug(input.slug, id);
    db.prepare(
      `UPDATE products SET slug=?, name=?, brand=?, category=?, scale=?, condition=?, description=?, highlights=?,
        tags=?, images=?, imageFit=?, imagePosition=?, priceSale=?, priceCost=?, feePercent=?, stock=?, lowStockThreshold=?, status=?, featured=?,
        dropAt=?, updatedAt=? WHERE id=?`
    ).run(
      slug, input.name, input.brand || null, input.category, input.scale || null, input.condition, input.description,
      JSON.stringify(input.highlights), input.tags.join(","), JSON.stringify(input.images),
      input.imageFit, input.imagePosition,
      input.priceSale, input.priceCost, input.feePercent, input.stock, input.lowStockThreshold,
      input.status, input.featured ? 1 : 0, input.dropAt || null, nowIso(), id
    );
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
  const product = getProductById(id);
  if (product) {
    // low-stock guard activity note
    if (product.stock <= product.lowStockThreshold) {
      db.prepare("INSERT INTO activityLog (actor, action, entity, detail, createdAt) VALUES (?,?,?,?,?)").run(
        actor, "product.low_stock", product.slug, `Stock low: ${product.stock} units left`, nowIso()
      );
    }
  }
  return product;
}

/** Deletes the product row. Order history keeps its name/slug/image snapshot, so the
 *  only link we sever is orderItems.productId (nullable by design). This is what the
 *  owner expects from "Delete" — archiving left the row visible and looked like a failure. */
export function deleteProduct(id: number): { mode: "deleted" } {
  const db = getDb();
  beginWrite(db);
  try {
    const prod = db.prepare("SELECT id, slug FROM products WHERE id = ?").get(id) as { id: number; slug: string } | undefined;
    if (prod?.slug) {
      db.prepare("INSERT OR REPLACE INTO deleted_products (id, slug, deletedAt) VALUES (?, ?, ?)").run(prod.id, prod.slug, nowIso());
    }
    // Detach history and clean relations before deleting product
    db.prepare("UPDATE orderItems SET productId = NULL WHERE productId = ?").run(id);
    db.prepare("DELETE FROM wishlistItems WHERE productId = ?").run(id);
    db.prepare("DELETE FROM reviews WHERE productId = ?").run(id);
    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
  return { mode: "deleted" };
}

export function deleteProductBySlug(slug: string): { mode: "deleted" } {
  const db = getDb();
  const prod = db.prepare("SELECT id FROM products WHERE slug = ?").get(slug) as { id: number } | undefined;
  if (prod) {
    return deleteProduct(prod.id);
  }
  db.prepare("INSERT OR REPLACE INTO deleted_products (slug, deletedAt) VALUES (?, ?)").run(slug, nowIso());
  return { mode: "deleted" };
}

/* ---------------- reviews ---------------- */

export function publishedReviews(productId: number): Review[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT r.*, p.name as productName FROM reviews r JOIN products p ON p.id = r.productId
              WHERE r.productId = ? AND r.status = 'PUBLISHED' ORDER BY r.createdAt DESC LIMIT 50`)
    .all(productId) as Record<string, unknown>[];
  return rows.map(parseReview);
}

export function pendingReviews(): Review[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT r.*, p.name as productName FROM reviews r JOIN products p ON p.id = r.productId
              WHERE r.status = 'PENDING' ORDER BY r.createdAt ASC LIMIT 100`)
    .all() as Record<string, unknown>[];
  return rows.map(parseReview);
}

export function moderatedReviews(limit = 100): Review[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT r.*, p.name as productName FROM reviews r JOIN products p ON p.id = r.productId
              WHERE r.status IN ('PUBLISHED','REJECTED') ORDER BY r.createdAt DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
  return rows.map(parseReview);
}

function parseReview(row: Record<string, unknown>): Review {
  return {
    id: row.id as number,
    productId: row.productId as number,
    productName: (row.productName as string) ?? undefined,
    name: row.name as string,
    email: row.email as string,
    rating: row.rating as number,
    title: (row.title as string) ?? "",
    body: row.body as string,
    status: row.status as Review["status"],
    createdAt: row.createdAt as string,
  };
}

export function createReview(input: { productId: number; name: string; email: string; rating: number; title: string; body: string }): Review {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO reviews (productId, name, email, rating, title, body, status, createdAt) VALUES (?,?,?,?,?,?, 'PENDING', ?)"
  );
  const res = run(stmt, input.productId, input.name, input.email, input.rating, input.title, input.body, nowIso());
  return {
    id: res.id,
    productId: input.productId,
    name: input.name,
    email: input.email,
    rating: input.rating,
    title: input.title,
    body: input.body,
    status: "PENDING",
    createdAt: nowIso(),
  };
}

export function moderateReview(id: number, status: "PUBLISHED" | "REJECTED"): boolean {
  const db = getDb();
  const res = run(db.prepare("UPDATE reviews SET status = ? WHERE id = ?"), status, id);
  return res.changes > 0;
}

export function deleteReview(id: number): boolean {
  const db = getDb();
  const res = run(db.prepare("DELETE FROM reviews WHERE id = ?"), id);
  return res.changes > 0;
}
