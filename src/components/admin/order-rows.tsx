"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge, ConfirmDialog } from "@/components/admin/admin-ui";
import { fmtUSD, fmtDate } from "@/lib/money";
import type { OrderWithRelations, OrderStatus } from "@/lib/types";

export function OrderActions({ order }: { order: OrderWithRelations }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [trackingC, setTrackingC] = useState("");
  const [trackingN, setTrackingN] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/orders?id=${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Update failed");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {err && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{err}</p>}

      {/* status transitions */}
      <div className="u-card p-5">
        <p className="u-label">Fulfilment flow</p>
        {order.status === "PENDING_PAYMENT" && (
          <p className="u-label-txt mt-2">
            {order.paymentMethod === "UPI"
              ? `Confirm only after the UPI payment lands. Customer email: ${order.email}.`
              : "COD order — it flips to PAID when the courier hands over the cash. Confirm carefully."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {NEXT[order.status].map((to) => (
            <button
              key={to}
              disabled={busy}
              onClick={() => (to === "CANCELLED" ? setConfirmCancel(true) : to === "REFUNDED" ? setConfirmRefund(true) : patch({ to, trackingCarrier: trackingC || order.trackingCarrier || "", trackingNumber: trackingN || order.trackingNumber || "" }))}
              className={to === "REFUNDED" || to === "CANCELLED" ? "u-btn u-btn-danger" : "u-btn u-btn-primary"}
            >
              → {LABELS[to]}
            </button>
          ))}
          {order.status === "DELIVERED" && <p className="u-label-txt self-center">Delivered — only refund actions remain.</p>}
        </div>
      </div>

      {/* tracking */}
      <div className="u-card p-5">
        <p className="u-label">Shipment tracking</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-40">
            <span className="u-label-txt">Carrier</span>
            <input value={trackingC} onChange={(e) => setTrackingC(e.target.value)} placeholder={order.trackingCarrier ?? "Delhivery / BlueDart"} className="u-input mt-1.5" />
          </label>
          <label className="block flex-1 min-w-40">
            <span className="u-label-txt">Tracking number</span>
            <input value={trackingN} onChange={(e) => setTrackingN(e.target.value)} placeholder={order.trackingNumber ?? "AWB…"} className="u-input mt-1.5" />
          </label>
          <button disabled={busy} onClick={() => patch({ trackingCarrier: trackingC, trackingNumber: trackingN })} className="u-btn u-btn-primary">Save</button>
        </div>
        {order.trackingNumber ? <p className="u-label-txt mt-2">Current: {order.trackingCarrier} · {order.trackingNumber}</p> : null}
      </div>

      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this order?" body="Stock returns to the shelf automatically. Unpaid or paid — it can be refunded separately from PAID." confirmLabel="Cancel order" danger onConfirm={() => patch({ to: "CANCELLED" })} />
      <ConfirmDialog open={confirmRefund} onClose={() => setConfirmRefund(false)} title="Mark as refunded?" body="Customer receives their money back via the original payment rail; inventory is restored." confirmLabel="Mark refunded" danger onConfirm={() => patch({ to: "REFUNDED" })} />
      <Link href="/admin/orders" className="u-btn u-btn-ghost self-start">Back to orders</Link>
    </div>
  );
}

const LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid — reserve stock",
  PACKING: "Packing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancel",
  REFUNDED: "Refund",
};

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PACKING", "CANCELLED", "REFUNDED"],
  PACKING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function OrdersTable({ orders }: { orders: OrderWithRelations[] }) {
  return (
    <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((o) => (
        <Link key={o.id} href={`/admin/orders/${o.id}`} className="u-card p-4 transition-colors hover:border-line-strong">
          <div className="flex items-center justify-between gap-3">
            <span className="u-mono text-[13px] font-bold">{o.number}</span>
            <StatusBadge status={o.status} />
          </div>
          <p className="mt-2 truncate text-[13px] font-medium">{o.name} <span className="text-dim">· {o.email}</span></p>
          <p className="u-label-txt mt-1">{fmtDate(o.placedAt)} · {o.paymentMethod} · {o.shippingMethod}</p>
          <p className="u-mono mt-2 text-lg font-bold">{fmtUSD(o.total)}</p>
        </Link>
      ))}
    </div>
  );
}
