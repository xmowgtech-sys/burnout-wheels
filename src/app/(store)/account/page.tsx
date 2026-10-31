import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, LogIn, Package, ShieldAlert, Timer } from "lucide-react";
import { readCustomerSession, accountByEmail } from "@/lib/accounts";
import { adminListOrders } from "@/lib/orders";
import { fmtUSD } from "@/lib/money";
import { ORDER_STATUS_LABELS, type Order } from "@/lib/types";
import { AccountSettings } from "@/components/store/account-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your paddock", robots: { index: false } };

const initials = (name: string, email: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const base = (parts[0] ?? email).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return base.slice(0, 2) || "BW";
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;
  const session = await readCustomerSession();
  if (!session) redirect("/login?next=/account");

  const [acc, orders] = [accountByEmail(session.email), adminListOrders({ q: session.email }).slice(0, 20)];
  if (!acc) redirect("/login?next=/account");

  return (
    <main className="min-h-[80vh] pt-28 md:pt-32">
      <div className="mx-auto max-w-4xl px-4 pb-24 md:px-8">
        <header className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-center">
          {/* Google profile picture (when available) or initials badge */}
          {acc.picture ? (
            <Image
              src={acc.picture}
              alt={acc.name ?? acc.email}
              width={64}
              height={64}
              unoptimized
              className="size-16 shrink-0 rounded-full border border-line object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span aria-hidden className="u-mono grid size-16 shrink-0 place-items-center rounded-full bg-red text-lg font-extrabold text-white">
              {initials(acc.name ?? "", acc.email)}
            </span>
          )}
          <div className="min-w-0">
            <p className="u-label">Your paddock</p>
            <h1 className="u-h1 mt-1 truncate text-2xl md:text-4xl">{acc.name || "Racer"}</h1>
            <p className="u-mono mt-1 truncate text-[13px] text-fog">{acc.email}</p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {acc.verified ? (
                <span className="u-badge border-mint text-mint"><CheckCircle2 className="mr-1 inline size-3" aria-hidden /> Verified</span>
              ) : (
                <span className="u-badge border-yellow text-yellow"><ShieldAlert className="mr-1 inline size-3" aria-hidden /> Unverified</span>
              )}
              {acc.googleId && <span className="u-badge border-sky text-sky">Google linked</span>}
              {acc.passwordHash && <span className="u-badge border-line-strong text-fog">Email sign-in on</span>}
              {acc.phone && <span className="u-badge border-line text-fog">{acc.phone}</span>}
            </p>
          </div>
          <form action="/api/auth/logout" method="post" className="sm:ml-auto">
            <LogIn className="hidden" aria-hidden />
            <button type="submit" className="u-btn u-btn-ghost">Sign out</button>
          </form>
        </header>

        {!acc.verified && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-yellow/50 bg-yellow/10 p-4">
            <Clock className="size-4 shrink-0 text-yellow" aria-hidden />
            <p className="text-[13px] leading-relaxed text-fog">
              Verify your email to lock in sign-in and order updates — the 6-digit code is in your inbox.
            </p>
            <Link href="/verify" className="u-btn u-btn-primary ml-auto !py-2">Verify now</Link>
          </div>
        )}

        {verified === "1" && (
          <div className="mt-6 flex items-center gap-3 rounded-sm border border-mint/50 bg-mint/10 p-4">
            <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden />
            <p className="text-[13px] text-fog">Email verified. Welcome to the paddock — everything&apos;s live.</p>
          </div>
        )}

        <section className="mt-8">
          <p className="u-label">Order history</p>
          {orders.length === 0 ? (
            <div className="u-card mt-4 p-8 text-center">
              <Package className="mx-auto size-6 text-fog" aria-hidden />
              <p className="mt-3 text-sm text-fog">No orders yet — the grid is waiting.</p>
              <Link href="/shop" className="u-btn u-btn-primary mt-4 inline-flex">Browse the shop</Link>
            </div>
          ) : (
            <ul className="u-card mt-4 divide-y divide-line">
              {orders.map((o: Order) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 p-5">
                  <span className="u-mono text-[13px] font-bold">{o.number}</span>
                  <span className="u-label-txt">{o.placedAt.slice(0, 10)}</span>
                  <span className="u-badge border-sky text-sky">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                  <span className="u-mono ml-auto text-sm">{fmtUSD(o.total)}</span>
                  <Link href="/track" className="u-label hover:text-bone">Track →</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <p className="u-label">Account</p>
          <div className="mt-4">
            <AccountSettings
              account={{
                email: acc.email,
                name: acc.name ?? "",
                phone: acc.phone ?? "",
                verified: acc.verified,
                hasPassword: Boolean(acc.passwordHash),
                googleLinked: Boolean(acc.googleId),
              }}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="u-card p-5">
            <Timer className="size-4 text-sky" aria-hidden />
            <p className="mt-2 text-[13px] font-bold">Cancel anytime, in-window</p>
            <p className="u-label-txt mt-1">Orders cancel free until dispatch. Rules are on the <Link href="/refund-cancellation" className="underline">refund &amp; cancellation page</Link>.</p>
          </div>
          <div className="u-card p-5">
            <CheckCircle2 className="size-4 text-mint" aria-hidden />
            <p className="mt-2 text-[13px] font-bold">Crew on the radio 24/7</p>
            <p className="u-label-txt mt-1">Discord for offers, WhatsApp for enquiries — both in the <Link href="/trust#contact" className="underline">contact section</Link>.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
