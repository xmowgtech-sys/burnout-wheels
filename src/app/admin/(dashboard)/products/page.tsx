import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductsGrid } from "@/components/admin/product-rows";
import { listProducts, productCount } from "@/lib/catalog";
import { catalogStoreMode, catalogStoreLabel, ensureCatalogHydrated } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products · Pit wall", robots: { index: false } };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  // Always read the latest snapshot. A stale list can point at a product that
  // another instance has already deleted, which makes the edit/hide actions
  // appear broken.
  await ensureCatalogHydrated({ force: true });
  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = (sp.status as "ACTIVE" | "DRAFT" | "ARCHIVED" | undefined) ?? undefined;
  const products = listProducts({ q: q || undefined, status, limit: 100, sort: "newest" });
  const total = productCount({});

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="u-label">Catalogue</p>
          <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Products</h1>
          <p className="u-label-txt mt-2">{total} total in database · showing {products.length}</p>
        </div>
        <Link href="/admin/products/new" className="u-btn u-btn-primary"><Plus className="size-4" /> Add product</Link>
      </header>

      {process.env.VERCEL ? (
        <div className="u-card flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
          <span className="font-medium">Catalog storage:</span>
          {catalogStoreMode() === "off" ? (
            <span className="u-label-txt">temporary on this deployment. Connect a private Vercel Blob store to keep product changes.</span>
          ) : (
            <span className="u-label-txt">
              {catalogStoreLabel()} — add, edit, hide and delete here persist across restarts and redeploys.
            </span>
          )}
        </div>
      ) : null}

      <form method="GET" className="flex flex-wrap gap-2" role="search" action="/admin/products">
        <input name="q" defaultValue={q} placeholder="Search name, category, tags…" className="u-input max-w-xs" aria-label="Search products" />
        <select name="status" defaultValue={sp.status ?? ""} className="u-select w-auto!" aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="u-btn u-btn-ghost">Filter</button>
      </form>

      {products.length === 0 ? (
        <p className="u-card px-6 py-12 text-center u-label-txt">No products match. Clear filters or add your first unit.</p>
      ) : (
        <ProductsGrid products={products} />
      )}
    </div>
  );
}
