import Link from "next/link";
import { CONTACT } from "@/lib/contact";

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

export function Footer() {
  return (
    <footer className="border-t border-line bg-coal">
      <div className="u-marquee border-b border-line py-3" aria-hidden>
        {Array.from({ length: 2 }).map((_, copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-8 pr-8">
            {["Formula 1", "Motorsport", "Rare drops", "Sealed & inspected", "Join the Discord for drops", "Track every order"].map(
              (word) => (
                <span key={word} className="u-label text-dim! whitespace-nowrap">
                  {word} <span className="text-red">◦</span>
                </span>
              )
            )}
          </div>
        ))}
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
          <p className="u-label mt-6">UPI · COD · Order-by-order confirmation</p>
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
