import { type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { rateLimit, ipOf } from "@/lib/auth";
import { hydrateOrderByNumber, persistOrderByNumber } from "@/lib/order-store";

const schema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  channel: z.enum(["discord", "whatsapp"]),
});

/**
 * POST — remember which manual payment route the customer chose (Discord or
 * WhatsApp). Only unpaid orders can be switched; accepted orders are locked.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`channel:${ipOf(req)}`, 30, 10 * 60_000)) {
      return Response.json({ error: "Too many requests — wait a minute." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Invalid order or channel." }, { status: 422 });

    const db = getDb();
    const number = parsed.data.orderNumber.toUpperCase();
    const channel = parsed.data.channel === "whatsapp" ? "WHATSAPP" : "DISCORD";

    // The success page may be served by an instance that has never seen this
    // order. Recover it before trying to switch its payment route.
    await hydrateOrderByNumber(number);

    const order = db
      .prepare("SELECT id, status FROM orders WHERE UPPER(number) = ? LIMIT 1")
      .get(number) as { id: number; status: string } | undefined;

    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_REVIEW") {
      return Response.json({ error: "This order has already been processed." }, { status: 409 });
    }

    const ts = new Date().toISOString();
    db.prepare("UPDATE orders SET paymentChannel = ?, updatedAt = ? WHERE id = ?").run(channel, ts, order.id);
    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)").run(
      order.id,
      order.status,
      `Customer chose ${channel === "WHATSAPP" ? "WhatsApp" : "Discord #billing"} for payment`,
      "customer",
      ts
    );

    await persistOrderByNumber(number);

    return Response.json({ ok: true, channel });
  } catch (err) {
    console.error("[burnout] channel update failed:", err);
    return Response.json({ error: "Could not save the payment channel." }, { status: 500 });
  }
}
