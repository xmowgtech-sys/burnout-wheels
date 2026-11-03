import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui";
import type { Product } from "@/lib/types";

/**
 * Server-driven grid. Products come from the database only — no browser cache
 * is merged in, so what a customer sees is exactly what the server can sell.
 */
export function ShopProductsGrid({ initialProducts }: { initialProducts: Product[] }) {
  if (initialProducts.length === 0) {
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
      {initialProducts.map((p, i) => (
        <div key={p.id} className="page-in" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  );
}
