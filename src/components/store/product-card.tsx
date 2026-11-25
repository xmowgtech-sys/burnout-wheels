"use client";

import Link from "next/link";
import { Eye, GitCompareArrows, Heart, Plus } from "lucide-react";
import Image from "next/image";
import { useStore, useToast } from "./providers";
import { fmtUSD } from "@/lib/money";
import { imageFitClass } from "@/lib/images";
import { CONDITION_LABELS, RARITY_LABELS, type Product } from "@/lib/types";
import { productToCompareItem } from "@/lib/collector-utils";
import { cn, dropLabel } from "@/lib/utils";

export function WishlistHeart({ product, floating = false }: { product: Product; floating?: boolean }) {
  const store = useStore();
  const { toast } = useToast();
  const active = store.inWishlist(product.id);

  return (
    <button
      type="button"
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
        "grid size-10 place-items-center border transition-all sm:size-11",
        floating
          ? "border-line bg-ink/80 backdrop-blur-sm hover:border-line-strong"
          : "border-line hover:border-line-strong",
        active ? "border-rose/60 bg-rose/15 text-rose" : "text-fog hover:text-bone"
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
  const secondary = product.images[1] ?? null;
  const comparing = store.inCompare(product.id);

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

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const status = store.toggleCompare(productToCompareItem(product));
    if (status === "added") toast(`${product.name} added to compare tray`);
    else if (status === "removed") toast("Removed from compare tray", "info");
    else toast("Compare tray holds up to 3 cars — remove one first", "err");
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    store.openQuickView(product);
  };

  return (
    <article className="group relative flex flex-col">
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="relative block" aria-label={`View ${product.name}`}>
          <div className="u-media u-duotone relative aspect-[4/3] overflow-hidden">
            {primary ? (
              <>
                <Image
                  src={primary}
                  alt={product.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 46vw"
                  className={cn(
                    imageFitClass(product.imageFit, product.imagePosition),
                    "transition-opacity duration-500",
                    secondary && "group-hover:opacity-0"
                  )}
                  priority={priority}
                />
                {secondary && (
                  <Image
                    src={secondary}
                    alt={`${product.name} — alternate angle`}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 46vw"
                    className={cn(
                      imageFitClass(product.imageFit, product.imagePosition),
                      "opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    )}
                  />
                )}
              </>
            ) : (
              <div className="u-skeleton absolute inset-0" aria-hidden />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/75 to-transparent" aria-hidden />

            <div className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3">
              {soldOut ? (
                <span className="u-badge border-white/20 bg-ink/90 uppercase text-fog">Sold out</span>
              ) : low ? (
                <span className="u-badge border-red/60 bg-red text-white uppercase">Only {product.stock} left</span>
              ) : product.rarity !== "STANDARD" ? (
                <span
                  className={cn(
                    "u-badge uppercase bg-ink/85",
                    product.rarity === "UNIQUE" ? "border-violet/60 text-violet" : "border-orange/60 text-orange"
                  )}
                >
                  {RARITY_LABELS[product.rarity]}
                </span>
              ) : (
                <span className="u-badge u-badge-cond bg-ink/85" data-condition={product.condition}>
                  {CONDITION_LABELS[product.condition]}
                </span>
              )}
            </div>

            <span
              className={cn(
                "u-badge absolute bottom-2.5 left-2.5 uppercase sm:bottom-3 sm:left-3",
                product.featured ? "border-yellow/70 bg-yellow text-ink" : "border-white/15 bg-ink/85 text-bone"
              )}
            >
              {dropLabel(product.dropNumber, product.id)}
            </span>

            <span className="u-spectrum absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" aria-hidden />
          </div>
        </Link>

        {/* Top-right wishlist toggle — native button outside link to keep HTML valid */}
        <div className="absolute right-2.5 top-2.5 z-10 sm:right-3 sm:top-3">
          <WishlistHeart product={product} floating />
        </div>

        {/* Bottom-right Quick View & Compare controls */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 sm:bottom-3 sm:right-3">
          <button
            type="button"
            onClick={handleCompare}
            aria-pressed={comparing}
            aria-label={comparing ? `Remove ${product.name} from compare` : `Compare ${product.name}`}
            title={comparing ? "In compare tray" : "Compare specs"}
            className={cn(
              "grid size-9 place-items-center border backdrop-blur-sm transition-all sm:size-10",
              comparing
                ? "border-sky/70 bg-sky/20 text-sky opacity-100"
                : "border-line bg-ink/85 text-fog hover:border-line-strong hover:text-bone md:opacity-80 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            )}
          >
            <GitCompareArrows className="size-3.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={handleQuickView}
            aria-label={`Quick view ${product.name}`}
            title="Quick view"
            className="grid size-9 place-items-center border border-line bg-ink/85 text-bone backdrop-blur-sm transition-all hover:border-red hover:text-red sm:size-10 md:opacity-80 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <Eye className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

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
          type="button"
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
