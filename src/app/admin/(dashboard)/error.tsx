"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="u-card mx-auto max-w-lg p-8 text-center">
      <p className="u-label !text-red">Red flag on track</p>
      <h2 className="u-h2 mt-3">This panel hit a wall</h2>
      <p className="mt-3 text-[13px] leading-relaxed text-fog">{error.message || "Something went wrong loading this area."}</p>
      <button onClick={reset} className="u-btn u-btn-primary mt-6">Restart lap</button>
    </div>
  );
}
