import Link from "next/link";
import { ShopFilters } from "@/components/store/filters";
import { ProductCard } from "@/components/store/product-card";
import { PageHero, EmptyState } from "@/components/ui";
import { categoryCounts, listProducts } from "@/lib/catalog";
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
          <p className="u-label" aria-live="polite">
            {products.length} {products.length === 1 ? "unit" : "units"} on grid{q ? ` for “${q}”` : ""}
          </p>

          {products.length === 0 ? (
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
            <div className="mt-6 grid content-start gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 md:gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i) => (
                <div key={p.id} className="page-in" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                  <ProductCard product={p} priority={i < 4} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
