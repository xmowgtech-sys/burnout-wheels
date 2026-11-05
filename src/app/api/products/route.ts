import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { listProducts, getProductById, getProductBySlug, createProduct, updateProduct, deleteProduct } from "@/lib/catalog";
import { ensureCatalogHydrated, persistCatalogSnapshot } from "@/lib/catalog-store";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { normalizeProductInput } from "@/lib/validation";
import { can } from "@/lib/permissions";
import { logActivity } from "@/lib/analytics";

/** GET — public product search (used by the storefront search overlay). */
export async function GET(req: NextRequest) {
  try {
    await ensureCatalogHydrated();
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 12);
    const products = listProducts({ status: "ACTIVE", q, limit: Math.min(limit, 40), sort: "featured" });
    return Response.json({ products });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST — create a product (products.manage). */
export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser("products.manage");
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json({ error: "The catalog store is unavailable — nothing was changed. Try again in a minute." }, { status: 503 });
    }
    const raw = (await req.json()) as Record<string, unknown>;
    const parsed = normalizeProductInput(raw);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
    const product = createProduct(parsed.data);
    const durable = await persistCatalogSnapshot({ hydrated: true });
    logActivity(me.email, "product.create", product.slug, product.name);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json({ product, durable }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?slug= (or ?id=) — update a product (products.manage). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("products.manage");
    const slugParam = req.nextUrl.searchParams.get("slug");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!slugParam && !id) return Response.json({ error: "slug or id required" }, { status: 400 });
    // Hydration can change row ids, and a stale admin card may still point at
    // an old id. Resolve by slug first, then re-resolve after the snapshot has
    // been applied so the update lands on the current row.
    const before = slugParam ? getProductBySlug(slugParam) : getProductById(id);
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json({ error: "The catalog store is unavailable — nothing was changed. Try again in a minute." }, { status: 503 });
    }
    const target = slugParam
      ? getProductBySlug(slugParam)
      : before
        ? getProductBySlug(before.slug)
        : getProductById(id);
    if (!target) {
      return Response.json(
        { error: "This product changed on another instance — refresh the product list and try again." },
        { status: 404 }
      );
    }
    const raw = (await req.json()) as Record<string, unknown>;
    const parsed = normalizeProductInput(raw);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
    const product = updateProduct(target.id, parsed.data, me.email);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    const durable = await persistCatalogSnapshot({ hydrated: true });
    logActivity(me.email, "product.update", product.slug, product.name);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json({ product, durable });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE ?slug= (or ?id=) — delete/archive (products.delete). */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser();
    if (!can(me.role, "products.delete")) return Response.json({ error: "Not allowed for your role" }, { status: 403 });
    const slugParam = req.nextUrl.searchParams.get("slug");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!slugParam && !id) return Response.json({ error: "slug or id required" }, { status: 400 });
    const before = slugParam ? getProductBySlug(slugParam) : getProductById(id);
    const ready = await ensureCatalogHydrated({ force: true });
    if (!ready) {
      return Response.json({ error: "The catalog store is unavailable — nothing was changed. Try again in a minute." }, { status: 503 });
    }
    const product = slugParam
      ? getProductBySlug(slugParam)
      : before
        ? getProductBySlug(before.slug)
        : getProductById(id);
    if (!product) {
      revalidatePath("/admin/products");
      revalidatePath("/shop");
      revalidatePath("/");
      return Response.json({ ok: true, mode: "already_deleted" });
    }
    const res = deleteProduct(product.id);
    const durable = await persistCatalogSnapshot({ hydrated: true });
    logActivity(me.email, "product.delete", product.slug, product.name);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json({ ok: true, mode: res.mode, durable });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
