import Image from "next/image";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/admin/order-rows";
import { StatusBadge } from "@/components/admin/admin-ui";
import { adminGetOrder } from "@/lib/orders";
import { fmtUSD, fmtDate } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order · Pit wall", robots: { index: false } };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = adminGetOrder(Number(id));
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="u-label">Order</p>
          <h1 className="u-h1 mt-2 text-3xl md:text-4xl">{order.number}</h1>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-8">
          {/* money */}
          <section className="u-card p-5">
            <p className="u-label">Settlement</p>
            <dl className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2 text-[13px]">
              {[
                ["Subtotal", fmtUSD(order.subtotal)],
                ["Discount", order.discountTotal > 0 ? `−${fmtUSD(order.discountTotal)} (${order.discountCode})` : "—"],
                ["Shipping", order.shippingFee === 0 ? "FREE" : fmtUSD(order.shippingFee)],
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

          {/* items */}
          <section>
            <p className="u-label mb-3">Items</p>
            <ul className="flex flex-col gap-3">
              {order.items.map((it) => (
                <li key={it.id} className="u-card flex items-center gap-4 p-3">
                  <span className="u-media relative size-14 shrink-0">
                    {it.image ? <Image src={it.image} alt={it.name} fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{it.name}</span>
                    <span className="u-label-txt">×{it.qty} · {it.condition ?? ""}{it.scale ? ` · ${it.scale}` : ""} · cost {fmtUSD(it.cost)}</span>
                  </span>
                  <span className="u-mono text-[13px]">{fmtUSD(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* events */}
          <section>
            <p className="u-label mb-3">Audit trail</p>
            <ol className="flex flex-col">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex gap-4 border-b border-line py-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red" aria-hidden />
                  <span>
                    <span className="block text-[13px] font-semibold">{ev.status.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="u-label-txt block">{fmtDate(ev.createdAt)}{ev.actor ? ` · by ${ev.actor}` : ""}{ev.note ? ` — ${ev.note}` : ""}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <div className="u-card p-5">
            <p className="u-label">Customer</p>
            <p className="mt-3 text-[14px] font-semibold">{order.name}</p>
            <p className="u-label-txt mt-1">{order.email}</p>
            {order.phone ? <p className="u-label-txt">{order.phone}</p> : null}
            <p className="u-label-txt mt-3 leading-relaxed">
              {order.addressLine},<br />{order.city}, {order.state} {order.pincode},<br />{order.country}
            </p>
            {order.notes ? (
              <p className="mt-3 border-l-2 border-yellow bg-yellow/5 px-3 py-2 text-[12px] italic text-fog">{order.notes}</p>
            ) : null}
            <p className="u-label-txt mt-3">Payment {order.paymentMethod}{order.paymentChannel ? ` · via ${order.paymentChannel}` : ""} · Delivery {order.shippingMethod}</p>
            {order.shiprocketAwb ? (
              <p className="mt-2 text-[12px] text-mint">
                Shiprocket AWB: <strong className="font-mono">{order.shiprocketAwb}</strong>
              </p>
            ) : null}
            {order.refundedAt ? <p className="u-label-txt mt-1 text-red!">Refunded {fmtDate(order.refundedAt)}</p> : null}
          </div>
          <OrderActions order={order} />
        </div>
      </div>
    </div>
  );
}
