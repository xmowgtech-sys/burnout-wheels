import Link from "next/link";
import { ShopFilters } from "@/components/store/filters";
import { ShopProductsGrid } from "@/components/store/shop-products-grid";
import { PageHero } from "@/components/ui";
import { categoryCounts, listProducts } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import type { ProductCondition } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop the grid",
  description: "Browse every die-cast drop live in the Burnout Wheels paddock — filter by category, condition and stock.",
};

const CONDITIONS: { value: ProductCondition; label: string }[] = [
  { value: "NEW", label: "New / Boxed" },
  { value: "GRADED", label: "Graded" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "PRE_OWNED", label: "Pre-owned" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; cond?: string; q?: string; sort?: string; stock?: string }>;
}) {
  await ensureCatalogHydrated();
  const sp = await searchParams;
  const cat = sp.cat ?? "";
  const cond = sp.cond ?? "";
  const q = sp.q ?? "";
  const sort = (sp.sort as "newest" | "price-asc" | "price-desc") ?? "newest";
  const inStock = sp.stock === "1";

  const [products, cats] = await Promise.all([
    listProducts({
      status: "ACTIVE",
      category: cat || undefined,
      condition: cond || undefined,
      q: q || undefined,
      sort: sort,
      inStock,
      limit: 60,
    }),
    Promise.resolve(categoryCounts()),
  ]);

  return (
    <>
      <PageHero
        label="02 — Catalogue"
        title="Shop the grid"
        sub="Live inventory only. What you see is on the shelf, inspected and packed from the pit lane."
      />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <ShopFilters
          categories={cats.map((c) => ({ value: c.category, label: c.category, count: c.count }))}
          conditions={CONDITIONS.map((c) => ({ value: c.value, label: c.label, count: 0 }))}
          activeCategory={cat}
          activeCondition={cond}
          activeSort={sort}
          activeStock={inStock}
          activeQ={q}
        />

        <section className="py-8 md:py-14" aria-label="Products">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="u-label" aria-live="polite">
              {products.length} {products.length === 1 ? "unit" : "units"} on grid{q ? ` for “${q}”` : ""}
            </p>
            <p className="u-label hidden sm:block">Sorted · {sort === "price-asc" ? "price low → high" : sort === "price-desc" ? "price high → low" : "newest first"}</p>
          </div>

          <ShopProductsGrid initialProducts={products} />
        </section>
      </div>
    </>
  );
}
