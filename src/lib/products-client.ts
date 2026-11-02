import type { Product } from "./types";

export interface DeletedProductEntry {
  id?: number;
  slug?: string;
  deletedAt: string;
}

/** Remove a product from custom client storage and record it as deleted so it never resurrects. */
export function markProductDeletedLocal(id?: number, slug?: string) {
  if (typeof window === "undefined") return;
  try {
    // 1. Remove from bw:custom_products
    const raw = window.localStorage.getItem("bw:custom_products");
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const next = list.filter((p: { id?: number; slug?: string }) => {
          if (id && p.id === id) return false;
          if (slug && p.slug === slug) return false;
          return true;
        });
        window.localStorage.setItem("bw:custom_products", JSON.stringify(next));
      }
    }

    // 2. Add to bw:deleted_products
    const rawDel = window.localStorage.getItem("bw:deleted_products");
    const delList: DeletedProductEntry[] = rawDel ? JSON.parse(rawDel) : [];
    const already = delList.some((d) => (id && d.id === id) || (slug && d.slug === slug));
    if (!already) {
      delList.push({ id, slug, deletedAt: new Date().toISOString() });
      window.localStorage.setItem("bw:deleted_products", JSON.stringify(delList));
    }

    // 3. Inform server to permanently log deletion in deleted_products table
    const deletedSlugs = [slug].filter(Boolean) as string[];
    fetch("/api/products/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deletedSlugs }),
    }).catch(() => {});
  } catch {}
}

/** Save or update a custom product in local storage and unmark it from deleted. */
export function saveCustomProductLocal(product: Product) {
  if (typeof window === "undefined" || !product) return;
  try {
    // 1. Remove from deleted products if it was there
    const rawDel = window.localStorage.getItem("bw:deleted_products");
    if (rawDel) {
      const delList: DeletedProductEntry[] = JSON.parse(rawDel);
      if (Array.isArray(delList)) {
        const nextDel = delList.filter((d) => d.id !== product.id && d.slug !== product.slug);
        window.localStorage.setItem("bw:deleted_products", JSON.stringify(nextDel));
      }
    }

    // 2. Upsert in bw:custom_products
    const raw = window.localStorage.getItem("bw:custom_products");
    const list: Product[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((p) => (product.id && p.id === product.id) || (product.slug && p.slug === product.slug));
    if (idx >= 0) {
      list[idx] = product;
    } else {
      list.unshift(product);
    }
    window.localStorage.setItem("bw:custom_products", JSON.stringify(list));
  } catch {}
}

/** Get set of deleted IDs and slugs from local storage. */
export function getDeletedLocalSets(): { ids: Set<number>; slugs: Set<string> } {
  const ids = new Set<number>();
  const slugs = new Set<string>();
  if (typeof window === "undefined") return { ids, slugs };
  try {
    const rawDel = window.localStorage.getItem("bw:deleted_products");
    if (rawDel) {
      const delList: DeletedProductEntry[] = JSON.parse(rawDel);
      if (Array.isArray(delList)) {
        for (const d of delList) {
          if (d.id != null) ids.add(d.id);
          if (d.slug) slugs.add(d.slug);
        }
      }
    }
  } catch {}
  return { ids, slugs };
}
