import Link from "next/link";
import { ReviewCards } from "@/components/admin/review-actions";
import { pendingReviews, moderatedReviews } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews · Pit wall", robots: { index: false } };

export default async function ReviewsPage() {
  await ensureCatalogHydrated();
  const [pending, moderated] = [pendingReviews(), moderatedReviews(50)];

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="u-label">Moderation desk</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Reviews</h1>
        <p className="u-label-txt mt-2">Nothing publishes without a human pass through here. Zero seeded reviews — ever.</p>
      </header>

      <section aria-label="Pending reviews">
        <p className="u-label mb-4">Waiting on you ({pending.length})</p>
        <ReviewCards reviews={pending} />
      </section>

      <section aria-label="Moderated reviews">
        <p className="u-label mb-4">Recently moderated ({moderated.length})</p>
        <ReviewCards reviews={moderated} showStatus />
      </section>

      <Link href="/shop" className="u-btn u-btn-ghost self-start">Storefront grid</Link>
    </div>
  );
}
