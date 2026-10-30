import Link from "next/link";
import { PageHero, SectionHead } from "@/components/ui";
import { getStorefront } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Returns",
  description: "The Burnout Wheels returns protocol: clear windows, pickup on us, no small print.",
};

export default function ReturnsPage() {
  const s = getStorefront();
  return (
    <>
      <PageHero
        label="Policy"
        title="Returns"
        sub="Collecting should be confidence, not gambling. If something's wrong, the door stays open — no small print."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <SectionHead index="01" title="The window" />
        <div className="u-card mt-8 grid gap-6 p-6 sm:grid-cols-3">
          <div>
            <p className="u-mono text-5xl font-bold text-red">{s.returnsDays}</p>
            <p className="u-label mt-2">Days after delivery</p>
          </div>
          <div>
            <p className="u-mono text-5xl font-bold">100%</p>
            <p className="u-label mt-2">Refund on approved returns</p>
          </div>
          <div>
            <p className="u-mono text-5xl font-bold">0</p>
            <p className="u-label mt-2">Restocking theatrics</p>
          </div>
        </div>

        <SectionHead index="02" title="Protocol" />
        <ol className="mt-8 flex flex-col gap-4">
          {[
            ["Flag it", "Reply to your order confirmation mail with the order number, or flag a crew member in chat. Say what's wrong — photos help with damage claims."],
            ["Approval", "Sealed, unopened pieces pass automatically within the window. Damaged or wrong-item claims get reviewed same day."],
            ["Pickup", "For approved returns we arrange the pickup — the courier takes it from your door."],
            ["Refund", "Money returns via your original payment rail once the piece is back and checked. UPI ≈ 2–3 days."],
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

        <div className="u-card mt-12 border-yellow/40 p-6">
          <p className="u-label !text-yellow">Exceptions</p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-fog">
            <li>· Opened, sealed-verified pieces (graded glass cases etc.) are only returnable for damage in transit.</li>
            <li>· Cosmetic casting quirks described in the listing aren't faults — that's manufacturing character, and we document it.</li>
          </ul>
        </div>

        <div className="mt-10 flex gap-3">
          <Link href="/shipping" className="u-btn u-btn-ghost">Shipping policy</Link>
          <Link href="/track" className="u-btn u-btn-primary">Track an order</Link>
        </div>
      </div>
    </>
  );
}
