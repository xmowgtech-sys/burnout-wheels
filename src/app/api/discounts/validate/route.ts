import { getDb } from "@/lib/db";
import { rateLimit, ipOf } from "@/lib/auth";

/** Public discount code check for the checkout page. */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`validate:${ipOf(req)}`, 20, 60_000)) {
      return Response.json({ error: "Slow down — too many code attempts" }, { status: 429 });
    }
    const { code, subtotal } = (await req.json()) as { code?: string; subtotal?: number };
    const clean = (code ?? "").trim().toUpperCase();
    if (!clean) return Response.json({ error: "Enter a code" }, { status: 422 });
    const row = getDb().prepare("SELECT * FROM discounts WHERE UPPER(code) = ?").get(clean) as
      | { code: string; type: string; value: number; minSubtotal: number; maxUses: number; usedCount: number; active: number; startsAt: string | null; endsAt: string | null }
      | undefined;
    if (!row) return Response.json({ error: `Code “${clean}” doesn't exist` }, { status: 404 });
    if (row.active !== 1) return Response.json({ error: `Code “${clean}” is not active` }, { status: 422 });
    if (row.maxUses > 0 && row.usedCount >= row.maxUses) return Response.json({ error: "Code fully redeemed" }, { status: 422 });
    const sub = Number(subtotal ?? 0);
    if (sub < row.minSubtotal) {
      return Response.json({ error: `Needs a cart of ₹${Math.ceil(row.minSubtotal / 100)}` }, { status: 422 });
    }
    const amount = row.type === "PERCENT" ? Math.round((sub * row.value) / 100) : Math.min(row.value, sub);
    return Response.json({ code: row.code, amount });
  } catch {
    return Response.json({ error: "Validation failed" }, { status: 500 });
  }
}
