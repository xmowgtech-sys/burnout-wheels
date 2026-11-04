import { listProducts } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { orderStoreLabel, orderStoreMode } from "@/lib/order-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getDb();
    const count = listProducts({ status: "ACTIVE", limit: 1 }).length;
    return Response.json({
      ok: true,
      products: count,
      orderStore: orderStoreLabel(),
      durableOrders: orderStoreMode() !== "off",
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
