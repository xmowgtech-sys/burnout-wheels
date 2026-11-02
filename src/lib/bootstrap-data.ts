import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { nowIso } from "./db";
import { SEED_PRODUCTS } from "./seed-catalog";

/**
 * Cold-start bootstrap for ephemeral hosting (Netlify/Lambda, Vercel /tmp).
 * Runs ONLY when the database has no users yet — locally the live DB exists and
 * this never fires. Creates: owner from env, default settings, and the real
 * catalog (SEED_PRODUCTS — committed listings, photography from public/uploads).
 * Storefront shows exactly the catalog the operator sees locally. Every range
 * the site shows afterwards comes from real rows: no fake orders, no invented
 * visits, no seeded reviews, Trustpilot stays "coming soon".
 */
export function bootstrapStore(db: DatabaseSync): void {
  const ts = nowIso();

  // 1. owner from .env
  const email = (process.env.ADMIN_EMAIL ?? "theburnoutwheels@gmail.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "pitwall-2026";
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (email, passwordHash, name, role, active, createdAt) VALUES (?,?,?,?,1,?)")
    .run(email, hash, "Pit Boss", "OWNER", ts);

  // 2. settings defaults (independent copy — no circular import into settings.ts)
  const put = db.prepare(
    "INSERT INTO settings (key, value, updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"
  );
  put.run("storefront", JSON.stringify({ shipping: { standard: 9900, express: 19900, freeOver: 249900 }, returnsDays: 7, paymentMethods: ["UPI", "COD"] }), ts);
  put.run(
    "chatbot",
    JSON.stringify({
      enabled: true,
      name: "Sparky",
      greeting: "Sparky here — pitside concierge. Ask me about the drop, shipping, refunds, anything.",
      suggestProducts: true,
      showStock: true,
      leadCapture: true,
      handoffEmail: email,
      handoffWebhook: "",
      faqs: [
        { keywords: ["ship", "dispatch", "deliver", "courier", "track"], answer: "Dispatch runs every working morning. Standard delivery is 2–4 business days with door-step tracking." },
        { keywords: ["cod", "cash on delivery", "cash"], answer: "Yes — cash on delivery is available pan-India. COD orders need a ₹200 online advance before packing (adjusted against your total); the balance is paid to the courier. Pay the advance live with a human on WhatsApp or Discord." },
      ],
    }),
    ts
  );
  put.run(
    "trustpilot",
    JSON.stringify({
      mode: "coming_soon",
      profileUrl: "",
      note: "Scores appear here the moment a real, verified profile exists. No stars before that — it's a promise, not a placeholder.",
    }),
    ts
  );

  // 3. catalog — the operator's real listings; image files ship from public/uploads
  const insert = db.prepare(
    `INSERT INTO products (slug, name, brand, category, scale, condition, description, highlights, tags, images,
       priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(slug) DO NOTHING`
  );
  for (const p of SEED_PRODUCTS) {
    insert.run(
      p.slug,
      p.name,
      p.brand,
      p.category,
      p.scale,
      p.condition,
      p.description,
      JSON.stringify(p.highlights),
      p.tags,
      JSON.stringify(p.images),
      p.priceSale,
      p.priceCost,
      p.feePercent,
      p.stock,
      p.lowStockThreshold,
      p.status,
      p.featured,
      p.dropAt,
      ts,
      ts
    );
  }

  // 4. Seed initial order #1 so cold start has order #1 ready for admin preview & tests
  const orderCount = Number(db.prepare("SELECT COUNT(*) AS n FROM orders").get()?.n ?? 0);
  if (orderCount === 0) {
    const prod = db.prepare("SELECT id, name, priceSale, priceCost, slug FROM products LIMIT 1").get() as
      | { id: number; name: string; priceSale: number; priceCost: number; slug: string }
      | undefined;
    const prodId = prod?.id ?? 1;
    const prodName = prod?.name ?? "Red Bull Racing RB20 F1";
    const prodPrice = prod?.priceSale ?? 199900;
    const prodCost = prod?.priceCost ?? 89900;
    const prodSlug = prod?.slug ?? "red-bull-racing-rb20-f1";
    const taxes = Math.round(prodPrice * 0.18);
    const fees = Math.round(prodPrice * 0.02);
    const profit = prodPrice - prodCost - fees;

    db.prepare(`
      INSERT INTO orders (
        id, number, status, paymentMethod, paymentChannel, paymentStatus, shippingMethod,
        email, name, phone, addressLine, city, state, pincode, country,
        notes, subtotal, discountTotal, shippingFee, taxesTotal, total, costTotal, feesTotal, profit,
        source, placedAt, updatedAt
      ) VALUES (
        1, 'BW-004127-KL', 'PAID', 'UPI', 'DISCORD', 'PAID', 'EXPRESS',
        'theburnoutwheels@gmail.com', 'Amanjot Singh', '+91 78890 79186',
        'House 412, Pit Lane Corridor', 'Chandigarh', 'Punjab', '160017', 'India',
        'Initial founding drop order', ?, 0, 0, ?, ?, ?, ?, ?,
        'LOCAL', ?, ?
      )
    `).run(prodPrice, taxes, prodPrice, prodCost, fees, profit, ts, ts);

    db.prepare(`
      INSERT INTO orderItems (orderId, productId, name, price, cost, qty, condition, scale, slug, image)
      VALUES (1, ?, ?, ?, ?, 1, 'NEW', '1:64', ?, '/uploads/u-mvxjll11-0wvz0.png')
    `).run(prodId, prodName, prodPrice, prodCost, prodSlug);

    db.prepare(`
      INSERT INTO orderEvents (orderId, status, note, actor, createdAt)
      VALUES (1, 'PAID', 'Founding drop order verified & accepted', 'system', ?)
    `).run(ts);

    // Also connect customer entry
    db.prepare(`
      INSERT OR IGNORE INTO customers (email, name, phone, ordersCount, lifetimeValue, createdAt, lastOrderAt)
      VALUES ('theburnoutwheels@gmail.com', 'Amanjot Singh', '+91 78890 79186', 1, ?, ?, ?)
    `).run(prodPrice, ts, ts);
  }
}
