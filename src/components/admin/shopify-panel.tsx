"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCcw, Trash2, XCircle } from "lucide-react";
import { Field, Table, Td } from "@/components/admin/admin-ui";
import type { SyncLog } from "@/lib/types";

interface Props {
  connected: boolean;
  domain: string;
  apiVersion: string;
  secretSet: boolean;
  logs: SyncLog[];
}

type Job = "full" | "products" | "orders" | "customers" | "inventory";

const JOB_LABELS: Record<Job, string> = {
  full: "Full sync",
  products: "Products",
  orders: "Orders",
  customers: "Customers",
  inventory: "Inventory",
};

export function ShopifyPanel({ connected, domain, apiVersion, secretSet, logs }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ shopDomain: domain, adminToken: "", webhookSecret: "", apiVersion });
  const [busyJob, setBusyJob] = useState<Job | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const connect = async () => {
    setErr("");
    setMsg("");
    const res = await fetch("/api/shopify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = (await res.json()) as { ok?: boolean; note?: string; error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Connection failed.");
      return;
    }
    setMsg(data.note ?? "Connected.");
    setForm((f) => ({ ...f, adminToken: "" }));
    router.refresh();
  };

  const disconnect = async () => {
    setErr("");
    setMsg("");
    const res = await fetch("/api/shopify", { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setErr(d.error ?? "Disconnect failed.");
      return;
    }
    setMsg("Disconnected — synced rows remain, marked SHOPIFY.");
    router.refresh();
  };

  const runJob = async (job: Job) => {
    setBusyJob(job);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/shopify", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ job }) });
      const data = (await res.json()) as { products?: number; orders?: number; customers?: number; inventory?: number; error?: string; items?: number };
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setMsg("Sync complete" + (data.products !== undefined ? ` — ${data.products} products, ${data.orders} orders, ${data.customers} customers, ${data.inventory} inventory rows.` : (data.items !== undefined ? ` — ${data.items} rows.` : ".")));
      router.refresh();
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Sync failed.");
    } finally {
      setBusyJob(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {msg && <p role="status" className="border border-mint/50 bg-mint/[0.07] px-4 py-3 text-[13px] text-mint">{msg}</p>}
      {err && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{err}</p>}

      <section className="u-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="u-h3">Connection</p>
            <p className="u-label-txt mt-1">
              {connected
                ? <>Connected to <span className="u-mono text-bone">{domain}</span> · Admin API {apiVersion} · webhook secret {secretSet ? "set" : "not set — webhook events will be rejected"}</>
                : "Not connected — create a custom app in Shopify admin (Admin API access token with read_products, read_orders, read_customers, read_inventory scopes)."}
            </p>
          </div>
          {connected && (
            <button onClick={disconnect} className="u-btn u-btn-danger text-[12px]!"><Trash2 className="size-3.5" aria-hidden /> Disconnect</button>
          )}
        </div>

        {!connected && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Shop domain *"><input value={form.shopDomain} onChange={(e) => setForm((f) => ({ ...f, shopDomain: e.target.value }))} placeholder="pit-lane.myshopify.com" className="u-input" /></Field>
            <Field label="Admin API token *"><input value={form.adminToken} onChange={(e) => setForm((f) => ({ ...f, adminToken: e.target.value }))} placeholder="shpat_…" className="u-input font-mono! text-[13px]!" /></Field>
            <Field label="Webhook secret" hint="From your Shopify webhook notification — verifies every incoming event">
              <input value={form.webhookSecret} onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))} className="u-input font-mono! text-[13px]!" />
            </Field>
            <Field label="API version"><input value={form.apiVersion} onChange={(e) => setForm((f) => ({ ...f, apiVersion: e.target.value }))} placeholder="2024-10" className="u-input" /></Field>
            <div className="md:col-span-2">
              <button onClick={connect} className="u-btn u-btn-primary">Connect Shopify</button>
            </div>
          </div>
        )}
      </section>

      <section className="u-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="u-h3">Run a sync</p>
            <p className="u-label-txt mt-1">Retries on rate limits & 5xx automatically; every attempt is logged below and on Monitoring.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(JOB_LABELS) as Job[]).map((j) => (
              <button key={j} disabled={!connected || busyJob !== null} onClick={() => runJob(j)} className="u-btn u-btn-ghost text-[12px]! disabled:opacity-40">
                {busyJob === j ? <RefreshCcw className="size-3.5 animate-spin" aria-hidden /> : null} {JOB_LABELS[j]}
              </button>
            ))}
          </div>
        </div>
        <p className="u-label-txt mt-3 text-dim!">Store currency must be INR — this ledger is minor-paise. Synced rows are tagged <span className="u-mono">SHOPIFY</span> and kept even after disconnect.</p>
      </section>

      <section>
        <p className="u-label mb-3">Sync log</p>
        {logs.length === 0 ? (
          <p className="u-label-txt">No syncs yet.</p>
        ) : (
          <Table head={["When", "Job", "Status", "Rows", "Duration", "Detail"]}>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="u-mono text-[12px]!">{new Date(l.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</Td>
                <Td>{l.job}</Td>
                <Td>
                  <span className={`u-badge ${l.status === "OK" ? "border-mint text-mint" : "border-red text-red"}`}>
                    {l.status === "OK" ? <CheckCircle2 className="mr-1 inline size-3" aria-hidden /> : <XCircle className="mr-1 inline size-3" aria-hidden />}
                    {l.status}
                  </span>
                </Td>
                <Td className="u-mono">{l.items}</Td>
                <Td className="u-mono text-[12px]!">{(l.durationMs / 1000).toFixed(1)}s</Td>
                <Td className="max-w-xs truncate text-[12px]! text-fog" title={l.detail}>{l.detail}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section className="u-card p-5">
        <p className="u-h3">Webhook topics</p>
        <p className="u-label-txt mt-1">In Shopify → Settings → Notifications → Webhooks, point these at <span className="u-mono text-bone">/api/webhooks/shopify</span> (JSON format). Events re-verify the HMAC signature, and failed processing returns 500 so Shopify retries.</p>
        <ul className="u-mono mt-3 flex flex-wrap gap-2 text-[12px]">
          {["products/create", "products/update", "orders/create", "orders/updated", "orders/cancelled", "refunds/create"].map((t) => (
            <li key={t} className="border border-line px-2.5 py-1.5 text-fog">{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
