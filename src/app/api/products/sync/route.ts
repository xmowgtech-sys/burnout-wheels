import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb, nowIso } from "@/lib/db";
import { uniqueSlug } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { products?: Product[]; product?: Product; deletedSlugs?: string[] };
    const items = body.products || (body.product ? [body.product] : []);
    const deletedSlugs = Array.isArray(body.deletedSlugs) ? body.deletedSlugs.filter(Boolean) : [];

    const db = getDb();
    const ts = nowIso();
    let synced = 0;
    let deletedCount = 0;

    // 1. Process deletions across instances
    if (deletedSlugs.length > 0) {
      for (const slug of deletedSlugs) {
        db.prepare("INSERT OR REPLACE INTO deleted_products (slug, deletedAt) VALUES (?, ?)").run(slug, ts);
        const delRes = db.prepare("DELETE FROM products WHERE slug = ?").run(slug);
        if (delRes.changes > 0) deletedCount++;
      }
    }

    // 2. Process product creation/sync
    for (const p of items) {
      if (!p || !p.name) continue;
      const slugCandidate = (p.slug || p.name).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      
      // Never re-create a deleted product
      const isDeleted = db.prepare("SELECT 1 FROM deleted_products WHERE slug = ?").get(slugCandidate);
      if (isDeleted) continue;

      const existing = db.prepare("SELECT id FROM products WHERE slug = ? OR LOWER(name) = LOWER(?)").get(slugCandidate, p.name) as { id: number } | undefined;
      if (!existing) {
        const safeSlug = uniqueSlug(slugCandidate);
        db.prepare(`
          INSERT INTO products (
            slug, name, brand, category, scale, condition, description, highlights, tags, images, imageFit, imagePosition,
            priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          safeSlug,
          p.name,
          p.brand || null,
          p.category || "Rare Drops",
          p.scale || "1:64",
          p.condition || "NEW",
          p.description || `${p.name} — authentic collector piece.`,
          JSON.stringify(Array.isArray(p.highlights) ? p.highlights : []),
          Array.isArray(p.tags) ? p.tags.join(",") : String(p.tags || ""),
          JSON.stringify(Array.isArray(p.images) && p.images.length > 0 ? p.images : ["/uploads/u-mvxjll11-0wvz0.png"]),
          p.imageFit || "cover",
          p.imagePosition || "center",
          p.priceSale || 199900,
          p.priceCost || 0,
          p.feePercent || 2,
          p.stock || 10,
          p.lowStockThreshold || 3,
          p.status || "ACTIVE",
          p.featured ? 1 : 0,
          p.dropAt || null,
          p.createdAt || ts,
          ts
        );
        synced++;
      }
    }

    if (synced > 0 || deletedCount > 0) {
      revalidatePath("/shop");
      revalidatePath("/admin/products");
      revalidatePath("/");
    }

    return Response.json({ ok: true, synced, deleted: deletedCount }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
