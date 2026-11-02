import type { NextRequest } from "next/server";
import { getShopifyConfig, verifyWebhook, handleWebhookTopic } from "@/lib/shopify";
import { logSync, logEvent } from "@/lib/ops";

/**
 * POST /api/webhooks/shopify — real-time events.
 * HMAC-verified against the raw body BEFORE any parsing. Unverified requests are
 * 401'd and logged. Handlers are idempotent upserts.
 */
export async function POST(req: NextRequest) {
  const cfg = getShopifyConfig();
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!cfg || !cfg.webhookSecret || !verifyWebhook(raw, cfg.webhookSecret, hmac)) {
    logEvent({
      source: "API",
      level: "WARN",
      type: "webhook",
      path: "/api/webhooks/shopify",
      message: "Rejected webhook — HMAC verification failed",
    });
    return new Response("Unauthorized", { status: 401 });
  }

  const topic = (req.headers.get("x-shopify-topic") ?? "").toLowerCase();
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    await handleWebhookTopic(topic, cfg, body);
    logEvent({
      source: "API",
      level: "INFO",
      type: "webhook",
      path: "/api/webhooks/shopify",
      message: `ok: ${topic}`,
      meta: `shop=${shopDomain}`,
    });
    return new Response(null, { status: 200 });
  } catch (err) {
    logSync({
      job: `webhook:${topic}`,
      status: "FAIL",
      detail: err instanceof Error ? err.message : "processing failed",
    });
    logEvent({
      source: "API",
      level: "ERROR",
      type: "webhook",
      path: "/api/webhooks/shopify",
      message: `${topic} failed: ${err instanceof Error ? err.message : "unknown"}`,
    });
    // 500 makes Shopify retry with backoff — exactly the behavior we want.
    return new Response("Processing failed", { status: 500 });
  }
}
