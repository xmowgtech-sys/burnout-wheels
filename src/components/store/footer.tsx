import Link from "next/link";
import { CONTACT } from "@/lib/contact";
import { COD_ADVANCE_LABEL } from "@/lib/payments";
import { Marquee } from "./marquee";

const COLS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Pit lane",
    links: [
      { href: "/shop", label: "Shop the grid" },
      { href: "/wishlist", label: "Wishlist" },
      { href: "/track", label: "Track an order" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/shipping", label: "Shipping" },
      { href: "/refund-cancellation", label: "Refund & cancellation" },
      { href: "/trust", label: "Trust & authenticity" },
      { href: CONTACT.whatsappHref, label: "WhatsApp enquiry (24/7)", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms & conditions" },
      { href: "/privacy", label: "Privacy policy" },
    ],
  },
  {
    title: "Radio",
    links: [
      { href: CONTACT.discord, label: "Discord server — discounts & offers", external: true },
      { href: "/trust#contact", label: "Contact the crew" },
      { href: "/admin/login", label: "Admin cockpit" },
    ],
  },
];

const TICKER = ["Formula 1", "Motorsport", "Rare drops", "Sealed & inspected", "Join the Discord for drops", "Track every order"];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-coal">
      <div className="border-b border-line py-3">
        <Marquee speed={38}>
          {TICKER.map((word, i) => (
            <span
              key={word}
              className={`flex items-center gap-8 pr-8 text-xl font-extrabold uppercase tracking-tight md:text-3xl ${
                i % 2 === 1 ? "u-outline" : "text-bone"
              }`}
            >
              {word}
              <span className="text-red" aria-hidden>
                ◦
              </span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(2,1fr)_1.4fr] md:px-8">
        <div className="sm:col-span-2 md:col-span-1 md:row-span-1">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Burnout Wheels home">
            <span className="grid size-8 place-items-center bg-red">
              <span className="block h-4 w-[3px] skew-x-[-18deg] bg-bone" aria-hidden />
            </span>
            <span className="text-sm font-extrabold uppercase tracking-[0.18em]">
              Burnout<span className="text-red">/</span>Wheels
            </span>
          </Link>
          <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-fog">
            Die-cast racing metal for collectors who read telemetry. One product at a time, inspected before it leaves
            the paddock.
          </p>
          <p className="u-label mt-6">UPI · COD ({COD_ADVANCE_LABEL} advance) · PayPal live</p>
          <p className="u-label-txt mt-2">Human-confirmed payments on WhatsApp or Discord.</p>
        </div>

        {COLS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="min-w-0">
            <p className="u-label">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <a
                    href={l.href}
                    {...("external" in l && l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="text-[13px] text-fog transition-colors hover:text-bone"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* address + reach */}
        <div className="min-w-0">
          <p className="u-label">The paddock</p>
          <address className="mt-4 max-w-xs text-[13px] not-italic leading-relaxed text-fog">
            {CONTACT.address}
          </address>
          <p className="mt-4 text-[13px] leading-relaxed text-fog">
            Email: <a className="underline underline-offset-2 hover:text-bone" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <br />
            Phone: <a className="hover:text-bone" href={CONTACT.phoneTel}>{CONTACT.phoneDisplay}</a>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer" className="u-btn u-btn-ghost px-3! py-2! text-[12px]!">
              WhatsApp us
            </a>
            <a href={CONTACT.discord} target="_blank" rel="noopener noreferrer" className="u-btn u-btn-primary px-3! py-2! text-[12px]!">
              Join Discord
            </a>
          </div>
        </div>
      </div>

      {/* oversized wordmark — the last thing on the page */}
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="u-spectrum h-px w-full" aria-hidden />
        <p
          aria-hidden
          className="u-display mt-5 select-none whitespace-nowrap text-[clamp(2.6rem,10.6vw,9.5rem)]! leading-[0.78] text-bone"
        >
          Burnout<span className="text-red">/</span>
          <span className="u-outline">Wheels</span>
        </p>
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="u-label">Die-cast pit lane — Mohali, India</p>
          <a href="#main" className="u-label transition-colors hover:text-bone">
            Back to top ↑
          </a>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="u-label text-dim!">© {new Date().getFullYear()} Burnout Wheels · Mohali, Punjab, India</p>
          <p className="u-label text-dim! normal-case! tracking-normal!">
            Reference photography via Wikimedia Commons (CC BY-SA) — replace with your own product shots as stock grows.
          </p>
        </div>
      </div>
    </footer>
  );
}
