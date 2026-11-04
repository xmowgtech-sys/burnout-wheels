"use client";

import Image from "next/image";
import Link from "next/link";
import { OrderActions } from "@/components/admin/order-rows";
import { StatusBadge } from "@/components/admin/admin-ui";
import { fmtUSD, fmtDate } from "@/lib/money";
import type { OrderWithRelations } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export function AdminOrderDetailView({ order }: { order: OrderWithRelations }) {
  const formattedPlacedDate = new Date(order.placedAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const taxesAmount = order.taxesTotal ?? Math.round(order.subtotal * 0.18);
  const paymentStatus =
    order.paymentStatus ||
    (order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_REVIEW" ? "PENDING" : "PAID");

  return (
    <div className="flex flex-col gap-8">
      {order.isArchived ? (
        <div className="flex items-center justify-between rounded-lg border border-red/40 bg-red/10 p-4 text-[13px] text-red">
          <div className="flex items-center gap-2">
            <span className="font-semibold">⚠️ Archived Order:</span>
            <span>
              This order was soft-deleted{order.archivedAt ? ` on ${fmtDate(order.archivedAt)}` : ""}. It is hidden from standard views.
            </span>
          </div>
          <span className="rounded bg-red/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">Archived</span>
        </div>
      ) : null}

      <div>
        <Link href="/admin/orders" className="text-xs text-fog hover:text-white transition-colors inline-flex items-center gap-1.5 mb-2">
          <ArrowLeft className="size-3" /> Back to Orders
        </Link>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <p className="u-label">Order</p>
              <span className="text-xs text-fog">· Placed {formattedPlacedDate}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                paymentStatus === "PAID" ? "bg-mint/15 text-mint" : "bg-yellow/15 text-yellow"
              }`}>
                Payment {paymentStatus}
              </span>
            </div>
            <h1 className="u-h1 mt-2 text-3xl md:text-4xl">{order.number}</h1>
          </div>
          <StatusBadge status={order.status} />
        </header>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-8">
          {/* Settlement */}
          <section className="u-card p-5">
            <p className="u-label">Settlement</p>
            <dl className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2 text-[13px]">
              {[
                ["Subtotal", fmtUSD(order.subtotal)],
                ["Discount", order.discountTotal > 0 ? `−${fmtUSD(order.discountTotal)} (${order.discountCode || "CODE"})` : "—"],
                ["Shipping", order.shippingFee === 0 ? "FREE" : fmtUSD(order.shippingFee)],
                ["Taxes (GST 18% incl.)", fmtUSD(taxesAmount)],
                ["Total charge", fmtUSD(order.total)],
                ["Unit cost", fmtUSD(order.costTotal)],
                ["Payment fees", fmtUSD(order.feesTotal)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-1.5">
                  <dt className="text-fog">{k}</dt><dd className="u-mono">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 sm:col-span-2">
                <dt className="font-bold">Profit</dt>
                <dd className={`u-mono font-bold ${order.profit >= 0 ? "text-mint" : "text-red"}`}>{fmtUSD(order.profit)}</dd>
              </div>
            </dl>
          </section>

          {/* Line Items */}
          <section>
            <p className="u-label mb-3">Items</p>
            <ul className="flex flex-col gap-3">
              {order.items && order.items.length > 0 ? (
                order.items.map((it) => (
                  <li key={it.id} className="u-card flex items-center gap-4 p-3">
                    <span className="u-media relative size-14 shrink-0 bg-surface/50 rounded overflow-hidden">
                      {it.image ? (
                        <Image src={it.image} alt={it.name} fill sizes="56px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-dim">Piece</div>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{it.name}</span>
                      <span className="u-label-txt">
                        ×{it.qty} @ {fmtUSD(it.price)} each · {it.condition ?? "NEW"}{it.scale ? ` · ${it.scale}` : ""} · cost {fmtUSD(it.cost || 0)}
                      </span>
                    </span>
                    <span className="u-mono text-[13px] font-bold">{fmtUSD(it.price * it.qty)}</span>
                  </li>
                ))
              ) : (
                <li className="u-card p-4 text-xs text-fog">Order line item registered with total {fmtUSD(order.total)}</li>
              )}
            </ul>
          </section>

          {/* Audit trail */}
          <section>
            <p className="u-label mb-3">Audit trail</p>
            <ol className="flex flex-col">
              {order.events && order.events.length > 0 ? (
                order.events.map((ev) => (
                  <li key={ev.id} className="flex gap-4 border-b border-line py-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red" aria-hidden />
                    <span>
                      <span className="block text-[13px] font-semibold">{ev.status.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="u-label-txt block">{fmtDate(ev.createdAt)}{ev.actor ? ` · by ${ev.actor}` : ""}{ev.note ? ` — ${ev.note}` : ""}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-xs text-dim">Placed on {fmtDate(order.placedAt)}</li>
              )}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <div className="u-card p-5">
            <div className="flex items-center justify-between">
              <p className="u-label">Customer</p>
              <Link
                href={`/admin/customers/${encodeURIComponent(order.email)}`}
                className="text-xs text-mint hover:underline font-medium flex items-center gap-1"
              >
                View Profile ↗
              </Link>
            </div>
            <Link
              href={`/admin/customers/${encodeURIComponent(order.email)}`}
              className="mt-3 block text-[15px] font-semibold text-white hover:text-mint transition-colors"
            >
              {order.name}
            </Link>
            <p className="u-label-txt mt-1">{order.email}</p>
            {order.phone ? <p className="u-label-txt">{order.phone}</p> : null}

            <div className="mt-4 pt-4 border-t border-line space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fog">Delivery Address</p>
                <p className="u-label-txt mt-1 leading-relaxed text-[13px] text-white/90">
                  {order.addressLine || "Address on record"},<br />
                  {order.city || "Chandigarh"}, {order.state || "Punjab"} {order.pincode || "160017"},<br />
                  {order.country || "India"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fog">Billing Address</p>
                <p className="u-label-txt mt-1 leading-relaxed text-[13px] text-white/90">
                  {order.billingAddress ? order.billingAddress : (
                    <span>Same as delivery address ({order.addressLine || "Default"}, {order.city || "Chandigarh"})</span>
                  )}
                </p>
              </div>
            </div>

            {order.notes ? (
              <p className="mt-4 border-l-2 border-yellow bg-yellow/5 px-3 py-2 text-[12px] italic text-fog">
                <strong className="not-italic text-white font-medium block mb-0.5">Order Note:</strong>
                {order.notes}
              </p>
            ) : (
              <p className="mt-4 border border-line/60 bg-surface/30 px-3 py-2 text-[12px] text-dim">
                No customer notes attached.
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-line space-y-1.5">
              <p className="u-label-txt">
                Payment: <strong className="text-white">{order.paymentMethod}</strong>
                {order.paymentChannel ? ` · via ${order.paymentChannel}` : ""}
                <span className={`ml-2 text-xs font-semibold ${paymentStatus === "PAID" ? "text-mint" : "text-yellow"}`}>
                  ({paymentStatus})
                </span>
              </p>
              <p className="u-label-txt">
                Delivery Method: <strong className="text-white">{order.shippingMethod}</strong>
              </p>
              {order.trackingCarrier || order.trackingNumber ? (
                <p className="text-[12px] text-mint">
                  Tracking: <strong>{order.trackingCarrier || "Carrier"}</strong> · <span className="font-mono">{order.trackingNumber}</span>
                </p>
              ) : null}
              {order.shiprocketAwb ? (
                <p className="text-[12px] text-mint">
                  Shiprocket AWB: <strong className="font-mono">{order.shiprocketAwb}</strong>
                </p>
              ) : null}
              {order.refundedAt ? <p className="u-label-txt mt-1 text-red font-medium">Refunded {fmtDate(order.refundedAt)}</p> : null}
            </div>
          </div>
          <OrderActions order={order} />
        </div>
      </div>
    </div>
  );
}

