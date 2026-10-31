import { getDb, run, nowIso, tx } from "./db";
import { checkoutSchema, type CheckoutInput } from "./validation";
import type { Customer, CustomerWithOrders, Order, OrderEvent, OrderItem, OrderStatus, OrderWithRelations, Product, StorefrontSettings } from "./types";
import { DEFAULT_STOREFRONT } from "./settings";
import { logActivity } from "./analytics";
import { ApiError } from "./auth";
import { orderNumber } from "./utils";

/* ---------------- status flow ---------------- */

export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PACKING", "CANCELLED", "REFUNDED"],
  PACKING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
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
}

export function createOrderFromCheckout(raw: unknown): CheckoutResult {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check your details and try again";
    throw new ApiError(422, msg);
  }
  const input: CheckoutInput = parsed.data;
  const db = getDb();
  const storefront = rawStorefrontSnapshot();
  const items = [...input.items].sort((a, b) => a.productId - b.productId);

  const build = (): OrderWithRelations => {
    const ts = nowIso();

    // 1. Resolve active products (fresh stock read happens inside the lock)
    const products = new Map<number, Product & Record<string, unknown>>();
    const fetchProduct = db.prepare(
      "SELECT * FROM products WHERE id = ? AND status = 'ACTIVE'"
    );
    for (const item of items) {
      const row = fetchProduct.get(item.productId) as Record<string, unknown> | undefined;
      if (!row) throw new ApiError(409, "One of the products is no longer available. Refresh your cart.");
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

    // 4. Shipping — settings store paise
    const rate = input.shippingMethod === "EXPRESS" ? storefront.shipping.express : storefront.shipping.standard;
    const shippingFee = subtotal - discountTotal >= storefront.shipping.freeOver ? 0 : rate;

    const total = subtotal - discountTotal + shippingFee;

    // 5. Customer upsert
    const existing = db.prepare("SELECT id FROM customers WHERE email = ?").get(input.email) as { id: number } | undefined;
    let customerId: number;
    if (existing) {
      db.prepare("UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?").run(
        input.name, input.phone || null, existing.id
      );
      customerId = existing.id;
    } else {
      const res = run(
        db.prepare("INSERT INTO customers (email, name, phone, createdAt) VALUES (?,?,?,?)"),
        input.email, input.name, input.phone || null, ts
      );
      customerId = res.id;
    }

    // 6. Insert order
    const number = orderNumber();
    const orderRes = run(
      db.prepare(
        `INSERT INTO orders (number, status, paymentMethod, shippingMethod, email, name, phone, addressLine, city, state,
          pincode, country, notes, subtotal, discountTotal, discountCode, shippingFee, total, costTotal, feesTotal, profit,
          customerId, placedAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ),
      number, "PENDING_PAYMENT", input.paymentMethod, input.shippingMethod, input.email, input.name, input.phone || null,
      input.addressLine, input.city, input.state, input.pincode, input.country || "India", input.notes || null,
      subtotal, discountTotal, discountCodeUsed, shippingFee, total, costTotal, feesTotal, total - costTotal - feesTotal,
      customerId, ts, ts
    );
    const orderId = orderRes.id;

    // 7. Items + stock decrement (validated inside the lock)
    const itemStmt = db.prepare(
      `INSERT INTO orderItems (orderId, productId, name, slug, condition, scale, image, price, cost, qty)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    const decStmt = db.prepare("UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ? AND status = 'ACTIVE'");
    for (const item of items) {
      const p = products.get(item.productId)!;
      const images = safeImages(p.images);
      if (Number(p.stock) < item.qty) {
        throw new ApiError(409, `“${String(p.name)}” only has ${String(p.stock)} left — reduces the units in your cart.`);
      }
      run(
        itemStmt,
        orderId, item.productId, String(p.name), String(p.slug), String(p.condition), (p.scale as string) ?? null,
        images[0] ?? null, Number(p.priceSale), Number(p.priceCost), item.qty
      );
      const dec = decStmt.run(item.qty, ts, item.productId) as { changes: number | bigint };
      if (Number(dec.changes) === 0) throw new ApiError(409, `“${String(p.name)}” went out of stock. Adjust your cart.`);
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
      orderId, "PENDING_PAYMENT", "Order placed — stock reserved", input.name, ts
    );

    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow;
    return { ...parseOrder(order), items: listItems(orderId), events: listEvents(orderId) };
  };

  const order = tx(db, build);

  logActivity(input.email, "order.placed", order.number, `₹${(order.total / 100).toFixed(0)} · ${input.paymentMethod}`);

  return { number: order.number, total: order.total, status: order.status, paymentMethod: order.paymentMethod };
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

export function adminGetOrder(id: number): OrderWithRelations | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...parseOrder(row), items: listItems(id), events: listEvents(id) };
}

export interface AdminOrderQuery {
  status?: OrderStatus | "ALL";
  q?: string;
  limit?: number;
}

export function adminListOrders(query: AdminOrderQuery = {}): OrderWithRelations[] {
  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (query.status && query.status !== "ALL") {
    where.push("status = ?");
    params.push(query.status);
  }
  if (query.q) {
    const like = `%${query.q.toLowerCase()}%`;
    where.push("(LOWER(number) LIKE ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?)");
    params.push(like, like, like);
  }
  const limit = query.limit ?? 200;
  const rows = db
    .prepare(
      `SELECT * FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY placedAt DESC LIMIT ?`
    )
    .all(...params, limit) as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    ...parseOrder(row),
    items: listItems(Number(row.id)),
    events: [],
  }));
}

