import { Download } from "lucide-react";
import { AreaChart, StatCard, Table, Td } from "@/components/admin/admin-ui";
import { fmtUSD } from "@/lib/money";
import { monthlySeries, pnlPerProduct, overview } from "@/lib/finance";
import { sessionsSince } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance · Pit wall", robots: { index: false } };

export default async function FinancePage() {
  const stats = overview(sessionsSince(28));
  const months = monthlySeries(12);
  const pnl = pnlPerProduct();

  const revenue12 = months.reduce((a, m) => a + m.revenue, 0);
  const cost12 = months.reduce((a, m) => a + m.cost, 0);
  const fees12 = months.reduce((a, m) => a + m.fees, 0);
  const profit12 = months.reduce((a, m) => a + m.profit, 0);
  const refunds12 = months.reduce((a, m) => a + m.refunds, 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="u-label">Money room</p>
          <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Finance</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export?type=orders" className="u-btn u-btn-ghost"><Download className="size-4" /> Orders CSV</a>
          <a href="/api/admin/export?type=products" className="u-btn u-btn-ghost"><Download className="size-4" /> Products CSV</a>
          <a href="/api/admin/export?type=pnl" className="u-btn u-btn-ghost"><Download className="size-4" /> P&L CSV</a>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue · 12mo" value={fmtUSD(revenue12)} sub={`28d: ${fmtUSD(stats.revenue28)}`} tone="good" />
        <StatCard label="Costs · 12mo" value={fmtUSD(cost12)} sub={`fees ${fmtUSD(fees12)} · refunds ${fmtUSD(refunds12)}`} />
        <StatCard label="Profit · 12mo" value={fmtUSD(profit12)} sub={`28d: ${fmtUSD(stats.profit28)}`} tone={profit12 >= 0 ? "good" : "bad"} />
        <StatCard label="Refunds · 12mo" value={fmtUSD(refunds12)} sub="money out the door" tone={refunds12 > 0 ? "warn" : "neutral"} />
      </section>

      <section className="u-card p-5">
        <p className="u-label">Monthly P&L</p>
        <div className="mt-4"><AreaChart points={months.map((m) => m.profit / 100)} /></div>
      </section>

      <section>
        <p className="u-label mb-3">Monthly detail</p>
        <Table head={["Month", "Revenue", "Cost", "Fees", "Profit", "Orders", "Refunds"]}>
          {months.map((m) => (
            <tr key={m.month}>
              <Td className="u-mono font-semibold">{m.month}</Td>
              <Td className="u-mono">{m.revenue ? fmtUSD(m.revenue) : "—"}</Td>
              <Td className="u-mono">{m.cost ? fmtUSD(m.cost) : "—"}</Td>
              <Td className="u-mono">{m.fees ? fmtUSD(m.fees) : "—"}</Td>
              <Td className={m.profit >= 0 ? "u-mono text-mint" : "u-mono text-red"}>{m.profit ? fmtUSD(m.profit) : "—"}</Td>
              <Td className="u-mono">{m.orders}</Td>
              <Td className="u-mono">{m.refunds ? `−${fmtUSD(m.refunds)}` : "—"}</Td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <p className="u-label mb-3">Profit per product</p>
        {pnl.length === 0 ? (
          <p className="u-card px-6 py-10 text-center u-label-txt">No order lines yet — margins appear with the first confirmed order.</p>
        ) : (
          <Table head={["Product", "Units sold", "Revenue", "Cost", "Profit", "Margin"]}>
            {pnl.map((row) => (
              <tr key={row.productId ?? row.name}>
                <Td className="font-medium">{row.name}</Td>
                <Td className="u-mono">{row.units}</Td>
                <Td className="u-mono">{fmtUSD(row.revenue)}</Td>
                <Td className="u-mono">{fmtUSD(row.cost)}</Td>
                <Td className="u-mono font-bold">{fmtUSD(row.profit)}</Td>
                <Td className="u-mono">{row.revenue > 0 ? `${Math.round((row.profit / row.revenue) * 100)}%` : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
