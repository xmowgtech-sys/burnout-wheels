import type { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, ipOf } from "@/lib/auth";
import { getPayments, verifyRazorpaySignature, markOrderPaid } from "@/lib/razorpay";
import { logEvent } from "@/lib/ops";

/**
 * POST — Razorpay Checkout success handler. Verifies the HMAC signature against the
 * key secret BEFORE trusting anything, then flips the order to PAID with an event row.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`confirm:${ipOf(req)}`, 20, 10 * 60_000)) {
      return Response.json({ error: "Too many attempts — wait a minute." }, { status: 429 });
    }
    const parsed = z
      .object({
        number: z.string().min(4).max(40),
        razorpay_order_id: z.string().min(6).max(80),
        razorpay_payment_id: z.string().min(6).max(80),
        razorpay_signature: z.string().min(16).max(128),
      })
      .safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Incomplete payment response." }, { status: 422 });

    const cfg = getPayments();
    if (!cfg) return Response.json({ error: "Card/UPI gateway isn't configured." }, { status: 409 });

    const { number, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
    if (!verifyRazorpaySignature(cfg, razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      logEvent({ source: "API", level: "WARN", type: "payment", path: "/api/checkout/confirm", message: "Signature verification failed" });
      return Response.json({ error: "Payment signature failed verification — nothing was captured." }, { status: 400 });
    }

    const ok = markOrderPaid(number, razorpay_payment_id);
    if (!ok) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json({ ok: true, status: "PAID" });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/checkout/confirm", message: err instanceof Error ? err.message : "confirm crash" });
    return Response.json({ error: "Payment confirmation failed — the order stays pending until this clears." }, { status: 500 });
  }
}
