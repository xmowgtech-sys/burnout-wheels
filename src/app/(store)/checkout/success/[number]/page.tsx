import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getOrderByNumber } from "@/lib/orders";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import { fmtUSD, fmtDate } from "@/lib/money";
import { COD_ADVANCE_LABEL, PAYMENT_HELP, codBalance } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmed", robots: { index: false } };

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const [{ number }, { email }] = await Promise.all([params, searchParams]);
  const order = getOrderByNumber(number.toUpperCase());
  if (!order || (email && email.toLowerCase() !== order.email.toLowerCase())) notFound();

  return (
    <div className="relative overflow-hidden">
      <div className="u-gridlines" aria-hidden />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 md:px-8 md:pt-40">
        <div className="u-card page-in p-8 md:p-10">
          <span className="grid size-12 place-items-center rounded-full bg-mint/15 text-mint">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="u-label mt-6 text-mint">Lights out — order logged</p>
          <h1 className="u-h2 mt-3">{order.number}</h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-fog">
            Stock is reserved under <strong className="text-bone">{order.name}</strong>. Status: <strong className="text-bone">{ORDER_STATUS_LABELS[order.status]}</strong>
            {order.paymentMethod === "UPI"
              ? " — we confirm UPI payment, then the piece leaves the pit lane."
              : ` — our crew will collect the ${COD_ADVANCE_LABEL} online advance on WhatsApp or Discord. Packing starts only after it lands; the balance is paid to the courier.`}
          </p>

          {order.paymentMethod === "COD" && (
            <div className="mt-6 border border-yellow/30 bg-yellow/[0.045] p-4">
              <p className="u-label text-yellow!">COD advance — {COD_ADVANCE_LABEL} online</p>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">
                Send us the order number on WhatsApp or Discord and a human will take the advance live (UPI or
                PayPal). It is part of your total; the balance of{" "}
                <span className="u-mono text-bone">{fmtUSD(codBalance(order.total))}</span> is paid at the door.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={PAYMENT_HELP.whatsappCod}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-btn u-btn-primary px-3! py-2! text-[10px]!"
                >
                  Pay {COD_ADVANCE_LABEL} on WhatsApp
                </a>
                <a
                  href={PAYMENT_HELP.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-btn u-btn-ghost px-3! py-2! text-[10px]!"
                >
                  Discord
                </a>
              </div>
            </div>
          )}

          <dl className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {[
              ["Placed", fmtDate(order.placedAt)],
              ["Payment", order.paymentMethod],
              ["Delivery", order.shippingMethod === "EXPRESS" ? "Express" : "Standard"],
              ["Total", fmtUSD(order.total)],
              ...(order.paymentMethod === "COD"
                ? [
                    ["COD advance", `${COD_ADVANCE_LABEL} online`],
                    ["Balance on delivery", fmtUSD(codBalance(order.total))],
                  ]
                : []),
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="u-label">{k}</dt>
                <dd className="u-mono mt-1 text-[14px]">{v}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-8 flex flex-col border-t border-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-4 py-3 even:border-b">
                <span>
                  <Link href={`/product/${it.slug}`} className="text-[14px] font-medium hover:text-red">{it.name}</Link>
                  <span className="u-label-txt block">×{it.qty} · {it.condition}</span>
                </span>
                <span className="u-mono text-[14px]">{fmtUSD(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`/track?number=${order.number}&email=${encodeURIComponent(order.email)}`} className="u-btn u-btn-primary">
              Track this order
            </Link>
            <Link href="/shop" className="u-btn u-btn-ghost">
              Back to the grid
            </Link>
          </div>
        </div>
        <p className="u-label mt-8">Save the order number — it unlocks the live tracking page at any time.</p>
      </div>
    </div>
  );
}
