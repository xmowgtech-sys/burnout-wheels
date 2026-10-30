import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const products = listProducts({ status: "ACTIVE", limit: 500 });
  const staticPages = ["", "/shop", "/shipping", "/returns", "/trust", "/track", "/wishlist"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  const productPages = products.map((p) => ({
    url: `${siteUrl}/product/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));
  return [...staticPages, ...productPages];
}
