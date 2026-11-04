/**
 * Durable order storage.
 *
 * Vercel Functions run on an ephemeral filesystem, so the SQLite database in
 * `/tmp` is different on every cold start. Orders written by checkout used to
 * disappear before the customer even reached the confirmation page. This module
 * keeps a private snapshot of every order in Vercel Blob (or a local folder in
 * development) and hydrates it back into SQLite whenever a page or API route
 * needs an order that the current instance has not seen yet.
 *
 * A single JSON index is kept in Blob so listing orders does not require a
 * Blob `list()` call (those count as advanced operations). Reads of the index
 * and snapshots are simple operations, which keeps the free tier healthy even
 * while the admin order table polls for updates.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { put, get, list, del, BlobPreconditionFailedError } from "@vercel/blob";
import { getDb, run, nowIso, tx } from "./db";
import type { Order, OrderEvent, OrderItem, OrderWithRelations } from "./types";

const SNAPSHOT_VERSION = 1;
const INDEX_PATH = "orders/v1/index.json";
const SNAPSHOT_PREFIX = "orders/v1/by-number/";
const INDEX_TTL_MS = 60_000;

export type OrderStoreMode = "blob" | "local" | "off";

interface OrderIndexEntry {
  number: string;
  email: string;
  updatedAt: string;
  isArchived: number;
  idempotencyKey: string | null;
  /** The local SQLite id at the time of the snapshot — lets old /admin/orders/1 links still resolve. */
  legacyId?: number;
}

interface OrderIndex {
  version: 1;
  updatedAt: string;
  orders: Record<string, OrderIndexEntry>;
}

interface OrderSnapshot {
  version: 1;
  savedAt: string;
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
}

interface Tombstone {
  version: 1;
  deleted: true;
  number: string;
  deletedAt: string;
}

interface StoredText {
  text: string;
  etag: string;
}

class StorePreconditionError extends Error {
  constructor() {
    super("Order index changed while it was being updated");
    this.name = "StorePreconditionError";
  }
}

let lastFullHydrationAt = 0;
let warnedMissingStore = false;
let localRootCache: string | null = null;

/* ------------------------------------------------------------------ */
/* Store selection                                                     */
/* ------------------------------------------------------------------ */

/**
 * `BLOB_STORE_ID` is added automatically when a private Blob store is connected
 * on Vercel. `BLOB_READ_WRITE_TOKEN` remains useful for local development and
 * older stores. Without either one we must not pretend orders are durable.
 */
export function orderStoreMode(): OrderStoreMode {
  if (process.env.ORDER_STORE_DISABLED === "1") return "off";
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  if (process.env.ORDER_STORE_DIR) return "local";
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") return "local";
  return "off";
}

export function orderStoreLabel(): string {
  const mode = orderStoreMode();
  if (mode === "blob") return "vercel-blob-private";
  if (mode === "local") return "local-files";
  return "not-configured";
}

function warnMissingStore(): void {
  if (warnedMissingStore) return;
  warnedMissingStore = true;
  console.warn(
    "[orders] No durable order store is configured. Orders will be lost when this " +
      "serverless instance is recycled. Connect a private Vercel Blob store (BLOB_STORE_ID) " +
      "or set ORDER_STORE_DIR for local development."
  );
}

function localRoot(): string {
  if (localRootCache) return localRootCache;
  const root = process.env.ORDER_STORE_DIR
    ? path.resolve(process.env.ORDER_STORE_DIR)
    : path.join(process.cwd(), "data", "order-store");
  localRootCache = root;
  return root;
}

