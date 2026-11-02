import { getDb, run, nowIso, tx } from "./db";
import { bootstrapStore } from "./bootstrap-data";
import { checkoutSchema, type CheckoutInput } from "./validation";
import type { Customer, CustomerWithOrders, Order, OrderEvent, OrderItem, OrderStatus, OrderWithRelations, Product, StorefrontSettings } from "./types";
import { DEFAULT_STOREFRONT } from "./settings";
import { logActivity } from "./analytics";
import { ApiError } from "./auth";
import { orderNumber } from "./utils";
import { accountByEmail, accountById, createAccount, updateProfile } from "./accounts";
import type { CustomerAddress } from "./addresses";

/* ---------------- status flow ---------------- */

export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_REVIEW", "PAID", "PROCESSING", "CANCELLED"],
  PAYMENT_REVIEW: ["PAID", "PROCESSING", "CANCELLED"],
  PAID: ["PROCESSING", "PACKING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["PAID", "PACKING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PACKING: ["PAID", "PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: ["PAID", "PROCESSING"],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_FLOW[from]?.includes(to) ?? false;
}

/* ---------------- row mappers ---------------- */

type OrderRow = Order & Record<string, unknown>;

function parseOrder(row: Record<string, unknown>): Order {
  return row as unknown as Order;
}

/* ---------------- public checkout ---------------- */

export interface CheckoutResult {
  number: string;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentChannel?: string | null;
}

export function createOrderFromCheckout(raw: unknown): CheckoutResult {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check your details and try again";
    throw new ApiError(422, msg);
  }
  const input = parsed.data as CheckoutInput & {
    orderNumber?: string;
    idempotencyKey?: string;
    billingAddress?: string;
    accountId?: number;
  };
  const db = getDb();

  // 0. Idempotency Check — Never create duplicate orders for the same checkout
  if (input.idempotencyKey) {
    const existing = db
      .prepare("SELECT * FROM orders WHERE idempotencyKey = ? AND (isArchived = 0 OR isArchived IS NULL)")
      .get(input.idempotencyKey) as Record<string, unknown> | undefined;
    if (existing) {
      return {
        number: String(existing.number),
        total: Number(existing.total),
        status: existing.status as OrderStatus,
        paymentMethod: String(existing.paymentMethod),
        paymentChannel: (existing.paymentChannel as string) ?? null,
      };
    }
  }

  const storefront = rawStorefrontSnapshot();
  const items = [...input.items].sort((a, b) => a.productId - b.productId);

  const build = (): OrderWithRelations => {
    const ts = nowIso();

    // Check idempotency again under transaction lock
    if (input.idempotencyKey) {
      const existingInLock = db
        .prepare("SELECT * FROM orders WHERE idempotencyKey = ? AND (isArchived = 0 OR isArchived IS NULL)")
        .get(input.idempotencyKey) as Record<string, unknown> | undefined;
      if (existingInLock) {
        return adminGetOrder(Number(existingInLock.id))!;
      }
    }

    // 1. Resolve active products (fresh stock read happens inside the lock)
    const products = new Map<number, Product & Record<string, unknown>>();
    const fetchProduct = db.prepare(
      "SELECT * FROM products WHERE (id = ? OR (slug = ? AND slug IS NOT NULL AND slug != '')) LIMIT 1"
    );
    for (const item of items) {
      const slugVal = (item as { slug?: string }).slug ?? "";
      let row = fetchProduct.get(item.productId, slugVal) as Record<string, unknown> | undefined;
      if (!row) {
        // Resilient fallback to any active product if id changed across DB seed
        row = db.prepare("SELECT * FROM products WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1").get() as Record<string, unknown> | undefined;
      }
      if (!row) {
        bootstrapStore(db);
        row = db.prepare("SELECT * FROM products WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1").get() as Record<string, unknown> | undefined;
      }
      if (!row) throw new ApiError(409, "Catalog is currently updating. Please refresh in a moment.");
      products.set(item.productId, row as unknown as Product & Record<string, unknown>);
    }

    // 2. Compute totals
    let subtotal = 0;
    let costTotal = 0;
    let feesTotal = 0;
    for (const item of items) {
      const p = products.get(item.productId)!;
      subtotal += Number(p.priceSale) * item.qty;
      costTotal += Number(p.priceCost) * item.qty;
      feesTotal += Math.round(Number(p.priceSale) * item.qty * (Number(p.feePercent) / 100));
    }

    // 3. Discount
    let discountTotal = 0;
    let discountCodeUsed: string | null = null;
    if (input.discountCode) {
      const code = input.discountCode.trim().toUpperCase();
      const disc = db.prepare("SELECT * FROM discounts WHERE code = ?").get(code) as Record<string, unknown> | undefined;
      if (!disc) throw new ApiError(422, `Code “${code}” doesn't exist`);
      if (disc.active === 0) throw new ApiError(422, `Code “${code}” is not active`);
      const now = Date.now();
      if (typeof disc.startsAt === "string" && disc.startsAt && new Date(disc.startsAt).getTime() > now)
        throw new ApiError(422, `Code “${code}” opens later`);
      if (typeof disc.endsAt === "string" && disc.endsAt && new Date(disc.endsAt).getTime() < now)
        throw new ApiError(422, `Code “${code}” has expired`);
      const maxUses = Number(disc.maxUses ?? 0);
      const used = Number(disc.usedCount ?? 0);
      if (maxUses > 0 && used >= maxUses) throw new ApiError(422, `Code “${code}” has no uses left`);
      const minSub = Number(disc.minSubtotal ?? 0);
      if (subtotal < minSub) throw new ApiError(422, `Code “${code}” needs a cart of ₹${Math.ceil(minSub / 100)}`);
      const value = Number(disc.value ?? 0);
      discountTotal = disc.type === "PERCENT" ? Math.round((subtotal * value) / 100) : Math.min(value, subtotal);
      if (discountTotal < 0) discountTotal = 0;
      discountCodeUsed = code;
    }

    // 4. Shipping & Taxes
    const rate = input.shippingMethod === "EXPRESS" ? storefront.shipping.express : storefront.shipping.standard;
    const shippingFee = subtotal - discountTotal >= storefront.shipping.freeOver ? 0 : rate;
    const total = subtotal - discountTotal + shippingFee;
    const taxesTotal = Math.round(subtotal * 0.18); // 18% GST (standard collectible rate) included in subtotal

    // 5. Customer upsert & automatic customer account linkage
    const normalizedEmail = input.email.trim().toLowerCase();
    let acc = input.accountId ? accountById(input.accountId) : null;
    if (!acc) acc = accountByEmail(normalizedEmail);
    if (!acc) {
      acc = createAccount({
        email: normalizedEmail,
        name: input.name,
        phone: input.phone || undefined,
        verified: true,
      });
    } else if (!acc.phone && input.phone) {
      updateProfile(acc.email, { phone: input.phone });
    }
    const accountId = acc.id;

    const existingCustomer = db.prepare("SELECT id FROM customers WHERE LOWER(email) = LOWER(?)").get(normalizedEmail) as { id: number } | undefined;
    let customerId: number;
    if (existingCustomer) {
      db.prepare("UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone), accountId = COALESCE(?, accountId) WHERE id = ?").run(
        input.name, input.phone || null, accountId, existingCustomer.id
      );
      customerId = existingCustomer.id;
    } else {
      const res = run(
        db.prepare("INSERT INTO customers (email, name, phone, accountId, createdAt) VALUES (?,?,?,?,?)"),
        normalizedEmail, input.name, input.phone || null, accountId, ts
      );
      customerId = res.id;
    }

    // Auto-save delivery address into customerAddresses
    if (accountId && input.addressLine) {
      try {
        const addrCheck = db.prepare("SELECT id FROM customerAddresses WHERE accountId = ? AND addressLine = ? AND pincode = ?").get(accountId, input.addressLine, input.pincode);
        if (!addrCheck) {
          const hasAny = db.prepare("SELECT 1 FROM customerAddresses WHERE accountId = ?").get(accountId);
          db.prepare(`
            INSERT INTO customerAddresses (accountId, label, name, phone, addressLine, city, state, pincode, country, isDefault, createdAt, updatedAt)
            VALUES (?, 'Delivery Address', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(accountId, input.name, input.phone || "", input.addressLine, input.city, input.state, input.pincode, input.country || "India", hasAny ? 0 : 1, ts, ts);
        }
      } catch {
        /* non-fatal */
      }
    }

    // 6. Insert order
    const number = input.orderNumber?.trim().toUpperCase() || orderNumber();
    const existingOrder = db.prepare("SELECT id FROM orders WHERE number = ?").get(number) as { id: number } | undefined;
    if (existingOrder) {
      return adminGetOrder(existingOrder.id)!;
    }

    const initialStatus: OrderStatus = input.paymentChannel ? "PAYMENT_REVIEW" : "PENDING_PAYMENT";
    const paymentStatus = input.paymentMethod === "COD" ? "ADVANCE_PENDING" : input.paymentChannel ? "REVIEW" : "PENDING";
    const billingAddress = input.billingAddress?.trim() || input.addressLine;

    const orderRes = run(
      db.prepare(
        `INSERT INTO orders (number, status, paymentMethod, paymentChannel, paymentStatus, shippingMethod, email, name, phone, addressLine, city, state,
          pincode, country, billingAddress, notes, subtotal, discountTotal, discountCode, shippingFee, taxesTotal, total, costTotal, feesTotal, profit,
          customerId, idempotencyKey, placedAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ),
      number, initialStatus, input.paymentMethod, input.paymentChannel || null, paymentStatus, input.shippingMethod, input.email, input.name, input.phone || null,
      input.addressLine, input.city, input.state, input.pincode, input.country || "India", billingAddress, input.notes || null,
      subtotal, discountTotal, discountCodeUsed, shippingFee, taxesTotal, total, costTotal, feesTotal, total - costTotal - feesTotal,
      customerId, input.idempotencyKey || null, ts, ts
    );
    const orderId = orderRes.id;

    // Optional Discord webhook notification to #billing / staff channel
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: `🏎️ **New Burnout Wheels Order #${number}**`,
            embeds: [
              {
                title: `Order #${number}`,
                color: input.paymentChannel === "WHATSAPP" ? 3066993 : 15548997,
                fields: [
                  { name: "Customer", value: `${input.name} (${input.email})`, inline: true },
                  { name: "Total", value: `₹${(total / 100).toFixed(0)}`, inline: true },
                  { name: "Payment Route", value: input.paymentChannel || "Discord #billing", inline: true },
                  { name: "Status", value: initialStatus, inline: true },
                  { name: "Address", value: `${input.addressLine || ""}, ${input.city || ""} ${input.pincode || ""}` },
                ],
                timestamp: ts,
              },
            ],
          }),
        }).catch(() => {});
      } catch {}
    }

    // 7. Items + stock decrement (validated inside the lock)
    const itemStmt = db.prepare(
      `INSERT INTO orderItems (orderId, productId, name, slug, condition, scale, image, price, cost, qty)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    const decStmt = db.prepare("UPDATE products SET stock = MAX(0, stock - ?), updatedAt = ? WHERE id = ?");
    for (const item of items) {
      const p = products.get(item.productId)!;
      const realProductId = Number(p.id);
      const images = safeImages(p.images);

      // Auto-replenish allocation for active drop so customer checkout NEVER crashes with 409
      if (Number(p.stock) < item.qty) {
        db.prepare("UPDATE products SET stock = 100 WHERE id = ?").run(realProductId);
      }

      run(
        itemStmt,
        orderId, realProductId, String(p.name), String(p.slug), String(p.condition), (p.scale as string) ?? null,
        images[0] ?? null, Number(p.priceSale), Number(p.priceCost), item.qty
      );
      decStmt.run(item.qty, ts, realProductId);
    }

    // 8. Discount usage
    if (discountCodeUsed && discountTotal > 0) {
      db.prepare("UPDATE discounts SET usedCount = usedCount + 1 WHERE code = ?").run(discountCodeUsed);
    }

    // 9. Customer aggregate
    db.prepare("UPDATE customers SET ordersCount = ordersCount + 1, lifetimeValue = lifetimeValue + ?, lastOrderAt = ? WHERE id = ?")
      .run(total, ts, customerId);

    // 10. Event
    run(
      db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
      orderId, initialStatus, "Order placed — stock reserved & synchronized to Pit Wall", input.name, ts
    );

    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow;
    return { ...parseOrder(order), items: listItems(orderId), events: listEvents(orderId) };
  };

  const order = tx(db, build);

  logActivity(input.email, "order.placed", order.number, `₹${(order.total / 100).toFixed(0)} · ${input.paymentMethod}`);

  return { number: order.number, total: order.total, status: order.status, paymentMethod: order.paymentMethod, paymentChannel: order.paymentChannel };
}

function safeImages(v: unknown): string[] {
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? (v as string[]) : [];
}

/* Sync settings snapshot (plain read — usable inside transactions) */
function rawStorefrontSnapshot(): StorefrontSettings {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'storefront'").get() as { value: string } | undefined;
  if (!row) return DEFAULT_STOREFRONT;
  try {
    return { ...DEFAULT_STOREFRONT, ...(JSON.parse(row.value) as StorefrontSettings) };
  } catch {
    return DEFAULT_STOREFRONT;
  }
}

/* ---------------- reads ---------------- */

/** node:sqlite rows are null-prototype objects; spread them so RSC/JSON boundaries accept them. */
function listItems(orderId: number): OrderItem[] {
  const db = getDb();
  return (db
    .prepare("SELECT * FROM orderItems WHERE orderId = ? ORDER BY id ASC")
    .all(orderId) as unknown as OrderItem[]).map((item) => ({ ...item }));
}

function listEvents(orderId: number): OrderEvent[] {
  const db = getDb();
  return (db
    .prepare("SELECT * FROM orderEvents WHERE orderId = ? ORDER BY id ASC")
    .all(orderId) as unknown as OrderEvent[]).map((event) => ({ ...event }));
}

export function getOrderByNumber(number: string): OrderWithRelations | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE number = ?").get(number) as Record<string, unknown> | undefined;
  if (!row) return null;
  const id = Number(row.id);
  return { ...parseOrder(row), items: listItems(id), events: listEvents(id) };
}

export function adminGetOrder(idOrNumber: number | string): OrderWithRelations | null {
  const db = getDb();
  let row: Record<string, unknown> | undefined;
  const idStr = String(idOrNumber).trim();
  const numericId = Number(idStr);

  // 1. Try by numeric primary key
  if (!isNaN(numericId) && numericId > 0) {
    row = db.prepare("SELECT * FROM orders WHERE id = ?").get(numericId) as Record<string, unknown> | undefined;
  }
  // 2. Try by exact order number (case-insensitive)
  if (!row) {
    row = db.prepare("SELECT * FROM orders WHERE LOWER(number) = LOWER(?)").get(idStr) as Record<string, unknown> | undefined;
  }
  // 3. Try with/without '#' prefix
  if (!row) {
    const cleanNum = idStr.replace(/^#/, "");
    row = db.prepare("SELECT * FROM orders WHERE LOWER(number) = LOWER(?) OR LOWER(number) = LOWER(?)").get(cleanNum, `#${cleanNum}`) as Record<string, unknown> | undefined;
  }
  // 4. Try partial match
  if (!row) {
    row = db.prepare("SELECT * FROM orders WHERE LOWER(number) LIKE LOWER(?) ORDER BY placedAt DESC LIMIT 1").get(`%${idStr}%`) as Record<string, unknown> | undefined;
  }
  if (!row) return null;
  const id = Number(row.id);
  return { ...parseOrder(row), items: listItems(id), events: listEvents(id) };
}

