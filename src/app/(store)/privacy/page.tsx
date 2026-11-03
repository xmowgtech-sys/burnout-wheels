import { PageHero, SectionHead } from "@/components/ui";

export const metadata = {
  title: "Privacy Policy",
  description: "What Burnout Wheels collects, why, how long it stays, and the choices you control — including analytics consent.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        label="Policy"
        title="Privacy policy"
        sub="Collected only when it serves the order. Never sold. Never shaved into a profile."
      />
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <SectionHead index="01" title="What we collect, and why" />
        <div className="u-card mt-8 divide-y divide-line text-[13.5px] leading-relaxed text-fog">
          {[
            ["Order details", "Name, email, phone, shipping address — to deliver the parcel and handle claims. Kept for the order lifecycle + accounting."],
            ["Account email & name", "For sign-in only; Google accounts verify the email for us. Passwords are stored as bcrypt hashes, never in readable form."],
            ["Analytics (only with consent)", "Anonymous visit counts and funnel events (view → cart → checkout) with a random per-session id. No cross-site tracking, no ad profiles."],
            ["Ops telemetry (scrubbed)", "JS errors, failed requests, slow pages and failed uploads — path plus a shortened message. Form values, passwords and tokens are stripped before storage."],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 p-5 md:flex-row md:gap-8">
              <p className="w-44 shrink-0 text-[14px] font-bold uppercase tracking-wide text-bone">{k}</p>
              <p>{v}</p>
            </div>
          ))}
        </div>

        <SectionHead index="02" title="What we never take" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          No card numbers on our servers, no form-field sniffing, no keyboard capture, no password storage beyond the hash, no data sales, no third-party ad trafficking. Payment rails (UPI/COD processors if added later) are governed by their own privacy terms.
        </div>

        <SectionHead index="03" title="Your controls" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          <ul className="flex flex-col gap-3">
            <li>• Change or withdraw cookie consent any time — "Cookie settings" link lives in the footer; analytics beacons stop immediately.</li>
            <li>• Ask for a copy or erasure of your account/order data: <span className="u-mono">theburnoutwheels@gmail.com</span> — fulfilled within 30 days.</li>
            <li>• Sign out deletes the session from the browser; account data removal is a mail away.</li>
          </ul>
        </div>

        <SectionHead index="04" title="Retention & security" />
        <div className="u-card mt-8 p-6 text-[14px] leading-relaxed text-fog">
          Order records stay as long as Indian commerce rules ask. Verification and reset links are single-use, hashed in storage and expire in ≤24h. Sessions are httpOnly, sameSite cookies. Ops events roll as plain rows an operator can purge in the dashboard.
        </div>

        <p className="u-label-txt mt-10">Effective date: October 2026 · Requests: <span className="u-mono">theburnoutwheels@gmail.com</span></p>
      </div>
    </>
  );
}
