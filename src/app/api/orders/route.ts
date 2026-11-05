import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  adminListOrders,
  adminGetOrder,
  adminFindOrderExact,
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
import {
  hydrateAllOrders,
  hydrateOrderByIdempotencyKey,
  hydrateOrderByNumber,
  persistOrderByNumber,
  persistOrderSnapshot,
  removeOrderSnapshot,
} from "@/lib/order-store";
import { ensureCatalogHydrated, persistCatalogSnapshot } from "@/lib/catalog-store";
import {
  RECOVERY_COOKIE_MAX_AGE,
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_PATH,
  sealOrderRecovery,
} from "@/lib/order-recovery";

/** GET — admin order list with full filters. */
export async function GET(req: NextRequest) {
  try {
    await requireApiUser("orders.view");
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      await hydrateOrderByNumber(id, { refresh: true });
      const order = adminGetOrder(id);
      if (!order) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ order });
    }

    // The admin table polls every few seconds. Hydrate on a short TTL unless the
    // operator pressed Refresh — this keeps Blob reads inside the free tier.
    await hydrateAllOrders({ force: req.nextUrl.searchParams.get("fresh") === "1" });

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
    // A checkout can land on an instance that has never served the storefront.
    // Recover the current catalog (including live-added products) before
    // resolving the cart.
    await ensureCatalogHydrated();
    const body = await req.json();

    // A retry can land on a serverless instance that never saw the original
    // insert. Recover the existing order by its idempotency key before the
    // checkout code decides whether to create a duplicate.
    if (typeof body?.idempotencyKey === "string") {
      await hydrateOrderByIdempotencyKey(body.idempotencyKey);
    }

    const result = createOrderFromCheckout(body);
    const fullOrder = adminGetOrder(result.number);
    await persistOrderByNumber(result.number);
    // Stock was reserved above. Save the new counts so another instance does
    // not resurrect the old stock level on the next cold start.
    if (result.created !== false) await persistCatalogSnapshot();
    if (result.created !== false) await notifyDiscordOrder(result, body, fullOrder);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/customers");
    revalidatePath("/account");
    revalidatePath("/shop");
    revalidatePath("/");

    const response = NextResponse.json(result, { status: 201 });
    // Even if Blob is unavailable or the redirect beats the write, the browser
    // can show the real confirmation page from this encrypted, HttpOnly cookie.
    const recovery = fullOrder ? sealOrderRecovery(fullOrder) : null;
    if (recovery) {
      response.cookies.set(RECOVERY_COOKIE_NAME, recovery, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: RECOVERY_COOKIE_PATH,
        maxAge: RECOVERY_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — status transitions, tracking, shiprocket, archive/restore. */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("orders.manage");
    const ref = req.nextUrl.searchParams.get("id");
    if (!ref) return Response.json({ error: "id required" }, { status: 400 });

    // Admin links use the stable order number. Recover the order into this
    // instance (and refresh it if another instance changed it) before writing.
    await hydrateOrderByNumber(ref, { refresh: true });
    const target = adminFindOrderExact(ref);
    if (!target) return Response.json({ error: "Order not found" }, { status: 404 });
    const id = target.id;
    const orderNumber = target.number;

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
      await persistOrderSnapshot(order);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${orderNumber}`);
      return Response.json({ order, message: "Order archived successfully" });
    }

    if (body.action === "restore") {
      const order = restoreOrder(id, me.email);
      await persistOrderSnapshot(order);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${orderNumber}`);
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
      // Cancelling puts stock back on the shelf; persist the new counts.
      if (body.to === "CANCELLED") {
        await ensureCatalogHydrated({ force: true });
        await persistCatalogSnapshot();
      }
      await persistOrderSnapshot(order);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${orderNumber}`);
      return Response.json({ order });
    }

    if (
      body.shiprocketAwb !== undefined ||
      body.shiprocketOrderId !== undefined ||
      body.shiprocketStatus !== undefined ||
      body.shiprocketLabelUrl !== undefined
    ) {
      const order = updateShiprocket(id, body, me.email);
      await persistOrderSnapshot(order);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${orderNumber}`);
      return Response.json({ order });
    }

    if (body.trackingCarrier !== undefined || body.trackingNumber !== undefined) {
      const order = updateTracking(id, body.trackingCarrier ?? "", body.trackingNumber ?? "", me.email);
      await persistOrderSnapshot(order);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${orderNumber}`);
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
    const ref = req.nextUrl.searchParams.get("id");
    if (!ref) return Response.json({ error: "id required" }, { status: 400 });

    await hydrateOrderByNumber(ref, { refresh: true });
    const target = adminFindOrderExact(ref);
    if (!target) return Response.json({ error: "Order not found" }, { status: 404 });
    const id = target.id;

    const hard = req.nextUrl.searchParams.get("hard") === "true";
    if (hard) {
      deleteOrder(id, me.email);
      await removeOrderSnapshot(target.number);
      revalidatePath(`/admin/orders`);
      return Response.json({ ok: true, message: "Order deleted permanently" });
    } else {
      const order = archiveOrder(id, me.email);
      await persistOrderSnapshot(order);
      revalidatePath(`/admin/orders`);
      revalidatePath(`/admin/orders/${target.number}`);
      return Response.json({ order, message: "Order archived" });
    }
  } catch (err) {
    return apiErrorResponse(err);
  }
}
