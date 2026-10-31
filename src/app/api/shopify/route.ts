import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getShopifyConfig, setShopifyConfig, fullSync, syncProducts, syncOrders, syncCustomers, syncInventory, WEBHOOK_TOPICS } from "@/lib/shopify";
import { logActivity } from "@/lib/analytics";

const cfgSchema = z.object({
  shopDomain: z.string().trim().regex(/^[\w-]+\.myshopify\.com/i, "Use your store's *.myshopify.com domain"),
  adminToken: z.string().min(10, "Paste the full Admin API access token"),
  webhookSecret: z.string().max(200).default(""),
  apiVersion: z.string().max(12).default("2024-10"),
});

/** POST — connect/replace Shopify credentials (settings.manage). */
export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser("settings.manage");
    const parsed = cfgSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid config" }, { status: 422 });
    setShopifyConfig({ ...parsed.data, apiVersion: parsed.data.apiVersion || "2024-10" });
    logActivity(me.email, "shopify", "config", "credentials connected");
    const topics = WEBHOOK_TOPICS.map(
      (t) => `${new URL(req.url).origin}/api/webhooks/shopify`
    );
    void topics;
    return Response.json({ ok: true, note: "Connected. Subscribe the webhook topics below in Shopify admin." });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE — disconnect without deleting synced rows. */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser("settings.manage");
    setShopifyConfig(null);
    logActivity(me.email, "shopify", "config", "disconnected");
    void new URL(req.url).origin;
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH { job } — run a single sync now (finance.view to see money, admin/owner to run). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("settings.manage");
    const { job } = (await req.json()) as { job: string };
    switch (job) {
      case "full": { const r = await fullSync(); return Response.json(r); }
      case "products": { const r = await syncProducts(); return Response.json(r); }
      case "orders": { const r = await syncOrders(); return Response.json(r); }
      case "customers": { const r = await syncCustomers(); return Response.json(r); }
      case "inventory": { const r = await syncInventory(); return Response.json(r); }
      default:
        return Response.json({ error: "Unknown sync job" }, { status: 422 });
    }
  } catch (err) {
    void can;
    return apiErrorResponse(err);
  }
}
