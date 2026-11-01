"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCallback, useState } from "react";

interface Facet { value: string; label: string; count: number }

export function ShopFilters({
  categories,
  conditions,
  activeCategory,
  activeCondition,
  activeSort,
  activeStock,
  activeQ,
}: {
  categories: Facet[];
  conditions: Facet[];
  activeCategory: string;
  activeCondition: string;
  activeSort: string;
  activeStock: boolean;
  activeQ: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(activeQ);

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      router.push(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [params, router, pathname]
  );

  const toggle = (key: string, value: string, active: boolean) =>
    push((p) => {
      if (active) p.delete(key);
      else p.set(key, value);
    });

  const hasFilters = activeCategory || activeCondition || activeStock || activeSort !== "newest" || activeQ;

  return (
    <div className="sticky top-16 z-30 -mx-4 border-y border-line bg-ink/90 px-4 py-3 backdrop-blur-md md:top-[72px] md:-mx-8 md:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          push((p) => {
            const term = q.trim();
            if (term) p.set("q", term);
            else p.delete("q");
          });
        }}
        className="flex flex-wrap items-center gap-2"
  role="search"
      >
        <div className="relative flex min-w-[200px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-dim" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this grid…"
            className="u-input py-2.5! pl-9!"
            aria-label="Search products"
          />
        </div>

        <select value={activeCategory} onChange={(e) => toggle("cat", e.target.value, activeCategory === "")} className="u-select w-auto! py-2.5!" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label} ({c.count})</option>
          ))}
        </select>

        <select value={activeCondition} onChange={(e) => toggle("cond", e.target.value, activeCondition === "")} className="u-select w-auto! py-2.5!" aria-label="Condition">
          <option value="">All conditions</option>
          {conditions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select value={activeSort} onChange={(e) => push((p) => p.set("sort", e.target.value))} className="u-select w-auto! py-2.5!" aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
        </select>

        <button
          type="button"
          onClick={() => push((p) => (activeStock ? p.delete("stock") : p.set("stock", "1")))}
          className="u-chip"
          data-active={activeStock}
          aria-pressed={activeStock}
        >
          In stock
        </button>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => { setQ(""); router.push(pathname, { scroll: false }); }}
            className="u-chip text-red!"
          >
            <X className="size-3" aria-hidden /> Reset
          </button>
        ) : null}
      </form>
    </div>
  );
}
