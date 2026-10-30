import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="u-gridlines" aria-hidden />
      <p className="u-label">Sector 404 — Deleted scene</p>
      <h1 className="u-h1 mt-4">
        OFF <span className="u-outline-red">TRACK</span>
      </h1>
      <p className="mt-6 max-w-md text-bone/70">
        That URL ran wide at the apex. Nothing to recover here — head back to the pit lane.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="u-btn u-btn-primary">
          Back to garage
        </Link>
        <Link href="/shop" className="u-btn u-btn-ghost">
          Browse the grid
        </Link>
      </div>
      <div className="pointer-events-none fixed bottom-0 left-0 right-0">
        <div className="h-1 u-stripe opacity-60" />
      </div>
    </main>
  );
}
