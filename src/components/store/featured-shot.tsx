"use client";

import { useEffect, useState } from "react";
import { CameraOff } from "lucide-react";
import { imageFitClass } from "@/lib/images";
import type { ImageFit, ImagePosition } from "@/lib/types";

/**
 * Featured-drop shot with a real fallback chain. A missing product upload, a
 * dead remote URL or a deleted file should never leave a blank rectangle on the
 * home page — it steps through manual poster → product cover → site hero and
 * finally shows a labelled placeholder that points the owner at Admin.
 */
export function FeaturedShot({
  sources,
  alt,
  fit,
  position,
  sizes = "(min-width: 1024px) 52vw, 95vw",
  priority = false,
}: {
  sources: string[];
  alt: string;
  fit?: ImageFit | string | null;
  position?: ImagePosition | string | null;
  sizes?: string;
  priority?: boolean;
}) {
  const unique = Array.from(new Set(sources.map((src) => src.trim()).filter(Boolean)));
  const signature = unique.join("|");
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [signature]);
  const src = unique[index];

  if (!src) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(90%_80%_at_60%_20%,#1d1d22_0%,#111114_55%,#0a0a0c_100%)]">
        <div className="max-w-[280px] px-6 text-center">
          <CameraOff className="mx-auto size-6 text-dim" aria-hidden />
          <p className="u-label mt-3">Drop photo pending</p>
          <p className="u-label-txt mt-1.5">Add a featured image in Admin → Settings, or give the product a cover photo.</p>
        </div>
      </div>
    );
  }

  return (
    // Plain img mirrors the hero poster: direct file URLs, no optimizer hop.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setIndex((current) => current + 1)}
      className={`absolute inset-0 h-full w-full ${imageFitClass(fit, position)}`}
    />
  );
}
