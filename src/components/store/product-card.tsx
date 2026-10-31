"use client";

import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import Image from "next/image";
import { useStore, useToast } from "./providers";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function WishlistHeart({ product, floating = false }: { product: Product; floating?: boolean }) {
  const store = useStore();
  const { toast } = useToast();
  const active = store.inWishlist(product.id);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        store.toggleWishlist({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.priceSale,
          image: product.images[0] ?? null,
          condition: CONDITION_LABELS[product.condition],
        });
        toast(active ? "Removed from wishlist" : "Saved to wishlist — garage door open", active ? "info" : "ok");
      }}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
      aria-pressed={active}
      className={cn(
        "grid size-9 place-items-center border transition-all",
        floating
          ? "border-line bg-ink/70 backdrop-blur-sm hover:border-line-strong"
          : "border-line hover:border-line-strong",
        active ? "text-red" : "text-fog hover:text-bone"
      )}
    >
      <Heart className={cn("size-4", active && "fill-red")} aria-hidden />
    </button>
  );
}

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const store = useStore();
  const { toast } = useToast();
  const soldOut = product.stock <= 0;
  const low = !soldOut && product.stock <= product.lowStockThreshold;
  const primary = product.images[0] ?? null;

  const add = () => {
    store.add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.priceSale,
      image: primary,
      condition: CONDITION_LABELS[product.condition],
      stock: product.stock,
    });
    toast(`${product.name} loaded into cart`);
  };

  return (
    <article className="group relative flex flex-col">
      <Link href={`/product/${product.slug}`} className="relative block" aria-label={`View ${product.name}`}>
        <div className="u-media u-duotone relative aspect-[4/3]">
          {primary ? (
            <Image
              src={primary}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 92vw"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <div className="u-skeleton absolute inset-0" aria-hidden />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/70 to-transparent" aria-hidden />
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            <span className="u-badge border-white/15 bg-ink/70 uppercase backdrop-blur-sm">
              {product.condition === "NEW" ? "New / Boxed" : CONDITION_LABELS[product.condition]}
            </span>
            {low && (
              <span className="u-badge border-red/60 bg-red/90 uppercase text-white">Only {product.stock} left</span>
            )}
            {soldOut && <span className="u-badge border-white/15 bg-ink/80 uppercase backdrop-blur-sm">Sold out</span>}
          </div>
          <div className="absolute right-3 top-3 opacity-90">
            <WishlistHeart product={product} floating />
          </div>
          {product.featured && (
            <span className="u-badge absolute bottom-3 left-3 border-yellow/70 bg-yellow/95 uppercase text-ink">Drop 001</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 items-start justify-between gap-3 pt-4">
        <div className="min-w-0">
          <p className="u-label !text-dim">{product.category}{product.scale ? ` · ${product.scale}` : ""}</p>
          <Link href={`/product/${product.slug}`} className="mt-1.5 block text-[15px] font-semibold leading-snug transition-colors hover:text-red">
            {product.name}
          </Link>
          <p className="u-mono mt-2 text-[15px] font-medium">{fmtUSD(product.priceSale)}</p>
        </div>
        <button
          onClick={add}
          disabled={soldOut}
          aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
          className="u-btn u-btn-ghost !rounded-sm !p-3 disabled:cursor-not-allowed"
        >
          <Plus className={cn("size-4", !soldOut && "transition-transform group-hover:rotate-90")} aria-hidden />
        </button>
      </div>
    </article>
  );
}
