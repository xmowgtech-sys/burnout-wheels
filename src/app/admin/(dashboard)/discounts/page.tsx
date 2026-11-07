import { getDb } from "@/lib/db";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { DiscountsPanel } from "@/components/admin/discounts-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discounts · Pit wall", robots: { index: false } };

type Row = {
  id: number; code: string; type: string; value: number; minSubtotal: number;
  maxUses: number; usedCount: number; startsAt: string | null; endsAt: string | null; active: number; createdAt: string;
};

export default async function DiscountsPage() {
  await ensureCatalogHydrated();
  const rows = (getDb().prepare("SELECT * FROM discounts ORDER BY createdAt DESC").all() as Row[]).map((r) => ({ ...r, active: r.active === 1 }));
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Codes</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Discounts</h1>
      </header>
      <DiscountsPanel rows={rows} />
    </div>
  );
}
