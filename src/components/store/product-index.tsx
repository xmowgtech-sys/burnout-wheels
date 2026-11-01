"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { fmtUSD } from "@/lib/money";
import { CONDITION_LABELS, type Product } from "@/lib/types";

/**
 * Editorial product index. Desktop: hovering/focusing a line swaps the large
 * preview (all images are stacked, so there is zero layout shift or fetch lag).
 * Mobile: each line carries its own thumbnail; the preview is desktop-only.
 */
export function ProductIndex({ products }: { products: Product[] }) {
  const items = products.slice(0, 6);
  const [active, setActive] = useState(0);
  if (items.length === 0) return null;

  const current = items[Math.min(active, items.length - 1)]!;

  return (
    <section className="border-t border-line" aria-label="Product index">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="u-label">
              <span className="text-red">03</span> — The index
            </p>
            <h2 className="u-h2 mt-3">Every unit, one line.</h2>
          </div>
          <Link href="/shop" className="u-btn u-btn-ghost">
            Full grid <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <ol className="border-t border-line">
            {items.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/product/${p.slug}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line py-4 transition-colors md:gap-5 md:py-5 ${
                    active === i ? "text-bone" : "text-fog hover:text-bone"
                  }`}
                >
                  <span className={`u-mono text-[10px] ${active === i ? "text-red" : "text-dim"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="flex min-w-0 items-center gap-3">
                    {p.images[0] ? (
                      <span className="u-media relative hidden h-12 w-16 shrink-0 min-[380px]:block">
                        <Image src={p.images[0]} alt="" fill sizes="64px" className="object-cover" />
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-extrabold uppercase leading-tight tracking-tight sm:text-2xl lg:text-[27px]">
                        {p.name}
                      </span>
                      <span className="u-label mt-1 block truncate">
                        {p.brand}
                        {p.scale ? ` · ${p.scale}` : ""} · {CONDITION_LABELS[p.condition]}
                      </span>
                      <span className="u-mono mt-1 block text-[12px] sm:hidden">{fmtUSD(p.priceSale)}</span>
                    </span>
                  </span>

                  <span className="flex items-center gap-3">
                    <span className="u-mono hidden text-[12px] sm:block">{fmtUSD(p.priceSale)}</span>
                    <span
                      className={`grid size-10 place-items-center border transition-colors ${
                        active === i
                          ? "border-red bg-red text-white"
                          : "border-line text-dim group-hover:border-line-strong group-hover:text-bone"
                      }`}
                    >
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {/* visual preview — the list above is the accessible navigation */}
          <div className="hidden lg:block" aria-hidden>
            <div className="sticky top-28">
              <Link href={`/product/${current.slug}`} tabIndex={-1} className="group relative block aspect-[4/3] overflow-hidden border border-line bg-coal">
                {items.map((p, i) =>
                  p.images[0] ? (
                    <Image
                      key={p.id}
                      src={p.images[0]}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 44vw, 90vw"
                      className={`object-cover transition-[opacity,transform] duration-700 ${
                        i === active ? "scale-100 opacity-100" : "scale-105 opacity-0"
                      }`}
                    />
                  ) : null
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="u-label text-bone/70">
                        {current.brand}
                        {current.scale ? ` · ${current.scale}` : ""}
                      </p>
                      <p className="mt-1 truncate text-2xl font-extrabold uppercase leading-tight">{current.name}</p>
                    </div>
                    <span className="u-badge u-badge-cond shrink-0" data-condition={current.condition}>
                      {CONDITION_LABELS[current.condition]}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
                    <span className="u-mono text-lg">{fmtUSD(current.priceSale)}</span>
                    <span className="u-label flex items-center gap-2 text-bone">
                      Inspect <ArrowUpRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
                <div className="u-spectrum absolute inset-x-0 top-0 h-[3px]" />
              </Link>
              <p className="u-label mt-3">Hover a line to load its telemetry.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
