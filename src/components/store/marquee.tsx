import type { ReactNode } from "react";

/**
 * CSS-driven ticker. Two identical copies make the -50% loop seamless.
 * The duplicate is hidden from assistive tech; hover pauses the belt.
 */
export function Marquee({
  children,
  speed = 32,
  reverse = false,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div
        className={reverse ? "u-marquee-rev" : "u-marquee"}
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
