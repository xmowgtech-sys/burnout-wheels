import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { getShopifyConfig } from "@/lib/shopify";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

const schema = z.object({
  productIds: z.array(z.number().int().positive()).max(50),
});

interface VariantRow {
  id: number;
  source: string | null;
  shopifyVariantId: string | null;
  status: string;
  stock: number;
  priceSale: number;
}

/**
 * POST — resolves cart product ids to Shopify variant ids for the Shop Pay
 * express button. Honest gating: `eligible` is true only when Shopify is
 * connected AND every requested ACTIVE product is a Shopify-sourced, in-stock
 * row with a real variant id. Never fabricates ids.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`shoppay:${ipOf(req)}`, 30, 10 * 60_000)) {
      return Response.json({ error: "Too many requests." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Invalid cart payload." }, { status: 422 });

    const cfg = getShopifyConfig();
    if (!cfg) return Response.json({ eligible: false, reason: "Shopify store not connected." });

    await ensureCatalogHydrated();
    const db = getDb();
    const stmt = db.prepare("SELECT id, source, shopifyVariantId, status, stock, priceSale FROM products WHERE id = ?");
    const variantIds: number[] = [];
    for (const id of parsed.data.productIds) {
      const row = stmt.get(id) as VariantRow | undefined;
      if (!row || row.status !== "ACTIVE" || row.source !== "SHOPIFY" || !row.shopifyVariantId || row.stock <= 0) {
        return Response.json({ eligible: false, reason: `Item ${id} is not a connected Shopify product.` });
      }
      variantIds.push(Number(row.shopifyVariantId));
    }
    if (variantIds.some((v) => !Number.isFinite(v) || v <= 0)) {
      return Response.json({ eligible: false, reason: "Variant ids unavailable for this cart." });
    }

    logEvent({ source: "API", level: "INFO", type: "flow", path: "/api/shop-pay/session", message: `Shop Pay express intent — ${variantIds.length} item(s)` });
    return Response.json({ eligible: true, storeDomain: cfg.shopDomain, variantIds });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/shop-pay/session", message: err instanceof Error ? err.message : "shop-pay crash" });
    return Response.json({ eligible: false, reason: "Shop Pay check failed." }, { status: 500 });
  }
}
