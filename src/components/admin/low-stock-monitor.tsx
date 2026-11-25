"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Package, PackagePlus, RefreshCw, TriangleAlert } from "lucide-react";
import { fmtUSD } from "@/lib/money";
import {
  RESTOCK_PRESETS,
  computeLowStockSummary,
  filterLowStockProducts,
  getSeverityLabel,
  getStockFillPercent,
  getStockSeverity,
  getSuggestedRestockQty,
  isLowStock,
  sortLowStockProducts,
  validateRestockDelta,
  type LowStockFilter,
} from "@/lib/inventory";
import type { Product } from "@/lib/types";

interface RestockNotice {
  productName: string;
  previousStock: number;
  nextStock: number;
  added: number;
  clearedAlert: boolean;
}

function ProductThumb({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  const src = product.images[0];

  if (!src || failed) {
    return (
      <div
        className="grid size-11 shrink-0 place-items-center border border-line bg-ink/80 text-dim"
        aria-hidden="true"
      >
        <Package className="size-4" />
      </div>
    );
  }

  return (
    <div className="size-11 shrink-0 overflow-hidden border border-line bg-ink/80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={product.name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </div>
  );
}

export function LowStockMonitor({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(() => sortLowStockProducts(initialProducts));
  const [filter, setFilter] = useState<LowStockFilter>("all");
  const [quantities, setQuantities] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const p of initialProducts) {
      map[p.id] = String(getSuggestedRestockQty(p.stock, p.lowStockThreshold));
    }
    return map;
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<RestockNotice | null>(null);

  // Sync if server re-renders with fresh catalog state
  useEffect(() => {
    const sorted = sortLowStockProducts(initialProducts);
    setProducts(sorted);
    setQuantities((prev) => {
      const next = { ...prev };
      for (const p of sorted) {
        if (next[p.id] === undefined) {
          next[p.id] = String(getSuggestedRestockQty(p.stock, p.lowStockThreshold));
        }
      }
      return next;
    });
  }, [initialProducts]);

  const summary = useMemo(() => computeLowStockSummary(products), [products]);
  const visible = useMemo(
    () => sortLowStockProducts(filterLowStockProducts(products, filter)),
    [products, filter]
  );

  const getQtyValue = (product: Product): string =>
    quantities[product.id] ?? String(getSuggestedRestockQty(product.stock, product.lowStockThreshold));

  const setQtyValue = (productId: number, value: string) => {
    setError("");
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/products/restock", { cache: "no-store" });
      const data = (await res.json()) as { products?: Product[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not refresh low-stock list.");
      if (Array.isArray(data.products)) {
        const sorted = sortLowStockProducts(data.products);
        setProducts(sorted);
        setQuantities((prev) => {
          const next = { ...prev };
          for (const p of sorted) {
            if (next[p.id] === undefined) {
              next[p.id] = String(getSuggestedRestockQty(p.stock, p.lowStockThreshold));
            }
          }
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh low-stock list.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestock = async (product: Product, overrideQty?: number) => {
    const rawQty = overrideQty !== undefined ? overrideQty : getQtyValue(product);
    const check = validateRestockDelta(rawQty);
    if (!check.ok) {
      setError(`${product.name}: ${check.error}`);
      return;
    }

    setBusyId(product.id);
    setError("");
    try {
      const res = await fetch("/api/products/restock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          slug: product.slug,
          addQty: check.qty,
        }),
      });
      const data = (await res.json()) as {
        product?: Product;
        previousStock?: number;
        added?: number;
        error?: string;
      };
      if (!res.ok || !data.product) {
        throw new Error(data.error || "Restock failed.");
      }

      const updated = data.product;
      const stillLow = isLowStock(updated.stock, updated.lowStockThreshold);

      setProducts((prev) => {
        if (!stillLow) {
          return prev.filter((item) => item.id !== product.id && item.slug !== product.slug);
        }
        return sortLowStockProducts(
          prev.map((item) => (item.id === product.id ? updated : item))
        );
      });

      if (stillLow) {
        setQuantities((prev) => ({
          ...prev,
          [updated.id]: String(getSuggestedRestockQty(updated.stock, updated.lowStockThreshold)),
        }));
      }

      setNotice({
        productName: updated.name,
        previousStock: data.previousStock ?? product.stock,
        nextStock: updated.stock,
        added: data.added ?? check.qty,
        clearedAlert: !stillLow,
      });

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restock failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-labelledby="low-stock-heading"
      data-testid="low-stock-monitor"
      className="u-card overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TriangleAlert
              className={`size-4 shrink-0 ${summary.totalAlerts > 0 ? "text-yellow" : "text-mint"}`}
              aria-hidden="true"
            />
            <h2 id="low-stock-heading" className="u-label text-bone!">
              Low stock alerts
            </h2>
          </div>
          <p className="mt-1.5 text-[13px] text-fog">
            {summary.totalAlerts === 0 ? (
              "Every active catalog unit is stocked above its threshold."
            ) : (
              <>
                <span className="u-mono tabular-nums font-semibold text-bone">
                  {summary.totalAlerts}
                </span>{" "}
                {summary.totalAlerts === 1 ? "product" : "products"} at or below threshold
                {summary.outOfStockCount > 0 ? (
                  <>
                    {" "}
                    <span aria-hidden="true">·</span>{" "}
                    <span className="u-mono tabular-nums font-semibold text-red">
                      {summary.outOfStockCount} out of stock
                    </span>
                  </>
                ) : null}
                {" "}
                <span aria-hidden="true">·</span>{" "}
                <span className="u-mono tabular-nums text-dim">
                  {summary.totalUnitsShort} unit{summary.totalUnitsShort === 1 ? "" : "s"} needed to clear alerts
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {summary.totalAlerts > 0 && (
            <div
              className="flex items-center gap-1 border border-line bg-ink/70 p-1"
              role="group"
              aria-label="Filter low stock alerts"
            >
              {(
                [
                  { id: "all", label: `All (${summary.totalAlerts})` },
                  { id: "out", label: `Out (${summary.outOfStockCount})` },
                  {
                    id: "low",
                    label: `Low (${summary.belowThresholdCount + summary.atThresholdCount})`,
                  },
                ] as const
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(tab.id)}
                    className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-bone/15 text-bone font-semibold"
                        : "text-fog hover:text-bone"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || busyId !== null}
            aria-label="Refresh low stock alerts"
            className="u-btn u-btn-ghost px-3! py-1.5! text-[11px]! whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>

          <Link
            href="/admin/products"
            className="u-label inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 hover:text-bone"
          >
            Inventory <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Inline status / error banners */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-red/40 bg-red/10 px-5 py-3 text-[13px] text-red"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="px-1.5 text-sm font-bold hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-mint/40 bg-mint/10 px-5 py-3 text-[13px] text-mint"
        >
          <span className="flex items-center gap-2 font-medium">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Restocked <strong className="text-bone">{notice.productName}</strong>:{" "}
              <span className="u-mono tabular-nums">
                {notice.previousStock} → {notice.nextStock} units (+{notice.added})
              </span>
              {notice.clearedAlert ? " · Cleared low-stock threshold" : " · Still below threshold"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss restock confirmation"
            className="px-1.5 text-sm font-bold hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Body */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-[14px] font-semibold text-bone">
              {summary.totalAlerts === 0
                ? "Inventory levels look healthy"
                : "No products match this severity filter"}
            </p>
            <p className="mt-1 text-[13px] text-fog">
              {summary.totalAlerts === 0
                ? "Products appear here automatically when their stock falls to or below their alert threshold."
                : "Switch back to All alerts to review remaining low-stock items."}
            </p>
          </div>
          {summary.totalAlerts > 0 ? (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="u-btn u-btn-ghost whitespace-nowrap shrink-0"
            >
              Show all alerts
            </button>
          ) : (
            <Link
              href="/admin/products"
              className="u-btn u-btn-ghost whitespace-nowrap shrink-0"
            >
              Manage inventory
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line" data-testid="low-stock-list">
          {visible.map((product) => {
            const severity = getStockSeverity(product.stock, product.lowStockThreshold);
            const severityLabel = getSeverityLabel(severity);
            const fillPct = getStockFillPercent(product.stock, product.lowStockThreshold);
            const qtyStr = getQtyValue(product);
            const parsedQty = Number(qtyStr);
            const displayQty = Number.isInteger(parsedQty) && parsedQty > 0 ? parsedQty : null;
            const isBusy = busyId === product.id;

            const severityTone =
              severity === "out"
                ? "text-red"
                : severity === "below"
                  ? "text-orange"
                  : "text-yellow";

            const barTone =
              severity === "out"
                ? "bg-red"
                : severity === "below"
                  ? "bg-orange"
                  : "bg-yellow";

            return (
              <li
                key={product.id}
                data-testid={`low-stock-row-${product.slug}`}
                className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-ink/40 lg:flex-row lg:items-center lg:justify-between"
              >
                {/* Left: Product identity */}
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <ProductThumb product={product} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="block truncate text-[14px] font-semibold text-bone transition-colors hover:text-red"
                    >
                      {product.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fog">
                      <span>{product.category}</span>
                      {product.scale ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="u-mono tabular-nums">{product.scale}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span className="u-mono tabular-nums text-dim">{fmtUSD(product.priceSale)}</span>
                    </div>
                  </div>
                </div>

                {/* Middle: Stock vs Threshold meter */}
                <div className="flex items-center gap-4 lg:w-52 lg:shrink-0">
                  <div className="w-full">
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className={`font-semibold ${severityTone}`}>{severityLabel}</span>
                      <span className="u-mono tabular-nums text-bone">
                        <strong>{product.stock}</strong>
                        <span className="text-dim"> / {product.lowStockThreshold} min</span>
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden bg-line"
                      aria-hidden="true"
                    >
                      <div
                        className={`h-full transition-transform duration-200 ${barTone}`}
                        style={{ width: `${Math.max(fillPct, product.stock === 0 ? 0 : 8)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Quick-restock presets, custom qty input & primary Restock CTA */}
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  <div
                    className="flex items-center border border-line bg-ink/70"
                    role="group"
                    aria-label={`Restock quantity presets for ${product.name}`}
                  >
                    {RESTOCK_PRESETS.map((preset) => {
                      const selected = qtyStr === String(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={isBusy}
                          aria-pressed={selected}
                          onClick={() => setQtyValue(product.id, String(preset))}
                          className={`u-mono tabular-nums whitespace-nowrap px-2.5 py-2 text-[11px] transition-colors ${
                            selected
                              ? "bg-bone/15 text-bone font-semibold"
                              : "text-fog hover:text-bone"
                          }`}
                        >
                          +{preset}
                        </button>
                      );
                    })}
                  </div>

                  <label className="sr-only" htmlFor={`restock-qty-${product.id}`}>
                    Restock quantity for {product.name}
                  </label>
                  <input
                    id={`restock-qty-${product.id}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    step={1}
                    value={qtyStr}
                    disabled={isBusy}
                    onChange={(e) => setQtyValue(product.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleRestock(product);
                      }
                    }}
                    aria-label={`Restock quantity for ${product.name}`}
                    className="u-input u-mono tabular-nums w-20! py-2! text-center text-[12px]!"
                  />

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleRestock(product)}
                    aria-label={`Restock ${product.name} by ${displayQty ?? qtyStr} units`}
                    className="u-btn u-btn-primary w-full sm:w-auto whitespace-nowrap shrink-0 px-3.5! py-2! text-[11px]!"
                  >
                    <PackagePlus className="size-3.5" aria-hidden="true" />
                    {isBusy ? "Restocking…" : `Restock${displayQty ? ` +${displayQty}` : ""}`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