function localPath(pathname: string): string {
  const root = localRoot();
  const full = path.resolve(root, pathname);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside the order store: ${pathname}`);
  }
  return full;
}

function etagOf(stat: { size: number; mtimeMs: number }): string {
  return `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`;
}

/* ------------------------------------------------------------------ */
/* Low-level storage                                                   */
/* ------------------------------------------------------------------ */

async function readText(pathname: string): Promise<StoredText | null> {
  if (orderStoreMode() === "blob") {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode === 304 || !result.stream) {
      return { text: "", etag: result.blob.etag ?? "" };
    }
    return { text: await new Response(result.stream).text(), etag: result.blob.etag ?? "" };
  }

  try {
    const full = localPath(pathname);
    const [text, stat] = await Promise.all([fs.readFile(full, "utf8"), fs.stat(full)]);
    return { text, etag: etagOf(stat) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeText(pathname: string, text: string, ifMatch?: string): Promise<StoredText> {
  if (orderStoreMode() === "blob") {
    const result = await put(pathname, text, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      ...(ifMatch ? { ifMatch } : {}),
    });
    return { text, etag: result.etag ?? "" };
  }

  const full = localPath(pathname);
  await fs.mkdir(path.dirname(full), { recursive: true });
  if (ifMatch) {
    const current = await readText(pathname);
    if (!current || current.etag !== ifMatch) throw new StorePreconditionError();
  }
  await fs.writeFile(full, text, "utf8");
  const stat = await fs.stat(full);
  return { text, etag: etagOf(stat) };
}

async function deleteText(pathname: string): Promise<void> {
  if (orderStoreMode() === "blob") {
    try {
      await del(pathname);
    } catch (err) {
      // A missing blob is fine — the tombstone/index removal is what matters.
      if (!String(err instanceof Error ? err.message : err).toLowerCase().includes("not found")) {
        throw err;
      }
    }
    return;
  }
  try {
    await fs.unlink(localPath(pathname));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

async function listTexts(prefix: string): Promise<string[]> {
  if (orderStoreMode() === "blob") {
    const out: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 50; page++) {
      const result = await list({ prefix, limit: 1000, cursor });
      out.push(...result.blobs.map((blob) => blob.pathname));
      if (!result.hasMore || !result.cursor) break;
      cursor = result.cursor;
    }
    return out;
  }

  const root = localRoot();
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(root, full).split(path.sep).join("/");
        if (rel.startsWith(prefix)) out.push(rel);
      }
    }
  }
  await walk(root);
  return out;
}

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

function emptyIndex(): OrderIndex {
  return { version: 1, updatedAt: nowIso(), orders: {} };
}

function parseIndex(text: string): OrderIndex | null {
  try {
    const data = JSON.parse(text) as Partial<OrderIndex>;
    if (!data || data.version !== 1 || !data.orders || typeof data.orders !== "object") return null;
    return { version: 1, updatedAt: data.updatedAt ?? nowIso(), orders: data.orders };
  } catch {
    return null;
  }
}

async function readIndex(): Promise<{ index: OrderIndex; etag: string } | null> {
  const stored = await readText(INDEX_PATH);
  if (!stored) return null;
  const index = parseIndex(stored.text);
  if (!index) return null;
  return { index, etag: stored.etag };
}

async function rebuildIndexFromSnapshots(): Promise<OrderIndex | null> {
  try {
    const paths = await listTexts(SNAPSHOT_PREFIX);
    const index = emptyIndex();
    for (const pathname of paths) {
      const stored = await readText(pathname);
      if (!stored) continue;
      const snapshot = parseSnapshot(stored.text);
      if (!snapshot) continue;
      index.orders[snapshot.order.number] = entryFor(snapshot.order);
    }
    index.updatedAt = nowIso();
    try {
      await writeText(INDEX_PATH, JSON.stringify(index));
    } catch (err) {
      console.error("[orders] Could not persist the rebuilt order index:", err);
    }
    return index;
  } catch (err) {
    console.error("[orders] Could not rebuild the order index:", err);
    return null;
  }
}

/** Read the index, rebuilding it once if it is missing or corrupt. */
async function loadIndex(): Promise<OrderIndex | null> {
  const current = await readIndex().catch(() => null);
  if (current) return current.index;
  return rebuildIndexFromSnapshots();
}

/** Read-modify-write the index with optimistic ETag retries. */
async function updateIndex(mutator: (index: OrderIndex) => void): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let current: { index: OrderIndex; etag: string } | null = null;
    try {
      current = await readIndex();
    } catch (err) {
      console.error("[orders] Could not read the order index:", err);
      return false;
    }

    const index: OrderIndex = current ? structuredClone(current.index) : emptyIndex();
    mutator(index);
    index.updatedAt = nowIso();

    try {
      await writeText(INDEX_PATH, JSON.stringify(index), current?.etag);
      return true;
    } catch (err) {
      const retryable =
        err instanceof StorePreconditionError ||
        err instanceof BlobPreconditionFailedError ||
        (err instanceof Error && err.name === "BlobPreconditionFailedError");
      if (!retryable) {
        console.error("[orders] Could not update the order index:", err);
        return false;
      }
      // Another instance wrote the index — re-read and merge, then retry.
    }
  }
  console.error("[orders] Order index stayed busy after 8 attempts.");
  return false;
}

function entryFor(order: Order): OrderIndexEntry {
  return {
    number: order.number,
    email: order.email.trim().toLowerCase(),
    updatedAt: order.updatedAt,
    isArchived: Number(order.isArchived ?? 0),
    idempotencyKey: order.idempotencyKey ?? null,
    legacyId: order.id,
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot parsing                                                    */
/* ------------------------------------------------------------------ */

function parseSnapshot(text: string): OrderSnapshot | null {
  try {
    const data = JSON.parse(text) as Partial<OrderSnapshot>;
    if (!data || data.version !== SNAPSHOT_VERSION || !data.order || typeof data.order.number !== "string") return null;
    return {
      version: 1,
      savedAt: data.savedAt ?? nowIso(),
      order: data.order as Order,
      items: Array.isArray(data.items) ? data.items : [],
      events: Array.isArray(data.events) ? data.events : [],
    };
  } catch {
    return null;
  }
}

function isTombstone(text: string): boolean {
  try {
    const data = JSON.parse(text) as Partial<Tombstone>;
    return data?.version === 1 && data.deleted === true;
  } catch {
    return false;
  }
}

function snapshotPath(number: string): string {
  return `${SNAPSHOT_PREFIX}${encodeURIComponent(number.trim().toUpperCase())}.json`;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/** Write a complete order snapshot and add it to the index. */
export async function persistOrderSnapshot(order: OrderWithRelations): Promise<boolean> {
  if (orderStoreMode() === "off") {
    warnMissingStore();
    return false;
  }

  try {
    const { items, events, ...orderRow } = order;
    const snapshot: OrderSnapshot = {
      version: SNAPSHOT_VERSION,
      savedAt: nowIso(),
      // Remove null-prototype artifacts before crossing the JSON boundary.
      order: { ...orderRow } as Order,
      items: items.map((item) => ({ ...item })),
      events: events.map((event) => ({ ...event })),
    };

    await writeText(snapshotPath(order.number), JSON.stringify(snapshot));
    const indexed = await updateIndex((index) => {
      index.orders[order.number] = entryFor(order);
    });
    if (!indexed) {
      console.error(`[orders] Snapshot for ${order.number} was saved but the index update failed.`);
    }
    return true;
  } catch (err) {
    console.error(`[orders] Could not persist order ${order.number}:`, err);
    return false;
  }
}

/** Convenience wrapper for API routes that only have the order number. */
export async function persistOrderByNumber(number: string): Promise<boolean> {
  const order = localOrder(number);
  if (!order) return false;
  return persistOrderSnapshot(order);
}

/** Replace the snapshot with a PII-free tombstone so a deleted order cannot resurrect. */
export async function removeOrderSnapshot(number: string): Promise<void> {
  if (orderStoreMode() === "off") return;
  const clean = number.trim().toUpperCase();
  try {
    const tombstone: Tombstone = { version: 1, deleted: true, number: clean, deletedAt: nowIso() };
    await writeText(snapshotPath(clean), JSON.stringify(tombstone));
    const indexed = await updateIndex((index) => {
      delete index.orders[clean];
    });
    // Only remove the tombstone once the index no longer points at the order.
    // If the index update failed, the tombstone stays behind so hydration still
    // refuses to resurrect the deleted record.
    if (indexed) await deleteText(snapshotPath(clean));
  } catch (err) {
    console.error(`[orders] Could not remove the snapshot for ${clean}:`, err);
  }
}

/* ------------------------------------------------------------------ */
/* SQLite hydration                                                    */
/* ------------------------------------------------------------------ */

const tableColumnCache = new Map<string, string[]>();

function tableColumns(table: string): string[] {
  const cached = tableColumnCache.get(table);
  if (cached) return cached;
  const rows = getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const columns = rows.map((row) => row.name);
  tableColumnCache.set(table, columns);
  return columns;
}

function normaliseValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function insertRow(table: string, values: Record<string, unknown>, skip: string[] = []): number {
  const columns = tableColumns(table).filter(
    (column) => column !== "id" && !skip.includes(column) && Object.prototype.hasOwnProperty.call(values, column)
  );
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
  const result = run(
    getDb().prepare(sql),
    ...columns.map((column) => normaliseValue(values[column]))
  );
  return result.id;
}

function updateRow(table: string, id: number, values: Record<string, unknown>, skip: string[] = []): void {
  const columns = tableColumns(table).filter(
    (column) => column !== "id" && !skip.includes(column) && Object.prototype.hasOwnProperty.call(values, column)
  );
  if (columns.length === 0) return;
  const sql = `UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`;
  run(
    getDb().prepare(sql),
    ...columns.map((column) => normaliseValue(values[column])),
    id
  );
}

interface LocalOrderMeta {
  id: number;
  number: string;
  updatedAt: string;
  customerId: number | null;
}

function localMetaByNumber(number: string): LocalOrderMeta | undefined {
  return getDb()
    .prepare("SELECT id, number, updatedAt, customerId FROM orders WHERE LOWER(number) = LOWER(?) LIMIT 1")
    .get(number.trim()) as LocalOrderMeta | undefined;
}

function localMetaById(id: number): LocalOrderMeta | undefined {
  return getDb()
    .prepare("SELECT id, number, updatedAt, customerId FROM orders WHERE id = ? LIMIT 1")
    .get(id) as LocalOrderMeta | undefined;
}

function localOrder(number: string): OrderWithRelations | null {
  const meta = localMetaByNumber(number);
  if (!meta) return null;
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(meta.id) as Record<string, unknown>;
  const items = getDb()
    .prepare("SELECT * FROM orderItems WHERE orderId = ? ORDER BY id ASC")
    .all(meta.id) as unknown as OrderItem[];
  const events = getDb()
    .prepare("SELECT * FROM orderEvents WHERE orderId = ? ORDER BY id ASC")
    .all(meta.id) as unknown as OrderEvent[];
  return {
    ...(row as unknown as Order),
    items: items.map((item) => ({ ...item })),
    events: events.map((event) => ({ ...event })),
  };
}

function newer(candidate: string | null | undefined, current: string | null | undefined): boolean {
  const a = Date.parse(candidate ?? "");
  const b = Date.parse(current ?? "");
  if (Number.isNaN(a)) return false;
  if (Number.isNaN(b)) return true;
  return a > b;
}

function ensureCustomer(order: Order): number {
  const db = getDb();
  const email = order.email.trim().toLowerCase();
  const existing = db
    .prepare("SELECT id FROM customers WHERE LOWER(email) = LOWER(?) LIMIT 1")
    .get(email) as { id: number } | undefined;
  const account = db
    .prepare("SELECT id FROM accounts WHERE LOWER(email) = LOWER(?) LIMIT 1")
    .get(email) as { id: number } | undefined;
  const accountId = account?.id ?? null;

  if (existing) {
    db.prepare(
      `UPDATE customers
       SET name = CASE WHEN name IS NULL OR name = '' THEN ? ELSE name END,
           phone = COALESCE(phone, ?),
           accountId = COALESCE(accountId, ?)
       WHERE id = ?`
    ).run(order.name, order.phone ?? null, accountId, existing.id);
    return existing.id;
  }

  const result = run(
    db.prepare(
      "INSERT INTO customers (email, name, phone, accountId, createdAt, lastOrderAt) VALUES (?,?,?,?,?,?)"
    ),
    email,
    order.name,
    order.phone ?? null,
    accountId,
    order.placedAt,
    order.placedAt
  );
  return result.id;
}

function refreshCustomerStats(customerId: number): void {
  const db = getDb();
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(CASE WHEN paymentStatus = 'PAID' AND status NOT IN ('CANCELLED', 'REFUNDED') THEN total ELSE 0 END), 0) AS ltv,
              MAX(placedAt) AS lastOrderAt
       FROM orders WHERE customerId = ?`
    )
    .get(customerId) as { n: number; ltv: number; lastOrderAt: string | null };
  db.prepare("UPDATE customers SET ordersCount = ?, lifetimeValue = ?, lastOrderAt = ? WHERE id = ?").run(
    Number(stats.n ?? 0),
    Number(stats.ltv ?? 0),
    stats.lastOrderAt ?? null,
    customerId
  );
}