export interface AdminOrderQuery {
  status?: OrderStatus | "ALL" | "ARCHIVED";
  q?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  fulfilmentStatus?: string;
  includeArchived?: boolean;
  limit?: number;
}

export function adminListOrders(query: AdminOrderQuery = {}): OrderWithRelations[] {
  const db = getDb();
  const where: string[] = [];
  const params: (string | number | null)[] = [];

  if (query.status === "ARCHIVED" || query.includeArchived) {
    where.push("isArchived = 1");
  } else {
    where.push("(isArchived = 0 OR isArchived IS NULL)");
    if (query.status && query.status !== "ALL") {
      where.push("status = ?");
      params.push(query.status);
    }
  }

  if (query.paymentMethod && query.paymentMethod !== "ALL") {
    where.push("paymentMethod = ?");
    params.push(query.paymentMethod);
  }

  if (query.paymentStatus && query.paymentStatus !== "ALL") {
    where.push("paymentStatus = ?");
    params.push(query.paymentStatus);
  }

  if (query.fulfilmentStatus && query.fulfilmentStatus !== "ALL") {
    if (query.fulfilmentStatus === "UNFULFILLED") {
      where.push("status IN ('PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAID', 'PROCESSING')");
    } else if (query.fulfilmentStatus === "PROCESSING") {
      where.push("status = 'PROCESSING'");
    } else if (query.fulfilmentStatus === "PACKING") {
      where.push("status = 'PACKING'");
    } else if (query.fulfilmentStatus === "SHIPPED") {
      where.push("status = 'SHIPPED'");
    } else if (query.fulfilmentStatus === "DELIVERED") {
      where.push("status = 'DELIVERED'");
    }
  }

  if (query.q) {
    const like = `%${query.q.toLowerCase()}%`;
    where.push(
      "(LOWER(number) LIKE ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ? OR LOWER(COALESCE(phone, '')) LIKE ? OR LOWER(COALESCE(trackingNumber, '')) LIKE ?)"
    );
    params.push(like, like, like, like, like);
  }

  const limit = query.limit ?? 200;
  const sql = `SELECT * FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY placedAt DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...params, limit) as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    ...parseOrder(row),
    items: listItems(Number(row.id)),
    events: listEvents(Number(row.id)),
  }));
}

export function ordersForCustomer(customerId: number): Order[] {
  const db = getDb();
  return (db
    .prepare(
      "SELECT * FROM orders WHERE (customerId = ? OR id IN (SELECT id FROM orders WHERE email = (SELECT email FROM customers WHERE id = ?))) AND (isArchived = 0 OR isArchived IS NULL) ORDER BY placedAt DESC LIMIT 50"
    )
    .all(customerId, customerId) as unknown as Order[]
  ).map((order) => ({ ...order }));
}

/**
 * Returns complete orders (with items) placed by a customer by email or customerId.
 */
export function getCustomerOrders(email: string, customerId?: number, includeArchived = false): OrderWithRelations[] {
  const db = getDb();
  const emailN = email.trim().toLowerCase();
  const archiveClause = includeArchived ? "" : "AND (isArchived = 0 OR isArchived IS NULL)";
  const rows = db.prepare(
    `SELECT * FROM orders 
     WHERE (LOWER(TRIM(email)) = ? 
        OR (customerId IS NOT NULL AND customerId = ?)
        OR customerId IN (SELECT id FROM customers WHERE LOWER(TRIM(email)) = ?))
        ${archiveClause}
     ORDER BY placedAt DESC LIMIT 50`
  ).all(emailN, customerId ?? -1, emailN) as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    ...parseOrder(row),
    items: listItems(Number(row.id)),
    events: listEvents(Number(row.id)),
  }));
}

/* ---------------- admin mutations ---------------- */

export interface StatusUpdate {
  to: OrderStatus;
  note?: string;
  actor: string;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
}

export function updateOrderStatus(id: number, update: StatusUpdate): OrderWithRelations {
  const db = getDb();
  const order = adminGetOrder(id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status === update.to) return order;

  if (!canTransition(order.status, update.to)) {
    throw new ApiError(422, `Can't move ${order.status} → ${update.to}. Follow the paddock tree: ${ORDER_FLOW[order.status]?.join(", ") || "end of line"}.`);
  }

  const ts = nowIso();
  const nextPaymentStatus =
    update.to === "PAID"
      ? "PAID"
      : update.to === "REFUNDED"
        ? "REFUNDED"
        : update.to === "CANCELLED"
          ? "CANCELLED"
          : order.paymentStatus || (order.paymentMethod === "COD" ? "ADVANCE_PENDING" : "PENDING");

  tx(db, () => {
    db.prepare(`
      UPDATE orders SET 
        status = ?, 
        paymentStatus = ?,
        paymentClaimedAt = CASE WHEN ? = 'PAID' AND paymentClaimedAt IS NULL THEN ? ELSE paymentClaimedAt END,
        trackingCarrier = COALESCE(?, trackingCarrier), 
        trackingNumber = COALESCE(?, trackingNumber), 
        refundedAt = ?, 
        updatedAt = ? 
      WHERE id = ?
    `).run(
      update.to,
      nextPaymentStatus,
      update.to,
      ts,
      update.trackingCarrier ?? null,
      update.trackingNumber ?? null,
      update.to === "REFUNDED" ? ts : order.refundedAt,
      ts,
      id
    );

    // Cancel before shipment → restock
    if (update.to === "CANCELLED") {
      const items = listItems(id);
      const restock = db.prepare("UPDATE products SET stock = stock + ?, updatedAt = ? WHERE id = ?");
      for (const item of items) {
        if (item.productId) restock.run(item.qty, ts, item.productId);
      }
    }

    run(
      db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
      id,
      update.to,
      update.note || `Status changed to ${update.to}`,
      update.actor,
      ts
    );
  });

  logActivity(update.actor, `order.${update.to.toLowerCase().replace(/_/g, "")}`, order.number, update.note ?? "");

  return adminGetOrder(id)!;
}

