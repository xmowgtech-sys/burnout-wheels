#!/usr/bin/env node
/**
 * Burnout Wheels seed — idempotent.
 *   node scripts/seed.mjs            → schema + owner + RB20 product + settings
 *   node scripts/seed.mjs --fresh    → wipe DB first, then everything above
 *   node scripts/seed.mjs --no-demo  → skip demo orders/visits/conversations
 *
 * Demo data is CLEARY the only place orders/visits exist — reviews stay at zero
 * (no fake ratings), stock counts match real inventory, Trustpilot stays "coming soon".
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const DATA = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA, "burnout.db");
const FRESH = process.argv.includes("--fresh");
const NO_DEMO = process.argv.includes("--no-demo");

// load .env manually (no dotenv dependency)
try {
  const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* .env optional */ }

if (FRESH && fs.existsSync(DB_PATH)) {
  fs.rmSync(DB_PATH);
  for (const suffix of ["-wal", "-shm"]) {
    if (fs.existsSync(DB_PATH + suffix)) fs.rmSync(DB_PATH + suffix);
  }
  console.log("· dropped existing database");
}
fs.mkdirSync(path.join(DATA, "uploads"), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

/* ---------------- schema (mirrors src/lib/db.ts exactly) ---------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'STAFF', active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL, lastLoginAt TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    brand TEXT, category TEXT NOT NULL, scale TEXT, condition TEXT NOT NULL DEFAULT 'NEW',
    description TEXT NOT NULL DEFAULT '', highlights TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '',
    images TEXT NOT NULL DEFAULT '[]', priceSale INTEGER NOT NULL, priceCost INTEGER NOT NULL DEFAULT 0,
    feePercent REAL NOT NULL DEFAULT 2.0, stock INTEGER NOT NULL DEFAULT 0,
    lowStockThreshold INTEGER NOT NULL DEFAULT 3, status TEXT NOT NULL DEFAULT 'ACTIVE',
    featured INTEGER NOT NULL DEFAULT 0, dropAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT, phone TEXT,
    ordersCount INTEGER NOT NULL DEFAULT 0, lifetimeValue INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL, lastOrderAt TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    paymentMethod TEXT NOT NULL DEFAULT 'UPI', shippingMethod TEXT NOT NULL DEFAULT 'STANDARD',
    email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, addressLine TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '', pincode TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT 'India', notes TEXT, subtotal INTEGER NOT NULL,
    discountTotal INTEGER NOT NULL DEFAULT 0, discountCode TEXT, shippingFee INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL, costTotal INTEGER NOT NULL DEFAULT 0, feesTotal REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0, trackingCarrier TEXT, trackingNumber TEXT, refundedAt TEXT,
    customerId INTEGER, placedAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_placedAt ON orders(placedAt);
  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
  CREATE TABLE IF NOT EXISTS orderItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    productId INTEGER, name TEXT NOT NULL, slug TEXT, condition TEXT, scale TEXT, image TEXT,
    price INTEGER NOT NULL, cost INTEGER NOT NULL DEFAULT 0, qty INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_orderItems_order ON orderItems(orderId);
  CREATE INDEX IF NOT EXISTS idx_orderItems_product ON orderItems(productId);
  CREATE TABLE IF NOT EXISTS orderEvents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL, note TEXT, actor TEXT, createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orderEvents_order ON orderEvents(orderId);
  CREATE TABLE IF NOT EXISTS discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'PERCENT',
    value INTEGER NOT NULL DEFAULT 0, minSubtotal INTEGER NOT NULL DEFAULT 0, maxUses INTEGER NOT NULL DEFAULT 0,
    usedCount INTEGER NOT NULL DEFAULT 0, startsAt TEXT, endsAt TEXT, active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL, rating INTEGER NOT NULL, title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(productId, status);
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sessionId TEXT NOT NULL UNIQUE, email TEXT, name TEXT,
    status TEXT NOT NULL DEFAULT 'BOT', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, conversationId INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversationId);
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, source TEXT NOT NULL DEFAULT 'newsletter', createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visits (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS activityLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL DEFAULT 'system', action TEXT NOT NULL,
    entity TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activityLog(createdAt);
`);

const now = () => new Date().toISOString();
const daysAgo = (d, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 24 % 60, 0, 0);
  return t.toISOString();
};

/* ---------------- owner from .env ---------------- */
const OWNER_EMAIL = (process.env.ADMIN_EMAIL ?? "owner@burnoutwheels.in").toLowerCase();
const OWNER_PASSWORD = process.env.ADMIN_PASSWORD ?? "pitwall-2026";
const hash = bcrypt.hashSync(OWNER_PASSWORD, 12);

if (!db.prepare("SELECT 1 FROM users WHERE LOWER(email) = ?").get(OWNER_EMAIL)) {
  db.prepare("INSERT INTO users (email, passwordHash, name, role, active, createdAt) VALUES (?,?,?,?,1,?)")
    .run(OWNER_EMAIL, hash, "Pit Boss", "OWNER", now());
  console.log(`· owner created: ${OWNER_EMAIL}`);
} else {
  console.log("· owner already exists (password unchanged)");
}

/* ---------------- setting keys ---------------- */
const putSetting = (key, value) =>
  db.prepare("INSERT INTO settings (key, value, updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt")
    .run(key, JSON.stringify(value), now());

putSetting("storefront", {
  shipping: { standard: 9900, express: 19900, freeOver: 249900 },
  returnsDays: 7,
  paymentMethods: ["UPI", "COD"],
});
putSetting("trustpilot", {
  mode: "coming_soon",
  profileUrl: "",
  note: "Scores appear here the moment a real, verified profile exists. No stars before that — it's a promise, not a placeholder.",
});
console.log("· settings written");

/* ---------------- RB20 product ---------------- */
const IMG = (file) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/${file}/1920px-${file.split("/").pop()}`;

const IMAGES = [
  // show-car front three-quarter (PDP primary)
  IMG("5/57/Red_Bull_RB20_show_car%2C_2024_Singapore_Grand_Prix_%28cropped%29.jpg"),
  // museum front view
  IMG("6/6e/Red_Bull_RB20_%2816038586806%29.jpg"),
  // museum rear view
  IMG("d/d9/Red_Bull_RB20_%2816038599054%29.jpg"),
  // track action shot
  IMG("b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg"),
];

const DESCRIPTION =
  "The RB20 is the car that took Red Bull Racing back-to-back constructors' championships, and this 1:43 die-cast by Bburago puts it at desk height. Cast in zinc alloy with the superb Red Bull livery applied, the model rides on detailed wheels with rolling rubber-style tyres and a moulded front-wing assembly. This is reference-grade hobby metal: sharp decals, correct sponsor placement down to the air-intake livery, and an authentic finish. Sold exactly as pictured — one unit, inspected at the pit bench, boxed with an inspection card. When the shelf allocation runs out, it's gone until the next one is sourced.";

if (db.prepare("SELECT 1 FROM products WHERE slug = ?").get("red-bull-racing-rb20-f1-die-cast")) {
  console.log("· RB20 product already seeded");
} else {
  db.prepare(
    `INSERT INTO products (slug, name, brand, category, scale, condition, description, highlights, tags, images,
      priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    "red-bull-racing-rb20-f1-die-cast",
    "Red Bull Racing RB20 F1 Die-Cast",
    "Bburago",
    "Formula 1",
    "1:43",
    "NEW",
    DESCRIPTION,
    JSON.stringify([
      "1:43 scale — 11.5 cm of officially liveried zinc alloy",
      "Rolling wheels with rubber-style tyres",
      "Sharp sponsor decals down to the intake livery",
      "Pit-inspected and shipped in a impact-sleeve box",
      "Serial-logged sourcing — one allocation, then it's gone",
    ]),
    "red bull, f1, 2024 season, max verstappen era, 1:43",
    JSON.stringify(IMAGES),
    89900, // ₹899
    52000, // ₹520 landed cost
    2,     // 2% payment fees
    3,     // stock (3 units, matches demoed solds story - 2 demo orders came from earlier batches)
    5,     // low stock threshold → warns on shelf
    "ACTIVE",
    1,
    daysAgo(7),
    now(), now()
  );
  console.log("· RB20 product created");
}

