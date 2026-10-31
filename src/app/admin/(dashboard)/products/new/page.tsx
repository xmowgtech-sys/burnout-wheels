import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New product · Pit wall", robots: { index: false } };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <p className="u-label">Catalogue</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Add product</h1>
        <p className="u-label-txt mt-2">Real description, real photos. Stock counts exactly what's on the shelf.</p>
      </header>
      <ProductForm initial={null} />
    </div>
  );
}
