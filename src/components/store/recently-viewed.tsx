"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Trash2 } from "lucide-react";
import {
  isRecentlyViewedItem,
  pushRecentlyViewed,
  safeParseArray,
  type RecentlyViewedItem,
} from "@/lib/collector-utils";
import { fmtUSD } from "@/lib/money";
import { dropLabel } from "@/lib/utils";
import type { Product } from "@/lib/types";

const RECENT_KEY = "bw:recent:v1";

export function RecentlyViewedTracker({ product }: { product: Product }) {
  useEffect(() => {
    try {
      const current = safeParseArray(window.localStorage.getItem(RECENT_KEY), isRecentlyViewedItem);
      const next = pushRecentlyViewed(current, {
        id: product.id,
        slug: product.slug,
        name: product.name,
        category: product.category,
        scale: product.scale,
        priceSale: product.priceSale,
        dropNumber: product.dropNumber,
        image: product.images[0] ?? null,
      });
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore private mode / quota errors */
    }
  }, [
    product.id,
    product.slug,
    product.name,
    product.category,
    product.scale,
    product.priceSale,
    product.dropNumber,
    product.images,
  ]);

  return null;
}

export function RecentlyViewedStrip({ excludeId }: { excludeId?: number }) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    try {
      const parsed = safeParseArray(window.localStorage.getItem(RECENT_KEY), isRecentlyViewedItem);
      setItems(excludeId !== undefined ? parsed.filter((i) => i.id !== excludeId) : parsed);
    } catch {
      setItems([]);
    }
  }, [excludeId]);

  if (items.length === 0) return null;

  const clearHistory = () => {
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
    setItems([]);
  };

  return (
    <section
      aria-label="Recently inspected models"
      className="mt-16 border-t border-line pt-12 md:mt-20"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="u-label flex items-center gap-2">
            <Clock className="size-3.5 text-red" aria-hidden />
            Pit history
          </p>
          <h2 className="u-h3 mt-2">Recently inspected</h2>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="inline-flex items-center gap-1.5 u-label text-dim! transition-colors hover:text-bone!"
        >
          <Trash2 className="size-3" aria-hidden />
          Clear history
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-6">
        {items.slice(0, 6).map((item) => (
          <Link
            key={item.id}
            href={`/product/${item.slug}`}
            className="group flex flex-col border border-line bg-panel/60 transition-colors hover:border-line-strong"
          >
            <div className="u-media relative aspect-[4/3] w-full overflow-hidden">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 46vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="u-skeleton absolute inset-0" aria-hidden />
              )}
              <span className="u-mono absolute bottom-1.5 left-1.5 border border-white/15 bg-ink/85 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-bone">
                {dropLabel(item.dropNumber, item.id)}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-2.5">
              <p className="truncate u-mono text-[9.5px] uppercase tracking-[0.12em] text-dim">
                {item.category}
                {item.scale ? ` · ${item.scale}` : ""}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-bone transition-colors group-hover:text-red">
                {item.name}
              </p>
              <p className="u-mono mt-auto pt-2 text-[12px] font-medium text-fog">
                {fmtUSD(item.priceSale)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