function hydrateSnapshot(snapshot: OrderSnapshot): void {
  const db = getDb();
  const incoming = { ...snapshot.order } as Record<string, unknown>;
  const number = String(incoming.number);
  const existing = localMetaByNumber(number);
  let customerId = 0;

  // Never let two local rows claim the same idempotency key.
  if (incoming.idempotencyKey) {
    const conflict = db
      .prepare("SELECT id FROM orders WHERE idempotencyKey = ? AND LOWER(number) <> LOWER(?) LIMIT 1")
      .get(String(incoming.idempotencyKey), number) as { id: number } | undefined;
    if (conflict) incoming.idempotencyKey = null;
  }

  tx(db, () => {
    customerId = ensureCustomer(snapshot.order);
    incoming.customerId = customerId;

    let orderId: number;
    if (existing) {
      orderId = existing.id;
      updateRow("orders", orderId, incoming);
      db.prepare("DELETE FROM orderItems WHERE orderId = ?").run(orderId);
      db.prepare("DELETE FROM orderEvents WHERE orderId = ?").run(orderId);
    } else {
      orderId = insertRow("orders", incoming);
    }

    for (const item of snapshot.items) {
      insertRow("orderItems", { ...item, orderId }, ["id"]);
    }
    for (const event of snapshot.events) {
      insertRow("orderEvents", { ...event, orderId }, ["id"]);
    }
  });

  refreshCustomerStats(customerId);
}