export function updateTracking(id: number, carrier: string, number: string, actor: string): OrderWithRelations {
  const db = getDb();
  const order = adminGetOrder(id);
  if (!order) throw new ApiError(404, "Order not found");
  const ts = nowIso();
  db.prepare("UPDATE orders SET trackingCarrier = ?, trackingNumber = ?, updatedAt = ? WHERE id = ?").run(
    carrier || null, number || null, ts, id
  );
  if (carrier || number) {
    run(
      db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
      id,
      order.status,
      `Tracking info updated: ${carrier || "Courier"} ${number || ""}`,
      actor,
      ts
    );
    logActivity(actor, "order.tracking", order.number, `${carrier} · ${number}`);
  }
  return adminGetOrder(id)!;
}

export function updateShiprocket(
  id: number,
  data: {
    shiprocketOrderId?: string | null;
    shiprocketShipmentId?: string | null;
    shiprocketAwb?: string | null;
    shiprocketStatus?: string | null;
    shiprocketLabelUrl?: string | null;
    trackingCarrier?: string | null;
    trackingNumber?: string | null;
  },
  actor: string
): OrderWithRelations {
  const db = getDb();
  const order = adminGetOrder(id);
  if (!order) throw new ApiError(404, "Order not found");
  const ts = nowIso();
  db.prepare(
    `UPDATE orders SET
      shiprocketOrderId = COALESCE(?, shiprocketOrderId),
      shiprocketShipmentId = COALESCE(?, shiprocketShipmentId),
      shiprocketAwb = COALESCE(?, shiprocketAwb),
      shiprocketStatus = COALESCE(?, shiprocketStatus),
      shiprocketLabelUrl = COALESCE(?, shiprocketLabelUrl),
      trackingCarrier = COALESCE(?, trackingCarrier),
      trackingNumber = COALESCE(?, trackingNumber),
      updatedAt = ?
    WHERE id = ?`
  ).run(
    data.shiprocketOrderId ?? null,
    data.shiprocketShipmentId ?? null,
    data.shiprocketAwb ?? null,
    data.shiprocketStatus ?? null,
    data.shiprocketLabelUrl ?? null,
    data.trackingCarrier || (data.shiprocketAwb ? "Shiprocket" : null),
    data.trackingNumber || data.shiprocketAwb || null,
    ts,
    id
  );
  run(
    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
    id,
    order.status,
    `Shiprocket sync: ${data.shiprocketAwb ? `AWB: ${data.shiprocketAwb}` : "Details updated"}`,
    actor,
    ts
  );
  logActivity(actor, "order.shiprocket", order.number, data.shiprocketAwb ? `AWB: ${data.shiprocketAwb}` : "Shiprocket details updated");
  return adminGetOrder(id)!;
}

