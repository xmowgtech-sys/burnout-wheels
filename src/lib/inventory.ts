import type { Product } from "./types";

export type StockSeverity = "out" | "below" | "at_threshold" | "healthy";

export type LowStockFilter = "all" | "out" | "low";

export interface LowStockSummary {
  totalAlerts: number;
  outOfStockCount: number;
  belowThresholdCount: number;
  atThresholdCount: number;
  totalUnitsShort: number;
}

export const RESTOCK_PRESETS = [5, 10, 25] as const;

export const MIN_RESTOCK_QTY = 1;
export const MAX_RESTOCK_QTY = 10000;

/**
 * Classifies a product's inventory severity relative to its low-stock threshold.
 * Matches Burnout Wheels' catalog threshold rule (`stock <= lowStockThreshold`).
 */
export function getStockSeverity(stock: number, lowStockThreshold: number): StockSeverity {
  const s = Math.max(0, Math.floor(Number.isFinite(stock) ? stock : 0));
  const t = Math.max(0, Math.floor(Number.isFinite(lowStockThreshold) ? lowStockThreshold : 0));
  if (s <= 0) return "out";
  if (s < t) return "below";
  if (s === t) return "at_threshold";
  return "healthy";
}

export function isLowStock(stock: number, lowStockThreshold: number): boolean {
  return getStockSeverity(stock, lowStockThreshold) !== "healthy";
}

export function getSeverityLabel(severity: StockSeverity): string {
  switch (severity) {
    case "out":
      return "Out of stock";
    case "below":
      return "Below threshold";
    case "at_threshold":
      return "At threshold";
    default:
      return "In stock";
  }
}

/**
 * Suggests a quick-restock increment that guarantees the resulting stock is
 * comfortably above the low-stock threshold in a single click, rounded up to
 * a clean multiple of 5.
 */
export function getSuggestedRestockQty(stock: number, lowStockThreshold: number): number {
  const s = Math.max(0, Math.floor(Number.isFinite(stock) ? stock : 0));
  const t = Math.max(0, Math.floor(Number.isFinite(lowStockThreshold) ? lowStockThreshold : 0));
  const neededToClear = Math.max(0, t - s) + 5;
  const rounded = Math.ceil(neededToClear / 5) * 5;
  return Math.min(MAX_RESTOCK_QTY, Math.max(5, rounded));
}

/**
 * Computes percentage fill of current stock against a target buffer of
 * `max(threshold * 2, 2)` for compact progress indicators.
 */
export function getStockFillPercent(stock: number, lowStockThreshold: number): number {
  const s = Math.max(0, Number.isFinite(stock) ? stock : 0);
  const target = Math.max(2, (Number.isFinite(lowStockThreshold) ? Math.max(0, lowStockThreshold) : 0) * 2);
  return Math.max(0, Math.min(100, Math.round((s / target) * 100)));
}

/**
 * Validates a restock quantity increment entered by an operator.
 */
export function validateRestockDelta(raw: unknown): { ok: true; qty: number } | { ok: false; error: string } {
  const num = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { ok: false, error: "Restock quantity must be a whole number." };
  }
  if (num < MIN_RESTOCK_QTY) {
    return { ok: false, error: `Enter at least ${MIN_RESTOCK_QTY} unit to restock.` };
  }
  if (num > MAX_RESTOCK_QTY) {
    return { ok: false, error: `Maximum single restock is ${MAX_RESTOCK_QTY.toLocaleString()} units.` };
  }
  return { ok: true, qty: num };
}

/**
 * Sorts low-stock products by operational urgency:
 * 1. Out of stock first
 * 2. Lowest ratio of stock / max(threshold, 1)
 * 3. Lowest absolute stock
 * 4. Alphabetical by name
 */
export function sortLowStockProducts<T extends Pick<Product, "name" | "stock" | "lowStockThreshold">>(
  products: T[]
): T[] {
  return [...products].sort((a, b) => {
    const aOut = a.stock <= 0 ? 0 : 1;
    const bOut = b.stock <= 0 ? 0 : 1;
    if (aOut !== bOut) return aOut - bOut;

    const aRatio = a.stock / Math.max(a.lowStockThreshold, 1);
    const bRatio = b.stock / Math.max(b.lowStockThreshold, 1);
    if (aRatio !== bRatio) return aRatio - bRatio;

    if (a.stock !== b.stock) return a.stock - b.stock;
    return a.name.localeCompare(b.name);
  });
}

export function filterLowStockProducts<T extends Pick<Product, "stock" | "lowStockThreshold">>(
  products: T[],
  filter: LowStockFilter
): T[] {
  if (filter === "out") {
    return products.filter((p) => getStockSeverity(p.stock, p.lowStockThreshold) === "out");
  }
  if (filter === "low") {
    return products.filter((p) => {
      const sev = getStockSeverity(p.stock, p.lowStockThreshold);
      return sev === "below" || sev === "at_threshold";
    });
  }
  return products;
}

export function computeLowStockSummary<T extends Pick<Product, "stock" | "lowStockThreshold">>(
  products: T[]
): LowStockSummary {
  let outOfStockCount = 0;
  let belowThresholdCount = 0;
  let atThresholdCount = 0;
  let totalUnitsShort = 0;

  for (const p of products) {
    const sev = getStockSeverity(p.stock, p.lowStockThreshold);
    if (sev === "out") outOfStockCount += 1;
    else if (sev === "below") belowThresholdCount += 1;
    else if (sev === "at_threshold") atThresholdCount += 1;

    // Deficit to rise strictly above threshold (threshold + 1)
    const targetAbove = Math.max(1, p.lowStockThreshold + 1);
    if (p.stock < targetAbove) {
      totalUnitsShort += targetAbove - Math.max(0, p.stock);
    }
  }

  return {
    totalAlerts: products.length,
    outOfStockCount,
    belowThresholdCount,
    atThresholdCount,
    totalUnitsShort,
  };
}
