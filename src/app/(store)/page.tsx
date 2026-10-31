import DevModal from "@/components/DevModal";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Undo2, Lock } from "lucide-react";
import { Hero } from "@/components/store/hero";
import { ProductCard } from "@/components/store/product-card";
import { Reveal } from "@/components/store/reveal";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { SectionHead } from "@/components/ui";
import { categoryCounts, featuredProduct, listProducts } from "@/lib/catalog";
import { getTrustpilot } from "@/lib/settings";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

const HERO_IMG =
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg/1920px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3937_by_Stepro.jpg";

export default async function HomePage() {
  const [featured, grid, categories, trust] = await Promise.all([
    featuredProduct(),
    Promise.resolve(listProducts({ status: "ACTIVE", limit: 8, sort: "featured" })),
    Promise.resolve(categoryCounts()),
    getTrustpilot(),
  ]);

  const heroDrop = featured ?? null;

  return (
    <>
    <DevModal />
      <Hero
        heroImage={HERO_IMG}
        headlineParts={["Raw metal.", "Racing blood."]}
        subline="Die-cast built to race-lace spec: sealed, inspected and catalogued like telemetry. One drop at a time — when it's gone, it's gone."
        dropName={heroDrop ? "RB20" : undefined}
        dropPrice={heroDrop ? fmtUSD(heroDrop.priceSale) : undefined}
        dropSlug={heroDrop?.slug}
      />

      {/* FEATURED DROP */}
      {heroDrop && (
        <section className="relative border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center md:px-8 md:py-28">
            <Reveal>
              <Link href={`/product/${heroDrop.slug}`} className="u-media u-media-hover relative block aspect-[4/3]">
                <Image
                  src={heroDrop.images[0] ?? HERO_IMG}
                  alt={heroDrop.name}
                  fill
                  sizes="(min-width: 768px) 50vw, 95vw"
                  priority
                />
                <span className="u-badge absolute left-4 top-4 border-red bg-red text-white">Drop 001 — live</span>
              </Link>
            </Reveal>
            <div>
              <Reveal>
                <SectionHead index="002" title="Featured drop" />
                <h2 className="u-h2 mt-6">
                  {heroDrop.name}
                </h2>
                <p className="u-mono mt-3 text-sm text-fog">
                  {heroDrop.brand} · {heroDrop.scale} · {CONDITION_LABELS[heroDrop.condition]}
                </p>
                <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-fog">{heroDrop.description.slice(0, 320)}</p>
                <div className="mt-8 flex flex-wrap items-center gap-6">
                  <p className="u-mono text-4xl font-bold">{fmtUSD(heroDrop.priceSale)}</p>
                  <p className="u-label">
                    {heroDrop.stock > 0
                      ? `${heroDrop.stock} IN THE PADDOCK`
                      : "SOLD OUT — NEXT ALLOCATION SOON"}
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={`/product/${heroDrop.slug}`} className="u-btn u-btn-primary">
                    Inspect the piece <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link href="/shop" className="u-btn u-btn-ghost">
                    Full grid
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* SHOP THE GRID */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHead index="003" title="Shop the grid" sub="Every unit is hand-checked against the box, the casting and the livery before it lists." />
              <Link href="/shop" className="u-btn u-btn-ghost">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </Reveal>

          {grid.length === 0 ? (
            <p className="u-label mt-16">Grid empty — first drop lands soon.</p>
          ) : (
            <div className="mt-12 grid content-start gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {grid.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
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
      <section className="border-t border-line bg-coal">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-24">
          <Reveal>
            <SectionHead index="004" title="Trust, not tapes" sub="No star inflation, no invented reviews. Policies and proof do the talking." />
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 md:grid-cols-4">
            {[
              { icon: ShieldCheck, k: "Authenticity", v: "Sealed sourcing, serials logged, every unit pit-inspected before dispatch." },
              { icon: Lock, k: "Secure shopping", v: "No card data is ever stored. UPI and COD, confirmed order-by-order." },
              { icon: Undo2, k: "Cancellation built in", v: "Cancel free any time before the parcel ships. After dispatch, the rules live on the Refund & Cancellation page — written, not implied." },
              { icon: ArrowRight, k: "Trustpilot", v: trust.mode === "coming_soon" ? "Coming soon — real profile, then real scores." : "Live profile linked." },
            ].map((c, i) => (
              <Reveal key={c.k} delay={i * 70} className="bg-coal">
                <div className="flex h-full flex-col gap-4 p-7">
                  <c.icon className="size-5 text-red" aria-hidden />
                  <p className="u-h3">{c.k}</p>
                  <p className="text-[13px] leading-relaxed text-fog">{c.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8">
            <Link href="/trust" className="u-label underline-offset-4 hover:underline">
              Read the full trust protocol →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="u-gridlines" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:grid-cols-2 md:items-center md:px-8">
          <Reveal>
            <p className="u-label"><span className="text-red">005</span> — Paddock radio</p>
            <h2 className="u-h2 mt-4">First call on drops. Zero spam laps.</h2>
            <p className="mt-4 max-w-md text-[15px] text-fog">Drop windows sell through in minutes. The list hears first, always with dates and units — never with invented hype.</p>
          </Reveal>
          <Reveal delay={80}>
            <NewsletterForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}