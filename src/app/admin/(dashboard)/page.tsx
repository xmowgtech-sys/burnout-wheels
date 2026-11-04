import Link from "next/link";
import { ArrowRight, Package, TriangleAlert } from "lucide-react";
import { AreaChart, BarChart, StatCard, Table, Td, StatusBadge } from "@/components/admin/admin-ui";
import { fmtUSD, fmtDate } from "@/lib/money";
import { overview, monthlySeries, bestSellers, lowStockProducts } from "@/lib/finance";
import { sessionsSince, recentActivity } from "@/lib/analytics";
import { adminListOrders } from "@/lib/orders";
import { hydrateAllOrders } from "@/lib/order-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview · Pit wall", robots: { index: false } };

type MonthPoint = { month: string; revenue: number; cost: number; fees: number; profit: number; orders: number; refunds: number };

export default async function AdminOverviewPage() {
  await hydrateAllOrders({ force: true });
  const sessions28 = sessionsSince(28);
  const stats = overview(sessions28);
  const months = monthlySeries(8) as MonthPoint[];
  const sellers = bestSellers(5);
  const lowStock = lowStockProducts();
  const activity = recentActivity(8);
  const recentOrders = adminListOrders({}).slice(0, 6);

  const revenuePts = months.map((m) => m.revenue / 100);
  const orderPts = months.map((m) => m.orders);
  const monthLabels = months.map((m) => m.month.slice(5));

  const conv = (stats.conversion28 * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="u-label">Race control</p>
          <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Overview</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders" className="u-btn u-btn-ghost">Orders</Link>
          <Link href="/admin/products/new" className="u-btn u-btn-primary">New product</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
        <StatCard label="Revenue · 28d" value={fmtUSD(stats.revenue28)} sub={`${fmtUSD(stats.revenueAll)} all-time`} tone="good" />
        <StatCard label="Profit · 28d" value={fmtUSD(stats.profit28)} sub={`${fmtUSD(stats.profitAll)} all-time`} tone={stats.profit28 >= 0 ? "neutral" : "bad"} />
        <StatCard label="Orders · 28d" value={String(stats.orders28)} sub={`${stats.ordersAll} all-time · avg ${fmtUSD(stats.averageOrder)}`} />
        <StatCard label="Conversion · 28d" value={`${conv}%`} sub={`${stats.sessions28} sessions seen`} tone={Number(conv) > 1 ? "good" : "neutral"} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Trends">
        <div className="u-card p-5">
          <p className="u-label">Revenue · last {months.length} months</p>
          <div className="mt-4"><AreaChart points={revenuePts} /></div>
          <div className="mt-3 flex justify-between u-label-txt">{monthLabels.map((l) => <span key={l}>{l}</span>)}</div>
        </div>
        <div className="u-card p-5">
          <p className="u-label">Orders · same window</p>
          <div className="mt-4"><BarChart points={orderPts} labels={monthLabels} /></div>
          <p className="u-label-txt mt-3">{stats.pendingCount} awaiting payment confirmation · {fmtUSD(stats.refundTotal)} refunded</p>
        </div>
      </section>

      <section aria-label="Best sellers">
        <p className="u-label mb-3">Best sellers</p>
        {sellers.length === 0 ? (
          <p className="u-label-txt border border-line px-4 py-3 font-mono">No revenue yet — first confirmed order writes this row.</p>
        ) : (
          <Table head={["Product", "Units", "Revenue"]}>
            {sellers.map((s, i) => (
              <tr key={s.productId ?? s.slug ?? i}>
                <Td className="font-medium">{s.productId ? <Link href={`/admin/products/${s.productId}`} className="hover:text-red">{s.name}</Link> : s.name}</Td>
                <Td className="u-mono">{s.units}</Td>
                <Td className="u-mono">{fmtUSD(s.revenue)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section aria-label="Recent orders">
        <div className="mb-3 flex items-center justify-between">
          <p className="u-label">Latest orders</p>
          <Link href="/admin/orders" className="u-label flex items-center gap-1.5 hover:text-bone">All orders <ArrowRight className="size-3" /></Link>
        </div>
        <Table head={["Order", "Customer", "Status", "Total", "Placed"]}>
          {recentOrders.map((o) => (
            <tr key={o.id}>
              <Td><Link href={`/admin/orders/${o.number}`} className="u-mono font-semibold hover:text-red">{o.number}</Link></Td>
              <Td className="truncate">{o.name}</Td>
              <Td><StatusBadge status={o.status} /></Td>
              <Td className="u-mono">{fmtUSD(o.total)}</Td>
              <Td className="u-label-txt">{fmtDate(o.placedAt)}</Td>
            </tr>
          ))}
        </Table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Low stock">
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert className="size-4 text-yellow" aria-hidden />
            <p className="u-label">Low stock</p>
          </div>
          {lowStock.length === 0 ? (
            <p className="u-label-txt border border-line px-4 py-3 font-mono">All units above threshold.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lowStock.map((p) => (
                <li key={p.id} className="border border-line bg-coal/60 px-4 py-3">
                  <Link href={`/admin/products/${p.id}`} className="text-[13px] font-semibold hover:text-red">{p.name}</Link>
                  <p className="u-label-txt mt-1">{p.stock} left · threshold {p.lowStockThreshold}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/products" className="u-label mt-3 inline-flex items-center gap-1.5 hover:text-bone"><Package className="size-3" /> Inventory</Link>
        </section>

        <section aria-label="Recent activity">
          <p className="u-label mb-3">Activity log</p>
          {activity.length === 0 ? (
            <p className="u-label-txt border border-line px-4 py-3 font-mono">Quiet pit lane.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-baseline gap-3 border-b border-line pb-1.5 text-[12px]">
                  <span className="u-mono font-bold text-red">{a.action}</span>
                  <span className="truncate text-fog">{a.detail || a.entity}</span>
                  <span className="u-label-txt ml-auto shrink-0">{a.actor}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
