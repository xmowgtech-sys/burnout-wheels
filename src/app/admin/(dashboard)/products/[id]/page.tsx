import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { getProductById } from "@/lib/catalog";
import { fmtDate } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit product · Pit wall", robots: { index: false } };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProductById(Number(id));
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link href="/admin/products" className="u-label hover:text-bone">← All products</Link>
        <h1 className="u-h1 mt-3 text-3xl md:text-4xl">{product.name}</h1>
        <p className="u-label-txt mt-2">
          <Link href={`/product/${product.slug}`} target="_blank" className="underline underline-offset-4 hover:text-bone">View live page</Link>
          {" · "}created {fmtDate(product.createdAt)} · updated {fmtDate(product.updatedAt)}
        </p>
      </header>
      <ProductForm initial={product} />
    </div>
  );
}
