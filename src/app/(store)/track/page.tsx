import { PageHero } from "@/components/ui";
import { getOrderByNumber } from "@/lib/orders";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { fmtUSD, fmtDate } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Track an order",
  description: "Follow your Burnout Wheels order from the pit lane to your door — status, events and tracking included.",
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string; email?: string }>;
}) {
  const { number, email } = await searchParams;
  const order =
    number && email ? getOrderByNumber(number.trim().toUpperCase()) : null;
  const match = order && email && email.trim().toLowerCase() === order.email.toLowerCase();

  return (
    <>
      <PageHero
        label="04 — Telemetry"
        title="Track an order"
        sub="Order number + delivery email. That pair is your pit-pass wherever you are."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <form method="GET" action="/track" className="u-card flex flex-col gap-3 p-6 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="u-label-txt">Order number</span>
            <input name="number" defaultValue={number ?? ""} required placeholder="BW-XXXXXX-XX" className="u-input mt-1.5 !uppercase" />
          </label>
          <label className="flex-1">
            <span className="u-label-txt">Delivery email</span>
            <input name="email" type="email" defaultValue={email ?? ""} required className="u-input mt-1.5" />
          </label>
          <button className="u-btn u-btn-primary">Pull telemetry</button>
        </form>

        {number && email && (
          order === null || !match ? null : (
            <div className="u-card mt-8 p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="u-h3">{order.number}</h2>
                <span className="u-badge border-mint text-mint">{ORDER_STATUS_LABELS[order.status]}</span>
              </div>
              <dl className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
                {[
                  ["Placed", fmtDate(order.placedAt)],
                  ["Total", fmtUSD(order.total)],
                  ["Delivery", order.shippingMethod === "EXPRESS" ? "Express" : "Standard"],
                  [
                    "Tracking",
                    order.trackingNumber ? `${order.trackingCarrier ?? "Carrier"} · ${order.trackingNumber}` : "Assigned at dispatch",
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="u-label">{k}</dt>
                    <dd className="u-mono mt-1 text-[13px]">{v}</dd>
                  </div>
                ))}
              </dl>
              <ol className="mt-8 flex flex-col border-t border-line">
                {order.events.map((ev) => (
                  <li key={ev.id} className="flex gap-4 py-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red" aria-hidden />
                    <span>
                      <span className="block text-[13px] font-semibold">{ev.status.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="u-label-txt block">{fmtDate(ev.createdAt)}{ev.note ? ` — ${ev.note}` : ""}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )
        )}

        {number && email && (!order || !match) && (
          <p role="alert" className="mt-8 border border-red bg-red/10 px-4 py-3 text-[13px] text-red">
            No order matches that number + email pair. Check both and try again — exactly as they were at checkout.
          </p>
        )}
      </div>
    </>
  );
}
