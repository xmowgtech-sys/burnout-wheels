import { getDb } from "./db";
import { REVENUE_STATUSES, type Product, type OrderStatus } from "./types";
import { lastMonthKeys, daysAgoIso } from "./utils";

export interface MonthPoint {
  month: string;
  revenue: number;
  cost: number;
  fees: number;
  profit: number;
  orders: number;
  refunds: number;
}

const revenueList = ["'PAID'", "'PACKING'", "'SHIPPED'", "'DELIVERED'"].join(",");

export function monthlySeries(months = 12): MonthPoint[] {
  const db = getDb();
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const rows = db
    .prepare(
      `SELECT substr(placedAt, 1, 7) AS m, status, COUNT(*) AS n,
              SUM(total) AS total, SUM(costTotal) AS cost, SUM(feesTotal) AS fees
       FROM orders
       WHERE placedAt >= ?
       GROUP BY m, status`
    )
    .all(since.toISOString()) as { m: string; status: string; n: number; total: number; cost: number; fees: number }[];

  const byMonth = new Map<string, Map<string, { n: number; total: number; cost: number; fees: number }>>();
  for (const r of rows) {
    if (!byMonth.has(r.m)) byMonth.set(r.m, new Map());
    byMonth.get(r.m)!.set(r.status, { n: r.n, total: r.total, cost: r.cost, fees: r.fees });
  }

  return lastMonthKeys(months).map((month) => {
    const monthRows = byMonth.get(month) ?? new Map();
    let revenue = 0;
    let cost = 0;
    let fees = 0;
    let orders = 0;
    let refunds = 0;
    for (const [status, agg] of monthRows) {
      orders += agg.n;
      cost += agg.cost;
      if ((REVENUE_STATUSES as string[]).includes(status)) {
        revenue += agg.total;
        fees += agg.fees;
      }
      if (status === "REFUNDED") refunds += agg.total;
    }
    return {
      month,
      revenue,
      cost,
      fees,
      profit: revenue - cost - fees,
      orders,
      refunds,
    };
  });
}

export interface ProductPnl {
  productId: number | null;
  name: string;
  slug: string;
  units: number;
  revenue: number;
  cost: number;
  fees: number;
  profit: number;
  margin: number;
}

export function pnlPerProduct(): ProductPnl[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT oi.productId AS productId,
              COALESCE(p.name, oi.name) AS name,
              COALESCE(p.slug, oi.slug) AS slug,
              COALESCE(p.feePercent, 2.0) AS feePercent,
              SUM(oi.qty) AS units,
              SUM(oi.price * oi.qty) AS revenue,
              SUM(oi.cost * oi.qty) AS cost
       FROM orderItems oi
       LEFT JOIN products p ON p.id = oi.productId
       JOIN orders o ON o.id = oi.orderId
       WHERE o.status IN (${revenueList})
       GROUP BY oi.productId, oi.name, oi.slug, feePercent, p.id
       ORDER BY revenue DESC`
    )
    .all() as unknown as { productId: number | null; name: string; slug: string | null; feePercent: number; units: number; revenue: number; cost: number }[];

  return rows.map((r) => {
    const fees = Math.round(r.revenue * (r.feePercent / 100));
    const profit = r.revenue - r.cost - fees;
    return {
      productId: r.productId,
      name: r.name,
      slug: r.slug ?? "",
      units: r.units,
      revenue: r.revenue,
      cost: r.cost,
      fees,
      profit,
      margin: r.revenue > 0 ? profit / r.revenue : 0,
    };
  });
}

export interface Overview {
  revenue28: number;
  revenueAll: number;
  profit28: number;
  profitAll: number;
  orders28: number;
  ordersAll: number;
  pendingCount: number;
  refundTotal: number;
  conversion28: number;
  sessions28: number;
  averageOrder: number;
}

const AUDIT_STATUSES: string[] = REVENUE_STATUSES as unknown as string[];

export function overview(sessions28: number): Overview {
  const db = getDb();
  const since28 = daysAgoIso(28);
  const agg = (sql: string, ...params: (string | number)[]): { n: number; total: number; profit: number } => {
    const row = db.prepare(sql).get(...params) as { n: number; total: number | null; profit: number | null };
    return { n: row.n, total: row.total ?? 0, profit: row.profit ?? 0 };
  };
  const r28 = agg(
    `SELECT COUNT(*) n, SUM(total) total, SUM(profit) profit FROM orders WHERE placedAt >= ? AND status IN (${revenueList})`,
    since28
  );
  const rAll = agg(
    `SELECT COUNT(*) n, SUM(total) total, SUM(profit) profit FROM orders WHERE status IN (${revenueList})`
  );
  const rf = agg(`SELECT COUNT(*) n, SUM(total) total, 0 profit FROM orders WHERE status = 'REFUNDED'`);
  const pending = agg(`SELECT COUNT(*) n, 0 total, 0 profit FROM orders WHERE status = 'PENDING_PAYMENT'`);

  const revenue28 = r28.total;
  const orders28 = r28.n;
  return {
    revenue28,
    revenueAll: rAll.total,
    profit28: r28.profit,
    profitAll: rAll.profit,
    orders28,
    ordersAll: rAll.n,
    pendingCount: pending.n,
    refundTotal: rf.total,
    conversion28: sessions28 > 0 ? orders28 / sessions28 : 0,
    sessions28,
    averageOrder: orders28 > 0 ? Math.round(revenue28 / orders28) : 0,
  };
}

export interface BestSeller {
  productId: number | null;
  name: string;
  slug: string | null;
  units: number;
  revenue: number;
}

export function bestSellers(limit = 5): BestSeller[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT oi.productId AS productId, oi.name AS name, oi.slug AS slug,
              SUM(oi.qty) AS units, SUM(oi.price * oi.qty) AS revenue
       FROM orderItems oi
       JOIN orders o ON o.id = oi.orderId
       WHERE o.status IN (${revenueList})
       GROUP BY oi.productId, oi.name, oi.slug
       ORDER BY revenue DESC
       LIMIT ?`
    )
    .all(limit) as unknown as BestSeller[];
  return rows;
}

