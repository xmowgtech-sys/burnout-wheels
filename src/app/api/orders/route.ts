import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  adminListOrders,
  adminGetOrder,
  createOrderFromCheckout,
  notifyDiscordOrder,
  updateOrderStatus,
  updateTracking,
  updateShiprocket,
  archiveOrder,
  restoreOrder,
  deleteOrder,
  type StatusUpdate,
  type AdminOrderQuery,
} from "@/lib/orders";
import { requireApiUser, apiErrorResponse, rateLimit, ipOf } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

/** GET — admin order list with full filters. */
export async function GET(req: NextRequest) {
  try {
    await requireApiUser("orders.view");
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const order = adminGetOrder(id);
      if (!order) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ order });
    }

    const status = (req.nextUrl.searchParams.get("status") ?? "ALL") as OrderStatus | "ALL" | "ARCHIVED";
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const paymentMethod = req.nextUrl.searchParams.get("paymentMethod") ?? undefined;
    const paymentStatus = req.nextUrl.searchParams.get("paymentStatus") ?? undefined;
    const fulfilmentStatus = req.nextUrl.searchParams.get("fulfilmentStatus") ?? undefined;
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";

    const query: AdminOrderQuery = {
      status,
      q,
      paymentMethod,
      paymentStatus,
      fulfilmentStatus,
      includeArchived,
    };

    return Response.json({ orders: adminListOrders(query) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST — public checkout (with idempotency protection). */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`checkout:${ipOf(req)}`, 15, 10 * 60_000)) {
      return Response.json({ error: "Too many checkouts in a row — take a breath and retry in a minute." }, { status: 429 });
    }
    const body = await req.json();
    const result = createOrderFromCheckout(body);
    if (result.created !== false) await notifyDiscordOrder(result, body);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/customers");
    revalidatePath("/account");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json(result, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — status transitions, tracking, shiprocket, archive/restore. */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("orders.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const body = (await req.json()) as Partial<StatusUpdate> & {
      action?: "archive" | "restore" | "delete";
      trackingCarrier?: string;
      trackingNumber?: string;
      shiprocketOrderId?: string;
      shiprocketShipmentId?: string;
      shiprocketAwb?: string;
      shiprocketStatus?: string;
      shiprocketLabelUrl?: string;
    };

    if (body.action === "archive") {
      const order = archiveOrder(id, me.email);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order, message: "Order archived successfully" });
    }

    if (body.action === "restore") {
      const order = restoreOrder(id, me.email);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order, message: "Order restored successfully" });
    }

    if (body.to) {
      const order = updateOrderStatus(id, {
        to: body.to as OrderStatus,
        note: body.note,
        actor: me.email,
        trackingCarrier: body.trackingCarrier ?? undefined,
        trackingNumber: body.trackingNumber ?? undefined,
      });
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order });
    }

    if (
      body.shiprocketAwb !== undefined ||
      body.shiprocketOrderId !== undefined ||
      body.shiprocketStatus !== undefined ||
      body.shiprocketLabelUrl !== undefined
    ) {
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

/** DELETE ?id= — soft archive or hard delete (orders.manage). */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser("orders.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const hard = req.nextUrl.searchParams.get("hard") === "true";
    if (hard) {
      deleteOrder(id, me.email);
      revalidatePath(`/admin/orders`);
      return Response.json({ ok: true, message: "Order deleted permanently" });
    } else {
      const order = archiveOrder(id, me.email);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${id}`);
      return Response.json({ order, message: "Order archived" });
    }
  } catch (err) {
    return apiErrorResponse(err);
  }
}
