"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, MessageCircle, Package, ShieldCheck, Truck } from "lucide-react";

const PANELS = [
  {
    sector: "S1",
    title: "Scrutineering",
    body: "Sealed sourcing, serials logged, every unit pit-inspected against the box, the casting and the livery before it lists.",
    link: "Read the trust protocol",
    href: "/trust",
    icon: ShieldCheck,
    text: "text-mint",
    bar: "bg-mint",
  },
  {
    sector: "S2",
    title: "Parc fermé",
    body: "Corner protection, box-in-box for graded and sealed pieces, then a signed-off inspection card before the parcel is sealed.",
    link: "How packing runs",
    href: "/shipping",
    icon: Package,
    text: "text-sky",
    bar: "bg-sky",
  },
  {
    sector: "S3",
    title: "Pit release",
    body: "Standard rides in 2–4 business days; Express goes first out the door. Tracking lands the moment the courier scans it.",
    link: "Shipping windows",
    href: "/shipping",
    icon: Truck,
    text: "text-yellow",
    bar: "bg-yellow",
  },
  {
    sector: "S4",
    title: "Race radio",
    body: "A human reads every message — WhatsApp, Discord or email. Day or night, claims and order questions get a real reply.",
    link: "Talk to the crew",
    href: "/trust#contact",
    icon: MessageCircle,
    text: "text-violet",
    bar: "bg-violet",
  },
];

function PanelCard({ panel, ghost }: { panel: (typeof PANELS)[number]; ghost: string }) {
  const Icon = panel.icon;
  return (
    <article className="group relative flex h-full flex-col justify-between overflow-hidden border border-line bg-panel p-6 transition-colors hover:border-line-strong md:p-8">
      <div className="u-gridlines opacity-25" aria-hidden />
      <div className="relative flex items-start justify-between">
        <span className={`u-mono text-[10px] tracking-[0.24em] ${panel.text}`}>SECTOR {panel.sector.slice(1)}</span>
        <Icon className={`size-5 ${panel.text}`} aria-hidden />
      </div>

      <div className="relative mt-10">
        <p
          aria-hidden
          className="u-mono pointer-events-none select-none text-[clamp(3.5rem,7vw,6.5rem)] font-bold leading-none text-transparent"
          style={{ WebkitTextStroke: "1px rgba(244,244,240,0.16)" }}
        >
          {ghost}
        </p>
        <h3 className="u-h2 mt-1">{panel.title}</h3>
        <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-fog">{panel.body}</p>
        <Link href={panel.href} className="u-label mt-6 inline-flex items-center gap-2 text-bone transition-colors hover:text-red">
          {panel.link}
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>

      <div className={`absolute inset-x-0 bottom-0 h-1 ${panel.bar}`} aria-hidden />
    </article>
  );
}

export function PitWall() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.06, 0.94], [0, -distance]);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const viewport = viewportRef.current;
      if (!track || !viewport) return;
      setDistance(Math.max(0, track.scrollWidth - viewport.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section className="border-t border-line bg-coal" aria-label="Pit wall">
      {/* mobile / reduced-motion heading */}
      <div className="mx-auto max-w-7xl px-4 pb-2 pt-16 md:hidden">
        <p className="u-label">
          <span className="text-red">02</span> — Pit wall
        </p>
        <h2 className="u-h2 mt-3">
          Four checks. No shortcuts.
        </h2>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-fog">
          Every unit passes the same four stations between listing and your shelf.
        </p>
      </div>

      {/* desktop pinned horizontal run */}
      {reduced ? (
        <div className="mx-auto hidden max-w-7xl gap-4 px-8 py-16 md:grid md:grid-cols-2">
          {PANELS.map((panel, i) => (
            <div key={panel.title} className="min-h-[340px]">
              <PanelCard panel={panel} ghost={`0${i + 1}`} />
            </div>
          ))}
        </div>
      ) : (
        <div ref={sectionRef} className="relative hidden md:block" style={{ height: "360vh" }}>
          <div ref={viewportRef} className="sticky top-[72px] flex h-[calc(100svh-72px)] items-center overflow-hidden">
            <motion.div ref={trackRef} style={{ x }} className="flex gap-6 px-8 will-change-transform">
              {/* intro panel */}
              <div className="relative flex h-[min(62vh,540px)] w-[min(46vw,560px)] shrink-0 flex-col justify-between overflow-hidden border border-line bg-ink p-8">
                <div className="u-gridlines opacity-30" aria-hidden />
                <p className="u-label relative">
                  <span className="text-red">02</span> — Pit wall
                </p>
                <div className="relative">
                  <h2 className="u-display text-[clamp(2.4rem,4.4vw,4rem)]!">
                    No
                    <br />
                    <span className="u-outline-red">shortcuts.</span>
                  </h2>
                  <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-fog">
                    Four stations stand between a listing and your shelf. Keep scrolling — the wall moves sideways.
                  </p>
                </div>
                <div className="relative flex items-center justify-between">
                  <span className="u-label">Scroll to advance</span>
                  <ArrowRight className="size-4 text-red" aria-hidden />
                </div>
                <div className="u-spectrum absolute inset-x-0 bottom-0 h-1" aria-hidden />
              </div>

              {PANELS.map((panel, i) => (
                <div key={panel.title} className="h-[min(62vh,540px)] w-[min(58vw,680px)] shrink-0">
                  <PanelCard panel={panel} ghost={`0${i + 1}`} />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      )}

      {/* mobile: native snap rail */}
      <div className="u-scroll-x flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-16 pt-6 md:hidden">
        {PANELS.map((panel, i) => (
          <div key={panel.title} className="h-[380px] w-[82vw] max-w-[340px] shrink-0 snap-center">
            <PanelCard panel={panel} ghost={`0${i + 1}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
