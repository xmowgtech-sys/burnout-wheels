"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Trash2, ShoppingCart } from "lucide-react";
import { useStore, useToast } from "@/components/store/providers";
import { PageHero, EmptyState } from "@/components/ui";
import { fmtUSD } from "@/lib/money";

export default function WishlistPage() {
  const store = useStore();
  const { toast } = useToast();

  if (!store.mounted) {
    return <PageHero label="03 — Garage" title="Wishlist" sub="Loading your saved metal…" />;
  }

  const moveToCart = (item: (typeof store.wishlist)[number]) => {
    store.add({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      price: item.price,
      image: item.image ?? null,
      condition: item.condition || "New / Boxed",
      stock: 99,
    });
    toast(`${item.name} loaded into cart`);
  };

  return (
    <>
      <PageHero label="03 — Garage" title="Wishlist" sub="Everything you've flagged for the next drop window. Saved on this device only." />
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {store.wishlist.length === 0 ? (
          <EmptyState
            title="Garage is empty"
            body="Tap the heart on any piece and it parks here until the price, the stock or the mood is right."
            action={<Link href="/shop" className="u-btn u-btn-primary">Browse the grid</Link>}
          />
        ) : (
          <ul className="grid content-start gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {store.wishlist.map((w) => (
              <li key={w.productId} className="u-card flex gap-4 p-4">
                <Link href={`/product/${w.slug}`} className="u-media relative size-24 shrink-0">
                  {w.image ? <Image src={w.image} alt={w.name} fill sizes="96px" className="object-cover" /> : null}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/product/${w.slug}`} className="truncate text-[14px] font-semibold hover:text-red">{w.name}</Link>
                  <p className="u-mono mt-1 text-[13px]">{fmtUSD(w.price)}</p>
                  <div className="mt-auto flex gap-2 pt-3">
                    <button onClick={() => moveToCart(w)} className="u-btn u-btn-primary !px-3 !py-2 !text-[10px]">
                      <ShoppingCart className="size-3.5" aria-hidden /> To cart
                    </button>
                    <button
                      onClick={() => store.toggleWishlist(w)}
                      className="u-btn u-btn-ghost !px-3 !py-2"
                      aria-label={`Remove ${w.name} from wishlist`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="u-label mt-10 flex items-center gap-2"><Heart className="size-3.5 text-red" aria-hidden /> Wishlist hearts also appear inline on every grid card.</p>
      </div>
    </>
  );
}
