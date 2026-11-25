import { CONDITION_LABELS, RARITY_LABELS, type Product, type ProductCondition, type ProductRarity } from "./types";
import { fmtUSD } from "./money";
import { dropLabel } from "./utils";

export const FREE_SHIPPING_THRESHOLD_MINOR = 249900; // ₹2,499
export const MAX_COMPARE_ITEMS = 3;
export const MAX_RECENTLY_VIEWED = 6;

export interface FreeShippingProgress {
  subtotal: number;
  threshold: number;
  remaining: number;
  percent: number;
  unlocked: boolean;
}

export function computeFreeShippingProgress(
  subtotalMinor: number,
  thresholdMinor: number = FREE_SHIPPING_THRESHOLD_MINOR
): FreeShippingProgress {
  const safeSubtotal = Math.max(0, Math.round(subtotalMinor));
  const safeThreshold = Math.max(1, Math.round(thresholdMinor));
  const remaining = Math.max(0, safeThreshold - safeSubtotal);
  const percent = Math.min(100, Math.round((safeSubtotal / safeThreshold) * 100));
  return {
    subtotal: safeSubtotal,
    threshold: safeThreshold,
    remaining,
    percent,
    unlocked: remaining === 0,
  };
}

export interface CompareItem {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  scale: string | null;
  condition: ProductCondition;
  rarity: ProductRarity;
  priceSale: number;
  stock: number;
  dropNumber: number;
  image: string | null;
}

export function productToCompareItem(product: Product): CompareItem {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    scale: product.scale,
    condition: product.condition,
    rarity: product.rarity,
    priceSale: product.priceSale,
    stock: product.stock,
    dropNumber: product.dropNumber,
    image: product.images[0] ?? null,
  };
}

export function toggleCompareItem(
  list: CompareItem[],
  item: CompareItem,
  max: number = MAX_COMPARE_ITEMS
): { next: CompareItem[]; status: "added" | "removed" | "full" } {
  const exists = list.some((entry) => entry.id === item.id);
  if (exists) {
    return {
      next: list.filter((entry) => entry.id !== item.id),
      status: "removed",
    };
  }
  if (list.length >= max) {
    return { next: list, status: "full" };
  }
  return { next: [...list, item], status: "added" };
}

export interface ComparisonRow {
  key: string;
  label: string;
  values: string[];
  /** Column indices that represent the standout value (e.g., lowest price or highest rarity). */
  highlightIndices: number[];
}

const RARITY_RANK: Record<ProductRarity, number> = {
  STANDARD: 1,
  RARE: 2,
  UNIQUE: 3,
};

export function buildComparisonMatrix(items: CompareItem[]): ComparisonRow[] {
  if (items.length === 0) return [];

  const minPrice = Math.min(...items.map((i) => i.priceSale));
  const priceDiffers = new Set(items.map((i) => i.priceSale)).size > 1;
  const priceHighlights = priceDiffers
    ? items.reduce<number[]>((acc, item, idx) => (item.priceSale === minPrice ? [...acc, idx] : acc), [])
    : [];

  const maxRarity = Math.max(...items.map((i) => RARITY_RANK[i.rarity] ?? 1));
  const rarityDiffers = new Set(items.map((i) => i.rarity)).size > 1;
  const rarityHighlights = rarityDiffers
    ? items.reduce<number[]>(
        (acc, item, idx) => ((RARITY_RANK[item.rarity] ?? 1) === maxRarity ? [...acc, idx] : acc),
        []
      )
    : [];

  return [
    {
      key: "price",
      label: "Price",
      values: items.map((i) => fmtUSD(i.priceSale)),
      highlightIndices: priceHighlights,
    },
    {
      key: "drop",
      label: "Drop No.",
      values: items.map((i) => dropLabel(i.dropNumber, i.id)),
      highlightIndices: [],
    },
    {
      key: "brand",
      label: "Manufacturer",
      values: items.map((i) => i.brand || "Burnout Wheels"),
      highlightIndices: [],
    },
    {
      key: "category",
      label: "Series",
      values: items.map((i) => i.category),
      highlightIndices: [],
    },
    {
      key: "scale",
      label: "Scale",
      values: items.map((i) => i.scale || "1:64"),
      highlightIndices: [],
    },
    {
      key: "condition",
      label: "Condition",
      values: items.map((i) => CONDITION_LABELS[i.condition] ?? i.condition),
      highlightIndices: [],
    },
    {
      key: "rarity",
      label: "Rarity",
      values: items.map((i) => RARITY_LABELS[i.rarity] ?? i.rarity),
      highlightIndices: rarityHighlights,
    },
    {
      key: "stock",
      label: "Paddock Stock",
      values: items.map((i) => (i.stock <= 0 ? "Sold out" : i.stock <= 3 ? `Only ${i.stock} left` : `${i.stock} available`)),
      highlightIndices: [],
    },
  ];
}

export interface RecentlyViewedItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  scale: string | null;
  priceSale: number;
  dropNumber: number;
  image: string | null;
}

export function pushRecentlyViewed(
  list: RecentlyViewedItem[],
  item: RecentlyViewedItem,
  max: number = MAX_RECENTLY_VIEWED
): RecentlyViewedItem[] {
  const deduped = list.filter((entry) => entry.id !== item.id);
  return [item, ...deduped].slice(0, Math.max(1, max));
}

export function safeParseArray<T>(raw: string | null, guard: (val: unknown) => val is T): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

export function isRecentlyViewedItem(val: unknown): val is RecentlyViewedItem {
  if (!val || typeof val !== "object") return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    typeof v.category === "string" &&
    typeof v.priceSale === "number" &&
    typeof v.dropNumber === "number"
  );
}

export function isCompareItem(val: unknown): val is CompareItem {
  if (!val || typeof val !== "object") return false;
  const v = val as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    typeof v.category === "string" &&
    typeof v.priceSale === "number" &&
    typeof v.stock === "number" &&
    typeof v.dropNumber === "number" &&
    typeof v.condition === "string" &&
    typeof v.rarity === "string"
  );
}
