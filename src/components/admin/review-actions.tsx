"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Trash2 } from "lucide-react";
import { Stars } from "@/components/store/pdp-client";
import { ConfirmDialog } from "./admin-ui";

export type ReviewRow = { id: number; productId: number; name: string; email: string; rating: number; title: string | null; body: string; status: string; createdAt: string };

export function ReviewRowActions({ review }: { review: ReviewRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);

  const patch = async (status: "PUBLISHED" | "REJECTED") => {
    setBusy(true);
    await fetch(`/api/reviews?id=${review.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  const destroy = async () => {
    setBusy(true);
    await fetch(`/api/reviews?id=${review.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1.5">
      {review.status === "PENDING" && (
        <>
          <button onClick={() => patch("PUBLISHED")} disabled={busy} className="u-btn u-btn-primary !px-3 !py-2" aria-label="Publish review"><Check className="size-3.5" /> Publish</button>
          <button onClick={() => patch("REJECTED")} disabled={busy} className="u-btn u-btn-ghost !px-3 !py-2" aria-label="Reject review"><X className="size-3.5" /> Reject</button>
        </>
      )}
      {review.status === "PUBLISHED" && <button onClick={() => patch("REJECTED")} disabled={busy} className="u-btn u-btn-ghost !px-3 !py-2">Unpublish</button>}
      {review.status === "REJECTED" && <button onClick={() => patch("PUBLISHED")} disabled={busy} className="u-btn u-btn-primary !px-3 !py-2">Publish</button>}
      <button onClick={() => setDel(true)} disabled={busy} className="u-btn u-btn-danger !px-2.5 !py-2" aria-label="Delete review"><Trash2 className="size-3.5" /></button>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={destroy} title="Delete this review?" body="Removed and gone — no archive." confirmLabel="Delete" danger />
    </div>
  );
}

export function ReviewCards({ reviews, showStatus }: { reviews: ReviewRow[]; showStatus?: boolean }) {
  if (reviews.length === 0) {
    return <p className="u-card px-6 py-12 text-center u-label-txt">Queue empty — nothing waiting on a human check.</p>;
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {reviews.map((r) => (
        <li key={r.id} className="u-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <Stars rating={r.rating} />
                {showStatus && (
                  <span className="u-badge border-line text-fog">{r.status}</span>
                )}
              </div>
              <p className="mt-2 text-[14px] font-semibold">{r.title || "Untitled review"}</p>
            </div>
            <span className="u-label whitespace-nowrap">{r.name}</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">{r.body}</p>
          <div className="mt-4 flow-item"><ReviewRowActions review={r} /></div>
        </li>
      ))}
    </ul>
  );
}
