import Link from "next/link";
import { ShieldCheck, Lock, Undo2, Star } from "lucide-react";
import { PageHero, SectionHead } from "@/components/ui";
import { Reveal } from "@/components/store/reveal";
import { getTrustpilot } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Trust & authenticity",
  description: "How Burnout Wheels earns trust: authentic sourcing, secure payments, clear returns — and no invented reviews.",
};

export default function TrustPage() {
  const t = getTrustpilot();
  return (
    <>
      <PageHero
        label="Protocol"
        title="Trust, in writing"
        sub="Collectibles attract fakes, shortcuts and star inflation. Here's exactly how this store operates instead."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <div className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
          {[
            { icon: ShieldCheck, k: "Authenticity", v: ["Pieces are sourced sealed from authorised die-cast suppliers.", "Every unit is inspected against the factory box, casting and livery before it lists.", "Anything pre-owned or graded is described honestly — condition labels are never guesses."] },
            { icon: Lock, k: "Secure shopping", v: ["No card is ever stored — payments run on UPI or cash on delivery.", "Order payment is confirmed person-by-person; a human checks every transaction before dispatch.", "Your data lives in one database on this store only, never sold or shared."] },
            { icon: Undo2, k: "Clear returns", v: [`${"7"}-day window from delivery on sealed pieces — see the returns page for the exact protocol.`, "Approved returns get door pickup arranged by the crew.", "Damaged-in-transit claims are reviewed the same day they're flagged."] },
            { icon: Star, k: "Reviews & scores", v: ["Every review is submitted by a real person and human-checked before it publishes.", "No seeded testimonials, no purchased ratings, no invented sales numbers — anywhere.", t.mode === "coming_soon" ? "“Trustpilot coming soon”: the moment a real profile is connected, it appears here. Nothing before then." : `Live Trustpilot profile is connected.`] },
          ].map((c, i) => (
            <Reveal key={c.k} delay={i * 60} className="bg-coal">
              <div className="h-full p-7">
                <c.icon className="size-5 text-red" aria-hidden />
                <h2 className="u-h3 mt-4">{c.k}</h2>
                <ul className="mt-4 flex flex-col gap-2.5 text-[13px] leading-relaxed text-fog">
                  {c.v.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <div id="trustpilot" className="u-card mt-12 border-yellow/40 p-7">
          <p className="u-label !text-yellow">Trustpilot status</p>
          {t.mode === "coming_soon" ? (
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/85">
              Trustpilot is coming soon. Until a real Burnout Wheels profile is connected, we display zero customer scores anywhere
              — no stars, no badges, no “rated X from Y”. The storefront shows policies; the truck shows up; that's the deal.
            </p>
          ) : (
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-bone/85">
              Our verified Trustpilot profile is live above. Scores you see come straight from Trustpilot — nowhere else.
              {t.profileUrl ? (
                <a href={t.profileUrl} rel="noopener noreferrer" target="_blank" className="u-btn u-btn-ghost mt-4 inline-flex">
                  Open the profile
                </a>
              ) : null}
            </p>
          )}
        </div>

        <section id="contact" className="mt-16">
          <SectionHead index="02" title="Contact" sub="Fastest: flag the crew in the chat radio. Email works too — support@burnoutwheels.in. Human replies within one business day." />
          <div className="mt-8 flex gap-3">
            <Link href="/returns" className="u-btn u-btn-ghost">Returns protocol</Link>
            <Link href="/shipping" className="u-btn u-btn-ghost">Shipping policy</Link>
          </div>
        </section>
      </div>
    </>
  );
}
