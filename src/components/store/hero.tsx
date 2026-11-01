"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface HeroProps {
  heroImage: string;
  headlineParts: [string, string];
  subline: string;
  dropName?: string;
  dropPrice?: string;
  dropStock?: number;
  dropSlug?: string;
}

export function Hero({ heroImage, headlineParts, subline, dropName, dropPrice, dropStock, dropSlug }: HeroProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "16%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.06, reduced ? 1.06 : 1.14]);
  const fgY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "-18%"]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0.25]);
  const soldOut = dropStock !== undefined && dropStock <= 0;

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* broadcast background */}
      <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt="" className="h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30 md:via-ink/60 md:to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/75" />
        <div className="u-scan absolute inset-0 opacity-40" />
      </motion.div>

      <motion.div style={{ y: fgY, opacity: fade }} className="relative z-10 flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 pb-5 pt-32 sm:px-6 md:px-8 md:pb-9 md:pt-36">
          {/* top telemetry row */}
          <div className="flex items-start justify-between gap-6">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: reduced ? 0 : 0.12 }}
              className="u-label flex items-center gap-2.5"
            >
              <span className="u-live-dot" aria-hidden />
              Die-cast pit lane — live from Mohali
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: reduced ? 0 : 0.25 }}
              className="u-mono hidden text-right text-[9.5px] uppercase leading-relaxed tracking-[0.22em] text-fog md:block"
            >
              30.7046° N / 76.7179° E
              <br />
              Grid session 001
            </motion.p>
          </div>

          <div className="mt-auto pt-10 md:pt-24">
            {/* editorial headline */}
            <h1 className="u-display max-w-[15ch] text-bone">
              {headlineParts.map((part, i) => (
                <span key={part} className="block overflow-hidden pb-[0.06em]">
                  <motion.span
                    className={`block ${i === 1 ? "u-outline-red" : ""}`}
                    initial={{ y: "112%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.95, ease: EASE, delay: reduced ? 0 : 0.18 + i * 0.12 }}
                  >
                    {part}
                  </motion.span>
                </span>
              ))}
            </h1>

            <div className="mt-8 grid gap-8 border-t border-line pt-6 md:mt-10 md:grid-cols-[1fr_auto] md:items-end md:gap-16">
              <div className="min-w-0">
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: reduced ? 0 : 0.5 }}
                  className="max-w-xl text-[14px] leading-relaxed text-bone/75 md:text-[15px]"
                >
                  {subline}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE, delay: reduced ? 0 : 0.62 }}
                  className="mt-6 flex flex-wrap items-center gap-3"
                >
                  <Link href="/shop" className="u-btn u-btn-primary group">
                    Enter the shop
                    <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                  {dropSlug && (
                    <Link href={`/product/${dropSlug}`} className="u-btn u-btn-ghost max-w-full min-w-0">
                      <span className="truncate sm:hidden">Latest drop</span>
                      <span className="hidden truncate sm:inline">{dropName ? `Drop: ${dropName}` : "Latest drop"}</span>
                      {dropPrice ? <span className="shrink-0 text-fog">· {dropPrice}</span> : null}
                    </Link>
                  )}
                </motion.div>
              </div>

              {/* live timing tower — only real catalog data */}
              <motion.aside
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: EASE, delay: reduced ? 0 : 0.7 }}
                className="hidden w-[280px] shrink-0 border border-line bg-ink/55 backdrop-blur-md md:block"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="u-label flex items-center gap-2 text-bone">
                    <span className="u-live-dot" aria-hidden /> Timing tower
                  </span>
                  <span className="u-mono text-[10px] text-dim">001</span>
                </div>
                {dropName ? (
                  <>
                    <div className="p-4">
                      <p className="text-xl font-extrabold uppercase leading-tight">{dropName}</p>
                      <p className="u-label mt-1.5">Featured drop</p>
                      <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
                        <div>
                          <p className="u-label">Price</p>
                          <p className="u-mono mt-1 text-lg font-semibold">{dropPrice}</p>
                        </div>
                        <div className="text-right">
                          <p className="u-label">Paddock</p>
                          <p className={`u-mono mt-1 text-lg font-semibold ${soldOut ? "text-red" : "text-lime"}`}>
                            {soldOut ? "SOLD OUT" : `${dropStock ?? "—"} units`}
                          </p>
                        </div>
                      </div>
                      <Link href={`/product/${dropSlug}`} className="u-btn u-btn-ghost mt-4 w-full">
                        Inspect the piece
                      </Link>
                    </div>
                    <div className="u-spectrum h-1 w-full" aria-hidden />
                  </>
                ) : (
                  <p className="p-4 text-[13px] leading-relaxed text-fog">First drop is being scrutineered. The list hears first.</p>
                )}
              </motion.aside>
            </div>
          </div>

          {/* scroll cue + sector legend */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: reduced ? 0 : 0.9 }}
            className="mt-6 flex items-center justify-between gap-4 md:mt-11"
          >
            <a href="#next" className="u-label group flex items-center gap-3 transition-colors hover:text-bone">
              <span className="grid size-8 place-items-center border border-line transition-colors group-hover:border-line-strong">
                <ArrowDown className="size-3.5 animate-[cue_1.8s_ease-in-out_infinite] text-red" aria-hidden />
              </span>
              Scroll the paddock
            </a>
            <div className="hidden items-center gap-4 md:flex" aria-hidden>
              {[
                ["S1", "bg-violet"],
                ["S2", "bg-mint"],
                ["S3", "bg-yellow"],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`size-1.5 ${color}`} />
                  <span className="u-mono text-[9px] tracking-[0.18em] text-dim">{label}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* telemetry strip */}
        <div className="relative border-t border-line bg-ink/60 backdrop-blur-sm">
          <div className="mx-auto grid max-w-[1500px] grid-cols-2 divide-x divide-line md:grid-cols-4">
            {[
              ["Catalogue", "Sealed & inspected"],
              ["Dispatch", "2–4 business days"],
              ["Payment", "UPI · COD · PayPal live"],
              ["Paddock", "Mohali → pan-India"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 px-4 py-3.5 md:px-6">
                <span className="u-label text-dim!">{k}</span>
                <span className="u-mono text-[11.5px] text-bone/85 md:text-[12.5px]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* vertical rail */}
      <div className="pointer-events-none absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex" aria-hidden>
        <span className="u-mono text-[9px] uppercase tracking-[0.3em] text-dim [writing-mode:vertical-rl]">
          Est. 2024 — India
        </span>
        <span className="h-16 w-px bg-gradient-to-b from-red to-transparent" />
      </div>
    </section>
  );
}