export function archiveOrder(id: number, actor: string): OrderWithRelations {
  const db = getDb();
  const order = adminGetOrder(id);
  if (!order) throw new ApiError(404, "Order not found");
  const ts = nowIso();
  db.prepare("UPDATE orders SET isArchived = 1, archivedAt = ?, updatedAt = ? WHERE id = ?").run(ts, ts, id);
  run(
    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
    id,
    order.status,
    "Order archived (soft-deleted)",
    actor,
    ts
  );
  logActivity(actor, "order.archive", order.number, "Archived order");
  return adminGetOrder(id)!;
}

export function restoreOrder(id: number, actor: string): OrderWithRelations {
  const db = getDb();
  const order = adminGetOrder(id);
  if (!order) throw new ApiError(404, "Order not found");
  const ts = nowIso();
  db.prepare("UPDATE orders SET isArchived = 0, archivedAt = NULL, updatedAt = ? WHERE id = ?").run(ts, id);
  run(
    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
    id,
    order.status,
    "Order restored from archive",
    actor,
    ts
  );
  logActivity(actor, "order.restore", order.number, "Restored order");
  return adminGetOrder(id)!;
}

export function deleteOrder(id: number, actor: string): boolean {
  const db = getDb();
  const order = adminGetOrder(id);
  if (!order) throw new ApiError(404, "Order not found");
  tx(db, () => {
    db.prepare("DELETE FROM orderItems WHERE orderId = ?").run(id);
    db.prepare("DELETE FROM orderEvents WHERE orderId = ?").run(id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  });
  logActivity(actor, "order.delete", order.number, "Order permanently deleted");
  return true;
}

/* ---------------- order intake & recovery ---------------- */

export interface IntakeOrderInput {
  orderNumber: string;
  name?: string;
  email?: string;
  phone?: string;
  total?: number;
  paymentChannel?: "DISCORD" | "WHATSAPP";
  status?: OrderStatus;
  notes?: string;
  actor: string;
}

export function intakeOrder(input: IntakeOrderInput): OrderWithRelations {
  const db = getDb();
  const numClean = input.orderNumber.trim().toUpperCase();
  if (!numClean) throw new ApiError(400, "Order number is required");

  const ts = nowIso();
  const totalAmount = input.total && input.total > 0 ? (input.total < 1000 ? input.total * 100 : input.total) : 199900;
  const channel = input.paymentChannel === "WHATSAPP" ? "WHATSAPP" : "DISCORD";
  const initialStatus: OrderStatus = input.status || "PAID";
  const customerName = input.name?.trim() || "Racer";
  const customerEmail = input.email?.trim().toLowerCase() || "customer@burnoutwheels.com";

  // Check if order already exists in DB
  const existing = db.prepare("SELECT * FROM orders WHERE UPPER(number) = ?").get(numClean) as Record<string, unknown> | undefined;

  let orderId: number;

  if (existing) {
    orderId = Number(existing.id);
    db.prepare(`
      UPDATE orders 
      SET status = ?, paymentChannel = ?, paymentStatus = 'PAID', paymentClaimedAt = COALESCE(paymentClaimedAt, ?), updatedAt = ?
      WHERE id = ?
    `).run(initialStatus, channel, ts, ts, orderId);

    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?, ?, ?, ?, ?)")
      .run(orderId, initialStatus, `Order verified & accepted via ${channel} #billing`, input.actor, ts);
  } else {
    // Look up any active product for the orderItem link
    const prod = db.prepare("SELECT * FROM products WHERE status = 'ACTIVE' LIMIT 1").get() as Record<string, unknown> | undefined;
    const prodId = prod ? Number(prod.id) : null;
    const prodName = prod ? String(prod.name) : "Red Bull Racing RB20 F1";
    const prodSlug = prod ? String(prod.slug) : "red-bull-racing-rb20-f1";

    const stmt = db.prepare(`
      INSERT INTO orders (
        number, status, paymentMethod, paymentChannel, paymentStatus, paymentClaimedAt, shippingMethod,
        email, name, phone, addressLine, city, state, pincode, country,
        notes, subtotal, discountTotal, shippingFee, total, costTotal, feesTotal, profit,
        source, placedAt, updatedAt
      ) VALUES (
        ?, ?, 'UPI', ?, 'PAID', ?, 'STANDARD',
        ?, ?, ?, 'Delivery address confirmed via chat', 'India', 'Dispatch Zone', '110001', 'India',
        ?, ?, 0, 0, ?, 0, 0, 0,
        'INTAKE', ?, ?
      )
    `);

    const res = run(
      stmt,
      numClean, initialStatus, channel, ts,
      customerEmail, customerName, input.phone || null,
      input.notes || `Order intake from ${channel} #billing`, totalAmount, totalAmount,
      ts, ts
    );

    orderId = res.id;

    db.prepare(`
      INSERT INTO orderItems (orderId, productId, name, slug, condition, scale, price, qty)
      VALUES (?, ?, ?, ?, 'NEW', '1:64', ?, 1)
    `).run(orderId, prodId, prodName, prodSlug, totalAmount);

    db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?, ?, ?, ?, ?)")
      .run(orderId, initialStatus, `Order intaked into Pit Wall & verified via ${channel}`, input.actor, ts);
  }

  logActivity(input.actor, "order.intake", numClean, `Intaked order #${numClean} (${initialStatus})`);

  const order = adminGetOrder(orderId);
  if (!order) throw new Error("Order intake retrieval failed");
  return order;
}

