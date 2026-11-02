"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui";
import { getDeletedLocalSets } from "@/lib/products-client";
import type { Product } from "@/lib/types";

export function ShopProductsGrid({ initialProducts }: { initialProducts: Product[] }) {
  const [items, setItems] = useState<Product[]>(initialProducts);

  useEffect(() => {
    const { ids: deletedIds, slugs: deletedSlugs } = getDeletedLocalSets();
    setItems(initialProducts.filter((p) => !deletedIds.has(p.id) && (!p.slug || !deletedSlugs.has(p.slug))));
  }, [initialProducts]);

  useEffect(() => {
    try {
      const { ids: deletedIds, slugs: deletedSlugs } = getDeletedLocalSets();
      const raw = window.localStorage.getItem("bw:custom_products");
      let activeCustom: Product[] = [];
      if (raw) {
        const custom = JSON.parse(raw) as Product[];
        if (Array.isArray(custom) && custom.length > 0) {
          activeCustom = custom.filter(
            (p) => p.status === "ACTIVE" && !deletedIds.has(p.id) && (!p.slug || !deletedSlugs.has(p.slug))
          );
        }
      }

      setItems((current) => {
        const withoutDeleted = current.filter(
          (p) => !deletedIds.has(p.id) && (!p.slug || !deletedSlugs.has(p.slug))
        );
        if (activeCustom.length === 0) return withoutDeleted;
        const existingIds = new Set(withoutDeleted.map((p) => p.id));
        const existingSlugs = new Set(withoutDeleted.map((p) => p.slug));
        const missing = activeCustom.filter((p) => !existingIds.has(p.id) && (!p.slug || !existingSlugs.has(p.slug)));
        if (missing.length === 0) return withoutDeleted;
        return [...missing, ...withoutDeleted];
      });

      if (activeCustom.length > 0) {
        fetch("/api/products/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ products: activeCustom }),
        }).catch(() => {});
      }
    } catch {}
  }, []);

  if (items.length === 0) {
    return (
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
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 content-start gap-x-3 gap-y-8 sm:gap-x-6 md:gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((p, i) => (
        <div key={p.id || p.slug} className="page-in" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  );
}
