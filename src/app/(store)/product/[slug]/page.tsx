import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Gallery, BuyPanel, ReviewLauncher, Stars } from "@/components/store/pdp-client";
import { ProductCard } from "@/components/store/product-card";
import { Reveal } from "@/components/store/reveal";
import { EmptyState, SectionHead } from "@/components/ui";
import { getProductBySlug, publishedReviews, relatedProducts } from "@/lib/catalog";
import { getTrustpilot } from "@/lib/settings";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.description.slice(0, 155),
    openGraph: { title: product.name, description: product.description.slice(0, 155), images: product.images[0] ? [product.images[0]] : [] },
    alternates: { canonical: `/product/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product || product.status !== "ACTIVE") notFound();

  const [reviews, related, trust] = await Promise.all([
    Promise.resolve(publishedReviews(product.id)),
    Promise.resolve(relatedProducts(product, 3)),
    getTrustpilot(),
  ]);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description.slice(0, 300),
    sku: `BW-${product.id}`,
    brand: { "@type": "Brand", name: product.brand ?? "Burnout Wheels" },
    category: product.category,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (product.priceSale / 100).toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 md:px-8 md:pt-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <nav className="u-label mb-8 flex items-center gap-2" aria-label="Breadcrumb">
        <Link href="/shop" className="hover:text-bone">Shop</Link>
        <span aria-hidden>/</span>
        <Link href={`/shop?cat=${encodeURIComponent(product.category)}`} className="hover:text-bone">{product.category}</Link>
        <span aria-hidden>/</span>
        <span className="text-fog" aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="page-in">
          <Gallery product={product} />
        </div>

        <div className="page-in" style={{ animationDelay: "80ms" }}>
          <p className="u-label">
            {product.featured ? <span className="text-red">▮ Drop 001 </span> : "▮ In catalogue "} · {product.brand}{product.scale ? ` · ${product.scale}` : ""}
          </p>
          <h1 className="u-h2 mt-4">{product.name}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="u-badge border-red text-red">{CONDITION_LABELS[product.condition]}</span>
            {product.tags.slice(0, 3).map((t) => (
              <span key={t} className="u-chip">{t}</span>
            ))}
          </div>

          <div className="mt-8 flex items-end gap-4">
            <p className="u-mono text-5xl font-bold">{fmtUSD(product.priceSale)}</p>
            <p className="u-label pb-2">incl. all taxes</p>
          </div>

          <div className="mt-10">
            <BuyPanel product={product} />
          </div>

          <div className="mt-10 border-t border-line pt-8">
            <p className="u-label">Protocol</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                "Sealed sourcing + pit inspection before dispatch",
                "Stock reserved the moment you order",
                product.stock > 0 ? "Dispatch information within 24h of payment confirmation" : "Restocks announced on the paddock list",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-[13px] text-fog">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-mint" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* description */}
      <section className="mt-20 border-t border-line pt-14 md:mt-28">
        <div className="grid gap-10 md:grid-cols-[300px_1fr]">
          <div>
            <p className="u-label">00 — Briefing</p>
            <h2 className="u-h3 mt-3">The piece</h2>
          </div>
          <Reveal>
            <p className="max-w-2xl text-[15px] leading-relaxed text-bone/80">{product.description}</p>
            {product.highlights.length > 0 && (
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {product.highlights.map((h) => (
                  <li key={h} className="u-card flex items-start gap-3 p-4 text-[13px] text-fog">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-red" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </section>

      {/* reviews */}
      <section id="reviews" className="mt-20 border-t border-line pt-14 md:mt-28">
        <div className="grid gap-10 md:grid-cols-[300px_1fr]">
          <div>
            <p className="u-label">01 — Grid talk</p>
            <h2 className="u-h3 mt-3">Reviews</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-fog">
              {trust.mode === "coming_soon"
                ? "No score inflation until our Trustpilot profile is live and linked. You will know it when you see it — here's the policy."
                : "Verified Trustpilot profile is live."}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {reviews.length === 0 ? (
              <EmptyState
                title="No verified reviews yet"
                body="Every review here is from a real, human-checked submission — never seed-written. Be the first to file a report."
                action={<ReviewLauncher product={product} />}
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {reviews.map((r) => (
                  <li key={r.id} className="u-card p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Stars rating={r.rating} />
                        <p className="text-[13px] font-semibold">{r.title || "Grid talk"}</p>
                      </div>
                      <p className="u-label">{r.name}</p>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-fog">{r.body}</p>
                  </li>
                ))}
                <li><ReviewLauncher product={product} /></li>
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* related */}
      <section className="mt-20 border-t border-line pt-14">
        <SectionHead index="02" title="Adjacent metal" />
        {related.length === 0 ? (
          <p className="u-label mt-8">Nothing adjacent yet — new drops soon.</p>
        ) : (
          <div className="mt-10 grid content-start gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* mobile sticky buy */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 p-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{product.name}</p>
            <p className="u-mono text-sm">{fmtUSD(product.priceSale)}{product.stock <= product.lowStockThreshold && product.stock > 0 ? ` · only ${product.stock} left` : ""}</p>
          </div>
          <div className="w-44"><BuyPanel product={product} /></div>
        </div>
      </div>
    </div>
  );
}
