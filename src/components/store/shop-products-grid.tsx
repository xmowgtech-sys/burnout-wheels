"use client";

import { useState } from "react";
import Link from "next/link";
import { Columns2, LayoutGrid } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { RecentlyViewedStrip } from "@/components/store/recently-viewed";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

/**
 * Server-driven grid. Products come from the database only — no browser cache
 * is merged in, so what a customer sees is exactly what the server can sell.
 */
export function ShopProductsGrid({
  initialProducts,
  sortLabel,
  query,
}: {
  initialProducts: Product[];
  sortLabel?: string;
  query?: string;
}) {
  const [density, setDensity] = useState<"grid" | "editorial">("grid");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="u-label" aria-live="polite">
          {initialProducts.length} {initialProducts.length === 1 ? "unit" : "units"} on grid
          {query ? ` for “${query}”` : ""}
        </p>

        <div className="flex items-center gap-4">
          {sortLabel && <p className="u-label hidden sm:block">Sorted · {sortLabel}</p>}

          {initialProducts.length > 0 && (
            <div
              className="hidden items-center border border-line bg-panel lg:inline-flex"
              role="group"
              aria-label="Grid layout density"
            >
              <button
                type="button"
                onClick={() => setDensity("grid")}
                aria-pressed={density === "grid"}
                aria-label="4-column catalog grid"
                title="Compact grid"
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 px-2.5 py-1.5 u-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                  density === "grid" ? "bg-red text-white" : "text-fog hover:text-bone"
                )}
              >
                <LayoutGrid className="size-3.5" aria-hidden />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setDensity("editorial")}
                aria-pressed={density === "editorial"}
                aria-label="2-column editorial view"
                title="Large editorial cards"
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 border-l border-line px-2.5 py-1.5 u-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                  density === "editorial" ? "bg-red text-white" : "text-fog hover:text-bone"
                )}
              >
                <Columns2 className="size-3.5" aria-hidden />
                <span>Large</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {initialProducts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Sector clear"
            body="Nothing matches that combination yet. Reset the filters — or wait: drops announce on the paddock list first."
            action={
              <Link href="/shop" className="u-btn u-btn-primary">
                Reset filters
              </Link>
            }
          />
        </div>
      ) : (
        <div
          data-testid="shop-products-grid"
          data-density={density}
          className={cn(
            "mt-6 grid content-start",
            density === "editorial"
              ? "grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2"
              : "grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 md:gap-y-12 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {initialProducts.map((p, i) => (
            <div key={p.id} className="page-in" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <ProductCard product={p} priority={i < 4} />
            </div>
          ))}
        </div>
      )}

      <RecentlyViewedStrip />
    </>
  );
}
