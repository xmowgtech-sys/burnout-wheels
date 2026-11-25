"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  GitCompareArrows,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  X,
  Zap,
} from "lucide-react";
import { useStore, useToast } from "./providers";
import { fmtUSD } from "@/lib/money";
import { imageFitClass } from "@/lib/images";
import { CONDITION_LABELS, RARITY_LABELS, type Product } from "@/lib/types";
import { productToCompareItem } from "@/lib/collector-utils";
import { cn, dropLabel } from "@/lib/utils";

export function QuickViewModal() {
  const store = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const product = store.quickViewProduct;

  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setImgIdx(0);
    setQty(1);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.closeQuickView();
      if (product.images.length > 1) {
        if (e.key === "ArrowRight") setImgIdx((i) => (i + 1) % product.images.length);
        if (e.key === "ArrowLeft") setImgIdx((i) => (i - 1 + product.images.length) % product.images.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [product, store]);

  if (!product) return null;

  return <QuickViewDialogContent product={product} imgIdx={imgIdx} setImgIdx={setImgIdx} qty={qty} setQty={setQty} closeBtnRef={closeBtnRef} router={router} toast={toast} />;
}

function QuickViewDialogContent({
  product,
  imgIdx,
  setImgIdx,
  qty,
  setQty,
  closeBtnRef,
  router,
  toast,
}: {
  product: Product;
  imgIdx: number;
  setImgIdx: React.Dispatch<React.SetStateAction<number>>;
  qty: number;
  setQty: React.Dispatch<React.SetStateAction<number>>;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  router: ReturnType<typeof useRouter>;
  toast: (title: string, kind?: "ok" | "err" | "info") => void;
}) {
  const store = useStore();
  const soldOut = product.stock <= 0;
  const images = product.images;
  const activeImg = images[imgIdx] ?? null;
  const inWish = store.inWishlist(product.id);
  const inComp = store.inCompare(product.id);

  const cartLine = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price: product.priceSale,
    image: images[0] ?? null,
    condition: CONDITION_LABELS[product.condition],
    stock: product.stock,
  };

  const handleBuyNow = () => {
    store.add(cartLine, qty, { openDrawer: false });
    store.closeQuickView();
    router.push("/checkout");
  };

  const handleAdd = () => {
    store.add(cartLine, qty);
    store.closeQuickView();
    toast(`${product.name} × ${qty} loaded into cart`);
  };

  const handleCompare = () => {
    const status = store.toggleCompare(productToCompareItem(product));
    if (status === "added") toast(`${product.name} added to compare tray`);
    else if (status === "removed") toast("Removed from compare tray", "info");
    else toast("Compare tray holds up to 3 cars — remove one first", "err");
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view: ${product.name}`}
    >
      <button
        type="button"
        aria-label="Close quick view"
        onClick={store.closeQuickView}
        className="absolute inset-0 bg-[#0a0a0c]/90 backdrop-blur-sm"
      />

      <div
        data-lenis-prevent
        className="relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden border border-line-strong bg-[#0f1013] shadow-2xl"
      >
        <div className="u-spectrum h-[2px] w-full shrink-0" aria-hidden />

        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
          <p className="u-label truncate">
            <span className={product.featured ? "text-red" : "text-fog"}>
              {dropLabel(product.dropNumber, product.id)}
            </span>
            {" · "}
            {product.brand || "Burnout Wheels"}
            {product.scale ? ` · ${product.scale}` : ""}
          </p>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={store.closeQuickView}
            className="u-btn u-btn-ghost min-h-10 min-w-10 px-2.5! py-2!"
            aria-label="Close quick view"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="grid flex-1 overflow-y-auto md:grid-cols-[1.15fr_1fr]">
          {/* Photo stage */}
          <div className="flex flex-col border-b border-line bg-ink p-4 sm:p-5 md:border-b-0 md:border-r">
            <div className="u-media relative aspect-[4/3] w-full overflow-hidden">
              {activeImg ? (
                <Image
                  src={activeImg}
                  alt={`${product.name} — angle ${imgIdx + 1}`}
                  fill
                  sizes="(min-width: 768px) 480px, 94vw"
                  className={imageFitClass(product.imageFit, product.imagePosition)}
                  priority
                />
              ) : (
                <div className="u-skeleton absolute inset-0" aria-hidden />
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                    aria-label="Previous photo"
                    className="absolute left-2.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center border border-line-strong bg-ink/80 text-bone transition-colors hover:border-red hover:text-red"
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                    aria-label="Next photo"
                    className="absolute right-2.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center border border-line-strong bg-ink/80 text-bone transition-colors hover:border-red hover:text-red"
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                  <span className="u-mono absolute bottom-2.5 right-2.5 border border-line bg-ink/85 px-2 py-1 text-[10px] tracking-[0.14em] text-bone">
                    {String(imgIdx + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
                  </span>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    aria-label={`View photo ${i + 1}`}
                    aria-current={i === imgIdx}
                    className={cn(
                      "u-media relative aspect-[4/3] w-16 shrink-0 transition-opacity",
                      i === imgIdx ? "opacity-100 ring-2 ring-red" : "opacity-55 hover:opacity-90"
                    )}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="64px"
                      className={imageFitClass(product.imageFit, product.imagePosition)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Purchase & specs column */}
          <div className="flex flex-col p-4 sm:p-6">
            <h2 className="text-xl font-extrabold uppercase tracking-tight text-bone sm:text-2xl">
              {product.name}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em]">
              <span className="u-badge u-badge-cond" data-condition={product.condition}>
                {CONDITION_LABELS[product.condition]}
              </span>
              {product.rarity !== "STANDARD" && (
                <span
                  className={cn(
                    "u-badge uppercase",
                    product.rarity === "UNIQUE"
                      ? "border-violet/60 bg-violet/15 text-violet"
                      : "border-orange/60 bg-orange/15 text-orange"
                  )}
                >
                  {RARITY_LABELS[product.rarity]}
                </span>
              )}
              <span
                className={cn(
                  "u-mono text-[10.5px]",
                  soldOut ? "text-red" : product.stock <= product.lowStockThreshold ? "text-yellow" : "text-mint"
                )}
              >
                {soldOut ? "Sold out" : `${product.stock} in stock`}
              </span>
            </div>

            <div className="mt-5 flex items-baseline gap-3">
              <p className="u-mono text-3xl font-bold text-bone">{fmtUSD(product.priceSale)}</p>
              <span className="u-label">incl. taxes</span>
            </div>

            <p className="mt-4 line-clamp-3 text-[13px] leading-relaxed text-fog">
              {product.description}
            </p>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-between gap-2">
              <div className="flex items-center border border-line">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid size-11 place-items-center text-fog transition-colors hover:text-bone"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <span className="u-mono min-w-9 text-center text-sm">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(product.stock || 1, q + 1))}
                  disabled={soldOut || qty >= product.stock}
                  className="grid size-11 place-items-center text-fog transition-colors hover:text-bone disabled:opacity-30"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCompare}
                  aria-pressed={inComp}
                  aria-label={inComp ? `Remove ${product.name} from compare` : `Compare ${product.name}`}
                  className={cn(
                    "grid size-11 place-items-center border transition-colors",
                    inComp
                      ? "border-sky/60 bg-sky/10 text-sky"
                      : "border-line text-fog hover:border-line-strong hover:text-bone"
                  )}
                  title={inComp ? "In compare tray" : "Add to spec compare"}
                >
                  <GitCompareArrows className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.toggleWishlist(cartLine);
                    toast(inWish ? "Removed from wishlist" : "Saved to wishlist", inWish ? "info" : "ok");
                  }}
                  aria-pressed={inWish}
                  aria-label={inWish ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                  className={cn(
                    "grid size-11 place-items-center border transition-colors",
                    inWish
                      ? "border-rose/60 bg-rose/10 text-rose"
                      : "border-line text-fog hover:border-line-strong hover:text-bone"
                  )}
                >
                  <Heart className={cn("size-4", inWish && "fill-rose")} aria-hidden />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={soldOut}
                onClick={handleBuyNow}
                className="u-btn u-btn-primary w-full py-3.5! text-xs font-bold"
              >
                <Zap className="size-4 text-yellow" aria-hidden />
                <span>{soldOut ? "Sold out" : `Place Order — ${fmtUSD(product.priceSale * qty)}`}</span>
              </button>
              <button
                type="button"
                disabled={soldOut}
                onClick={handleAdd}
                className="u-btn u-btn-ghost w-full py-2.5! text-xs font-semibold"
              >
                <ShoppingCart className="size-4" aria-hidden />
                <span>Add to cart</span>
              </button>
            </div>

            <div className="mt-auto pt-5">
              <Link
                href={`/product/${product.slug}`}
                onClick={store.closeQuickView}
                className="inline-flex items-center gap-1.5 u-label text-bone! underline underline-offset-4 transition-colors hover:text-red!"
              >
                Open full specs & gallery
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