function deleteLocalOrder(id: number): void {
  const db = getDb();
  tx(db, () => {
    db.prepare("DELETE FROM orderItems WHERE orderId = ?").run(id);
    db.prepare("DELETE FROM orderEvents WHERE orderId = ?").run(id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  });
}

/* ------------------------------------------------------------------ */
/* Hydration entry points                                              */
/* ------------------------------------------------------------------ */

function cleanNumber(ref: string): string | null {
  const trimmed = ref.trim().replace(/^#/, "");
  if (!trimmed || /^\d+$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/**
 * Bring one order into this instance's SQLite database.
 *
 * `refresh: true` also checks Blob when the order already exists locally, so
 * an admin detail page opened on another serverless instance sees the latest
 * status/tracking changes instead of a stale copy.
 */
export async function hydrateOrderByNumber(
  ref: string | number,
  options: { refresh?: boolean } = {}
): Promise<boolean> {
  if (orderStoreMode() === "off") return false;

  const raw = String(ref).trim();
  const numeric = /^\d+$/.test(raw) ? Number(raw) : null;
  const byId = numeric ? localMetaById(numeric) : undefined;
  if (byId && !options.refresh) return true;

  let number = cleanNumber(raw) ?? (byId ? byId.number.toUpperCase() : null);
  let local = number ? localMetaByNumber(number) : byId;

  // Old admin links used the local SQLite id. The index remembers the id that
  // was current when the snapshot was written, so those links keep working.
  if (!number && numeric) {
    const index = await loadIndex();
    const matches = Object.values(index?.orders ?? {}).filter((entry) => entry.legacyId === numeric);
    if (matches.length === 1) {
      number = matches[0].number;
      local = localMetaByNumber(number);
    }
  }

  if (!number) return Boolean(local);
  if (local && !options.refresh) return true;

  try {
    const stored = await readText(snapshotPath(number));
    if (!stored) return Boolean(local);

    if (isTombstone(stored.text)) {
      if (local) deleteLocalOrder(local.id);
      return false;
    }

    const snapshot = parseSnapshot(stored.text);
    if (!snapshot) return Boolean(local);
    if (snapshot.order.number.toUpperCase() !== number) return Boolean(local);
    if (local && !newer(snapshot.order.updatedAt, local.updatedAt)) return true;

    hydrateSnapshot(snapshot);
    return true;
  } catch (err) {
    console.error(`[orders] Could not hydrate order ${number}:`, err);
    return Boolean(local);
  }
}

/**
 * Look up an idempotent checkout retry. The index stores the key, so a retry
 * that lands on a fresh serverless instance does not create a duplicate order.
 */
export async function hydrateOrderByIdempotencyKey(key: string): Promise<boolean> {
  if (orderStoreMode() === "off" || !key.trim()) return false;
  try {
    const index = await loadIndex();
    if (!index) return false;
    const entry = Object.values(index.orders).find((candidate) => candidate.idempotencyKey === key);
    if (!entry) return false;
    return hydrateOrderByNumber(entry.number, { refresh: true });
  } catch (err) {
    console.error("[orders] Could not hydrate an idempotent order:", err);
    return false;
  }
}

/**
 * Hydrate every order the index knows about. The 60 second TTL keeps the admin
 * table's 4 second polling loop from spending Blob operations on every tick;
 * pass `force` for a manual refresh or a server-rendered admin page.
 */
export async function hydrateAllOrders(options: { force?: boolean } = {}): Promise<void> {
  if (orderStoreMode() === "off") return;
  if (!options.force && Date.now() - lastFullHydrationAt < INDEX_TTL_MS) return;

  try {
    const index = await loadIndex();
    if (!index) return;
    for (const entry of Object.values(index.orders)) {
      const local = localMetaByNumber(entry.number);
      if (!local || newer(entry.updatedAt, local.updatedAt)) {
        await hydrateOrderByNumber(entry.number, { refresh: true });
      }
    }
  } catch (err) {
    console.error("[orders] Could not hydrate the order index:", err);
  } finally {
    lastFullHydrationAt = Date.now();
  }
}

/** Hydrate only the orders belonging to one customer (account order history). */
export async function hydrateOrdersForEmail(email: string): Promise<void> {
  if (orderStoreMode() === "off") return;
  const wanted = email.trim().toLowerCase();
  if (!wanted) return;
  if (Date.now() - lastFullHydrationAt < INDEX_TTL_MS) return;

  try {
    const index = await loadIndex();
    if (!index) return;
    for (const entry of Object.values(index.orders)) {
      if (entry.email !== wanted) continue;
      const local = localMetaByNumber(entry.number);
      if (!local || newer(entry.updatedAt, local.updatedAt)) {
        await hydrateOrderByNumber(entry.number, { refresh: true });
      }
    }
  } catch (err) {
    console.error(`[orders] Could not hydrate orders for ${wanted}:`, err);
  }
}
