"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface HeroProps {
  heroImage: string;
  headlineParts: [string, string];
  subline: string;
  dropName?: string;
  dropPrice?: string;
  dropSlug?: string;
}

export function Hero({ heroImage, headlineParts, subline, dropName, dropPrice, dropSlug }: HeroProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "18%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.06, reduced ? 1.06 : 1.16]);
  const fgY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* broadcast background */}
      <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt="" className="h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/35 md:via-ink/55 md:to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/70" />
        <div className="u-scan absolute inset-0 opacity-40" />
      </motion.div>

      <motion.div style={{ y: fgY, opacity: fade }} className="relative flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 pb-28 pt-32 md:px-8">
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: reduced ? 0 : 0.9 }}
            className="u-label"
          >
            <span className="text-red">▮</span> Die-cast pit lane — now live
          </motion.p>

          <h1 className="u-h1 mt-5 max-w-5xl text-bone">
            <motion.span
              className="block overflow-hidden"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: reduced ? 0 : 1.0 }}
            >
              {headlineParts[0]}
            </motion.span>
            <motion.span
              className="block overflow-hidden"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: EASE, delay: reduced ? 0 : 1.14 }}
            >
              <span className="u-outline">{headlineParts[1]}</span>
            </motion.span>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: reduced ? 0 : 1.3 }}
            className="mt-6 max-w-xl text-[14.5px] leading-relaxed text-bone/80 sm:mt-7 sm:text-[15px]"
          >
            {subline}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: reduced ? 0 : 1.45 }}
            className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10"
          >
            <Link href="/shop" className="u-btn u-btn-primary">
              Enter the shop
            </Link>
            {dropSlug && (
              <Link href={`/product/${dropSlug}`} className="u-btn u-btn-ghost">
                {dropName ? `Drop: ${dropName}` : "Latest drop"} {dropPrice ? `· ${dropPrice}` : ""}
              </Link>
            )}
          </motion.div>
        </div>

        {/* telemetry strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 1.7, duration: 0.8 }}
          className="relative border-t border-line bg-ink/55 backdrop-blur-sm"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-line md:grid-cols-4">
            {[
              ["Grid session", "01 — Live"],
              ["Catalogue", "Sealed & inspected"],
              ["Dispatch", "2–4 business days"],
              ["Setter", "Scroll ↓"],
            ].map(([k, v], i) => (
              <div key={k} className="flex flex-col gap-1 px-4 py-4 md:px-6">
                <span className="u-label !text-dim">{k}</span>
                <span className={`u-mono text-[12px] md:text-[13px] ${i === 3 ? "flex items-center gap-2 text-fog" : ""}`}>
                  {v}
                  {i === 3 && <ArrowDown className="size-3.5 shrink-0 text-red" aria-hidden />}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
