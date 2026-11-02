import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { listProducts, getProductById, createProduct, updateProduct, deleteProduct } from "@/lib/catalog";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { normalizeProductInput } from "@/lib/validation";
import { can } from "@/lib/permissions";
import { logActivity } from "@/lib/analytics";

/** GET — public product search (used by the storefront search overlay). */
export async function GET(req: NextRequest) {
  try {
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
    const raw = (await req.json()) as Record<string, unknown>;
    const parsed = normalizeProductInput(raw);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
    const product = createProduct(parsed.data);
    logActivity(me.email, "product.create", product.slug, product.name);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json({ product }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — update a product (products.manage). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("products.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const raw = (await req.json()) as Record<string, unknown>;
    const parsed = normalizeProductInput(raw);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 422 });
    const product = updateProduct(id, parsed.data, me.email);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    logActivity(me.email, "product.update", product.slug, product.name);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json({ product });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE ?id= — delete/archive (products.delete). */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser();
    if (!can(me.role, "products.delete")) return Response.json({ error: "Not allowed for your role" }, { status: 403 });
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const product = getProductById(id);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    const res = deleteProduct(id);
    logActivity(me.email, "product.delete", product.slug, product.name);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return Response.json({ ok: true, mode: res.mode });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
