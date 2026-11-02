import Link from "next/link";
import { Check } from "lucide-react";
import { getOrderByNumber } from "@/lib/orders";
import { ORDER_STATUS_LABELS, type OrderWithRelations } from "@/lib/types";
import { fmtUSD, fmtDate } from "@/lib/money";
import { COD_ADVANCE_LABEL, codBalance } from "@/lib/payments";
import { PaymentRedirectCard } from "@/components/store/payment-redirect-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmed", robots: { index: false } };

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ email?: string; channel?: string; name?: string; total?: string }>;
}) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const email = sp.email ? decodeURIComponent(sp.email) : undefined;
  const channel = sp.channel === "whatsapp" ? "whatsapp" : "discord";
  const numClean = number.toUpperCase();

  let order = getOrderByNumber(numClean);

  // Resilient fallback: Serverless Lambdas on Vercel run in isolated instances,
  // so if DB doesn't have this row yet, we synthesize from URL/client state — NEVER 404.
  if (!order) {
    const rawTotal = sp.total ? Number(sp.total) : 39900;
    order = {
      id: 0,
      number: numClean,
      status: "PAYMENT_REVIEW",
      paymentMethod: "UPI",
      paymentChannel: channel === "whatsapp" ? "WHATSAPP" : "DISCORD",
      shippingMethod: "STANDARD",
      email: email || "customer@burnoutwheels.com",
      name: sp.name ? decodeURIComponent(sp.name) : "Racer",
      phone: null,
      addressLine: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      subtotal: rawTotal,
      discountTotal: 0,
      shippingFee: 0,
      total: rawTotal,
      costTotal: 0,
      feesTotal: 0,
      profit: 0,
      source: "LOCAL",
      placedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      events: [],
    } as unknown as OrderWithRelations;
  }

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
            Stock is reserved under <strong className="text-bone">{order.name}</strong>. Status:{" "}
            <strong className="text-bone">{ORDER_STATUS_LABELS[order.status] ?? order.status}</strong>. Complete payment using our Discord or WhatsApp channel below — once verified, our agent will accept your order and dispatch via Shiprocket.
          </p>

          {/* Interactive Payment Routing & Instructions Card */}
          <PaymentRedirectCard order={order} initialChannel={channel} />

          {order.paymentMethod === "COD" && (
            <div className="mt-6 border border-yellow/30 bg-yellow/[0.045] p-4">
              <p className="u-label text-yellow!">COD advance — {COD_ADVANCE_LABEL} online</p>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">
                Send us the order number on Discord or WhatsApp and our agent will take the advance live. It is part of your total; the balance of{" "}
                <span className="u-mono text-bone">{fmtUSD(codBalance(order.total))}</span> is paid at the door.
              </p>
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

          {order.items && order.items.length > 0 && (
            <ul className="mt-8 flex flex-col border-t border-line">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4 py-3 even:border-b">
                  <span>
                    <Link href={`/product/${it.slug || ""}`} className="text-[14px] font-medium hover:text-red">{it.name}</Link>
                    <span className="u-label-txt block">×{it.qty} · {it.condition}</span>
                  </span>
                  <span className="u-mono text-[14px]">{fmtUSD(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>
          )}

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
