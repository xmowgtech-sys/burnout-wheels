"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CONTACT } from "@/lib/contact";

const KEY = "bw:announce:v2";

/**
 * Slim, full-width announcement strip above the header. Dismiss with × and it
 * stays dismissed (localStorage, campaign-keyed). Copy is written in plain
 * utilities (no u-label override) so the colour can never regress to dim-on-red.
 */
export function AnnounceBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setOpen(true);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked — session only */
    }
  };

  if (!mounted || !open) return null;

  return (
    <div
      className={`relative z-[70] flex w-full items-center justify-center gap-2 overflow-hidden bg-red pl-4 pr-9 text-white transition-[max-height,opacity] duration-300 ease-out sm:gap-3 ${
        compact ? "pointer-events-none invisible max-h-0 opacity-0" : "visible max-h-12 opacity-100"
      }`}
      role="region"
      aria-label="Announcement"
      aria-hidden={compact}
    >
      {/* checker accent on the left edge — visible brand cue even when the text truncates */}
      <span aria-hidden className="hidden shrink-0 md:absolute md:left-0 md:inset-y-0 md:block md:w-10 md:bg-[repeating-conic-gradient(#fff_0%_25%,#e10600_0%_50%)] md:bg-[length:10px_10px] md:opacity-40" />

      <p className="min-w-0 truncate py-2 text-center text-[11px] font-semibold leading-tight sm:py-2.5 sm:text-[12.5px]">
        <a href={CONTACT.discord} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2 transition-colors hover:text-ink">
          Join our Discord
        </a>{" "}
        for discounts &amp; offers
        <span className="hidden sm:inline"> — or{" "}
          <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2 transition-colors hover:text-ink">
            WhatsApp us
          </a>
        </span>
      </p>

      <button
        onClick={close}
        aria-label="Dismiss announcement"
        className="absolute right-0.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded text-white/90 transition-colors hover:bg-black/25 hover:text-white"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