export function ordersForCustomer(customerId: number): Order[] {
  const db = getDb();
  return (db
    .prepare(
      "SELECT * FROM orders WHERE customerId = ? OR id IN (SELECT id FROM orders WHERE email = (SELECT email FROM customers WHERE id = ?)) ORDER BY placedAt DESC LIMIT 50"
    )
    .all(customerId, customerId) as unknown as Order[]
  ).map((order) => ({ ...order }));
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
    throw new ApiError(422, `Can't move ${order.status} → ${update.to}. Follow the paddock tree: ${ORDER_FLOW[order.status].join(", ") || "end of line"}.`);
  }

  const ts = nowIso();
  tx(db, () => {
    db.prepare("UPDATE orders SET status = ?, trackingCarrier = COALESCE(?, trackingCarrier), trackingNumber = COALESCE(?, trackingNumber), refundedAt = ?, updatedAt = ? WHERE id = ?")
      .run(
        update.to,
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
      update.note || null,
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
  db.prepare("UPDATE orders SET trackingCarrier = ?, trackingNumber = ?, updatedAt = ? WHERE id = ?").run(
    carrier || null, number || null, nowIso(), id
  );
  if (carrier || number) {
    logActivity(actor, "order.tracking", order.number, `${carrier} · ${number}`);
  }
  return adminGetOrder(id)!;
}

/* ---------------- customers ---------------- */

export function listCustomers(q?: string): CustomerWithOrders[] {
  const db = getDb();
  const like = q ? `%${q.toLowerCase()}%` : null;
  const rows = (
    like
      ? db
          .prepare("SELECT * FROM customers WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? ORDER BY lifetimeValue DESC LIMIT 200")
          .all(like, like)
      : db.prepare("SELECT * FROM customers ORDER BY lifetimeValue DESC LIMIT 200").all()
  ) as unknown as Customer[];

  const ordersStmt = db.prepare(
    "SELECT id, number, status, total, placedAt FROM orders WHERE customerId = ? ORDER BY placedAt DESC LIMIT 50"
  );
  return rows.map((c) => ({
    ...c,
    orders: (ordersStmt.all(c.id) as unknown as CustomerWithOrders["orders"]).map((o) => ({ ...o })),
  }));
}