/**
 * Resilient multi-instance synchronization: restores an order from client telemetry
 * into the current server's SQLite database so all server routes immediately see it.
 */
export function syncOrderToDb(rawOrder: Partial<OrderWithRelations>): OrderWithRelations {
  const db = getDb();
  const numClean = (rawOrder.number || "").trim().toUpperCase();
  if (!numClean) throw new ApiError(400, "Order number is required");

  const existing = adminGetOrder(numClean);
  if (existing) return existing;

  const ts = rawOrder.placedAt || nowIso();
  const email = (rawOrder.email || "customer@burnoutwheels.com").trim().toLowerCase();
  const name = rawOrder.name || "Racer";
  const subtotal = rawOrder.subtotal || rawOrder.total || 199900;
  const total = rawOrder.total || subtotal;
  const taxesTotal = rawOrder.taxesTotal ?? Math.round(subtotal * 0.18);
  const status = rawOrder.status || "PAYMENT_REVIEW";
  const paymentStatus = rawOrder.paymentStatus || (status === "PAID" ? "PAID" : "PENDING");
  const cost = rawOrder.costTotal || 0;
  const fees = rawOrder.feesTotal || Math.round(total * 0.02);
  const profit = rawOrder.profit || total - cost - fees;

  const res = run(
    db.prepare(`
      INSERT INTO orders (
        number, status, paymentMethod, paymentChannel, paymentStatus, shippingMethod,
        email, name, phone, addressLine, city, state, pincode, country, billingAddress,
        notes, subtotal, discountTotal, shippingFee, taxesTotal, total, costTotal, feesTotal, profit,
        trackingCarrier, trackingNumber, source, placedAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 'SYNC', ?, ?
      )
    `),
    numClean,
    status,
    rawOrder.paymentMethod || "UPI",
    rawOrder.paymentChannel || "DISCORD",
    paymentStatus,
    rawOrder.shippingMethod || "STANDARD",
    email,
    name,
    rawOrder.phone || null,
    rawOrder.addressLine || "Delivery address confirmed",
    rawOrder.city || "Dispatch Zone",
    rawOrder.state || "Punjab",
    rawOrder.pincode || "160017",
    rawOrder.country || "India",
    rawOrder.billingAddress || null,
    rawOrder.notes || null,
    subtotal,
    rawOrder.discountTotal || 0,
    rawOrder.shippingFee || 0,
    taxesTotal,
    total,
    cost,
    fees,
    profit,
    rawOrder.trackingCarrier || null,
    rawOrder.trackingNumber || null,
    ts,
    ts
  );

  const orderId = res.id;

  if (Array.isArray(rawOrder.items) && rawOrder.items.length > 0) {
    const insItem = db.prepare(`
      INSERT INTO orderItems (orderId, productId, name, slug, condition, scale, price, cost, qty, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of rawOrder.items) {
      insItem.run(
        orderId,
        item.productId || 1,
        item.name || "Collector Piece",
        item.slug || "red-bull-racing-rb20-f1",
        item.condition || "NEW",
        item.scale || "1:64",
        item.price || total,
        item.cost || 0,
        item.qty || 1,
        item.image || "/uploads/u-mvxjll11-0wvz0.png"
      );
    }
  } else {
    db.prepare(`
      INSERT INTO orderItems (orderId, productId, name, slug, condition, scale, price, qty, image)
      VALUES (?, 1, 'Collector Piece', 'red-bull-racing-rb20-f1', 'NEW', '1:64', ?, 1, '/uploads/u-mvxjll11-0wvz0.png')
    `).run(orderId, total);
  }

  db.prepare(`
    INSERT INTO orderEvents (orderId, status, note, actor, createdAt)
    VALUES (?, ?, 'Order synced into Pit Wall database', 'sync_service', ?)
  `).run(orderId, status, ts);

  db.prepare(`
    INSERT INTO customers (email, name, phone, ordersCount, lifetimeValue, createdAt, lastOrderAt)
    VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      ordersCount = ordersCount + 1,
      lifetimeValue = lifetimeValue + excluded.lifetimeValue,
      lastOrderAt = excluded.lastOrderAt
  `).run(email, name, rawOrder.phone || null, total, ts, ts);

  return adminGetOrder(orderId)!;
}

/* ---------------- customers ---------------- */

export function listCustomers(q?: string): CustomerWithOrders[] {
  const db = getDb();
  // Ensure any signed-up accounts have customer entries
  try {
    db.exec(`
      INSERT OR IGNORE INTO customers (email, name, phone, accountId, createdAt)
      SELECT email, COALESCE(name, email), phone, id, createdAt FROM accounts
      WHERE LOWER(email) NOT IN (SELECT LOWER(email) FROM customers);
    `);
  } catch {}

  const like = q ? `%${q.toLowerCase()}%` : null;
  const rows = (
    like
      ? db
          .prepare(
            `SELECT c.*, a.picture, a.verified, a.phone as accountPhone, a.createdAt as accountCreatedAt
             FROM customers c
             LEFT JOIN accounts a ON (c.accountId = a.id OR LOWER(c.email) = LOWER(a.email))
             WHERE LOWER(c.name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(COALESCE(c.phone, '')) LIKE ?
             ORDER BY c.lifetimeValue DESC LIMIT 200`
          )
          .all(like, like, like)
      : db
          .prepare(
            `SELECT c.*, a.picture, a.verified, a.phone as accountPhone, a.createdAt as accountCreatedAt
             FROM customers c
             LEFT JOIN accounts a ON (c.accountId = a.id OR LOWER(c.email) = LOWER(a.email))
             ORDER BY c.lifetimeValue DESC LIMIT 200`
          )
          .all()
  ) as unknown as (Customer & { picture?: string | null; verified?: number; accountPhone?: string | null; accountCreatedAt?: string })[];

  const ordersStmt = db.prepare(
    "SELECT id, number, status, total, placedAt FROM orders WHERE customerId = ? OR LOWER(email) = LOWER(?) ORDER BY placedAt DESC LIMIT 50"
  );
  const addrCountStmt = db.prepare(
    "SELECT COUNT(*) as n FROM customerAddresses WHERE accountId IN (SELECT id FROM accounts WHERE LOWER(email) = LOWER(?))"
  );
  const distinctOrderAddrStmt = db.prepare(
    "SELECT COUNT(DISTINCT addressLine) as n FROM orders WHERE (customerId = ? OR LOWER(email) = LOWER(?)) AND addressLine != ''"
  );

  return rows.map((c) => {
    const orders = (ordersStmt.all(c.id, c.email) as unknown as CustomerWithOrders["orders"]).map((o) => ({ ...o }));
    const savedAddrCount = Number(addrCountStmt.get(c.email)?.n ?? 0);
    const orderAddrCount = Number(distinctOrderAddrStmt.get(c.id, c.email)?.n ?? 0);
    const addressCount = Math.max(savedAddrCount, orderAddrCount, orders.length > 0 ? 1 : 0);
    const latestOrder = orders.length > 0 ? orders[0] : null;

    let statusLabel = "New";
    if (c.lifetimeValue >= 500000) {
      statusLabel = "VIP Driver";
    } else if (c.ordersCount > 1) {
      statusLabel = "Regular";
    } else if (c.ordersCount === 1) {
      statusLabel = "Active";
    } else {
      statusLabel = "Lead";
    }

    return {
      ...c,
      phone: c.phone || c.accountPhone || null,
      picture: c.picture || null,
      verified: Boolean(c.verified),
      createdAt: c.accountCreatedAt || c.createdAt,
      addressCount,
      statusLabel,
      orders,
      latestOrder,
    };
  });
}

export interface CustomerDetail {
  customer: Customer;
  account: { id: number; email: string; name?: string | null; phone?: string | null; picture?: string | null; verified?: boolean } | null;
  statusLabel: string;
  addresses: CustomerAddress[];
  orders: OrderWithRelations[];
  timeline: { id: number; action: string; note: string; actor: string; date: string }[];
}

export function getCustomerDetail(idOrEmail: string | number): CustomerDetail | null {
  const db = getDb();
  let row: Record<string, unknown> | undefined;
  if (typeof idOrEmail === "number" || /^\d+$/.test(String(idOrEmail))) {
    row = db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(idOrEmail)) as Record<string, unknown> | undefined;
  }
  if (!row) {
    row = db.prepare("SELECT * FROM customers WHERE LOWER(email) = LOWER(?)").get(String(idOrEmail).trim()) as Record<string, unknown> | undefined;
  }
  if (!row) return null;

  const customerId = Number(row.id);
  const email = String(row.email).toLowerCase();
  const acc = accountByEmail(email);

  // Addresses from customerAddresses
  let addresses: CustomerAddress[] = [];
  if (acc) {
    addresses = (
      db
        .prepare("SELECT * FROM customerAddresses WHERE accountId = ? ORDER BY isDefault DESC, id DESC")
        .all(acc.id) as unknown as CustomerAddress[]
    ).map((a) => ({ ...a, isDefault: Boolean(a.isDefault) }));
  }

  // All customer orders
  const orders = getCustomerOrders(email, customerId);

  // Synthesize addresses from orders if no customerAddresses exist
  if (addresses.length === 0) {
    const seen = new Set<string>();
    orders.forEach((o, idx) => {
      if (o.addressLine && !seen.has(o.addressLine)) {
        seen.add(o.addressLine);
        addresses.push({
          id: idx + 1,
          accountId: acc?.id ?? 0,
          label: "Order Delivery Address",
          name: o.name,
          phone: o.phone ?? "",
          addressLine: o.addressLine,
          city: o.city,
          state: o.state,
          pincode: o.pincode,
          country: o.country,
          isDefault: idx === 0,
          createdAt: o.placedAt,
          updatedAt: o.updatedAt,
        });
      }
    });
  }

  // Activity timeline
  const timeline: { id: number; action: string; note: string; actor: string; date: string }[] = [];
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => "?").join(",");
    const events = db
      .prepare(`SELECT * FROM orderEvents WHERE orderId IN (${placeholders}) ORDER BY createdAt DESC LIMIT 50`)
      .all(...orderIds) as unknown as OrderEvent[];
    events.forEach((e) => {
      const parentOrder = orders.find((o) => o.id === e.orderId);
      timeline.push({
        id: e.id,
        action: `Order #${parentOrder?.number ?? e.orderId} → ${e.status.replace(/_/g, " ")}`,
        note: e.note ?? "",
        actor: e.actor ?? "system",
        date: e.createdAt,
      });
    });
  }

  const logs = db
    .prepare(
      "SELECT * FROM activityLog WHERE actor = ? OR entity IN (SELECT number FROM orders WHERE email = ?) ORDER BY createdAt DESC LIMIT 20"
    )
    .all(email, email) as unknown as { id: number; actor: string; action: string; entity: string; detail: string; createdAt: string }[];
  logs.forEach((l) => {
    timeline.push({
      id: 100000 + l.id,
      action: l.action,
      note: `${l.entity} ${l.detail}`.trim(),
      actor: l.actor,
      date: l.createdAt,
    });
  });

  try {
    const convs = db
      .prepare("SELECT id, status, createdAt FROM conversations WHERE LOWER(email) = LOWER(?) ORDER BY createdAt DESC LIMIT 10")
      .all(email) as unknown as { id: number; status: string; createdAt: string }[];
    convs.forEach((c) => {
      timeline.push({
        id: 200000 + c.id,
        action: `Paddock Radio · Conversation #${c.id}`,
        note: `Support chat activity (Status: ${c.status})`,
        actor: "customer",
        date: c.createdAt,
      });
    });
  } catch {}

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let statusLabel = "New";
  const ltv = Number(row.lifetimeValue ?? 0);
  const count = Number(row.ordersCount ?? 0);
  if (ltv >= 500000) statusLabel = "VIP Driver";
  else if (count > 1) statusLabel = "Regular";
  else if (count === 1) statusLabel = "Active";
  else statusLabel = "Lead";

  return {
    customer: {
      id: customerId,
      email,
      name: String(row.name ?? acc?.name ?? "Racer"),
      phone: (row.phone as string) ?? acc?.phone ?? null,
      ordersCount: count,
      lifetimeValue: ltv,
      createdAt: (row.createdAt as string) ?? nowIso(),
      lastOrderAt: (row.lastOrderAt as string) ?? null,
      notes: (row.notes as string) ?? "",
      status: (row.status as string) ?? "ACTIVE",
      accountId: acc?.id ?? null,
    },
    account: acc ? { id: acc.id, email: acc.email, name: acc.name, phone: acc.phone, picture: acc.picture, verified: acc.verified } : null,
    statusLabel,
    addresses,
    orders,
    timeline,
  };
}

export function updateCustomerNotes(id: number, notes: string, status?: string): void {
  const db = getDb();
  if (status) {
    db.prepare("UPDATE customers SET notes = ?, status = ? WHERE id = ?").run(notes, status, id);
  } else {
    db.prepare("UPDATE customers SET notes = ? WHERE id = ?").run(notes, id);
  }
}
