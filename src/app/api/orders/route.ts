import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { adminListOrders, adminGetOrder, createOrderFromCheckout, updateOrderStatus, updateTracking, updateShiprocket, type StatusUpdate } from "@/lib/orders";
import { requireApiUser, apiErrorResponse, rateLimit, ipOf } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

/** GET — admin order list ?status=&q=. */
export async function GET(req: NextRequest) {
  try {
    await requireApiUser("orders.view");
    const status = (req.nextUrl.searchParams.get("status") ?? "ALL") as OrderStatus | "ALL";
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const order = adminGetOrder(Number(id));
      if (!order) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ order });
    }
    return Response.json({ orders: adminListOrders({ status, q }) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST — public checkout. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`checkout:${ipOf(req)}`, 8, 10 * 60_000)) {
      return Response.json({ error: "Too many checkouts in a row — take a breath and retry in a minute." }, { status: 429 });
    }
    const body = await req.json();
    const result = createOrderFromCheckout(body);
    revalidatePath("/admin/orders");
    revalidatePath("/account");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json(result, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — status transitions / tracking (orders.manage). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("orders.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const body = (await req.json()) as Partial<StatusUpdate> & {
      trackingCarrier?: string;
      trackingNumber?: string;
      shiprocketOrderId?: string;
      shiprocketShipmentId?: string;
      shiprocketAwb?: string;
      shiprocketStatus?: string;
      shiprocketLabelUrl?: string;
    };

    if (body.to) {
      const order = updateOrderStatus(id, { to: body.to as OrderStatus, note: body.note, actor: me.email, trackingCarrier: body.trackingCarrier ?? undefined, trackingNumber: body.trackingNumber ?? undefined });
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order });
    }
    if (body.shiprocketAwb !== undefined || body.shiprocketOrderId !== undefined || body.shiprocketStatus !== undefined || body.shiprocketLabelUrl !== undefined) {
      const order = updateShiprocket(id, body, me.email);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order });
    }
    if (body.trackingCarrier !== undefined || body.trackingNumber !== undefined) {
      const order = updateTracking(id, body.trackingCarrier ?? "", body.trackingNumber ?? "", me.email);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order });
    }
    return Response.json({ error: "Nothing to update" }, { status: 422 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
