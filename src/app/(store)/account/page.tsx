import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, LogIn, ShieldAlert, Timer } from "lucide-react";
import { readCustomerSession, accountByEmail, accountById } from "@/lib/accounts";
import { getCustomerOrders } from "@/lib/orders";
import { hydrateOrdersForEmail } from "@/lib/order-store";
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

  let acc = accountByEmail(session.email) ?? accountById(session.aid);
  if (!acc) {
    try {
      const { createAccount } = await import("@/lib/accounts");
      acc = createAccount({
        email: session.email,
        name: session.name || undefined,
        picture: session.picture ?? undefined,
        verified: true,
      });
    } catch {
      acc = accountByEmail(session.email);
    }
  }
  if (!acc) redirect("/login?next=/account");

  await hydrateOrdersForEmail(acc.email);
  const orders = getCustomerOrders(acc.email, { accountId: acc.id }).slice(0, 50);

  return (
    <main className="min-h-[80vh] pt-28 md:pt-32">
      <div className="mx-auto max-w-5xl px-4 pb-24 md:px-8">
        {/* Header Profile Section */}
        <header className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-center">
          {acc.picture ? (
            <Image
              src={acc.picture}
              alt={acc.name ?? acc.email}
              width={72}
              height={72}
              unoptimized
              className="size-16 sm:size-20 shrink-0 rounded-full border-2 border-red object-cover shadow-md"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span aria-hidden className="u-mono grid size-16 sm:size-20 shrink-0 place-items-center rounded-full bg-red text-xl font-extrabold text-white shadow-md">
              {initials(acc.name ?? "", acc.email)}
            </span>
          )}
          <div className="min-w-0">
            <p className="u-label">Driver Paddock</p>
            <h1 className="u-h1 mt-1 truncate text-2xl md:text-4xl">{acc.name || "Racer"}</h1>
            <p className="u-mono mt-1 truncate text-[13px] text-fog">{acc.email}</p>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {acc.verified ? (
                <span className="u-badge border-mint text-mint">
                  <CheckCircle2 className="mr-1 inline size-3" aria-hidden /> Verified
                </span>
              ) : (
                <span className="u-badge border-yellow text-yellow">
                  <ShieldAlert className="mr-1 inline size-3" aria-hidden /> Unverified
                </span>
              )}
              {acc.googleId && <span className="u-badge border-sky text-sky">Google linked</span>}
              {acc.passwordHash && <span className="u-badge border-line-strong text-fog">Password on</span>}
              {acc.phone && <span className="u-badge border-line text-fog">{acc.phone}</span>}
            </p>
          </div>
          <form action="/api/auth/logout" method="post" className="sm:ml-auto">
            <LogIn className="hidden" aria-hidden />
            <button type="submit" className="u-btn u-btn-ghost text-xs py-2! px-3!">
              Sign out
            </button>
          </form>
        </header>

        {!acc.verified && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-yellow/50 bg-yellow/10 p-4">
            <Clock className="size-4 shrink-0 text-yellow" aria-hidden />
            <p className="text-[13px] leading-relaxed text-fog">
              Verify your email to lock in sign-in and order updates — the 6-digit code is in your inbox.
            </p>
            <Link href="/verify" className="u-btn u-btn-primary ml-auto py-2!">
              Verify now
            </Link>
          </div>
        )}

        {verified === "1" && (
          <div className="mt-6 flex items-center gap-3 rounded-sm border border-mint/50 bg-mint/10 p-4">
            <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden />
            <p className="text-[13px] text-fog">Email verified. Welcome to the paddock — everything is live.</p>
          </div>
        )}

        {/* Tabbed Account Settings Area */}
        <section className="mt-8">
          <AccountSettings
            account={{
              email: acc.email,
              name: acc.name ?? "",
              phone: acc.phone ?? "",
              verified: acc.verified,
              hasPassword: Boolean(acc.passwordHash),
              googleLinked: Boolean(acc.googleId),
            }}
            orders={orders}
          />
        </section>

        {/* Support & Policies Banner */}
        <section className="mt-12 grid gap-4 sm:grid-cols-2 border-t border-line pt-8">
          <div className="u-card p-5">
            <Timer className="size-4 text-sky" aria-hidden />
            <p className="mt-2 text-[13px] font-bold">Free cancellation until dispatch</p>
            <p className="u-label-txt mt-1">
              Orders cancel free with full refund while in pit lane. Full protocol on the{" "}
              <Link href="/refund-cancellation" className="underline hover:text-white">
                cancellation page
              </Link>
              .
            </p>
          </div>
          <div className="u-card p-5">
            <CheckCircle2 className="size-4 text-mint" aria-hidden />
            <p className="mt-2 text-[13px] font-bold">Crew on the radio 24/7</p>
            <p className="u-label-txt mt-1">
              Direct assistance on Discord #billing and WhatsApp — available on our{" "}
              <Link href="/trust#contact" className="underline hover:text-white">
                trust page
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
