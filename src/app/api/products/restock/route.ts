import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProductById, getProductBySlug, restockProduct } from "@/lib/catalog";
import { ensureCatalogHydrated, persistCatalogSnapshot } from "@/lib/catalog-store";
import { lowStockProducts } from "@/lib/finance";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { MAX_RESTOCK_QTY, MIN_RESTOCK_QTY } from "@/lib/inventory";

const restockSchema = z
  .object({
    id: z.number().int().positive().optional(),
    slug: z.string().trim().min(1).max(200).optional(),
    addQty: z.number().int().min(MIN_RESTOCK_QTY).max(MAX_RESTOCK_QTY),
  })
  .refine((v) => Boolean(v.slug || v.id), {
    message: "Provide either product slug or id",
  });

/** GET — fetch current low-stock products for the admin dashboard monitor. */
export async function GET() {
  try {
    await requireApiUser("products.manage");
    await ensureCatalogHydrated();
    return Response.json({ products: lowStockProducts() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST — quick-action restock for a low-stock product (products.manage). */
export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser("products.manage");
    const raw = (await req.json().catch(() => null)) as unknown;
    const parsed = restockSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid restock request" },
        { status: 422 }
      );
    }

    const { id, slug, addQty } = parsed.data;
    const before = slug ? getProductBySlug(slug) : id ? getProductById(id) : null;

    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json(
        { error: "The catalog store is unavailable — nothing was changed. Try again in a minute." },
        { status: 503 }
      );
    }

    const target = slug
      ? getProductBySlug(slug)
      : before
        ? getProductBySlug(before.slug)
        : id
          ? getProductById(id)
          : null;

    if (!target) {
      return Response.json(
        { error: "Product could not be found — refresh the dashboard and try again." },
        { status: 404 }
      );
    }

    const result = restockProduct(target.id, addQty, me.email);
    if (!result) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const durable = await persistCatalogSnapshot({ hydrated: true });
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");

    return Response.json({
      product: result.product,
      previousStock: result.previousStock,
      added: addQty,
      durable,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
