"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitCompareArrows,
  Heart,
  Maximize2,
  Minus,
  Plus,
  Share2,
  ShoppingCart,
  Star,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useStore, useToast } from "./providers";
import { trackFlow } from "@/components/store/site-monitor";
import { fmtUSD } from "@/lib/money";
import { imageFitClass } from "@/lib/images";
import { CONDITION_LABELS, type Product } from "@/lib/types";
import { productToCompareItem } from "@/lib/collector-utils";
import { COD_ADVANCE_LABEL } from "@/lib/payments";
import { cn, prefersReducedMotion, clamp } from "@/lib/utils";

/* ---------------- gallery ---------------- */

export function Gallery({ product }: { product: Product }) {
  const images = product.images.length ? product.images : [];
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);

  const current = images[idx] ?? null;

  useEffect(() => {
    setIdx(0);
    setZoom(false);
    setLightboxOpen(false);
  }, [product.id]);

  useEffect(() => {
    if (!lightboxOpen) return;
    lightboxCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (images.length > 1) {
        if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
        if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, images.length]);

  const prevImage = () => {
    setZoom(false);
    setIdx((i) => (i - 1 + images.length) % images.length);
  };

  const nextImage = () => {
    setZoom(false);
    setIdx((i) => (i + 1) % images.length);
  };

  return (
    <div className="flex min-w-0 w-full flex-col gap-3">
      {current ? (
        <div
          ref={mainRef}
          className={cn(
            "u-media group relative aspect-[16/11] w-full overflow-hidden border border-line sm:aspect-[4/3]",
            zoom ? "cursor-zoom-out" : "cursor-zoom-in"
          )}
          onClick={() => setZoom((z) => !z)}
          onMouseMove={(e) => {
            if (!zoom || prefersReducedMotion() || e.currentTarget === null) return;
            const r = e.currentTarget.getBoundingClientRect();
            const x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
            const y = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
            const img = mainRef.current?.querySelector("img");
            if (img) img.style.transformOrigin = `${x}% ${y}%`;
          }}
          onMouseLeave={() => {
            if (zoom) setZoom(false);
          }}
        >
          <Image
            src={current}
            alt={`${product.name} — view ${idx + 1}`}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className={cn(
              imageFitClass(product.imageFit, product.imagePosition),
              "transition-transform duration-500",
              zoom && "scale-[2.2]"
            )}
          />

          {/* Top-left angle counter */}
          {images.length > 0 && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
              <span className="u-mono border border-line-strong bg-ink/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-bone backdrop-blur-sm">
                {String(idx + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
              </span>
            </div>
          )}

          {/* Top-right studio tools: Zoom toggle & Fullscreen lightbox */}
          <div
            className="absolute right-3 top-3 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoom((z) => !z)}
              aria-label={zoom ? "Reset photo zoom" : "Zoom in on photo"}
              aria-pressed={zoom}
              className="grid size-10 place-items-center border border-line-strong bg-ink/85 text-bone backdrop-blur-sm transition-colors hover:border-red hover:text-red"
              title={zoom ? "Reset zoom" : "Zoom photo"}
            >
              {zoom ? <ZoomOut className="size-4" aria-hidden /> : <ZoomIn className="size-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(false);
                setLightboxOpen(true);
              }}
              aria-label="Open fullscreen photo lightbox"
              className="grid size-10 place-items-center border border-line-strong bg-ink/85 text-bone backdrop-blur-sm transition-colors hover:border-red hover:text-red"
              title="Fullscreen view"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
          </div>

          {/* Stage prev/next arrows for multi-angle sets */}
          {images.length > 1 && !zoom && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center border border-line-strong bg-ink/80 text-bone opacity-90 transition-all hover:border-red hover:text-red md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center border border-line-strong bg-ink/80 text-bone opacity-90 transition-all hover:border-red hover:text-red md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </>
          )}

          {/* Subtle bottom-left interaction hint */}
          <span className="pointer-events-none absolute bottom-3 left-3 hidden border border-line bg-ink/80 px-2.5 py-1 u-mono text-[10px] uppercase tracking-[0.14em] text-fog sm:inline-block">
            {zoom ? "Move cursor to pan · click to reset" : "Click to inspect · macro zoom"}
          </span>
        </div>
      ) : (
        <div className="u-media aspect-[4/3] w-full">
          <div className="u-skeleton absolute inset-0" aria-hidden />
        </div>
      )}

      {/* Thumbnail filmstrip */}
      {images.length > 1 && (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="u-btn u-btn-ghost px-3! py-2.5!"
            onClick={prevImage}
            aria-label="Previous image"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>

          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => {
                  setIdx(i);
                  setZoom(false);
                }}
                className={cn(
                  "u-media relative aspect-[4/3] w-20 shrink-0 transition-opacity",
                  i === idx ? "opacity-100 ring-2 ring-red" : "opacity-60 hover:opacity-90"
                )}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === idx}
              >
                <Image src={src} alt="" fill sizes="80px" className={imageFitClass(product.imageFit, product.imagePosition)} />
              </button>
            ))}
          </div>

          <button
            type="button"
            className="u-btn u-btn-ghost px-3! py-2.5!"
            onClick={nextImage}
            aria-label="Next image"
          >
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && current && (
        <div
          className="fixed inset-0 z-[85] flex flex-col bg-ink/95 backdrop-blur-md anim-fade"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} fullscreen photo gallery`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <span className="u-mono text-xs uppercase tracking-[0.16em] text-red">
                {String(idx + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
              </span>
              <span className="truncate text-sm font-semibold text-bone">{product.name}</span>
            </div>
            <button
              ref={lightboxCloseRef}
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close fullscreen gallery"
              className="u-btn u-btn-ghost min-h-10 min-w-10 px-2.5! py-2!"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center p-4 sm:p-8">
            <div className="relative h-full max-h-[75dvh] w-full max-w-5xl">
              <Image
                src={current}
                alt={`${product.name} — fullscreen view ${idx + 1}`}
                fill
                sizes="95vw"
                className="object-contain"
                priority
              />
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevImage}
                  aria-label="Previous fullscreen photo"
                  className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center border border-line-strong bg-coal/90 text-bone transition-colors hover:border-red hover:text-red sm:left-6"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={nextImage}
                  aria-label="Next fullscreen photo"
                  className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center border border-line-strong bg-coal/90 text-bone transition-colors hover:border-red hover:text-red sm:right-6"
                >
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto border-t border-line px-4 py-3">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Fullscreen photo ${i + 1}`}
                  aria-current={i === idx}
                  className={cn(
                    "u-media relative aspect-[4/3] w-16 shrink-0 transition-opacity",
                    i === idx ? "opacity-100 ring-2 ring-red" : "opacity-50 hover:opacity-90"
                  )}
                >
                  <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- buy panel ---------------- */

