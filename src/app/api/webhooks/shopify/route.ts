import type { NextRequest } from "next/server";
import { getShopifyConfig, verifyWebhook, syncInventory } from "@/lib/shopify";
import { getDb, run, nowIso } from "@/lib/db";
import { logSync, logEvent } from "@/lib/ops";

/**
 * POST /api/webhooks/shopify — real-time events.
 * HMAC-verified against the raw body BEFORE any parsing. Unverified requests are
 * 401'd and logged. Handlers are idempotent upserts so.
 */
export async function POST(req: NextRequest) {
  const cfg = getShopifyConfig();
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!cfg || !cfg.webhookSecret || !verifyWebhook(raw, cfg.webhookSecret, hmac)) {
    logEvent({ source: "API", level: "WARN", type: "webhook", path: "/api/webhooks/shopify", message: "Rejected webhook — HMAC verification failed" });
    return new Response("Unauthorized", { status: 401 });
  }

  const topic = (req.headers.get("x-shopify-topic") ?? "").toLowerCase();
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    await handle(topic, cfg, body);
    logEvent({ source: "API", level: "INFO", type: "webhook", path: "/api/webhooks/shopify", message: `ok: ${topic}`, meta: `shop=${shopDomain}` });
    return new Response(null, { status: 200 });
  } catch (err) {
    logSync({ job: `webhook:${topic}`, status: "FAIL", detail: err instanceof Error ? err.message : "processing failed" });
    logEvent({ source: "API", level: "ERROR", type: "webhook", path: "/api/webhooks/shopify", message: `${topic} failed: ${err instanceof Error ? err.message : "unknown"}` });
    // 500 makes Shopify retry with backoff — exactly the behavior we want.
    return new Response("Processing failed", { status: 500 });
  }
}

async function handle(topic: string, cfg: Awaited<ReturnType<typeof getShopifyConfig>> & {}, body: Record<string, unknown>) {
  const db = getDb();
  const ts = nowIso();

  switch (topic) {
    case "products/create":
    case "products/update": {
      // Full image/desc sync is heavier than a webhook tick needs — refresh stock + price here.
      await syncInventory();
      break;
    }
    case "orders/create":
    case "orders/updated":
    case "orders/cancelled": {
      const orderId = body.id as number | undefined;
      const name = String(body.name ?? `SHOPIFY-${orderId}`);
      const financial = String(body.financial_status ?? "");
      const cancelled = Boolean(body.cancelled_at);
      const status = cancelled ? "CANCELLED" : financial === "paid" || financial === "partially_paid" ? "PAID" : "PENDING_PAYMENT";
      const stripe = Number(body.current_total_price ?? body.total_price ?? 0);
      const totalMinor = Math.round(stripe * 100);
      const subtotalMinor = Math.round(Number(body.current_subtotal_price ?? body.subtotal_price ?? 0) * 100);
      const hosp = db.prepare("SELECT id FROM orders WHERE number = ?").get(name) as { id: number } | undefined;
      if (hosp) {
        run(db.prepare("UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?"), status, ts, hosp.id);
        run(db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"), hosp.id, status, `Webhook ${topic}`, "shopify", ts);
      } else {
        // webhook before our poller saw the order: import it honestly with minimal fields
        const email = String((body.customer as { email?: string })?.email ?? "no-email@shopify.local").toLowerCase();
        const res = run(db.prepare(
          `INSERT INTO orders (number, status, paymentMethod, shippingMethod, email, name, subtotal, discountTotal, shippingFee, total, costTotal, feesTotal, profit, source, placedAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ), name, status, "UPI", "STANDARD", email, String((body.customer as { first_name?: string })?.first_name ?? "Shopify customer"),
        subtotalMinor, Math.round(Number(body.total_discounts ?? 0) * 100), 0, totalMinor, 0, Math.round(totalMinor * 0.02), totalMinor - Math.round(totalMinor * 0.02), "SHOPIFY",
        String(body.created_at ?? ts), ts);
        run(db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"), res.id, status, "Imported by webhook", "shopify", ts);
      }
      break;
    }
    case "refunds/create": {
      const order = body.order as { name?: string } | undefined;
      const number = String(order?.name ?? "");
      const row = db.prepare("SELECT id FROM orders WHERE number = ?").get(number) as { id: number } | undefined;
      if (row) {
        run(db.prepare("UPDATE orders SET status = 'REFUNDED', refundedAt = ?, updatedAt = ? WHERE id = ?"), ts, ts, row.id);
        run(db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"), row.id, "REFUNDED", "Refund received from Shopify", "shopify", ts);
      }
      break;
    }
    default:
      logEvent({ source: "API", level: "WARN", type: "webhook", path: "/api/webhooks/shopify", message: `Unknown topic: ${topic}` });
  }
}
