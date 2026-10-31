"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Heart, Minus, Plus, ShoppingCart, X, Star } from "lucide-react";
import { useStore, useToast } from "./providers";
import { trackFlow } from "@/components/store/site-monitor";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS, type Product } from "@/lib/types";
import { cn, prefersReducedMotion, clamp } from "@/lib/utils";

/* ---------------- gallery ---------------- */

export function Gallery({ product }: { product: Product }) {
  const images = product.images.length ? product.images : [];
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return <div className="u-media aspect-[4/3] w-full"><div className="u-skeleton absolute inset-0" aria-hidden /></div>;
  }
  const current = images[idx]!;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={mainRef}
        className={cn("u-media relative aspect-[16/11] w-full cursor-zoom-in", zoom && "cursor-zoom-out")}
        onClick={() => setZoom((z) => !z)}
        onMouseMove={(e) => {
          if (!zoom || prefersReducedMotion() || e.currentTarget === null) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
          const y = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
          const img = mainRef.current?.querySelector("img");
          if (img) img.style.transformOrigin = `${x}% ${y}%`;
        }}
        aria-label="Product image, click to zoom"
      >
        <Image
          src={current}
          alt={`${product.name} — view ${idx + 1}`}
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className={cn("object-cover transition-transform duration-500", zoom && "scale-[2.2]")}
        />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          <span className="u-badge bg-ink/70 backdrop-blur-sm">Reference photography</span>
        </div>
      </div>

      {images.length > 1 && (
        <div className="flex items-center gap-3">
          <button
            className="u-btn u-btn-ghost !px-3 !py-2.5"
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            aria-label="Previous image"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={src}
                onClick={() => setIdx(i)}
                className={cn("u-media relative aspect-[4/3] size-20 shrink-0 transition-opacity", i === idx ? "opacity-100 ring-2 ring-red" : "opacity-55 hover:opacity-85")}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === idx}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
          <button
            className="u-btn u-btn-ghost !px-3 !py-2.5"
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            aria-label="Next image"
          >
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- buy panel ---------------- */

export function BuyPanel({ product }: { product: Product }) {
  const store = useStore();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
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

  useEffect(() => {
    trackFlow("view", { productId: product.id });
  }, [product.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center border border-line">
          <button className="px-4 py-3 text-fog transition-colors hover:text-bone" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span className="u-mono min-w-10 text-center text-sm">{qty}</span>
          <button
            className="px-4 py-3 text-fog transition-colors hover:text-bone disabled:opacity-30"
            onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
            disabled={qty >= product.stock}
            aria-label="Increase quantity"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
        <button
          onClick={() => {
            store.toggleWishlist(line);
            toast(store.inWishlist(product.id) ? "Removed from wishlist" : "Saved to wishlist", store.inWishlist(product.id) ? "info" : "ok");
          }}
          className={cn("u-btn u-btn-ghost !px-4 !py-3", store.inWishlist(product.id) && "!text-red")}
          aria-pressed={store.inWishlist(product.id)}
          aria-label="Toggle wishlist"
        >
          <Heart className={cn("size-4", store.inWishlist(product.id) && "fill-red")} aria-hidden />
        </button>
      </div>

      <button
        onClick={() => {
          store.add(line, qty);
          toast(`${product.name} × ${qty} loaded into cart`);
        }}
        disabled={soldOut}
        className="u-btn u-btn-primary w-full !py-4 !text-[12px]"
      >
        <ShoppingCart className="size-4" aria-hidden />
        {soldOut ? "Sold out" : `Add to cart — ${fmtUSD(product.priceSale * qty)}`}
      </button>

      {soldOut ? (
        <p className="u-label-txt">Next allocation drops soon — join the newsletter for first call.</p>
      ) : product.stock <= product.lowStockThreshold ? (
        <p className="u-label-txt !text-yellow">⚠ Only {product.stock} in the paddock — first come, first served</p>
      ) : (
        <p className="u-label-txt">✓ In stock · reserved when the order is placed</p>
      )}

      <p className="u-label-txt">
        Payment: UPI or Cash on Delivery · <Link href="/shipping" className="underline underline-offset-4 hover:text-bone">Shipping</Link> ·{" "}
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
                <button type="button" onClick={() => setOpen(false)} className="u-btn u-btn-ghost !px-2.5 !py-2" aria-label="Close">
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
