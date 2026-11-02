import type { ImageFit, ImagePosition } from "./types";

/**
 * One source of truth for product/poster framing. Product editors pick fit
 * (cover = fill the frame, contain = show the whole shot) and an anchor for
 * crops. Kept as literal Tailwind classes so v4's scanner can see them.
 */
export function imageFitClass(fit?: ImageFit | string | null, position?: ImagePosition | string | null): string {
  const fitting = fit === "contain" ? "object-contain" : "object-cover";
  const anchor =
    position === "top"
      ? "object-top"
      : position === "bottom"
        ? "object-bottom"
        : position === "left"
          ? "object-left"
          : position === "right"
            ? "object-right"
            : "object-center";
  return `${fitting} ${anchor}`;
}
