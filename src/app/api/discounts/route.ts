import { type NextRequest } from "next/server";
import { getDb, run, nowIso } from "@/lib/db";
import { ensureCatalogHydrated, persistCatalogSnapshot } from "@/lib/catalog-store";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { discountSchema } from "@/lib/validation";

type DiscountRow = {
  id: number; code: string; type: string; value: number; minSubtotal: number; maxUses: number; usedCount: number;
  startsAt: string | null; endsAt: string | null; active: number; createdAt: string;
};

const serialize = (d: Record<string, unknown>) => ({
  ...d,
  active: d.active === 1,
});

export async function GET() {
  try {
    await requireApiUser("discounts.manage");
    await ensureCatalogHydrated();
    const rows = getDb().prepare("SELECT * FROM discounts ORDER BY createdAt DESC").all() as DiscountRow[];
    return Response.json({ discounts: rows.map(serialize) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiUser("discounts.manage");
    const parsed = discountSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
    if (parsed.data.type === "PERCENT" && parsed.data.value > 100) {
      return Response.json({ error: "Percentage cannot exceed 100" }, { status: 422 });
    }
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json(
        { error: "The durable settings store is unavailable — the code was not created. Try again in a minute." },
        { status: 503 }
      );
    }
    const db = getDb();
    const exists = db.prepare("SELECT id FROM discounts WHERE code = ?").get(parsed.data.code);
    if (exists) return Response.json({ error: "That code already exists" }, { status: 409 });
    run(
      db.prepare(
        "INSERT INTO discounts (code, type, value, minSubtotal, maxUses, startsAt, endsAt, active, createdAt) VALUES (?,?,?,?,?,?,?,?,?)"
      ),
      parsed.data.code, parsed.data.type, parsed.data.value, parsed.data.minSubtotal, parsed.data.maxUses,
      parsed.data.startsAt || null, parsed.data.endsAt || null, parsed.data.active ? 1 : 0, nowIso()
    );
    const durable = await persistCatalogSnapshot({ hydrated: true });
    return Response.json({ ok: true, durable }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireApiUser("discounts.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    const body = (await req.json()) as { active?: boolean; code?: string };
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json({ error: "The durable settings store is unavailable — nothing was changed." }, { status: 503 });
    }
    if (typeof body.active === "boolean") {
      run(getDb().prepare("UPDATE discounts SET active = ? WHERE id = ?"), body.active ? 1 : 0, id);
    } else {
      const parsed = discountSchema.safeParse({ ...body, active: true });
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid code" }, { status: 422 });
      const clash = getDb().prepare("SELECT id FROM discounts WHERE code = ? AND id <> ?").get(parsed.data.code, id);
      if (clash) return Response.json({ error: "That code already exists" }, { status: 409 });
      run(
        getDb().prepare(
          "UPDATE discounts SET code = ?, type = ?, value = ?, minSubtotal = ?, maxUses = ?, startsAt = ?, endsAt = ?, active = ? WHERE id = ?"
        ),
        parsed.data.code, parsed.data.type, parsed.data.value, parsed.data.minSubtotal, parsed.data.maxUses,
        parsed.data.startsAt || null, parsed.data.endsAt || null, parsed.data.active ? 1 : 0, id
      );
    }
    const durable = await persistCatalogSnapshot({ hydrated: true });
    return Response.json({ ok: true, durable });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireApiUser("discounts.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json({ error: "The durable settings store is unavailable — nothing was deleted." }, { status: 503 });
    }
    run(getDb().prepare("DELETE FROM discounts WHERE id = ?"), id);
    const durable = await persistCatalogSnapshot({ hydrated: true });
    return Response.json({ ok: true, durable });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
