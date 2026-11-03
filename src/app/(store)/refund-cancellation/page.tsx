import { PageHero, SectionHead } from "@/components/ui";
import { COD_ADVANCE_LABEL, PAYMENT_HELP } from "@/lib/payments";

export const metadata = {
  title: "Refund & Cancellation",
  description: "The exact Burnout Wheels cancellation and refund rules — cancellation only until dispatch, refunds only on proven damage with video proof.",
};

export default function RefundCancellationPage() {
  return (
    <>
      <PageHero
        label="Policy"
        title="Refund & cancellation"
        sub="Written plainly, enforced the same for everyone. Read it once — no surprises later."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <SectionHead index="01" title="Cancellation — accepted until dispatch" />
        <div className="u-card mt-8 p-6">
          <ul className="flex flex-col gap-4 text-[14px] leading-relaxed text-fog">
            <li>
              <strong className="text-bone">Before shipment — yes.</strong> You can cancel any order while it's still in the pit: unshipped and unstaged. Message the crew any time, 24/7, or reply to your order confirmation with the order number. Cancellation is free and the money comes back the same rail it arrived on.
            </li>
            <li>
              <strong className="text-bone">After shipment — no.</strong> Once the courier scans the parcel, the order is in transit and can no longer be cancelled. It can only be refused at the door or processed under the rules below.
            </li>
            <li>
              <strong className="text-bone">COD refusal.</strong> Refusing COD at the door two times closes your account to COD — the courier bills us for rejections twice over.
            </li>
            <li>
              <strong className="text-bone">COD advance.</strong> COD orders carry a {COD_ADVANCE_LABEL} online advance, adjusted against the total. If the order is cancelled before dispatch — by you or by us — the advance is returned to the source it came from. The balance is paid to the courier at the door.
            </li>
          </ul>
        </div>

        <SectionHead index="02" title="No general returns" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          We do <strong className="text-bone">not</strong> accept refunds for a change of mind, the wrong scale, the wrong driver name or a discovery that a car is pre-owned or built by a different maker.
          Every listing states its <strong className="text-bone">condition (new / graded / like-new / pre-owned)</strong>, scale, make and manufacturer — and we double-check the title, details and contents of everything in the product before it's ever listed. It is the buyer's job to read what's written; it's described the way it is because we verified it.
        </div>

        <SectionHead index="03" title="Refund — only on proven loss, with video proof" />
        <div className="u-card mt-8 p-6">
          <p className="text-[14px] leading-relaxed text-fog">
            A refund is possible under exactly one circumstance: the product <strong className="text-bone">is waste</strong> — smashed, cracked, missing parts or a completely different item from the listing — and <strong className="text-bone">video proof</strong> backs the claim.
          </p>
          <ol className="mt-5 flex flex-col gap-4 text-[14px] leading-relaxed text-fog">
            <li>
              <span className="u-mono mr-3 text-red">01</span> Record the <strong className="text-bone">unboxing video from the seam outward</strong>: packet closed, label visible, box opening, contents shown, then the damage close-up. No video, no claim — this protects the honest 99.
            </li>
            <li>
              <span className="u-mono mr-3 text-red">02</span> Flag it within <strong className="text-bone">48 hours of delivery</strong> with the order number and the video. 24/7 support — email or WhatsApp gets you to the crew.
            </li>
            <li>
              <span className="u-mono mr-3 text-red">03</span> The crew reviews the video against the listing's claimed condition. The decision is written to your order — approved or declined, with the reason.
            </li>
            <li>
              <span className="u-mono mr-3 text-red">04</span> Approved: refund goes back to the source of payment (UPI ≈ 2–3 working days after approval). Declined: the item is yours and stays yours.
            </li>
          </ol>
        </div>

        <SectionHead index="04" title="Support — 24/7" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          Humans read every message: <span className="u-mono text-bone">theburnoutwheels@gmail.com</span>, the in-site chat (hands off to staff), or reply to any order email. Day or night, a response lands within one working cycle — and claims are answered on the weekend too, because parcels don't respect office hours.
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <a href={PAYMENT_HELP.whatsapp} target="_blank" rel="noopener noreferrer" className="u-btn u-btn-primary">WhatsApp the crew</a>
          <a href={PAYMENT_HELP.discord} target="_blank" rel="noopener noreferrer" className="u-btn u-btn-ghost">Discord</a>
          <a href="mailto:theburnoutwheels@gmail.com" className="u-btn u-btn-ghost">Email the crew</a>
          <a href="/terms" className="u-btn u-btn-ghost">Full terms</a>
        </div>
      </div>
    </>
  );
}
