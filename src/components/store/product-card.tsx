"use client";

import Link from "next/link";
import { ArrowUpRight, Heart, Plus } from "lucide-react";
import Image from "next/image";
import { useStore, useToast } from "./providers";
import { fmtUSD } from "@/lib/money";
import { imageFitClass } from "@/lib/images";
import { CONDITION_LABELS, RARITY_LABELS, type Product } from "@/lib/types";
import { cn, dropLabel } from "@/lib/utils";

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
        "grid size-11 place-items-center border transition-all",
        floating
          ? "border-line bg-ink/70 backdrop-blur-sm hover:border-line-strong"
          : "border-line hover:border-line-strong",
        active ? "border-rose/60 bg-rose/10 text-rose" : "text-fog hover:text-bone"
      )}
    >
      <Heart className={cn("size-4", active && "fill-rose")} aria-hidden />
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
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 46vw"
              className={imageFitClass(product.imageFit, product.imagePosition)}
              priority={priority}
            />
          ) : (
            <div className="u-skeleton absolute inset-0" aria-hidden />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/70 to-transparent" aria-hidden />

          <div className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-4rem)] flex-col items-start gap-1.5 sm:left-3 sm:top-3">
            <span className="u-badge u-badge-cond bg-ink/60 backdrop-blur-sm" data-condition={product.condition}>
              {CONDITION_LABELS[product.condition]}
            </span>
            {product.rarity !== "STANDARD" && (
              <span
                className={cn(
                  "u-badge uppercase backdrop-blur-sm",
                  product.rarity === "UNIQUE"
                    ? "border-violet/60 bg-violet/20 text-violet"
                    : "border-orange/60 bg-orange/15 text-orange"
                )}
              >
                {RARITY_LABELS[product.rarity]}
              </span>
            )}
            {low && (
              <span className="u-badge border-red/60 bg-red/90 uppercase text-white">Only {product.stock} left</span>
            )}
            {soldOut && <span className="u-badge border-white/15 bg-ink/80 uppercase backdrop-blur-sm">Sold out</span>}
          </div>

          <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">
            <WishlistHeart product={product} floating />
          </div>

          <span
            className={cn(
              "u-badge absolute bottom-2.5 left-2.5 uppercase sm:bottom-3 sm:left-3",
              product.featured ? "border-yellow/70 bg-yellow/95 text-ink" : "border-white/15 bg-ink/75 text-bone backdrop-blur-sm"
            )}
          >
            {dropLabel(product.dropNumber, product.id)}
          </span>

          {/* inspect cue — desktop hover only */}
          <span className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-2 border border-white/20 bg-ink/70 px-3 py-2 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 md:flex">
            <span className="u-label text-bone">Inspect</span>
            <ArrowUpRight className="size-3.5 text-red" aria-hidden />
          </span>

          <span className="u-spectrum absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" aria-hidden />
        </div>
      </Link>

      <div className="flex flex-1 items-start justify-between gap-2 pt-3 sm:gap-3 sm:pt-4">
        <div className="min-w-0">
          <p className="u-label text-dim! truncate">
            {product.category}
            {product.scale ? ` · ${product.scale}` : ""}
          </p>
          <Link
            href={`/product/${product.slug}`}
            className="mt-1.5 block text-[13.5px] font-semibold leading-snug transition-colors hover:text-red sm:text-[15px]"
          >
            {product.name}
          </Link>
          <p className="u-mono mt-1.5 text-[13px] font-medium sm:mt-2 sm:text-[15px]">{fmtUSD(product.priceSale)}</p>
        </div>
        <button
          onClick={add}
          disabled={soldOut}
          aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
          className="u-btn u-btn-ghost mt-0.5 min-h-11 min-w-11 rounded-sm! p-3! disabled:cursor-not-allowed"
        >
          <Plus className={cn("size-4", !soldOut && "transition-transform group-hover:rotate-90")} aria-hidden />
        </button>
      </div>
    </article>
  );
}
