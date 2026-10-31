import type { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

/**
 * POST — client telemetry sink with strict type whitelist + scrub + rate limit.
 * Stores paths and scrubbed messages only — never cookies, form inputs, or PII.
 * Funnel types carry a random session id in meta.sid for distinct counting.
 */

const ALLOWED_TYPES = new Set([
  "js_error", "resource_fail", "page_slow", "inp_slow",
  "flow_session_start", "flow_view", "flow_cart_add", "flow_checkout_start", "flow_order_placed",
  "drop_cart_abandoned", "drop_checkout_abandoned",
  "account_created", "account_verified",
]);

const schema = z.object({
  type: z.string().max(40),
  level: z.enum(["INFO", "WARN", "ERROR"]).default("INFO"),
  path: z.string().max(200).default(""),
  message: z.string().max(400).optional(),
  meta: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`track:${ipOf(req)}`, 120, 10 * 60_000)) return new Response(null, { status: 204 });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || !ALLOWED_TYPES.has(parsed.data.type)) return new Response(null, { status: 204 });

    const { type, level, path, message, meta } = parsed.data;
    logEvent({
      source: "WEB",
      level,
      type,
      path,
      message: message ?? "",
      meta: meta ? JSON.stringify(meta).slice(0, 400) : "",
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
