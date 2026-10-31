"use client";

import { useEffect, useState } from "react";
import { X, MessageCircle } from "lucide-react";

const DISCORD = "https://discord.gg/wwUHm5MaK7";
const WHATSAPP =
  "https://wa.me/7889079186?text=" + encodeURIComponent("Hi Burnout Wheels — I have an enquiry:");
const KEY = "bw:announce:v2";

/**
 * Slim, full-width announcement overlay that sits on top of the fixed header.
 * Dismiss with the × and it stays dismissed (localStorage), re-appears on new campaign copy (v-keyed).
 */
export function AnnounceBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setOpen(true);
    }
    setMounted(true);
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
    <div className="relative z-[70] flex w-full items-center justify-center gap-2 bg-red px-9 py-1.5 text-white sm:gap-3 sm:py-2" role="region" aria-label="Announcement">
      <p className="u-label !text-white !tracking-[0.14em] text-center text-[10px] leading-tight sm:text-[11px]">
        Join our{" "}
        <a href={DISCORD} target="_blank" rel="noopener noreferrer" className="font-extrabold underline decoration-2 underline-offset-2 hover:!text-ink">
          Discord
        </a>{" "}
        for discounts &amp; offers — or{" "}
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-extrabold underline decoration-2 underline-offset-2 hover:!text-ink">
          WhatsApp us
        </a>{" "}
        for a quick enquiry
      </p>
      <button
        onClick={close}
        aria-label="Dismiss announcement"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/85 transition-colors hover:bg-black/25 hover:text-white"
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <span className="sr-only">
        <MessageCircle className="hidden" aria-hidden />
      </span>
    </div>
  );
}
