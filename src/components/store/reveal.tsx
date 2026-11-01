"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealVariant = "up" | "curtain" | "scale" | "fade";

/**
 * IO-based scroll reveal. CSS classes handle the animation, so reduced-motion
 * users get the final state instantly (see globals.css).
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "up",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: RevealVariant;
  as?: "div" | "section" | "li" | "article" | "figure" | "span";
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variantClass =
    variant === "curtain" ? "reveal-curtain" : variant === "scale" ? "reveal-scale" : variant === "fade" ? "reveal-dim" : "reveal";

  return (
    <Tag
      ref={ref as never}
      className={`${variantClass} ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
