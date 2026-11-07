"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

interface Facet {
  value: string;
  label: string;
  count: number;
}

export function ShopFilters({
  categories,
  conditions,
  rarities,
  activeCategories,
  activeConditions,
  activeRarities,
  activeSort,
  activeStock,
  activeQ,
}: {
  categories: Facet[];
  conditions: Facet[];
  rarities: Facet[];
  activeCategories: string[];
  activeConditions: string[];
  activeRarities: string[];
  activeSort: string;
  activeStock: boolean;
  activeQ: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(activeQ);
  const [cats, setCats] = useState(activeCategories);
  const [conds, setConds] = useState(activeConditions);
  const [rare, setRare] = useState(activeRarities);
  const [stockOnly, setStockOnly] = useState(activeStock);
  const selectedCount = cats.length + conds.length + rare.length + (stockOnly ? 1 : 0);
  const [open, setOpen] = useState(selectedCount > 0);

  // Back/forward and shared URLs re-render the server component with new
  // props. Adopt them only after the transition settles; adopting mid-click
  // would stomp a checkbox the customer just ticked.
  const serverKey = `${activeCategories.join("|")}/${activeConditions.join("|")}/${activeRarities.join("|")}/${activeStock ? 1 : 0}`;
  useEffect(() => {
    if (pending) return;
    setCats(activeCategories);
    setConds(activeConditions);
    setRare(activeRarities);
    setStockOnly(activeStock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey, pending]);

  // Sync local q with activeQ from server when not pending
  useEffect(() => {
    if (!pending) setQ(activeQ);
  }, [activeQ, pending]);

  const push = useCallback(
    (
      mutate: (p: URLSearchParams) => void,
      overrides: { cat?: string[]; cond?: string[]; rarity?: string[]; stock?: boolean } = {}
    ) => {
      // Use a fresh URLSearchParams from the current pathname + search to avoid stale params during transitions
      const next = new URLSearchParams(window.location.search);
      mutate(next);
      // Always write the facet keys from local state so two fast clicks cannot
      // lose the first selection while the server transition is still running.
      const lists: [string, string[]][] = [
        ["cat", overrides.cat ?? cats],
        ["cond", overrides.cond ?? conds],
        ["rarity", overrides.rarity ?? rare],
      ];
      for (const [key, values] of lists) {
        if (values.length > 0) next.set(key, values.join(","));
        else next.delete(key);
      }
      const inStock = overrides.stock ?? stockOnly;
      if (inStock) next.set("stock", "1");
      else next.delete("stock");
      const href = next.toString() ? `${pathname}?${next}` : pathname;
      startTransition(() => router.push(href, { scroll: false }));
    },
    [cats, conds, rare, stockOnly, startTransition, router, pathname]
  );

  const commitList = (
    key: "cat" | "cond" | "rarity",
    value: string,
    current: string[],
    setCurrent: (next: string[]) => void
  ) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setCurrent(next);
    push(
      (p) => {
        if (next.length > 0) p.set(key, next.join(","));
        else p.delete(key);
      },
      { [key]: next }
    );
  };

  const hasFilters = selectedCount > 0 || activeSort !== "newest" || Boolean(activeQ);

  const reset = () => {
    setQ("");
    setCats([]);
    setConds([]);
    setRare([]);
    setStockOnly(false);
    startTransition(() => router.push(pathname, { scroll: false }));
  };

  return (
    <div className="sticky top-16 z-30 -mx-4 border-y border-line bg-ink/95 px-4 py-2.5 backdrop-blur-md md:top-[72px] md:-mx-8 md:px-8 md:py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            push((p) => {
              const term = q.trim();
              if (term) p.set("q", term);
              else p.delete("q");
            });
          }}
          className="relative flex min-w-[180px] flex-1 items-center"
          role="search"
        >
          <Search className="pointer-events-none absolute left-3 size-4 text-dim" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this grid…"
            className="u-input py-2! pl-9! text-[12px]! sm:py-2.5! sm:pl-9! sm:text-[13px]!"
            aria-label="Search products"
          />
        </form>

        <select
          value={activeSort}
          onChange={(e) => push((p) => (e.target.value === "newest" ? p.delete("sort") : p.set("sort", e.target.value)))}
          className="u-select w-[calc(50%-0.25rem)]! py-2! pl-2.5! pr-7! text-[12px]! sm:w-auto! sm:py-2.5! sm:pl-3! sm:text-[13px]!"
          aria-label="Sort products"
        >
          <option value="newest">Newest first</option>
          <option value="featured">Featured first</option>
          <option value="price-asc">Price: low → high</option>
          <option value="price-desc">Price: high → low</option>
          <option value="rarity">Rare / unique first</option>
          <option value="name-asc">Name A → Z</option>
        </select>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn("u-chip w-[calc(50%-0.25rem)] justify-center sm:w-auto", selectedCount > 0 && "text-red!")}
          aria-expanded={open}
          aria-controls="shop-filter-panel"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filters{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </button>

        {hasFilters ? (
          <button type="button" onClick={reset} className="u-chip text-red!" aria-label="Reset all filters">
            <X className="size-3" aria-hidden /> Reset
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id="shop-filter-panel"
          className="mt-3 grid gap-5 border-t border-line pt-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <FacetGroup
            title="Category"
            facets={categories}
            active={cats}
            isActive={(value) => cats.includes(value)}
            onToggle={(value) => commitList("cat", value, cats, setCats)}
          />
          <FacetGroup
            title="Condition"
            facets={conditions}
            active={conds}
            isActive={(value) => conds.includes(value)}
            onToggle={(value) => commitList("cond", value, conds, setConds)}
          />
          <FacetGroup
            title="Rarity"
            facets={rarities}
            active={rare}
            isActive={(value) => rare.includes(value)}
            onToggle={(value) => commitList("rarity", value, rare, setRare)}
          />
          <fieldset>
            <legend className="u-label mb-2.5">Availability</legend>
            <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-fog transition-colors hover:text-bone">
              <input
                type="checkbox"
                checked={stockOnly}
                onChange={() => {
                  const next = !stockOnly;
                  setStockOnly(next);
                  push(() => {}, { stock: next });
                }}
                className="size-4 accent-red"
              />
              In stock only
            </label>
            <p className="u-label-txt mt-3 leading-relaxed">
              Sold-out pieces stay visible in the grid — untick this to see the full archive.
            </p>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

function FacetGroup({
  title,
  facets,
  active,
  isActive,
  onToggle,
}: {
  title: string;
  facets: Facet[];
  active: string[];
  isActive: (value: string) => boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="u-label mb-2.5">{title}</legend>
      <div className="flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
        {facets.length === 0 ? (
          <p className="u-label-txt">No options yet.</p>
        ) : (
          facets.map((facet) => {
            const checked = isActive(facet.value);
            return (
              <label
                key={facet.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 text-[12.5px] transition-colors",
                  checked ? "text-bone" : "text-fog hover:text-bone"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(facet.value)}
                  className="size-4 shrink-0 accent-red"
                />
                <span className="min-w-0 flex-1 truncate">{facet.label}</span>
                <span className="u-mono shrink-0 text-[10px] text-dim">{facet.count}</span>
              </label>
            );
          })
        )}
      </div>
      {active.length > 0 ? (
        <p className="u-label-txt mt-2">{active.length} selected · tick more to broaden the grid</p>
      ) : null}
    </fieldset>
  );
}
