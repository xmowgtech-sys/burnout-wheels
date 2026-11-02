"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { ConfirmDialog } from "./admin-ui";
import { fmtUSD } from "@/lib/money";
import { imageFitClass } from "@/lib/images";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const toPayload = (product: Product, status: Product["status"]) => ({
  name: product.name,
  slug: product.slug,
  brand: product.brand ?? "",
  category: product.category,
  scale: product.scale ?? "",
  condition: product.condition,
  description: product.description,
  highlights: product.highlights,
  tags: product.tags,
  images: product.images,
  imageFit: product.imageFit,
  imagePosition: product.imagePosition,
  priceSale: product.priceSale,
  priceCost: product.priceCost,
  feePercent: product.feePercent,
  stock: product.stock,
  lowStockThreshold: product.lowStockThreshold,
  status,
  featured: product.featured,
  dropAt: product.dropAt ?? "",
});

export function ProductRowActions({ product, onDeleted }: { product: Product; onDeleted?: (id: number) => void }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const del = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/products?id=${product.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; mode?: string; ok?: boolean };
      if (res.ok || res.status === 404 || data.mode === "already_deleted") {
        setConfirm(false);
        setError("");
        onDeleted?.(product.id);
        router.refresh();
        return;
      }
      throw new Error(data.error || `Delete failed (${res.status})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setError(msg);
      if (msg.toLowerCase().includes("not found")) {
        onDeleted?.(product.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    setBusy(true);
    const next = product.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    try {
      const res = await fetch(`/api/products?id=${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(product, next)),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Link href={`/admin/products/${product.id}`} className="u-btn u-btn-ghost px-2! py-2!" aria-label={`Edit ${product.name}`}><Pencil className="size-3.5" /></Link>
      <button onClick={toggleStatus} disabled={busy} className="u-btn u-btn-ghost px-2! py-2!" aria-label={product.status === "ACTIVE" ? "Unlist product" : "Publish product"}>
        {product.status === "ACTIVE" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button onClick={() => setConfirm(true)} disabled={busy} className="u-btn u-btn-danger px-2! py-2!" aria-label={`Delete ${product.name}`}><Trash2 className="size-3.5" /></button>
      <ConfirmDialog
        open={confirm}
        onClose={() => { setConfirm(false); setBusy(false); }}
        onConfirm={del}
        title={`Remove “${product.name}”?`}
        body="The listing is deleted permanently. Past orders keep their item snapshot, so finance history stays intact."
        confirmLabel={busy ? "Deleting…" : "Delete"}
        danger
      />
      {error && (
        <span className="flex items-center gap-1.5 text-[11px] text-red">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => onDeleted?.(product.id)}
            className="text-[10px] text-yellow underline hover:text-white"
            title="Force remove from screen"
          >
            [Force remove]
          </button>
        </span>
      )}
    </div>
  );
}

export function ProductsGrid({ products }: { products: Product[] }) {
  const [items, setItems] = useState<Product[]>(products);

  // Sync with incoming server props when filters change
  const [prevProps, setPrevProps] = useState(products);
  if (products !== prevProps) {
    setPrevProps(products);
    setItems(products);
  }

  const handleDeleted = (id: number) => {
    setItems((current) => current.filter((p) => p.id !== id));
  };

  return (
    <div className="grid content-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => {
        const margin = p.priceSale > 0 ? Math.round(((p.priceSale - p.priceCost - Math.round((p.priceSale * p.feePercent) / 100)) / p.priceSale) * 100) : 0;
        return (
          <article key={p.id} className="u-card overflow-hidden">
            <Link href={`/admin/products/${p.id}`} className="u-media relative block aspect-[4/3]">
              {p.images[0] ? <Image src={p.images[0]} alt={p.name} fill sizes="(min-width:1024px) 33vw, 100vw" className={imageFitClass(p.imageFit, p.imagePosition)} /> : null}
              <span className="u-badge absolute left-3 top-3 bg-ink/85">
                {p.status === "ACTIVE" ? <span className="text-mint">LIVE</span> : <span className="text-yellow">{p.status}</span>}
              </span>
              {p.featured && <span className="u-badge absolute right-3 top-3 border-red text-red">FEATURED</span>}
            </Link>
            <div className="p-4">
              <p className="truncate text-[14px] font-semibold">{p.name}</p>
              <p className="u-label-txt mt-1">{p.category} · {p.brand ?? "—"}{p.scale ? ` · ${p.scale}` : ""}</p>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <p className="u-mono text-lg font-bold">{fmtUSD(p.priceSale)}</p>
                <p className={cn("u-label-txt !text-[11px]", margin >= 30 ? "!text-mint" : margin > 0 ? "!text-yellow" : "!text-red")}>
                  {margin >= 0 ? margin : 0}% margin · {p.stock} on shelf
                </p>
              </div>
              <div className="mt-4 flow-item"><ProductRowActions product={p} onDeleted={handleDeleted} /></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
