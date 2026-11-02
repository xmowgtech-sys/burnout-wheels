import { DatabaseSync, type StatementSync } from "node:sqlite";
import fs, { constants as fsConstants } from "node:fs";
import path from "node:path";
import { bootstrapStore } from "./bootstrap-data";

const globalStore = globalThis as unknown as { __bwDb?: DatabaseSync; __bwDirs?: { data: string; uploads: string; db: string } };

/** Resolve writable storage. Serverless platforms (Netlify/Lambda, Vercel) deploy a
 *  read-only app FS — SQLite and uploads must live in the only writable dir (/tmp).
 *  When running there, we copy the bundled DB (if any) or start empty and bootstrap. */
function resolveDirs() {
  if (globalStore.__bwDirs) return globalStore.__bwDirs;
  const bundled = path.join(process.cwd(), "data");
  let dataDir = process.env.BW_DATA_DIR ?? bundled;
  try {
    fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
    fs.accessSync(dataDir, fsConstants.W_OK);
    fs.accessSync(path.join(dataDir, "uploads"), fsConstants.W_OK);
  } catch {
    dataDir = path.join(process.env.TEMP ?? process.env.TMP ?? "/tmp", "burnout-wheels");
  }
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  const dirs = { data: dataDir, uploads: path.join(dataDir, "uploads"), db: path.join(dataDir, "burnout.db") };
  // Copy the bundled seed DB into ephemeral storage exactly once (demo content rides along).
  if (dirs.db !== path.join(bundled, "burnout.db") && !fs.existsSync(dirs.db) && fs.existsSync(path.join(bundled, "burnout.db"))) {
    try {
      fs.copyFileSync(path.join(bundled, "burnout.db"), dirs.db);
    } catch {
      // can't copy (e.g. bundled host) — bootstrap fills in below
    }
  }
  globalStore.__bwDirs = dirs;
  return dirs;
}

export const DATA_DIR = resolveDirs().data;
export const UPLOADS_DIR = resolveDirs().uploads;
export const DB_PATH = resolveDirs().db;

export function getDb(): DatabaseSync {
  if (globalStore.__bwDb) return globalStore.__bwDb;
  resolveDirs();
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 8000;");
  db.exec("PRAGMA foreign_keys = ON;");
  // Schema FIRST, then the empty check — on a fresh serverless database the
  // users table does not exist until migrate() runs; counting before it used
  // to throw "no such table: users" and took every page down on cold start.
  migrate(db);
  const empty = Number(db.prepare("SELECT COUNT(*) AS n FROM users").get()?.n ?? 0) === 0;
  if (empty) bootstrapStore(db);
  globalStore.__bwDb = db;
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(`    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'STAFF',
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT NOT NULL,
      scale TEXT,
      condition TEXT NOT NULL DEFAULT 'NEW',
      description TEXT NOT NULL DEFAULT '',
      highlights TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '',
      images TEXT NOT NULL DEFAULT '[]',
      imageFit TEXT NOT NULL DEFAULT 'cover',
      imagePosition TEXT NOT NULL DEFAULT 'center',
      priceSale INTEGER NOT NULL,
      priceCost INTEGER NOT NULL DEFAULT 0,
      feePercent REAL NOT NULL DEFAULT 2.0,
      stock INTEGER NOT NULL DEFAULT 0,
      lowStockThreshold INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      featured INTEGER NOT NULL DEFAULT 0,
      dropAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      phone TEXT,
      ordersCount INTEGER NOT NULL DEFAULT 0,
      lifetimeValue INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastOrderAt TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
      paymentMethod TEXT NOT NULL DEFAULT 'UPI',
      shippingMethod TEXT NOT NULL DEFAULT 'STANDARD',
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      addressLine TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      pincode TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'India',
      notes TEXT,
      subtotal INTEGER NOT NULL,
      discountTotal INTEGER NOT NULL DEFAULT 0,
      discountCode TEXT,
      shippingFee INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      costTotal INTEGER NOT NULL DEFAULT 0,
      feesTotal REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      trackingCarrier TEXT,
      trackingNumber TEXT,
      refundedAt TEXT,
      customerId INTEGER,
      placedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_placedAt ON orders(placedAt);
    CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

    CREATE TABLE IF NOT EXISTS orderItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      productId INTEGER,
      name TEXT NOT NULL,
      slug TEXT,
      condition TEXT,
      scale TEXT,
      image TEXT,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL DEFAULT 0,
      qty INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_orderItems_order ON orderItems(orderId);
    CREATE INDEX IF NOT EXISTS idx_orderItems_product ON orderItems(productId);

    CREATE TABLE IF NOT EXISTS orderEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      actor TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orderEvents_order ON orderEvents(orderId);

    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'PERCENT',
      value INTEGER NOT NULL DEFAULT 0,
      minSubtotal INTEGER NOT NULL DEFAULT 0,
      maxUses INTEGER NOT NULL DEFAULT 0,
      usedCount INTEGER NOT NULL DEFAULT 0,
      startsAt TEXT,
      endsAt TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(productId, status);

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'BOT',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversationId INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversationId);

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'newsletter',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visits (
      day TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activityLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      entity TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activityLog(createdAt);

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      passwordHash TEXT,
      googleId TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_google ON accounts(googleId);

    CREATE TABLE IF NOT EXISTS authTokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      kind TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      usedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_email ON authTokens(email, kind);

    CREATE TABLE IF NOT EXISTS mailLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toEmail TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mail_created ON mailLog(createdAt);

    CREATE TABLE IF NOT EXISTS opsEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'WEB',
      level TEXT NOT NULL DEFAULT 'INFO',
      type TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      meta TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ops_created ON opsEvents(createdAt);
    CREATE INDEX IF NOT EXISTS idx_ops_level ON opsEvents(level, createdAt);

    CREATE TABLE IF NOT EXISTS syncLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'shopify',
      job TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      items INTEGER NOT NULL DEFAULT 0,
      durationMs INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_created ON syncLogs(createdAt);
  `);

  ensureColumn(db, "orders", "source", "source TEXT NOT NULL DEFAULT 'LOCAL'");
  ensureColumn(db, "products", "source", "source TEXT NOT NULL DEFAULT 'LOCAL'");
  // Storefront framing controls — some photos are wide banners, some are tall box shots.
  ensureColumn(db, "products", "imageFit", "imageFit TEXT NOT NULL DEFAULT 'cover'");
  ensureColumn(db, "products", "imagePosition", "imagePosition TEXT NOT NULL DEFAULT 'center'");
  ensureColumn(db, "accounts", "phone", "phone TEXT");
  ensureColumn(db, "accounts", "picture", "picture TEXT");
  // Shop Pay express checkout needs each Shopify-sourced variant's numeric id.
  ensureColumn(db, "products", "shopifyVariantId", "shopifyVariantId TEXT");
}

function ensureColumn(db: DatabaseSync, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
}

export function run(stmt: StatementSync, ...params: unknown[]): { changes: number; id: number } {
  const res = stmt.run(...(params as Parameters<typeof stmt.run>));
  return { changes: Number(res.changes), id: Number(res.lastInsertRowid) };
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Run a set of writes atomically. Nested/parallel usage must be avoided. */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const out = fn();
    db.exec("COMMIT;");
    return out;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

/** BEGIN IMMEDIATE for read-then-write flows where earlier reads are part of the same transaction. */
export function beginWrite(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE;");
}
