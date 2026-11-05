import { NextResponse, type NextRequest } from "next/server";
import { getDb, run, nowIso } from "@/lib/db";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { requireApiUser, apiErrorResponse, rateLimit, ipOf } from "@/lib/auth";
import { reviewSchema } from "@/lib/validation";
import { logActivity } from "@/lib/analytics";

type ReviewRow = {
  id: number; productId: number; name: string; email: string; rating: number;
  title: string | null; body: string; status: string; createdAt: string;
};

/** GET — admin review list ?status=PENDING|APPROVED|REJECTED. */
export async function GET(req: NextRequest) {
  try {
    await requireApiUser("reviews.moderate");
    const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
    const rows = status === "ALL"
      ? (getDb().prepare("SELECT * FROM reviews ORDER BY createdAt DESC").all() as ReviewRow[])
      : (getDb().prepare("SELECT * FROM reviews WHERE status = ? ORDER BY createdAt DESC").all(status) as ReviewRow[]);
    return Response.json({ reviews: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST — public review submission (always lands PENDING). */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`review:${ipOf(req)}`, 5, 30 * 60_000)) {
      return Response.json({ error: "Too many submissions — try again later" }, { status: 429 });
    }
    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid review" }, { status: 422 });

    await ensureCatalogHydrated();
    const product = getDb().prepare("SELECT id, name FROM products WHERE id = ?").get(parsed.data.productId) as
      | { id: number; name: string }
      | undefined;
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

    const result = run(
      getDb().prepare(
        "INSERT INTO reviews (productId, name, email, rating, title, body, status, createdAt) VALUES (?,?,?,?,?,?,?,?)"
      ),
      parsed.data.productId, parsed.data.name, parsed.data.email.toLowerCase(), parsed.data.rating,
      parsed.data.title ?? "", parsed.data.body, "PENDING", nowIso()
    );
    logActivity("public:review", "review.submit", product.name, `${parsed.data.rating}★ pending`);

    void result;
    return Response.json({ ok: true, message: "Received — it publishes after a human check." }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — moderate a review (reviews.moderate). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("reviews.moderate");
    const id = Number(req.nextUrl.searchParams.get("id"));
    const { status } = (await req.json()) as { status?: "PUBLISHED" | "REJECTED" };
    if (!id || (status !== "PUBLISHED" && status !== "REJECTED")) {
      return Response.json({ error: "id and status (PUBLISHED/REJECTED) required" }, { status: 400 });
    }
    const info = run(getDb().prepare("UPDATE reviews SET status = ? WHERE id = ?"), status, id);
    if (info.changes === 0) return Response.json({ error: "Review not found" }, { status: 404 });
    logActivity(me.email, status === "PUBLISHED" ? "review.approve" : "review.reject", "review", `#${id}`);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE ?id= — remove a review permanently (reviews.moderate). */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser("reviews.moderate");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    run(getDb().prepare("DELETE FROM reviews WHERE id = ?"), id);
    logActivity(me.email, "review.delete", "review", `#${id}`);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

void NextResponse;