if (!db.prepare("SELECT 1 FROM discounts WHERE code = ?").get("WELCOME10")) {
  db.prepare("INSERT INTO discounts (code, type, value, minSubtotal, maxUses, active, createdAt) VALUES (?,?,?,?,?,1,?)")
    .run("WELCOME10", "PERCENT", 10, 99900, 0, now());
  console.log("· WELCOME10 discount created");
}

/* ---------------- demo data (optional) ---------------- */
if (!NO_DEMO) {
  const product = db.prepare("SELECT id, images FROM products WHERE slug = ?").get("red-bull-racing-rb20-f1-die-cast");
  if (product) {
    const image0 = JSON.parse(product.images)[0] ?? "";
    const unitCost = 52000;
    const fee = 2;

    // 6 realistic orders across ~5 months. Totals are computed exactly the way
    // checkout computes them (subtotal - discount + shipping), profit = line math.
    const DEMOS = [
      { months: 4.5, qty: 2, status: "DELIVERED", method: "UPI",   name: "Rhea Menon",  email: "rhea.m@example.in",  city: "Bengaluru", state: "Karnataka" },
      { months: 3.8, qty: 1, status: "DELIVERED", method: "COD",   name: "Aditya Rao",  email: "aditya.rao@example.in", city: "Hyderabad", state: "Telangana" },
      { months: 2.9, qty: 1, status: "DELIVERED", method: "UPI",   name: "Sana Kapoor", email: "sana.kap@example.in",  city: "Mumbai",    state: "Maharashtra" },
      { months: 1.7, qty: 1, status: "SHIPPED",   method: "UPI",   name: "Vikram Shah", email: "vik.shah@example.in",  city: "Pune",      state: "Maharashtra" },
      { months: 0.6, qty: 1, status: "PACKING",   method: "UPI",   name: "Neha Dutta",  email: "neha.dutta@example.in", city: "Kolkata",   state: "West Bengal" },
      { months: 0.1, qty: 1, status: "PENDING_PAYMENT", method: "UPI", name: "Arjun Pillai", email: "arjun.p@example.in",  city: "Kochi",     state: "Kerala" },
    ];

    const insertOrder = db.prepare(
      `INSERT INTO orders (number, status, paymentMethod, shippingMethod, email, name, phone, addressLine, city, state,
        pincode, country, notes, subtotal, discountTotal, discountCode, shippingFee, total, costTotal, feesTotal, profit,
        trackingCarrier, trackingNumber, refundedAt, customerId, placedAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    const insertItem = db.prepare(
      "INSERT INTO orderItems (orderId, productId, name, slug, condition, scale, image, price, cost, qty) VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    const insertEvent = db.prepare(
      "INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"
    );
    const upsertCustomer = db.prepare(
      `INSERT INTO customers (email, name, ordersCount, lifetimeValue, createdAt, lastOrderAt) VALUES (?,?,?,?,?,?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name, ordersCount = ordersCount + excluded.ordersCount,
         lifetimeValue = lifetimeValue + excluded.lifetimeValue, lastOrderAt = excluded.lastOrderAt`
    );

    let seq = 4127;
    for (const d of DEMOS) {
      const placedAt = new Date();
      placedAt.setMonth(placedAt.getMonth() - Math.floor(d.months));
      placedAt.setDate(Math.max(1, placedAt.getDate() - Math.floor((d.months % 1) * 28)));
      placedAt.setHours(9 + Math.floor(seq % 5), 12, 0, 0);

      const subtotal = 89900 * d.qty;
      const shippingFee = subtotal >= 249900 ? 0 : 9900;
      const total = subtotal + shippingFee;
      const costTotal = unitCost * d.qty;
      const feesTotal = Math.round(subtotal * (fee / 100));
      const profit = subtotal - costTotal - feesTotal;

      const number = `BW-${seq.toString().padStart(6, "0")}-${["KR", "TS", "MH", "MH", "WB", "KL"][seq % 6]}`;
      seq += 1;

      const customerId = db.prepare("SELECT id FROM customers WHERE email = ?").get(d.email)?.id ?? null;
      const res = insertOrder.run(
        number, d.status, d.method, "STANDARD", d.email, d.name,
        `+91 98100000${seq % 100}`, `${seq - 4100} Indiranagar, 12th Main`, d.city, d.state,
        `5600${seq % 10}`, "India", null,
        subtotal, 0, null, shippingFee, total, costTotal, feesTotal, profit,
        d.status === "SHIPPED" || d.status === "DELIVERED" ? "Delhivery" : null,
        d.status === "SHIPPED" || d.status === "DELIVERED" ? `DLV${seq * 137}` : null,
        null, customerId, placedAt.toISOString(), placedAt.toISOString()
      );
      const orderId = Number(res.lastInsertRowid);

      insertItem.run(orderId, product.id, "Red Bull Racing RB20 F1 Die-Cast", "red-bull-racing-rb20-f1-die-cast", "NEW", "1:43", image0, 89900, unitCost, d.qty);

      const flow = {
        PENDING_PAYMENT: ["PLACED_AS_PENDING_PAYMENT"],
        PACKING: ["PLACED_AS_PENDING_PAYMENT", "PAID", "PACKING"],
        SHIPPED: ["PLACED_AS_PENDING_PAYMENT", "PAID", "PACKING", "SHIPPED"],
        DELIVERED: ["PLACED_AS_PENDING_PAYMENT", "PAID", "PACKING", "SHIPPED", "DELIVERED"],
      }[d.status] ?? ["PLACED_AS_PENDING_PAYMENT"];
      flow.forEach((s, i) => {
        const t = new Date(placedAt).setMinutes(new Date(placedAt).getMinutes() + i * 37);
        insertEvent.run(orderId, s, null, "system", new Date(t).toISOString());
      });

      upsertCustomer.run(d.email, d.name, d.qty, total, placedAt.toISOString(), placedAt.toISOString());
    }
    console.log(`· ${DEMOS.length} demo orders + customers written`);
  }

  // visits — organic-ish curve over 90 days
  const hasVisits = db.prepare("SELECT 1 FROM visits LIMIT 1").get();
  if (!hasVisits) {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const insVisit = db.prepare("INSERT OR REPLACE INTO visits (day, count) VALUES (?,?)");
    for (let i = 89; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const weight = i > 60 ? 0.4 : i > 30 ? 0.75 : 1.0;
      const base = Math.round((8 + rnd() * 18) * weight);
      insVisit.run(day.toISOString().slice(0, 10), base);
    }
    console.log("· 90 days of visits written");
  }

  }

const counts = ["users", "products", "orders", "reviews", "visits", "settings"].map((t) => `${t}:${db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n}`);
console.log("· seed complete →", counts.join(" "));
db.close();
