"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
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
  const [items, setItems] = useState<OrderWithRelations[]>(orders);

  // Sync with server props when filters change
  const [prevProps, setPrevProps] = useState(orders);
  if (orders !== prevProps) {
    setPrevProps(orders);
    setItems(orders);
  }

  // Automatic real-time telemetry polling every 6 seconds so incoming orders appear instantly
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/orders");
        if (res.ok && active) {
          const data = (await res.json()) as { orders?: OrderWithRelations[] };
          if (Array.isArray(data.orders)) {
            setItems(data.orders);
          }
        }
      } catch {
        /* ignore network jitter */
      }
    };
    const timer = setInterval(poll, 6000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleStatusChange = (orderId: number, nextStatus: OrderStatus) => {
    setItems((current) =>
      current.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
  };

  if (items.length === 0) {
    return (
      <div className="u-card px-6 py-12 text-center flex flex-col items-center justify-center gap-2.5">
        <span className="flex items-center gap-2 text-xs text-fog">
          <span className="size-2 rounded-full bg-mint animate-pulse" /> Live Telemetry Listening
        </span>
        <p className="u-label-txt text-bone font-semibold">Nothing at this filter.</p>
        <p className="text-xs text-dim max-w-sm">
          New orders appear automatically the second customer checkout lands. You can also manually intake or recover an order using the card above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((o) => (
        <OrderCard key={o.id} order={o} onStatusChange={handleStatusChange} />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
}: {
  order: OrderWithRelations;
  onStatusChange: (id: number, s: OrderStatus) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const isAwaitingAcceptance = order.status === "PAYMENT_REVIEW" || order.status === "PENDING_PAYMENT";

  const handleAccept = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/orders?id=${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: "PAID", note: "Accepted by operator from Pit Wall" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to accept order");
      onStatusChange(order.id, "PAID");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to accept order");
    } finally {
      setBusy(false);
    }
  };

  const copyNumber = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(order.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`u-card p-5 flex flex-col justify-between transition-all ${
        isAwaitingAcceptance ? "border-yellow/50 bg-panel shadow-lg" : "hover:border-line-strong"
      }`}
    >
      <div>
        {/* Header: Number + Badges */}
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-1.5">
            <span className="u-mono text-sm font-black text-white">{order.number}</span>
            <button
              type="button"
              onClick={copyNumber}
              className="text-[11px] text-fog hover:text-white transition-colors"
              title="Copy Order Number"
            >
              {copied ? <Check className="size-3 text-mint inline" /> : <Copy className="size-3 inline" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {order.paymentChannel && (
              <span
                className={`u-badge text-[10px] font-bold ${
                  order.paymentChannel === "DISCORD"
                    ? "bg-red/20 text-red border-red/40"
                    : "bg-mint/20 text-mint border-mint/40"
                }`}
              >
                {order.paymentChannel}
              </span>
            )}
            <StatusBadge status={order.status} />
          </div>
        </div>

        {/* Customer & Address Details */}
        <div className="mt-3 flex flex-col gap-1 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-bone">{order.name}</span>
            <span className="u-mono text-sm font-black text-white">{fmtUSD(order.total)}</span>
          </div>
          <p className="text-fog text-[12px]">{order.email}</p>
          {order.phone && (
            <p className="text-dim text-[11px] flex items-center gap-1">
              <span>📞 {order.phone}</span>
              <a
                href={`https://wa.me/${order.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-mint hover:underline ml-1"
              >
                (WhatsApp ↗)
              </a>
            </p>
          )}
          {order.addressLine && (
            <p
              className="text-[11px] text-dim mt-1 truncate"
              title={`${order.addressLine}, ${order.city}, ${order.state} ${order.pincode}`}
            >
              📍 {order.city || "Pan-India"} · {order.pincode}
            </p>
          )}
        </div>

        {/* Items snapshot */}
        {order.items && order.items.length > 0 && (
          <div className="mt-2.5 rounded bg-surface/60 p-2 text-[11.5px] text-fog">
            {order.items.map((it) => (
              <p key={it.id} className="truncate">
                ×{it.qty} {it.name} <span className="text-dim">({fmtUSD(it.price * it.qty)})</span>
              </p>
            ))}
          </div>
        )}

        {/* Awaiting Acceptance Banner */}
        {isAwaitingAcceptance && (
          <div className="mt-3 rounded border border-yellow/40 bg-yellow/[0.06] p-2.5">
            <p className="text-[11px] font-bold text-yellow flex items-center gap-1">
              <span>⏳ Awaiting Your Acceptance</span>
            </p>
            <p className="text-[10.5px] text-fog mt-0.5 leading-snug">
              Order placed by customer via {order.paymentChannel || "Discord/WhatsApp"}. Verify payment receipt, then click accept below.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-line flex flex-col gap-2">
        {err && <p className="text-[11px] text-red">{err}</p>}

        {isAwaitingAcceptance ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              className="u-btn u-btn-primary bg-mint! text-ink! flex-1 py-2! text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-md"
            >
              <Check className="size-3.5" />
              <span>{busy ? "Accepting…" : "Accept Order (Mark Paid)"}</span>
            </button>
            <Link
              href={`/admin/orders/${order.id}`}
              className="u-btn u-btn-ghost px-2.5! py-2! text-xs"
              title="View full order details"
            >
              Details →
            </Link>
          </div>
        ) : order.status === "PAID" ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-mint font-semibold flex items-center gap-1">
              <Check className="size-3" /> Accepted &amp; Stock Reserved
            </span>
            <Link
              href={`/admin/orders/${order.id}`}
              className="u-btn u-btn-primary px-3! py-1.5! text-xs font-bold"
            >
              Pack &amp; Ship →
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-dim">{fmtDate(order.placedAt)}</span>
            <Link
              href={`/admin/orders/${order.id}`}
              className="text-xs text-red hover:text-white underline underline-offset-2"
            >
              Manage order →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderIntakeCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState("1999");
  const [channel, setChannel] = useState<"DISCORD" | "WHATSAPP">("DISCORD");
  const [status, setStatus] = useState<"PAID" | "PAYMENT_REVIEW">("PAID");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = orderNumber.trim();
    if (!cleanNum) {
      setError("Please enter the order number");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/orders/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderNumber: cleanNum.toUpperCase(),
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          total: total ? Number(total) * 100 : 199900,
          channel,
          status,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean; order?: { number: string } };
      if (!res.ok) throw new Error(data.error || "Failed to intake order");
      
      setSuccess(`Order #${cleanNum.toUpperCase()} registered and marked ${status}!`);
      setOrderNumber("");
      setName("");
      setEmail("");
      router.refresh();
      setTimeout(() => {
        setSuccess("");
        setOpen(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to intake order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-line bg-surface/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-bone">Order Intake &amp; Recovery</p>
          <p className="text-[12px] text-fog">Received an order on Discord #billing or WhatsApp? Intake it here to verify, accept &amp; ship.</p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(!open); setError(""); setSuccess(""); }}
          className="u-btn u-btn-primary px-3! py-1.5! text-xs font-bold"
        >
          {open ? "Close Intake" : "+ Intake Discord/WhatsApp Order"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleIntake} className="mt-4 border-t border-line/60 pt-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-1">
              <label className="u-label-txt block mb-1">Order Number *</label>
              <input
                required
                value={orderNumber}
                onChange={(e) => { setOrderNumber(e.target.value); setError(""); }}
                placeholder="BW-Z8NNPV-P7"
                className="u-input uppercase font-mono text-xs"
              />
            </div>
            <div>
              <label className="u-label-txt block mb-1">Customer Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Racer Name"
                className="u-input text-xs"
              />
            </div>
            <div>
              <label className="u-label-txt block mb-1">Customer Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@gmail.com"
                className="u-input text-xs"
              />
            </div>
            <div>
              <label className="u-label-txt block mb-1">Amount (₹)</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="1999"
                className="u-input text-xs font-mono"
              />
            </div>
            <div>
              <label className="u-label-txt block mb-1">Route &amp; Status</label>
              <div className="flex gap-1">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "DISCORD" | "WHATSAPP")}
                  className="u-input text-xs w-1/2!"
                >
                  <option value="DISCORD">Discord</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "PAID" | "PAYMENT_REVIEW")}
                  className="u-input text-xs w-1/2!"
                >
                  <option value="PAID">PAID</option>
                  <option value="PAYMENT_REVIEW">Review</option>
                </select>
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red font-medium">{error}</p>}
          {success && <p className="text-xs text-mint font-medium">{success}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={busy || !orderNumber.trim()}
              className="u-btn u-btn-primary bg-mint! text-ink! text-xs font-bold px-4! py-2! disabled:opacity-50"
            >
              {busy ? "Registering…" : "Register in Orders List →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
