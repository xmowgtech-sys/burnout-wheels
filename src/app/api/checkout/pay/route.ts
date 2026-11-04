import type { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, ipOf } from "@/lib/auth";
import { getPayments, findOrderForPayment, createRazorpayOrder } from "@/lib/razorpay";
import { hydrateOrderByNumber } from "@/lib/order-store";
import { logEvent } from "@/lib/ops";

/**
 * POST { number } — payment context for a freshly-placed order.
 * Razorpay configured → { gateway: "razorpay", keyId, razorpayOrderId, amount }.
 * Not configured → honest manual flow: { gateway: "manual", upiVpa, amount } — the
 * customer pays and the crew confirms, exactly like the old UPI-verify pipeline.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`pay:${ipOf(req)}`, 20, 10 * 60_000)) {
      return Response.json({ error: "Too many payment attempts — wait a minute." }, { status: 429 });
    }
    const parsed = z.object({ number: z.string().min(4).max(40) }).safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Order number required." }, { status: 422 });

    await hydrateOrderByNumber(parsed.data.number, { refresh: true });
    const order = findOrderForPayment(parsed.data.number);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "PENDING_PAYMENT") {
      return Response.json({ error: "This order isn't awaiting payment." }, { status: 409 });
    }

    const cfg = getPayments();
    if (!cfg) {
      return Response.json({ gateway: "manual", amount: order.total, upiVpa: "", note: "manual-upi" });
    }

    try {
      const razorpayOrderId = await createRazorpayOrder(cfg, order.total, order.number);
      return Response.json({ gateway: "razorpay", keyId: cfg.razorpayKeyId, razorpayOrderId, amount: order.total, name: order.name, email: order.email });
    } catch (err) {
      // Gateway hiccup → honest manual flow so checkout never dies.
      logEvent({ source: "API", level: "WARN", type: "api_fail", path: "/api/checkout/pay", message: `Razorpay order failed: ${err instanceof Error ? err.message : "unknown"}` });
      return Response.json({ gateway: "manual", amount: order.total, upiVpa: cfg.upiVpa, note: "gateway-down" });
    }
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/checkout/pay", message: err instanceof Error ? err.message : "pay crash" });
    return Response.json({ error: "Payment setup failed. Try again." }, { status: 500 });
  }
}
