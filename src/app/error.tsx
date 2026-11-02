"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the digest in the console for support; never surface raw internals.
    console.error("[burnout] route error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="u-label">Race stopped — red flag</p>
      <h1 className="u-h2 mt-4">Something spun out</h1>
      <p className="mt-4 max-w-md text-sm text-fog">
        {error.digest ? `Digest ${error.digest}. ` : ""}The crew is on it. Head back to the pit lane and pick up the
        next lap.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="u-btn u-btn-primary">
          Restart the lap
        </Link>
        <button type="button" onClick={reset} className="u-btn u-btn-ghost">
          Try again
        </button>
      </div>
    </main>
  );
}