export interface LowStockItem {
  product: Product;
}

export function lowStockProducts(): Product[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM products WHERE status = 'ACTIVE' AND stock <= lowStockThreshold ORDER BY stock ASC LIMIT 20`
    )
    .all() as unknown as (Omit<Product, "featured"> & { featured: number })[];
  return rows.map((r) => ({ ...r, featured: r.featured === 1 }));
}

export interface InventoryStat {
  activeCount: number;
  units: number;
  value: number;
}

export function inventoryStat(): InventoryStat {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS activeCount, COALESCE(SUM(stock), 0) AS units, COALESCE(SUM(priceCost * stock), 0) AS value
       FROM products WHERE status = 'ACTIVE'`
    )
    .get() as { activeCount: number; units: number; value: number };
  return row;
}

/* ---------------- CSV exports ---------------- */

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function ordersCsv(limit = 1000): string {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.*, EXISTS(SELECT 1 FROM orderItems oi WHERE oi.orderId = o.id) AS hasItems FROM orders o ORDER BY o.placedAt DESC LIMIT ?`
    )
    .all(limit) as unknown as Record<string, unknown>[];
  const orderIds = rows.map((r) => Number(r.id));
  const items = db
    .prepare(
      `SELECT oi.orderId, oi.name, oi.qty, oi.price FROM orderItems oi
       WHERE oi.orderId IN (${orderIds.length ? orderIds.map(() => "?").join(",") : "SELECT -1"})`
    )
    .all(...orderIds) as unknown as { orderId: number; name: string; qty: number; price: number }[];
  const byOrder = new Map<number, string[]>();
  for (const it of items) {
    if (!byOrder.has(it.orderId)) byOrder.set(it.orderId, []);
    byOrder.get(it.orderId)!.push(`${it.qty} x ${it.name} @ ${(it.price / 100).toFixed(2)}`);
  }
  const header = [
    "order_number", "status", "payment_method", "shipping_method", "customer", "email", "phone",
    "address", "city", "state", "pincode", "country", "discount_code", "subtotal_inr", "discount_inr",
    "shipping_inr", "total_inr", "cost_inr", "fees_inr", "profit_inr", "tracking", "placed_at", "items",
  ];
  const body = rows.map((o) => [
    o.number, o.status, o.paymentMethod, o.shippingMethod, o.name, o.email, o.phone,
    o.addressLine, o.city, o.state, o.pincode, o.country, o.discountCode,
    (Number(o.subtotal) / 100).toFixed(2), (Number(o.discountTotal) / 100).toFixed(2),
    (Number(o.shippingFee) / 100).toFixed(2), (Number(o.total) / 100).toFixed(2),
    (Number(o.costTotal) / 100).toFixed(2), (Number(o.feesTotal) / 100).toFixed(2),
    (Number(o.profit) / 100).toFixed(2),
    [o.trackingCarrier, o.trackingNumber].filter(Boolean).join(":"),
    o.placedAt,
    (byOrder.get(Number(o.id)) ?? []).join(" | "),
  ]);
  return toCsv([header, ...body]);
}

export function productsCsv(): string {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM products ORDER BY status ASC, category ASC").all() as unknown as (Product & { id: number })[];
  const header = [
    "id", "slug", "name", "brand", "category", "scale", "condition", "status", "featured",
    "sale_price_inr", "cost_price_inr", "fee_percent", "stock", "low_stock_threshold", "units_sold_revenue", "margin_note",
  ];
  const body = rows.map((p) => [
    p.id, p.slug, p.name, p.brand, p.category, p.scale, p.condition, p.status, p.featured ? 1 : 0,
    (p.priceSale / 100).toFixed(2), (p.priceCost / 100).toFixed(2), p.feePercent, p.stock, p.lowStockThreshold,
    "", "",
  ]);
  void AUDIT_STATUSES;
  return toCsv([header, ...body]);
}

export function pnlCsv(months = 12): string {
  const header = ["month", "revenue_inr", "cost_inr", "fees_inr", "profit_inr", "orders", "refunds_inr"];
  const body = monthlySeries(months).map((m) => [
    m.month,
    (m.revenue / 100).toFixed(2),
    (m.cost / 100).toFixed(2),
    (m.fees / 100).toFixed(2),
    (m.profit / 100).toFixed(2),
    m.orders,
    (m.refunds / 100).toFixed(2),
  ]);
  return toCsv([header, ...body]);
}

export type { OrderStatus as _OrderStatus };
