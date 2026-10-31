"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="u-label">Race stopped — red flag</p>
      <h1 className="u-h2 mt-4">Something spun out</h1>
      <p className="mt-4 max-w-md text-sm text-fog">
        {error.digest ? `Digest ${error.digest}. ` : ""}The crew is on it. Try again — that usually clears it.
      </p>
      <button type="button" onClick={reset} className="u-btn u-btn-primary mt-8">
        Restart the lap
      </button>
    </main>
  );
}
