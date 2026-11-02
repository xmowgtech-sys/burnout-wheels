import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { syncOrderToDb } from "@/lib/orders";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import type { OrderWithRelations } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    await requireApiUser("orders.manage");
    const body = (await req.json()) as { order?: Partial<OrderWithRelations>; orders?: Partial<OrderWithRelations>[] };

    if (body.order) {
      const order = syncOrderToDb(body.order);
      revalidatePath("/admin/orders");
      revalidatePath(`/admin/orders/${order.id}`);
      return Response.json({ ok: true, order }, { status: 200 });
    }

    if (Array.isArray(body.orders)) {
      const results = body.orders.map((o) => {
        try {
          return syncOrderToDb(o);
        } catch {
          return null;
        }
      }).filter(Boolean);
      revalidatePath("/admin/orders");
      return Response.json({ ok: true, synced: results.length, orders: results }, { status: 200 });
    }

    return Response.json({ error: "order or orders array required" }, { status: 400 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
