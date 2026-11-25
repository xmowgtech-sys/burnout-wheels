"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { GitCompareArrows, ShoppingCart, Trash2, X } from "lucide-react";
import { useStore, useToast } from "./providers";
import { buildComparisonMatrix, MAX_COMPARE_ITEMS } from "@/lib/collector-utils";
import { CONDITION_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CompareOverlay() {
  const store = useStore();
  const { toast } = useToast();
  const {
    compareItems,
    removeCompare,
    clearCompare,
    compareModalOpen,
    openCompareModal,
    closeCompareModal,
    add,
  } = store;
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!compareModalOpen) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCompareModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [compareModalOpen, closeCompareModal]);

  if (compareItems.length === 0) return null;

  const matrix = buildComparisonMatrix(compareItems);

  return (
    <>
      {/* Floating Spec Compare Tray */}
      {!compareModalOpen && (
        <aside
          aria-label="Spec compare tray"
          className="fixed bottom-24 left-1/2 z-[65] w-[min(94vw,640px)] -translate-x-1/2 border border-line-strong bg-coal/95 shadow-2xl backdrop-blur-md lg:bottom-16"
        >
          <div className="u-spectrum h-[2px] w-full" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 u-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sky whitespace-nowrap">
                <GitCompareArrows className="size-3.5 shrink-0" aria-hidden />
                {compareItems.length}/{MAX_COMPARE_ITEMS}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {compareItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 border border-line bg-ink px-1.5 py-1"
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt=""
                        className="size-7 shrink-0 object-cover"
                      />
                    ) : (
                      <span className="size-7 shrink-0 bg-panel" aria-hidden />
                    )}
                    <span className="hidden max-w-[92px] truncate text-[11px] font-medium text-bone sm:inline">
                      {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCompare(item.id)}
                      aria-label={`Remove ${item.name} from compare`}
                      className="grid size-6 shrink-0 place-items-center text-dim transition-colors hover:text-red"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openCompareModal}
                disabled={compareItems.length < 2}
                className="u-btn u-btn-primary min-h-9 px-3.5! py-2! text-[10.5px]! whitespace-nowrap"
                title={compareItems.length < 2 ? "Select at least 2 cars to compare" : "Open side-by-side spec sheet"}
              >
                {compareItems.length < 2 ? "Pick 1 more" : "Compare specs"}
              </button>
              <button
                type="button"
                onClick={clearCompare}
                aria-label="Clear compare tray"
                className="u-btn u-btn-ghost min-h-9 px-2.5! py-2! text-[10.5px]!"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Side-by-Side Spec Matrix Modal */}
      {compareModalOpen && (
        <div
          className="fixed inset-0 z-[82] flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Side-by-side die-cast spec comparison"
        >
          <button
            type="button"
            aria-label="Close spec comparison"
            onClick={closeCompareModal}
            className="absolute inset-0 bg-[#0a0a0c]/90 backdrop-blur-sm"
          />

          <div
            data-lenis-prevent
            className="relative z-10 flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden border border-line-strong bg-[#0f1013] shadow-2xl"
          >
            <div className="u-spectrum h-[2px] w-full shrink-0" aria-hidden />
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6">
              <div>
                <p className="u-label text-sky!">Side-by-side telemetry</p>
                <h2 className="u-h3 mt-0.5">Spec Comparison</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearCompare();
                    closeCompareModal();
                  }}
                  className="u-btn u-btn-ghost min-h-10 px-3! py-2! text-[11px]!"
                >
                  Clear all
                </button>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeCompareModal}
                  aria-label="Close spec comparison"
                  className="u-btn u-btn-ghost min-h-10 min-w-10 px-2.5! py-2!"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="min-w-[540px]">
                {/* Product headers */}
                <div
                  className="grid gap-3 border-b border-line pb-5"
                  style={{ gridTemplateColumns: `140px repeat(${compareItems.length}, minmax(0, 1fr))` }}
                >
                  <div className="flex items-end">
                    <span className="u-label text-dim!">Specification</span>
                  </div>
                  {compareItems.map((item) => (
                    <div key={item.id} className="flex flex-col border border-line bg-ink p-3">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-panel">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="u-skeleton h-full w-full" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeCompare(item.id)}
                          aria-label={`Remove ${item.name} from comparison`}
                          className="absolute right-1.5 top-1.5 grid size-7 place-items-center border border-line bg-ink/85 text-fog transition-colors hover:border-red hover:text-red"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </div>
                      <Link
                        href={`/product/${item.slug}`}
                        onClick={closeCompareModal}
                        className="mt-3 line-clamp-2 text-[13px] font-bold leading-snug text-bone transition-colors hover:text-red"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        disabled={item.stock <= 0}
                        onClick={() => {
                          add({
                            productId: item.id,
                            slug: item.slug,
                            name: item.name,
                            price: item.priceSale,
                            image: item.image,
                            condition: CONDITION_LABELS[item.condition],
                            stock: item.stock,
                          });
                          closeCompareModal();
                          toast(`${item.name} loaded into cart`);
                        }}
                        className="u-btn u-btn-primary mt-3 min-h-9 w-full px-3! py-2! text-[10.5px]!"
                      >
                        <ShoppingCart className="size-3.5" aria-hidden />
                        {item.stock <= 0 ? "Sold out" : "Add to cart"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Spec rows */}
                <div className="divide-y divide-line">
                  {matrix.map((row) => (
                    <div
                      key={row.key}
                      className="grid items-center gap-3 py-3"
                      style={{ gridTemplateColumns: `140px repeat(${compareItems.length}, minmax(0, 1fr))` }}
                    >
                      <span className="u-label">{row.label}</span>
                      {row.values.map((val, colIdx) => {
                        const isBest = row.highlightIndices.includes(colIdx);
                        return (
                          <div
                            key={`${row.key}-${colIdx}`}
                            className={cn(
                              "px-3 py-1.5 text-[13px]",
                              row.key === "price" || row.key === "drop" || row.key === "scale" ? "u-mono" : "",
                              isBest
                                ? "border-l-2 border-mint bg-mint/[0.06] font-semibold text-mint"
                                : "text-bone/85"
                            )}
                          >
                            {val}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
