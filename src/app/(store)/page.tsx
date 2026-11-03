import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ShieldCheck, Undo2, Lock } from "lucide-react";
import { Hero } from "@/components/store/hero";
import { FeaturedShot } from "@/components/store/featured-shot";
import { ProductCard } from "@/components/store/product-card";
import { Reveal } from "@/components/store/reveal";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { Marquee } from "@/components/store/marquee";
import { PitWall } from "@/components/store/pit-wall";
import { ProductIndex } from "@/components/store/product-index";
import { categoryCounts, featuredProduct, listProducts } from "@/lib/catalog";
import { getStorefront, getTrustpilot, DEFAULT_HERO_IMAGE } from "@/lib/settings";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS } from "@/lib/types";
import { COD_ADVANCE_LABEL } from "@/lib/payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  other: {
    "trustpilot-one-time-domain-verification-id": "5dc5a967-3ed5-468d-9cc8-f8777b1f2e0b",
  },
};

export default async function HomePage() {
  const storefront = getStorefront();
  const home = storefront.home;
  const [featured, allProducts, categories, trust] = await Promise.all([
    featuredProduct(),
    Promise.resolve(listProducts({ status: "ACTIVE", limit: 100, sort: "featured" })),
    Promise.resolve(categoryCounts()),
    getTrustpilot(),
  ]);

  const byId = new Map(allProducts.map((p) => [p.id, p]));
  const heroDrop = (home.heroDropProductId ? byId.get(home.heroDropProductId) : undefined) ?? featured ?? allProducts[0] ?? null;
  const featuredDrop = (home.featuredProductId ? byId.get(home.featuredProductId) : undefined) ?? heroDrop;
  const featuredSources = [
    home.featuredImage,
    featuredDrop?.images[0] ?? "",
    home.heroDesktopImage,
    DEFAULT_HERO_IMAGE,
  ];
  const featuredFit = home.featuredImage ? home.featuredImageFit : featuredDrop?.imageFit;
  const featuredPosition = home.featuredImage ? home.featuredImagePosition : featuredDrop?.imagePosition;
  const featuredFrames = home.featuredImage ? 1 : featuredDrop?.images.length || 1;
  const pinnedGrid = home.gridProductIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const grid = pinnedGrid.length ? pinnedGrid : allProducts.slice(0, 8);
  const heroLines = home.heroHeadline.split("\n").map((line) => line.trim()).filter(Boolean);
  const heroHeadline: [string, string] = [heroLines[0] ?? "Raw metal.", heroLines[1] ?? "Racing blood."];
  const ticker = home.tickerItems.length ? home.tickerItems : ["Sealed & inspected", "UPI · COD · PayPal live"];

  return (
    <>
      <Hero
        heroImage={home.heroDesktopImage || DEFAULT_HERO_IMAGE}
        mobileImage={home.heroMobileImage || undefined}
        imageFit={home.heroFit}
        imagePosition={home.heroPosition}
        kicker={home.heroKicker}
        headlineParts={heroHeadline}
        subline={home.heroSubline}
        dropName={heroDrop?.name}
        dropPrice={heroDrop ? fmtUSD(heroDrop.priceSale) : undefined}
        dropStock={heroDrop?.stock}
        dropSlug={heroDrop?.slug}
      />

      {/* TICKER */}
      <section id="next" className="relative border-b border-line bg-red text-white" aria-label="Store ticker">
        <Marquee speed={30} className="py-2.5">
          {ticker.map((t) => (
            <span key={t} className="flex items-center gap-6 pr-6 u-mono text-[10.5px] uppercase tracking-[0.2em]">
              {t}
              <span className="text-white/55" aria-hidden>
                ◆
              </span>
            </span>
          ))}
        </Marquee>
      </section>

      {/* FEATURED DROP */}
      {featuredDrop && (
        <section className="relative border-t border-line" aria-label="Featured drop">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16">
            <Reveal variant="curtain" className="lg:sticky lg:top-28">
              <Link href={`/product/${featuredDrop.slug}`} className="u-media u-media-hover relative block aspect-[4/3]">
                <FeaturedShot
                  sources={featuredSources}
                  alt={featuredDrop.name}
                  fit={featuredFit}
                  position={featuredPosition}
                  priority
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-transparent" aria-hidden />
                <span className="u-badge absolute left-4 top-4 border-red bg-red text-white">Drop 001 — live</span>
                <span className="u-badge absolute bottom-4 left-4 border-white/15 bg-ink/65 text-bone backdrop-blur-sm">
                  {home.featuredLabel}
                </span>
              </Link>
              <div className="mt-3 flex items-center justify-between">
                <p className="u-label">BW-{String(featuredDrop.id).padStart(3, "0")}</p>
                <p className="u-label">{featuredFrames} frame{featuredFrames === 1 ? "" : "s"}</p>
              </div>
            </Reveal>

            <div>
              <Reveal>
                <div className="flex items-center gap-4">
                  <p className="u-label">
                    <span className="text-red">01</span> — {home.featuredLabel}
                  </p>
                  <span className="h-px flex-1 bg-line" aria-hidden />
                  <span className="u-mono flex items-center gap-2 text-[10px] tracking-[0.18em] text-dim">
                    <span className="u-live-dot" aria-hidden /> LIVE
                  </span>
                </div>

                <h2 className="u-h2 mt-6 text-[clamp(2rem,5vw,3.6rem)]!">{featuredDrop.name}</h2>
                <p className="u-mono mt-3 text-sm text-fog">
                  {featuredDrop.brand} · {featuredDrop.scale} · {CONDITION_LABELS[featuredDrop.condition]}
                </p>
                <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-fog">{featuredDrop.description}</p>

                <dl className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
                  {[
                    ["Brand", featuredDrop.brand || "—"],
                    ["Scale", featuredDrop.scale || "—"],
                    ["Condition", CONDITION_LABELS[featuredDrop.condition]],
                    ["Paddock", featuredDrop.stock > 0 ? `${featuredDrop.stock} units` : "Sold out"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-coal p-4">
                      <dt className="u-label">{k}</dt>
                      <dd className="mt-2 text-[12.5px] font-semibold leading-snug">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-8 flex flex-wrap items-center gap-6">
                  <p className="u-mono text-4xl font-bold">{fmtUSD(featuredDrop.priceSale)}</p>
                  <p className="u-label">
                    {featuredDrop.stock > 0 ? `${featuredDrop.stock} IN THE PADDOCK` : "SOLD OUT — NEXT ALLOCATION SOON"}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/product/${featuredDrop.slug}`} className="u-btn u-btn-primary">
                    Inspect the piece <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link href="/shop" className="u-btn u-btn-ghost">
                    Full grid
                  </Link>
                </div>
                <p className="u-label-txt mt-6">
                  COD needs a {COD_ADVANCE_LABEL} online advance — adjusted against the total. Balance on delivery.
                </p>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* STICKY HORIZONTAL PIT WALL */}
      {home.showPitWall && <PitWall />}

      {/* HOVER-SWAP PRODUCT INDEX */}
      {home.showProductIndex && <ProductIndex products={grid.slice(0, 6)} />}

      {/* SHOP THE GRID */}
      <section className="border-t border-line" aria-label="Shop the grid">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="u-label">
                  <span className="text-red">04</span> — The grid
                </p>
                <h2 className="u-h2 mt-3">{home.gridTitle}</h2>
                <p className="mt-3 max-w-md text-[14px] leading-relaxed text-fog">
                  {home.gridSubline}
                </p>
              </div>
              <Link href="/shop" className="u-btn u-btn-ghost">
                View all <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>
          </Reveal>

          {grid.length === 0 ? (
            <p className="u-label mt-16">Grid empty — first drop lands soon.</p>
          ) : (
            <div className="mt-10 grid grid-cols-2 content-start gap-x-3 gap-y-8 sm:gap-x-6 md:mt-12 md:grid-cols-4 md:gap-y-12">
              {grid.map((p, i) => (
                <Reveal key={p.id} delay={i * 55}>
                  <ProductCard product={p} priority={i < 2} />
                </Reveal>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <Reveal className="mt-14">
              <div className="flex flex-wrap gap-2 border-t border-line pt-8">
                {categories.map((c) => (
                  <Link key={c.category} href={`/shop?cat=${encodeURIComponent(c.category)}`} className="u-chip">
                    {c.category} <span className="text-dim">{c.count}</span>
                  </Link>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* TRUST */}
      <section className="border-t border-line bg-coal" aria-label="Trust protocol">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="u-label">
                  <span className="text-red">05</span> — Trust protocol
                </p>
                <h2 className="u-h2 mt-3">{home.trustTitle}</h2>
                <p className="mt-3 max-w-md text-[14px] leading-relaxed text-fog">
                  {home.trustSubline}
                </p>
              </div>
              <Link href="/trust" className="u-btn u-btn-ghost">
                Read the protocol
              </Link>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 md:mt-12 md:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                k: "Authenticity",
                v: "Sealed sourcing, serials logged, every unit pit-inspected before dispatch.",
                tint: "border-mint/40 bg-mint/10 text-mint",
              },
              {
                icon: Lock,
                k: "Secure shopping",
                v: `No card data stored. UPI, COD with a ${COD_ADVANCE_LABEL} online advance, or PayPal arranged live on WhatsApp/Discord.`,
                tint: "border-sky/40 bg-sky/10 text-sky",
              },
              {
                icon: Undo2,
                k: "Cancellation built in",
                v: "Cancel free any time before the parcel ships. After dispatch, the written rules take over.",
                tint: "border-yellow/40 bg-yellow/10 text-yellow",
              },
              {
                icon: ArrowRight,
                k: "Trustpilot",
                v: trust.mode === "coming_soon" ? "Coming soon — real profile, then real scores." : "Live profile linked.",
                tint: "border-violet/40 bg-violet/10 text-violet",
              },
            ].map((c, i) => (
              <Reveal key={c.k} delay={i * 60} className="bg-coal">
                <div className="flex h-full flex-col gap-4 p-6 md:p-7">
                  <span className={`grid size-9 place-items-center border ${c.tint}`}>
                    <c.icon className="size-4" aria-hidden />
                  </span>
                  <p className="u-h3">{c.k}</p>
                  <p className="text-[13px] leading-relaxed text-fog">{c.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="u-spectrum mt-8 h-px w-full" aria-hidden />
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="relative overflow-hidden border-t border-line" aria-label="Paddock radio">
        <div className="u-gridlines" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-end md:px-8 md:py-28">
          <Reveal>
            <p className="u-label">
              <span className="text-red">06</span> — Paddock radio
            </p>
            <h2 className="u-h2 mt-4 max-w-xl">{home.newsletterTitle}</h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fog">
              {home.newsletterSubline}
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              <span className="u-label">Discord for discounts</span>
              <span className="u-label">WhatsApp 24/7</span>
              <span className="u-label">Email the crew</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="border border-line bg-panel p-6 md:p-8">
              <p className="u-label">Join the list</p>
              <div className="mt-4">
                <NewsletterForm />
              </div>
              <p className="u-label-txt mt-4">One email per drop window. Unsubscribe in a click.</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
