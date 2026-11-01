import { PageHero, SectionHead } from "@/components/ui";
import { COD_ADVANCE_LABEL, PAYMENT_HELP } from "@/lib/payments";

export const metadata = {
  title: "Terms & Conditions",
  description: "Burnout Wheels terms: ordering, pricing, payment, dispatch, cancellation windows, refunds on proven damage, and account rules.",
};

export default function TermsPage() {
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
          Die-cast model vehicles — new, graded/sealed, like-new, or pre-owned, exactly as labelled on each product page. Some cars offered here are <strong className="text-bone">second-hand</strong> and some are built by makers other than the team whose livery they carry (unofficial builds); the product page states which, along with scale, maker and contents, and every title and detail line is double-checked before the product goes live. By ordering you accept the condition and configuration <strong className="text-bone">as listed</strong>.
        </div>

        <SectionHead index="02" title="Pricing & payment" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          All prices in INR, inclusive as stated at checkout. Payments run through UPI, cash on delivery, or PayPal
          arranged live with a human on WhatsApp/Discord — Burnout Wheels never stores card data on its servers.{" "}
          <strong className="text-bone">COD orders require a {COD_ADVANCE_LABEL} online advance before packing.</strong>{" "}
          The advance is adjusted against your order total, not charged on top; the remaining balance is paid to the
          courier. A discount code applies per its terms at checkout and may be withdrawn if misused. Payment help:{" "}
          <a href={PAYMENT_HELP.whatsapp} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a>{" "}
          or{" "}
          <a href={PAYMENT_HELP.discord} target="_blank" rel="noopener noreferrer" className="underline">Discord</a>.
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
