import Link from "next/link";
import { PageHero, SectionHead } from "@/components/ui";
import { getStorefront } from "@/lib/settings";
import { fmtUSD } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shipping",
  description: "Dispatch times, delivery speeds and tracking for Burnout Wheels die-cast orders.",
};

export default function ShippingPage() {
  const s = getStorefront();
  return (
    <>
      <PageHero
        label="Policy"
        title="Shipping"
        sub="From the pit lane to the door. Every parcel rides tracked — because die-cast deserves better than hope."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <SectionHead index="01" title="Speed & cost" />
        <div className="u-card mt-8 divide-y divide-line">
          {[
            ["Standard", `${fmtUSD(s.shipping.standard)} · 2–4 business days`, "Ground courier with full tracking"],
            ["Express", `${fmtUSD(s.shipping.express)} · priority dispatch`, "First out the door when payment clears"],
            ["Free shipping", `Orders over ${fmtUSD(s.shipping.freeOver)}`, "After discounts, applied automatically at checkout"],
          ].map(([k, v, d]) => (
            <div key={k} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 p-5">
              <p className="w-40 text-[14px] font-bold uppercase tracking-wide">{k}</p>
              <p className="u-mono text-[14px]">{v}</p>
              <p className="text-[13px] text-fog md:ml-auto">{d}</p>
            </div>
          ))}
        </div>

        <SectionHead index="02" title="How dispatch runs" />
        <ol className="mt-8 flex flex-col gap-4">
          {[
            ["Reservation", "Your piece is reserved the moment the order is placed — no mid-checkout surprises."],
            ["Payment window", "UPI orders ship after payment confirmation; COD rides with the courier, cash on the door."],
            ["Packing", "Corner protection, box-in-box for graded and sealed pieces, then a signed-off inspection card."],
            ["Tracking", "Tracking lands on your order the moment the courier scans it — follow it on the Track page."],
          ].map(([k, v], i) => (
            <li key={k} className="u-card flex gap-5 p-5">
              <span className="u-mono text-2xl font-bold text-red">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block text-[14px] font-semibold">{k}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-fog">{v}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex gap-3">
          <Link href="/track" className="u-btn u-btn-primary">Track an order</Link>
          <Link href="/refund-cancellation" className="u-btn u-btn-ghost">Refund & cancellation rules</Link>
        </div>
      </div>
    </>
  );
}
