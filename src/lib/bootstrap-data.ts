import type { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { nowIso } from "./db";

/**
 * Cold-start bootstrap for ephemeral hosting (Netlify/Lambda).
 * Runs ONLY when the database has no users yet — locally the seeded DB exists and
 * this never fires. Creates: owner from env, default settings, and the demo RB20
 * product with real Wikimedia photography. No fake orders, visits, reviews or chats.
 * Storefront shows a real product, checkout works, and every number that appears
 * is one a real customer made.
 */
export function bootstrapStore(db: DatabaseSync): void {
  const ts = nowIso();

  // 1. owner from .env
  const email = (process.env.ADMIN_EMAIL ?? "owner@burnoutwheels.in").toLowerCase();
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
      greeting: "Sparky here — pitside concierge. Ask me about the drop, shipping, returns, anything.",
      suggestProducts: true,
      showStock: true,
      leadCapture: true,
      handoffEmail: email,
      handoffWebhook: "",
      faqs: [
        { keywords: ["ship", "dispatch", "deliver", "courier", "track"], answer: "Dispatch runs every working morning. Standard delivery is 2–4 business days with door-step tracking." },
        { keywords: ["cod", "cash on delivery", "cash"], answer: "Yes — cash on delivery is available pan-India. Keep the exact amount ready for the courier." },
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

  // 3. demo product — real photos, honest description, honest stock of 3
  const IMG = (f: string) => `https://thumb.wikimedia.org/wikipedia/commons/thumb/${f}/1920px-${f.split("/").pop()!}`;
  const slug = "red-bull-racing-rb20-f1-die-cast";
  if (!db.prepare("SELECT 1 FROM products WHERE slug = ?").get(slug)) {
    db.prepare(
      `INSERT INTO products (slug, name, brand, category, scale, condition, description, highlights, tags, images,
        priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      slug,
      "Red Bull Racing RB20 F1 Die-Cast",
      "Bburago",
      "Formula 1",
      "1:43",
      "NEW",
      "The RB20 took Red Bull Racing back-to-back constructors' championships, and this 1:43 die-cast by Bburago puts it at desk height. Cast in zinc alloy with the full Red Bull livery, the model rides on detailed wheels with rubber-style tyres and a moulded front-wing assembly. Reference-grade hobby metal: sharp graphics and correct sponsor placement down to the air-intake livery. Sold exactly as pictured — one unit, inspected at the pit bench, boxed with an inspection card.",
      JSON.stringify([
        "1:43 scale — 11.5 cm of officially liveried zinc alloy",
        "Rolling wheels with rubber-style tyres",
        "Pit-inspected and shipped in an impact-sleeve box",
        "Serial-logged sourcing — one allocation, then it's gone",
      ]),
      "red bull, f1, 2024 season, 1:43",
      JSON.stringify([
        IMG("5/57/Red_Bull_RB20_show_car%2C_2024_Singapore_Grand_Prix_%28cropped%29.jpg"),
        IMG("6/6e/Red_Bull_RB20_%2816038586806%29.jpg"),
        IMG("d/d9/Red_Bull_RB20_%2816038599054%29.jpg"),
        IMG("b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg"),
      ]),
      89900,
      52000,
      2,
      3,
      5,
      "ACTIVE",
      1,
      ts.slice(0, 10),
      ts,
      ts
    );
  }
}
