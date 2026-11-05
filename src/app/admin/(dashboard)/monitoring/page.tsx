import Link from "next/link";
import { AlertTriangle, Activity, CheckCircle2, Mail, Package, XCircle } from "lucide-react";
import { Table, StatCard, Td } from "@/components/admin/admin-ui";
import { recentEvents, eventCounts, funnel, recentSyncs, recentUnreadMail, alerts } from "@/lib/ops";
import { listProducts } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { sessionsSince, visitsSeries } from "@/lib/analytics";
import type { OpsEvent, SyncLog, Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitoring — Pit wall" };

const LEVEL_TONE: Record<string, string> = { ERROR: "border-red text-red", WARN: "border-yellow text-yellow", INFO: "border-sky text-sky" };

function ago(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.round(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function MonitoringPage() {
  await ensureCatalogHydrated();
  const products = listProducts({ status: "ACTIVE" });
  const counts = eventCounts(24);
  const events = recentEvents(60);
  const steps = funnel(24);
  const syncs = recentSyncs(10);
  const outbox = recentUnreadMail(10);
  const alertRows = alerts(products);
  const visits = visitsSeries(14);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Ops telemetry</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Monitoring</h1>
        <p className="u-label-txt mt-2">Errors, failed requests and uploads, performance, drop-offs — the last 24 hours at a glance. Privacy-aware: no form values, no passwords, no tokens ever stored.</p>
      </header>

      {/* alerts */}
      {alertRows.length > 0 && (
        <section className="u-card p-5">
          <p className="u-h3 flex items-center gap-2"><AlertTriangle className="size-4 text-yellow" aria-hidden /> Active alerts</p>
          <ul className="mt-4 space-y-2">
            {alertRows.map((a) => (
              <li key={a.key} className="flex items-center gap-3 text-[13px]">
                <span className={`u-badge ${LEVEL_TONE[a.level] ?? ""}`}>{a.level}</span>
                {a.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events recorded (24h)" value={String(counts.total)} sub="all ops events" />
        <StatCard label="Errors (24h)" value={String(counts.errors)} tone={counts.errors > 0 ? "bad" : "good"} sub={counts.errors === 0 ? "clean slate" : "see log below"} />
        <StatCard label="Failed uploads (24h)" value={String(counts.uploadFails)} tone={counts.uploadFails > 0 ? "warn" : "good"} sub="product photo errors" />
        <StatCard label="API failures (24h)" value={String(counts.apiFails)} tone={counts.apiFails > 0 ? "bad" : "good"} sub="5xx / crashes logged server-side" />
      </section>

      {/* funnel */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="u-card p-5">
          <p className="u-h3">User flow (24h, consented sessions)</p>
          <ol className="mt-4 flex flex-col gap-0">
            {steps.filter((s) => s.type.startsWith("flow_")).map((s, i) => {
              const prev = i > 0 ? steps[i - 1]!.count : 0;
              const pct = i === 0 ? null : prev > 0 ? Math.round((s.count / prev) * 100) : null;
              return (
                <li key={s.type} className="border-b border-line py-3 last:border-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[13px]">{s.label}</span>
                    <span className="u-mono text-sm font-bold">{s.count}</span>
                  </div>
                  {pct !== null && (
                    <p className={`u-label-txt mt-1 ${pct < 60 ? "text-yellow" : "text-fog"}`}>{pct}% of previous step</p>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="u-label-txt mt-3">Drop-offs</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {steps.filter((s) => s.type.startsWith("drop_")).map((s) => (
              <li key={s.type} className="flex items-center justify-between gap-4 text-[13px] text-fog">
                {s.label} <span className="u-mono">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="u-card p-5">
          <p className="u-h3 flex items-center gap-2"><Activity className="size-4 text-red" aria-hidden /> Traffic</p>
          <p className="u-mono mt-3 text-[26px] font-bold">{sessionsSince(1)}<span className="text-fog text-sm font-normal"> sessions today</span></p>
          <div className="mt-4 flex h-16 items-end gap-1" role="img" aria-label="Sessions last 14 days">
            {visits.map((v, i) => {
              const max = Math.max(...visits.map((x) => x.count), 1);
              return (
                <div key={v.day} className="flex-1 bg-red/70 hover:bg-red" style={{ height: `${Math.max((v.count / max) * 100, 4)}%` }} title={`${v.day}: ${v.count}`} />
              );
            })}
          </div>
          <p className="u-label-txt mt-2 text-dim!">Counts only rise after visitors allow analytics cookies.</p>
        </div>
      </section>

      {/* events */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="u-label">Recent events</p>
          <span className="u-label-txt text-dim!">{counts.slowPages > 0 ? `${counts.slowPages} slow page report(s) in 24h` : ""}</span>
        </div>
        {events.length === 0 ? (
          <p className="u-label-txt">Nothing recorded in the window — quiet pit wall.</p>
        ) : (
          <Table head={["When", "Level", "Type", "Where", "Message"]}>
            {events.map((e) => (
              <tr key={e.id}>
                <Td className="u-mono text-[12px]! whitespace-nowrap">{ago(e.createdAt)}</Td>
                <Td><span className={`u-badge ${LEVEL_TONE[e.level] ?? ""}`}>{e.level}</span></Td>
                <Td className="u-mono text-[12px]!">{e.type}</Td>
                <Td className="u-mono text-[12px]! max-w-[160px] truncate" title={e.path}>{e.path}</Td>
                <Td className="text-[12.5px]! text-fog"><span title={e.meta}>{e.message}</span></Td>              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* syncs */}
        <div>
          <p className="u-label mb-3">
            <Link href="/admin/shopify" className="hover:text-bone">Shopify syncs →</Link>
          </p>
          {syncs.length === 0 ? <p className="u-label-txt">No sync activity yet.</p> : (
            <ul className="u-card divide-y divide-line">
              {syncs.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  {s.status === "OK" ? <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden /> : <XCircle className="size-4 shrink-0 text-red" aria-hidden />}
                  <span className="u-mono text-[12px]!">{s.job}</span>
                  <span className="truncate text-fog">{s.detail || `${s.items} rows`}</span>
                  <span className="u-label ml-auto text-dim!">{ago(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* outbox */}
        <div>
          <p className="u-label mb-3"><Mail className="mr-1 inline size-3.5" aria-hidden /> Mail outbox (SMTP off = parked here)</p>
          {outbox.length === 0 ? <p className="u-label-txt">Nothing queued.</p> : (
            <ul className="u-card divide-y divide-line">
              {outbox.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  {m.delivered ? <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden /> : <AlertTriangle className="size-4 shrink-0 text-yellow" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.subject}</span>
                    <span className="u-label-txt text-dim!">{m.toEmail}</span>
                  </span>
                  <span className="u-label text-dim!">{ago(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* low stock */}
      <section>
        <p className="u-label mb-3"><Package className="mr-1 inline size-3.5" aria-hidden /> Low stock shelf</p>
        {(() => {
          const low = products.filter((p) => p.stock <= p.lowStockThreshold);
          if (low.length === 0) return <p className="u-label-txt">All healthy — nothing beneath its threshold.</p>;
          return (
            <ul className="u-card divide-y divide-line">
              {low.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="u-mono text-yellow">{p.stock}</span> {p.name}
                  <span className="u-label ml-auto text-dim!">threshold {p.lowStockThreshold}</span>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>
    </div>
  );
}
