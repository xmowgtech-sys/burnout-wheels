import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, LogIn, Package, ShieldAlert, Timer, Heart, ShoppingBag, Truck, ExternalLink } from "lucide-react";
import { readCustomerSession, accountByEmail } from "@/lib/accounts";
import { getCustomerOrders } from "@/lib/orders";
import { getAccountWishlist } from "@/lib/wishlist";
import { fmtUSD } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/types";
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

  const acc = accountByEmail(session.email);
  if (!acc) redirect("/login?next=/account");

  const [orders, wishlist] = [
    getCustomerOrders(acc.email, acc.id).slice(0, 20),
    getAccountWishlist(acc.id),
  ];

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
            <Link href="/verify" className="u-btn u-btn-primary ml-auto py-2!">Verify now</Link>
          </div>
        )}

        {verified === "1" && (
          <div className="mt-6 flex items-center gap-3 rounded-sm border border-mint/50 bg-mint/10 p-4">
            <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden />
            <p className="text-[13px] text-fog">Email verified. Welcome to the paddock — everything&apos;s live.</p>
          </div>
        )}

        {/* Orders Section */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <p className="u-label">Order history</p>
            <Link href="/track" className="text-[12px] text-fog hover:text-bone underline-offset-4 hover:underline">Track an order →</Link>
          </div>
          {orders.length === 0 ? (
            <div className="u-card mt-4 p-8 text-center">
              <Package className="mx-auto size-6 text-fog" aria-hidden />
              <p className="mt-3 text-sm text-fog">No orders yet — the grid is waiting.</p>
              <Link href="/shop" className="u-btn u-btn-primary mt-4 inline-flex">Browse the shop</Link>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {orders.map((o) => (
                <div key={o.id} className="u-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="u-mono text-sm font-bold text-bone">{o.number}</span>
                      <span className="u-label-txt">{o.placedAt.slice(0, 10)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="u-badge border-sky text-sky">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                      {o.paymentChannel && (
                        <span className="u-badge border-yellow/60 text-yellow">
                          {o.paymentChannel === "DISCORD" ? "Discord #billing" : o.paymentChannel === "WHATSAPP" ? "WhatsApp" : o.paymentChannel}
                        </span>
                      )}
                      <span className="u-mono font-bold text-bone">{fmtUSD(o.total)}</span>
                    </div>
                  </div>

                  {/* Items in order */}
                  {o.items && o.items.length > 0 && (
                    <div className="py-3 flex flex-wrap gap-4 items-center">
                      {o.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-[13px] text-fog">
                          {item.image && (
                            <div className="relative size-10 shrink-0 border border-line bg-surface overflow-hidden">
                              <Image src={item.image} alt={item.name} fill sizes="40px" className="object-cover" />
                            </div>
                          )}
                          <span className="truncate max-w-[200px] text-bone font-medium">{item.name}</span>
                          <span className="u-mono text-[11px] text-dim">×{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Order Footer & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-[12px]">
                    <div className="flex items-center gap-3">
                      {o.shiprocketAwb ? (
                        <span className="flex items-center gap-1.5 text-mint font-mono">
                          <Truck className="size-3.5" aria-hidden /> AWB: {o.shiprocketAwb}
                        </span>
                      ) : (
                        <span className="text-dim">Standard dispatch via Shiprocket</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/checkout/success/${o.number}`} className="text-fog hover:text-bone underline-offset-4 hover:underline">
                        Payment &amp; Instructions →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wishlist Section */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <p className="u-label flex items-center gap-2">
              <Heart className="size-3.5 text-red fill-red" aria-hidden /> Saved Garage (Wishlist)
            </p>
            <Link href="/wishlist" className="text-[12px] text-fog hover:text-bone underline-offset-4 hover:underline">
              View full wishlist →
            </Link>
          </div>
          {wishlist.length === 0 ? (
            <div className="u-card mt-4 p-6 text-center">
              <Heart className="mx-auto size-5 text-dim" aria-hidden />
              <p className="mt-2 text-[13px] text-fog">Garage is clear — tap the heart on any model in the grid to save it to your account.</p>
              <Link href="/shop" className="u-btn u-btn-ghost mt-3 inline-flex text-xs">Explore die-cast grid</Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((w) => (
                <div key={w.productId} className="u-card flex gap-3 p-3">
                  <Link href={`/product/${w.slug}`} className="relative size-16 shrink-0 border border-line bg-surface overflow-hidden">
                    {w.image ? (
                      <Image src={w.image} alt={w.name} fill sizes="64px" className="object-cover" />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <Link href={`/product/${w.slug}`} className="truncate block text-[13px] font-semibold hover:text-red">
                        {w.name}
                      </Link>
                      <p className="u-mono mt-0.5 text-[12px] text-bone font-medium">{fmtUSD(w.price)}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-dim">{w.condition}</span>
                      <Link href={`/product/${w.slug}`} className="text-[11px] text-red hover:underline flex items-center gap-1">
                        View model <ExternalLink className="size-2.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
