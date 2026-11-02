import { PageHero, SectionHead } from "@/components/ui";
import { getStorefront } from "@/lib/settings";
import { fmtUSD } from "@/lib/money";
import { COD_ADVANCE_LABEL, PAYMENT_HELP } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Terms & Conditions",
  description: "Burnout Wheels terms: ordering, pricing, payment, dispatch, cancellation windows, refunds on proven damage, and account rules.",
};

export default function TermsPage() {
  const s = getStorefront();
  return (
    <>
      <PageHero
        label="Policy"
        title="Terms & conditions"
        sub="The rules of the pit lane — what you buy, what you get, and how disputes get handled."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <SectionHead index="01" title="What we sell" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          Die-cast model vehicles — new, graded/sealed, like-new, or pre-owned, exactly as labelled on each product page. Every car offered is catalogued with its verified scale, manufacturer, livery, and condition. Every detail is inspected before the model lists. By placing an order, you agree to the specifications and condition <strong className="text-bone">as listed</strong>.
        </div>

        <SectionHead index="02" title="Pricing & payment" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          All prices in INR, inclusive as stated at checkout. Payments run through direct UPI, cash on delivery (COD), or PayPal arranged live with our team — Burnout Wheels never stores payment card data on its servers.{" "}
          <strong className="text-bone">COD orders require a {COD_ADVANCE_LABEL} online security advance before packing.</strong>{" "}
          The advance is adjusted directly against your order total, not charged as an extra fee; the remaining balance is paid to the courier upon doorstep delivery. Orders over {fmtUSD(s.shipping.freeOver)} receive free standard shipping pan-India.
        </div>

        <SectionHead index="03" title="Dispatch & risk" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          Dispatch windows are on the <a href="/shipping" className="underline">Shipping page</a>. Risk passes to the courier at handover; tracking rides with every order. Damage in transit is handled under the refund rules — <a href="/refund-cancellation" className="underline">Refund & cancellation</a> — not under buyer's remorse.
        </div>

        <SectionHead index="04" title="Cancellation & refunds" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          Orders are cancellable <strong className="text-bone">only until the product ships</strong> — after dispatch, cancellation is not allowed. Refunds are not accepted generally. A refund is issued <strong className="text-bone">only after the product is found to be waste (damaged/not-as-listed) with video proof</strong>, reviewed within the 48-hour claim window. The COD advance follows the cancellation rules: returned to source if the order is cancelled before dispatch. The complete protocol lives on the <a href="/refund-cancellation" className="underline">Refund & cancellation page</a>.
        </div>

        <SectionHead index="05" title="Accounts & conduct" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          One honest account per person. Fraudulent claims, repeated COD refusals, discount abuse or sockpuppet reviews end in account closure. Reviews are moderated: published only when they appear to be from a real order experience — and no ratings are invented in the meantime.
        </div>

        <SectionHead index="06" title="Intellectual property & liability" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          Team names, liveries and trademarks belong to their rights holders; we sell collectible models, and describe them accurately. Our liability is capped at the value of your order. Nothing here waives your statutory rights under Indian consumer law.
        </div>

        <p className="u-label-txt mt-10">Effective date: October 2026 · Questions: <span className="u-mono">theburnoutwheels@gmail.com</span> (open 24/7)</p>
      </div>
    </>
  );
}
