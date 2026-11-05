import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { PageHero, EmptyState } from "@/components/ui";
import { listProducts } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await ensureCatalogHydrated();
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const results = term ? listProducts({ status: "ACTIVE", q: term, limit: 60 }) : [];

  return (
    <>
      <PageHero label="Search" title={term ? `“${term}”` : "Search the grid"} sub={term ? `${results.length} result${results.length === 1 ? "" : "s"} in the paddock` : "Scan the catalogue by name, scale, brand or category."} />
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {!term ? (
          <EmptyState title="Radio silence" body="Type a search term in the header — try “RB20” or “Formula 1”." action={<Link href="/shop" className="u-btn u-btn-primary">Browse everything</Link>} />
        ) : results.length === 0 ? (
          <EmptyState title="No hits" body={`Nothing matched “${term}”. Try a broader term or browse the full grid.`} action={<Link href="/shop" className="u-btn u-btn-primary">Browse everything</Link>} />
        ) : (
          <div className="grid content-start gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
