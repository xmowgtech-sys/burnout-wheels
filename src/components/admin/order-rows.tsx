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
  const [shipAwb, setShipAwb] = useState(order.shiprocketAwb ?? "");
  const [shipOrderId, setShipOrderId] = useState(order.shiprocketOrderId ?? "");
  const [shipLabelUrl, setShipLabelUrl] = useState(order.shiprocketLabelUrl ?? "");
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

  const saveShiprocket = () => {
    patch({
      shiprocketAwb: shipAwb,
      shiprocketOrderId: shipOrderId,
      shiprocketLabelUrl: shipLabelUrl,
      trackingCarrier: "Shiprocket",
      trackingNumber: shipAwb,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {err && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{err}</p>}

      {/* status transitions */}
      <div className="u-card p-5">
        <p className="u-label">Fulfilment flow</p>
        {order.paymentChannel && (
          <p className="mt-2 text-[12px] font-semibold text-mint">
            Payment route: {order.paymentChannel === "DISCORD" ? "Discord (#billing channel)" : "WhatsApp direct message"}
          </p>
        )}
        {order.status === "PENDING_PAYMENT" && (
          <p className="u-label-txt mt-2">
            {order.paymentMethod === "UPI"
              ? `Awaiting customer payment via ${order.paymentChannel ?? "Discord/WhatsApp"}. Confirm after payment lands.`
              : "COD order — confirm only after the ₹200 online advance lands."}
          </p>
        )}
        {order.status === "PAYMENT_REVIEW" && (
          <div className="mt-3 border-l-2 border-sky bg-sky/5 p-3">
            <p className="text-[13px] font-semibold text-sky">Payment submitted by customer — ready to verify</p>
            <p className="u-label-txt mt-1">
              Check {order.paymentChannel === "DISCORD" ? "Discord #billing" : "WhatsApp"} for order number <strong className="text-bone">{order.number}</strong>. Once payment is verified, accept the order below.
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {NEXT[order.status]?.map((to) => (
            <button
              key={to}
              disabled={busy}
              onClick={() => (to === "CANCELLED" ? setConfirmCancel(true) : to === "REFUNDED" ? setConfirmRefund(true) : patch({ to, trackingCarrier: trackingC || order.trackingCarrier || "", trackingNumber: trackingN || order.trackingNumber || "" }))}
              className={to === "REFUNDED" || to === "CANCELLED" ? "u-btn u-btn-danger" : to === "PAID" ? "u-btn u-btn-primary bg-mint! text-ink! font-bold" : "u-btn u-btn-primary"}
            >
              {to === "PAID" ? "✓ Accept Order (Payment Verified)" : `→ ${LABELS[to] ?? to}`}
            </button>
          ))}
          {order.status === "DELIVERED" && <p className="u-label-txt self-center">Delivered — only refund actions remain.</p>}
        </div>
      </div>

      {/* Shiprocket Fulfilment Card */}
      <div className="u-card p-5">
        <div className="flex items-center justify-between">
          <p className="u-label">Shiprocket Fulfilment</p>
          <a
            href="https://app.shiprocket.in/orders"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-red underline underline-offset-2 hover:text-white"
          >
            Open Shiprocket ↗
          </a>
        </div>
        <p className="u-label-txt mt-1">Dispatch parcel using Shiprocket with customer delivery address.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="u-label-txt">Shiprocket AWB Number</span>
            <input
              value={shipAwb}
              onChange={(e) => setShipAwb(e.target.value)}
              placeholder="e.g. 143256789012"
              className="u-input mt-1.5"
            />
          </label>
          <label className="block">
            <span className="u-label-txt">Shiprocket Order ID</span>
            <input
              value={shipOrderId}
              onChange={(e) => setShipOrderId(e.target.value)}
              placeholder="e.g. SR-892147"
              className="u-input mt-1.5"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="u-label-txt">Shipping Label / Tracking Link (optional)</span>
            <input
              value={shipLabelUrl}
              onChange={(e) => setShipLabelUrl(e.target.value)}
              placeholder="https://shiprocket.co/tracking/..."
              className="u-input mt-1.5"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button disabled={busy} onClick={saveShiprocket} className="u-btn u-btn-primary">
            Save Shiprocket Info
          </button>
          {order.shiprocketAwb ? (
            <span className="u-mono text-[12px] text-mint">AWB: {order.shiprocketAwb}</span>
          ) : null}
        </div>
      </div>

      {/* tracking */}
      <div className="u-card p-5">
        <p className="u-label">Manual Tracking / Courier</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-40">
            <span className="u-label-txt">Carrier</span>
            <input value={trackingC} onChange={(e) => setTrackingC(e.target.value)} placeholder={order.trackingCarrier ?? "Shiprocket / Delhivery / BlueDart"} className="u-input mt-1.5" />
          </label>
          <label className="block flex-1 min-w-40">
            <span className="u-label-txt">Tracking number</span>
            <input value={trackingN} onChange={(e) => setTrackingN(e.target.value)} placeholder={order.trackingNumber ?? "AWB…"} className="u-input mt-1.5" />
          </label>
          <button disabled={busy} onClick={() => patch({ trackingCarrier: trackingC, trackingNumber: trackingN })} className="u-btn u-btn-ghost">Save Courier</button>
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
  PAYMENT_REVIEW: "Review payment",
  PAID: "Paid — reserve stock",
  PACKING: "Packing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancel",
  REFUNDED: "Refund",
};

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_REVIEW", "PAID", "CANCELLED"],
  PAYMENT_REVIEW: ["PAID", "CANCELLED"],
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
            <div className="flex items-center gap-1.5">
              {o.paymentChannel && (
                <span className="u-badge border-line text-[10px] text-dim">{o.paymentChannel}</span>
              )}
              <StatusBadge status={o.status} />
            </div>
          </div>
          <p className="mt-2 truncate text-[13px] font-medium">{o.name} <span className="text-dim">· {o.email}</span></p>
          <p className="u-label-txt mt-1">{fmtDate(o.placedAt)} · {o.paymentMethod} · {o.shippingMethod}</p>
          <p className="u-mono mt-2 text-lg font-bold">{fmtUSD(o.total)}</p>
        </Link>
      ))}
    </div>
  );
}