export function BuyPanel({ product }: { product: Product }) {
  const store = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);
  const soldOut = product.stock <= 0;
  const inComp = store.inCompare(product.id);
  const inWish = store.inWishlist(product.id);

  const line = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price: product.priceSale,
    image: product.images[0] ?? null,
    condition: CONDITION_LABELS[product.condition],
    stock: product.stock,
  };

  useEffect(() => {
    trackFlow("view", { productId: product.id });
  }, [product.id]);

  const handlePlaceOrderNow = () => {
    store.add(line, qty, { openDrawer: false });
    router.push("/checkout");
  };

  const handleCompare = () => {
    const status = store.toggleCompare(productToCompareItem(product));
    if (status === "added") toast(`${product.name} added to compare tray`);
    else if (status === "removed") toast("Removed from compare tray", "info");
    else toast("Compare tray holds up to 3 cars — remove one first", "err");
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : `/product/${product.slug}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      toast("Product link copied to clipboard");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast("Link ready to share from your address bar", "info");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center border border-line">
          <button
            type="button"
            className="px-4 py-3 text-fog transition-colors hover:text-bone"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span className="u-mono min-w-10 text-center text-sm">{qty}</span>
          <button
            type="button"
            className="px-4 py-3 text-fog transition-colors hover:text-bone disabled:opacity-30"
            onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
            disabled={qty >= product.stock}
            aria-label="Increase quantity"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCompare}
            className={cn(
              "u-btn u-btn-ghost px-3.5! py-3! text-[11px]!",
              inComp && "border-sky/60! bg-sky/10! text-sky!"
            )}
            aria-pressed={inComp}
            aria-label={inComp ? `Remove ${product.name} from compare` : `Compare ${product.name}`}
          >
            <GitCompareArrows className="size-4" aria-hidden />
            <span className="hidden sm:inline">{inComp ? "Comparing" : "Compare"}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="u-btn u-btn-ghost px-3.5! py-3!"
            aria-label="Share product link"
            title="Copy product link"
          >
            {copied ? <Check className="size-4 text-mint" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
          </button>

          <button
            type="button"
            onClick={() => {
              store.toggleWishlist(line);
              toast(inWish ? "Removed from wishlist" : "Saved to wishlist", inWish ? "info" : "ok");
            }}
            className={cn("u-btn u-btn-ghost !px-4 !py-3", inWish && "!text-red")}
            aria-pressed={inWish}
            aria-label={inWish ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          >
            <Heart className={cn("size-4", inWish && "fill-red")} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handlePlaceOrderNow}
          disabled={soldOut}
          className="u-btn u-btn-primary w-full py-4! text-xs font-bold flex items-center justify-center gap-2"
        >
          <Zap className="size-4 text-yellow" aria-hidden />
          <span>{soldOut ? "Sold out" : `Place Order Now — ${fmtUSD(product.priceSale * qty)}`}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            store.add(line, qty);
            toast(`${product.name} × ${qty} loaded into cart`);
          }}
          disabled={soldOut}
          className="u-btn u-btn-ghost w-full py-2.5! text-xs font-semibold flex items-center justify-center gap-2"
        >
          <ShoppingCart className="size-4" aria-hidden />
          <span>Add to cart</span>
        </button>
      </div>

      {soldOut ? (
        <p className="u-label-txt">Next allocation drops soon — join the newsletter for first call.</p>
      ) : product.stock <= product.lowStockThreshold ? (
        <p className="u-label-txt text-yellow!">Only {product.stock} in the paddock — first come, first served</p>
      ) : (
        <p className="u-label-txt">In stock · reserved when the order is placed</p>
      )}

      <p className="u-label-txt">
        Payment: UPI · COD ({COD_ADVANCE_LABEL} online advance) · PayPal via WhatsApp/Discord ·{" "}
        <Link href="/shipping" className="underline underline-offset-4 hover:text-bone">Shipping</Link> ·{" "}
        <Link href="/refund-cancellation" className="underline underline-offset-4 hover:text-bone">Cancellation & refund rules</Link>
      </p>
    </div>
  );
}

/* ---------------- review modal ---------------- */

export function ReviewLauncher({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    el?.querySelector<HTMLInputElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (state === "done") {
    return (
      <div className="u-card p-5">
        <p className="u-label">Verified queue</p>
        <p className="mt-2 text-sm text-fog">
          Thanks — your review is held for verification and publishes once approved. Nothing is scored publicly until then.
        </p>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="u-btn u-btn-ghost w-full sm:w-auto">
        Write a review
      </button>
      {open && (
        <div className="fixed inset-0 z-[75] anim-fade" role="dialog" aria-modal="true" aria-label="Write a review">
          <button aria-label="Close review form" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/80 backdrop-blur-sm" />
          <div ref={ref} className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 anim-rise">
            <form
              className="u-card p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setError("");
                setState("busy");
                try {
                  const res = await fetch("/api/reviews", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      productId: product.id,
                      slug: product.slug,
                      name: form.get("name"),
                      email: form.get("email"),
                      rating: Number(form.get("rating")),
                      title: form.get("title"),
                      body: form.get("body"),
                    }),
                  });
                  const data = (await res.json()) as { error?: string };
                  if (!res.ok) throw new Error(data.error || "Could not submit");
                  setOpen(false);
                  setState("done");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not submit");
                  setState("idle");
                }
              }}
            >
              <div className="flex items-center justify-between">
                <p className="u-h3">Review {product.name}</p>
                <button type="button" onClick={() => setOpen(false)} className="u-btn u-btn-ghost px-2.5! py-2!" aria-label="Close">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="u-label-txt">Name</span>
                  <input name="name" required maxLength={80} className="u-input mt-1.5" />
                </label>
                <label className="block">
                  <span className="u-label-txt">Email (not published)</span>
                  <input name="email" type="email" required className="u-input mt-1.5" />
                </label>
                <label className="block">
                  <span className="u-label-txt">Rating</span>
                  <select name="rating" defaultValue="5" className="u-select mt-1.5">
                    {["5", "4", "3", "2", "1"].map((n) => (
                      <option key={n} value={n}>{"★".repeat(Number(n))} {n}/5</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="u-label-txt">Headline (optional)</span>
                  <input name="title" maxLength={120} className="u-input mt-1.5" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="u-label-txt">Your review</span>
                  <textarea name="body" required minLength={10} maxLength={1500} className="u-textarea mt-1.5" placeholder="Fit and finish, paint, packaging — say it like telemetry." />
                </label>
              </div>
              {error && <p className="mt-3 text-[13px] text-red">{error}</p>}
              <button disabled={state === "busy"} className="u-btn u-btn-primary mt-5 w-full">
                {state === "busy" ? "Submitting…" : "Submit for verification"}
              </button>
              <p className="u-label-txt mt-3">Every review is human-checked before publishing. Fake scores aren't our sport.</p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("inline size-3.5", i < rating ? "fill-yellow" : "opacity-30")} aria-hidden />
      ))}
    </span>
  );
}

/* ---------------- mobile sticky buy bar ---------------- */

export function MobileBuyBar({ product }: { product: Product }) {
  const store = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const soldOut = product.stock <= 0;

  const line = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price: product.priceSale,
    image: product.images[0] ?? null,
    condition: CONDITION_LABELS[product.condition],
    stock: product.stock,
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold">{product.name}</p>
          <p className="u-mono text-[11px] text-fog">
            {fmtUSD(product.priceSale)}
            {product.stock <= product.lowStockThreshold && product.stock > 0 ? ` · only ${product.stock} left` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              store.add(line, 1, { openDrawer: false });
              router.push("/checkout");
            }}
            disabled={soldOut}
            className="u-btn u-btn-primary min-h-11 px-3.5! py-2.5! text-[11px]! font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Zap className="size-3 shrink-0 text-yellow" aria-hidden />
            <span>{soldOut ? "Sold out" : `Order · ${fmtUSD(product.priceSale)}`}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              store.add(line, 1);
              toast(`${product.name} added to cart`);
            }}
            disabled={soldOut}
            aria-label={`Add ${product.name} to cart`}
            className="u-btn u-btn-ghost min-h-11 min-w-11 px-3! py-2.5! text-[11px]! font-semibold flex items-center justify-center whitespace-nowrap"
          >
            <ShoppingCart className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
