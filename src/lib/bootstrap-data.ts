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
       priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropNumber, rarity, dropAt, imageFit, imagePosition, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(slug) DO NOTHING`
  );
  SEED_PRODUCTS.forEach((p, index) => {
    const rarity = /\brare\b|\bunique\b/i.test(p.tags) ? "RARE" : "STANDARD";
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
      index + 1,
      rarity,
      p.dropAt,
      p.imageFit,
      p.imagePosition,
      ts,
      ts
    );
  });

  // 4. No demo orders. Every order in the Pit Wall must be a real checkout.
}
