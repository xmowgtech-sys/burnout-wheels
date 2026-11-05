import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureCatalogHydrated();
  const base = siteUrl();
  const products = listProducts({ status: "ACTIVE", limit: 500 });
  const staticPages = ["", "/shop", "/shipping", "/trust", "/track", "/wishlist", "/refund-cancellation", "/terms", "/privacy", "/login", "/signup"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  const productPages = products.map((p) => ({
    url: `${base}/product/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));
  return [...staticPages, ...productPages];
}
