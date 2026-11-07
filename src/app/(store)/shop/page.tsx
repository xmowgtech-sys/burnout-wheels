import { ShopFilters } from "@/components/store/filters";
import { ShopProductsGrid } from "@/components/store/shop-products-grid";
import { PageHero } from "@/components/ui";
import { listProducts } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { CONDITION_LABELS, RARITY_LABELS, type ProductCondition, type ProductRarity } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop the grid",
  description: "Browse every die-cast drop live in the Burnout Wheels paddock — filter by category, condition, rarity and stock.",
};

const CONDITIONS = (Object.keys(CONDITION_LABELS) as ProductCondition[]).map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

const RARITIES = (Object.keys(RARITY_LABELS) as ProductRarity[]).map((value) => ({
  value,
  label: RARITY_LABELS[value],
}));

const SORTS = ["newest", "featured", "price-asc", "price-desc", "rarity", "name-asc"] as const;
type Sort = (typeof SORTS)[number];

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; cond?: string; rarity?: string; q?: string; sort?: string; stock?: string }>;
}) {
  await ensureCatalogHydrated();
  const sp = await searchParams;

  const allActive = listProducts({ status: "ACTIVE", limit: 200 });
  const categoryFacets = Array.from(
    allActive.reduce((map, product) => {
      map.set(product.category, (map.get(product.category) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const conditionFacets = CONDITIONS.map((condition) => ({
    ...condition,
    count: allActive.filter((product) => product.condition === condition.value).length,
  })).filter((facet) => facet.count > 0);

  const rarityFacets = RARITIES.map((rarity) => ({
    ...rarity,
    count: allActive.filter((product) => product.rarity === rarity.value).length,
  })).filter((facet) => facet.count > 0);

  const knownCategories = new Set(categoryFacets.map((facet) => facet.value.toLowerCase()));
  const knownConditions = new Set(CONDITIONS.map((facet) => facet.value));
  const knownRarities = new Set(RARITIES.map((facet) => facet.value));

  const activeCategories = splitList(sp.cat).filter((value) => knownCategories.has(value.toLowerCase()));
  const activeConditions = splitList(sp.cond).filter((value): value is ProductCondition =>
    knownConditions.has(value as ProductCondition)
  );
  const activeRarities = splitList(sp.rarity).filter((value): value is ProductRarity =>
    knownRarities.has(value as ProductRarity)
  );
  const q = (sp.q ?? "").trim();
  const sort: Sort = SORTS.includes((sp.sort ?? "") as Sort) ? ((sp.sort ?? "newest") as Sort) : "newest";
  const inStock = sp.stock === "1";

  const products = listProducts({
    status: "ACTIVE",
    categories: activeCategories,
    conditions: activeConditions,
    rarities: activeRarities,
    q: q || undefined,
    sort,
    inStock,
    limit: 60,
  });

  return (
    <>
      <PageHero
        label="02 — Catalogue"
        title="Shop the grid"
        sub="Live inventory only. What you see is on the shelf, inspected and packed from the pit lane."
      />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <ShopFilters
          categories={categoryFacets}
          conditions={conditionFacets}
          rarities={rarityFacets}
          activeCategories={activeCategories}
          activeConditions={activeConditions}
          activeRarities={activeRarities}
          activeSort={sort}
          activeStock={inStock}
          activeQ={q}
        />

        <section className="py-8 md:py-14" aria-label="Products">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="u-label" aria-live="polite">
              {products.length} {products.length === 1 ? "unit" : "units"} on grid{q ? ` for “${q}”` : ""}
            </p>
            <p className="u-label hidden sm:block">
              Sorted ·{" "}
              {sort === "price-asc"
                ? "price low → high"
                : sort === "price-desc"
                  ? "price high → low"
                  : sort === "featured"
                    ? "featured first"
                    : sort === "rarity"
                      ? "rare / unique first"
                      : sort === "name-asc"
                        ? "name A → Z"
                        : "newest first"}
            </p>
          </div>

          <ShopProductsGrid initialProducts={products} />
        </section>
      </div>
    </>
  );
}
