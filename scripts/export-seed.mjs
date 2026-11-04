// Export the active products from the local SQLite database into the
// deployment seed file. Run with: npm run seed:export
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dbPath = process.env.BW_DB_PATH ?? path.join(root, "data", "burnout.db");
const outPath = path.join(root, "src", "lib", "seed-catalog.ts");

const db = new DatabaseSync(dbPath);
const rows = db
  .prepare(
    `SELECT slug, name, brand, category, scale, condition, description, highlights, tags, images,
            priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt,
            imageFit, imagePosition
     FROM products
     WHERE status = 'ACTIVE'
     ORDER BY id`
  )
  .all();

const parseArray = (value) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Uploaded files are copied to public/uploads so they ship with the deployment.
// /api/files/... only works while the serverless /tmp upload survives; the
// static /uploads/... URL is served straight from the deployment's public dir.
const toPublicUrl = (url) =>
  typeof url === "string" && url.startsWith("/api/files/")
    ? `/uploads/${url.slice("/api/files/".length)}`
    : url;

const products = rows.map((row) => ({
  slug: row.slug,
  name: row.name,
  brand: row.brand ?? null,
  category: row.category,
  scale: row.scale ?? null,
  condition: row.condition,
  description: row.description ?? "",
  highlights: parseArray(row.highlights),
  tags: row.tags ?? "",
  images: parseArray(row.images).map(toPublicUrl),
  priceSale: Number(row.priceSale),
  priceCost: Number(row.priceCost),
  feePercent: Number(row.feePercent),
  stock: Number(row.stock),
  lowStockThreshold: Number(row.lowStockThreshold),
  status: row.status,
  featured: Number(row.featured),
  dropAt: row.dropAt ?? null,
  imageFit: row.imageFit ?? "contain",
  imagePosition: row.imagePosition ?? "center",
}));

// Copy every local product photo into public/uploads so it ships with the
// deployment. Admin uploads live in data/uploads (gitignored); the seed points
// at /uploads/... which is served statically by Vercel from public/uploads.
const uploadsDir = path.join(root, "data", "uploads");
const publicUploadsDir = path.join(root, "public", "uploads");
fs.mkdirSync(publicUploadsDir, { recursive: true });

const localImages = [
  ...new Set(
    products.flatMap((product) =>
      product.images.filter((image) => typeof image === "string" && image.startsWith("/uploads/"))
    )
  ),
];

let synced = 0;
const missing = [];
for (const image of localImages) {
  const name = image.slice("/uploads/".length);
  const source = path.join(uploadsDir, name);
  const destination = path.join(publicUploadsDir, name);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destination);
    synced += 1;
  } else if (!fs.existsSync(destination)) {
    missing.push(name);
  }
}

const header = `// Cold-start catalog seed — generated from the operator's real product catalog.
// Only active, authentic products are included. Demo/placeholder items removed.
// Regenerate with: npm run seed:export
export type SeedProduct = {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  scale: string | null;
  condition: string;
  description: string;
  highlights: string[];
  tags: string;
  images: string[];
  priceSale: number;
  priceCost: number;
  feePercent: number;
  stock: number;
  lowStockThreshold: number;
  status: string;
  featured: number;
  dropAt: string | null;
  imageFit: string;
  imagePosition: string;
};

export const SEED_PRODUCTS: SeedProduct[] = `;

fs.writeFileSync(outPath, header + JSON.stringify(products, null, 2) + ";\n", "utf8");
console.log(`Wrote ${products.length} products to ${path.relative(root, outPath)}`);
console.log(`Synced ${synced} product photo(s) into public/uploads`);
if (missing.length > 0) {
  console.warn(`WARNING: ${missing.length} referenced photo(s) are missing from both data/uploads and public/uploads:`);
  for (const name of missing) console.warn(` - ${name}`);
}
for (const product of products) {
  console.log(` - ${product.slug}  INR ${product.priceSale / 100} / cost ${product.priceCost / 100}`);
}
