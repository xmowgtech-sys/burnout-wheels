"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, ArrowRight, Trash2, Plus, Minus, ShieldCheck, Truck } from "lucide-react";
import { useStore } from "@/components/store/providers";
import { PageHero, EmptyState } from "@/components/ui";
import { fmtUSD } from "@/lib/money";
import { COD_ADVANCE_LABEL } from "@/lib/payments";

export default function CartPage() {
  const store = useStore();
  const { lines, setQty, remove, subtotal, mounted } = store;

  if (!mounted) {
    return <PageHero label="Paddock Order" title="Loading cart" sub="Reading your paddock state…" />;
  }

  const freeOver = 249900;
  const currentSubtotal = subtotal();
  const remaining = Math.max(0, freeOver - currentSubtotal);
  const isFreeShipping = remaining === 0;

  if (lines.length === 0) {
    return (
      <>
        <PageHero
          label="Paddock Order"
          title="Your Cart"
          sub="No metal loaded yet. Browse the grid to pick your authentic die-cast model."
        />
        <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
          <EmptyState
            title="Empty paddock"
            body="No items in your cart yet. All models are genuine, inspected, and reserved the moment you order."
            action={
              <Link href="/shop" className="u-btn u-btn-primary">
                Browse the shop
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        label="Paddock Order"
        title="Your Cart"
        sub="Stock is reserved as soon as you place your order. Free shipping on orders over ₹2,499."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* Cart items list */}
          <div className="flex flex-col gap-4">
            <div className="border-b border-line pb-4 flex items-center justify-between">
              <h2 className="u-label text-sm">
                Cart Items ({lines.reduce((n, l) => n + l.qty, 0)})
              </h2>
              <button
                type="button"
                onClick={store.clear}
                className="text-xs text-dim hover:text-red transition-colors"
              >
                Clear all items
              </button>
            </div>

            <div className="divide-y divide-line">
              {lines.map((l) => (
                <article key={l.productId} className="flex gap-4 py-5 sm:gap-6">
                  <Link
                    href={`/product/${l.slug}`}
                    className="u-media relative size-24 shrink-0 sm:size-28 border border-line bg-surface"
                  >
                    {l.image ? (
                      <Image src={l.image} alt={l.name} fill sizes="112px" className="object-cover" />
                    ) : (
                      <div className="size-full u-skeleton" />
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/product/${l.slug}`}
                          className="text-base font-bold text-bone hover:text-red transition-colors"
                        >
                          {l.name}
                        </Link>
                        <span className="u-mono text-base font-bold text-bone">
                          {fmtUSD(l.price * l.qty)}
                        </span>
                      </div>
                      <p className="u-label mt-1">{l.condition}</p>
                      <p className="u-mono text-xs text-dim mt-0.5">
                        {fmtUSD(l.price)} each
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-line bg-surface">
                        <button
                          type="button"
                          onClick={() => setQty(l.productId, l.qty - 1)}
                          className="px-3 py-1.5 text-fog hover:text-bone hover:bg-coal"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="u-mono min-w-10 text-center text-sm font-semibold">
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(l.productId, Math.min(l.stock || 99, l.qty + 1))}
                          disabled={l.qty >= (l.stock || 99)}
                          className="px-3 py-1.5 text-fog hover:text-bone hover:bg-coal disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => remove(l.productId)}
                        className="flex items-center gap-1.5 text-xs text-dim hover:text-red transition-colors"
                        aria-label={`Remove ${l.name} from cart`}
                      >
                        <Trash2 className="size-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between text-xs text-fog">
              <Link href="/shop" className="underline underline-offset-4 hover:text-bone">
                ← Continue shopping
              </Link>
              <span>Authentic die-cast · Sealed &amp; inspected</span>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <aside className="h-fit lg:sticky lg:top-28">
            <div className="u-card p-6 border border-line bg-panel">
              <h3 className="u-label">Order Summary</h3>

              {/* Free shipping meter */}
              <div className="mt-4 rounded border border-line bg-surface p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Truck className="size-3.5 text-mint" />
                    <span>Free Shipping</span>
                  </span>
                  <span className={isFreeShipping ? "text-mint font-bold" : "text-bone"}>
                    {isFreeShipping ? "UNLOCKED" : `Add ${fmtUSD(remaining)} more`}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 w-full bg-line overflow-hidden rounded-full">
                  <div
                    className="h-full bg-mint transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, (currentSubtotal / freeOver) * 100)}%` }}
                  />
                </div>
              </div>

              <dl className="mt-6 flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fog">Subtotal</dt>
                  <dd className="u-mono font-medium">{fmtUSD(currentSubtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fog">Shipping</dt>
                  <dd className="u-mono font-medium">
                    {isFreeShipping ? <span className="text-mint font-semibold">FREE</span> : "Calculated at checkout"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
                  <dt>Estimated Total</dt>
                  <dd className="u-mono text-lg">{fmtUSD(currentSubtotal)}</dd>
                </div>
              </dl>

              {/* Place Order / Checkout Button */}
              <Link
                href="/checkout"
                className="u-btn u-btn-primary mt-6 w-full py-4! text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="size-4" />
              </Link>

              <div className="mt-5 flex flex-col gap-2 text-[11px] text-dim leading-relaxed border-t border-line pt-4">
                <p className="flex items-center gap-1.5 text-fog">
                  <ShieldCheck className="size-3.5 text-mint shrink-0" />
                  <span>Secure checkout — UPI, COD ({COD_ADVANCE_LABEL} advance)</span>
                </p>
                <p>Stock reserves the second you place your order.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
