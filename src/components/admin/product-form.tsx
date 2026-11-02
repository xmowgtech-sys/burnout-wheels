"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, ConfirmDialog } from "@/components/admin/admin-ui";
import { ImageUploader } from "@/components/admin/image-uploader";
import { fmtUSD } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveCustomProductLocal, markProductDeletedLocal } from "@/lib/products-client";
import type { ImageFit, ImagePosition, Product, ProductStatus, ProductCondition } from "@/lib/types";

interface FormState {
  name: string; slug: string; brand: string; scale: string; category: string;
  condition: ProductCondition; status: ProductStatus; featured: boolean;
  priceSale: string; priceCost: string; feePercent: string;
  stock: string; lowStockThreshold: string; dropAt: string;
  description: string; highlights: string; tags: string;
  images: string[]; imageFit: ImageFit; imagePosition: ImagePosition;
}

function toState(p: Product | null): FormState {
  if (!p) {
    return {
      name: "", slug: "", brand: "", scale: "1:64", category: "",
      condition: "NEW", status: "ACTIVE", featured: false,
      priceSale: "", priceCost: "", feePercent: "2",
      stock: "5", lowStockThreshold: "3", dropAt: "",
      description: "", highlights: "", tags: "",
      images: [], imageFit: "cover", imagePosition: "center",
    };
  }
  return {
    name: p.name, slug: p.slug, brand: p.brand ?? "", scale: p.scale ?? "",
    category: p.category, condition: p.condition, status: p.status, featured: p.featured,
    priceSale: (p.priceSale / 100).toString(),
    priceCost: (p.priceCost / 100).toString(),
    feePercent: p.feePercent.toString(),
    stock: p.stock.toString(), lowStockThreshold: p.lowStockThreshold.toString(),
    dropAt: p.dropAt ? p.dropAt.slice(0, 10) : "",
    description: p.description,
    highlights: p.highlights.join("\n"),
    tags: p.tags.join(", "),
    images: p.images,
    imageFit: p.imageFit,
    imagePosition: p.imagePosition,
  };
}

export function ProductForm({ initial }: { initial: Product | null }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => toState(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(initial);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  // live slug suggestion
  const slugSuggestion = useMemo(
    () => f.name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60),
    [f.name]
  );

  // money helpers — DB stores paise
  const cpp = (v: string) => Math.round((Number(v || 0) * 100 + Number.EPSILON));
  const sale = cpp(f.priceSale);
  const cost = cpp(f.priceCost);
  const fee = Math.round((sale * (Number(f.feePercent) || 0)) / 100);
  const profit = sale - cost - fee;
  const marginPct = sale > 0 ? Math.round((profit / sale) * 100) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const cleanSlug = (f.slug.trim() || slugSuggestion || f.name.trim())
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const fallbackImages = f.images.length > 0 ? f.images : ["/uploads/u-mvxjll11-0wvz0.png"];

      const payload = {
        name: f.name.trim(),
        slug: cleanSlug || "product-" + Date.now().toString(36),
        brand: f.brand.trim() || "Hot Wheels",
        category: f.category.trim() || "Rare Drops",
        scale: f.scale.trim() || "1:64",
        condition: f.condition,
        status: f.status,
        featured: f.featured,
        priceSale: sale || 199900,
        priceCost: cost || 0,
        feePercent: Number(f.feePercent) || 2,
        stock: Math.max(0, Math.round(Number(f.stock) || 10)),
        lowStockThreshold: Math.max(0, Math.round(Number(f.lowStockThreshold) || 3)),
        dropAt: f.dropAt || "",
        description: f.description.trim() || `${f.name.trim()} in mint authentic condition.`,
        highlights: f.highlights.split("\n").map((x) => x.trim()).filter(Boolean),
        tags: f.tags.split(",").map((x) => x.trim()).filter(Boolean),
        images: fallbackImages,
        imageFit: f.imageFit,
        imagePosition: f.imagePosition,
      };

      const res = await fetch(editing ? `/api/products?id=${initial!.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; product?: Product };
      if (!res.ok) throw new Error(data.error || "Save failed");

      // Persist in client storage across Vercel ephemeral lambdas
      if (data.product) {
        saveCustomProductLocal(data.product);
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // (image handling lives in ImageUploader — validation, progress, reorder, cover, retry)

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={3} className="u-input" /></Field>
        <Field label="Slug" hint={`Auto: ${slugSuggestion || "—"}`}>
          <input value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder={slugSuggestion} className="u-input font-mono! text-[13px]!" />
        </Field>
        <Field label="Brand"><input value={f.brand} onChange={(e) => set("brand", e.target.value)} className="u-input" /></Field>
        <Field label="Scale"><input value={f.scale} onChange={(e) => set("scale", e.target.value)} placeholder="1:43" className="u-input" /></Field>
        <Field label="Category *"><input value={f.category} onChange={(e) => set("category", e.target.value)} required className="u-input" /></Field>
        <Field label="Drop date (optional)">
          <input type="date" value={f.dropAt} onChange={(e) => set("dropAt", e.target.value)} className="u-input" />
        </Field>
        <Field label="Condition">
          <select value={f.condition} onChange={(e) => set("condition", e.target.value as ProductCondition)} className="u-select">
            <option value="NEW">New / boxed</option>
            <option value="GRADED">Graded</option>
            <option value="LIKE_NEW">Like new</option>
            <option value="PRE_OWNED">Pre-owned</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={(e) => set("status", e.target.value as ProductStatus)} className="u-select">
            <option value="ACTIVE">Active — on the grid</option>
            <option value="DRAFT">Draft — hidden</option>
            <option value="ARCHIVED">Archived — delisted</option>
          </select>
        </Field>
        <div className="flex items-end">
          <label className="u-card flex cursor-pointer items-center gap-3 self-stretch p-3.5">
            <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="accent-red" />
            <span className="text-[13px] font-semibold">Featured — hero of the storefront</span>
          </label>
        </div>
      </div>

      <fieldset className="u-card grid gap-4 p-5 md:grid-cols-3">
        <legend className="u-label px-1">Pricing (₹)</legend>
        <Field label="Sale price (₹) *"><input type="number" min="1" step="0.01" value={f.priceSale} onChange={(e) => set("priceSale", e.target.value)} required className="u-input" /></Field>
        <Field label="Unit cost (₹) *"><input type="number" min="0" step="0.01" value={f.priceCost} onChange={(e) => set("priceCost", e.target.value)} required className="u-input" /></Field>
        <Field label="Fee %"><input type="number" min="0" step="0.1" value={f.feePercent} onChange={(e) => set("feePercent", e.target.value)} className="u-input" /></Field>
        <div className="md:col-span-3">
          <p className="u-label-txt">Margin preview</p>
          <p className={cn("u-mono mt-2 text-xl font-bold", profit >= 0 ? "text-mint" : "text-red")}>
            {fmtUSD(profit)} / unit · {isNaN(marginPct) ? "0" : marginPct}%
          </p>
          <p className="u-label-txt mt-1.5">Sale {fmtUSD(sale)} − cost {fmtUSD(cost)} − fees {fmtUSD(fee)}</p>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Stock on shelf *"><input type="number" min="0" value={f.stock} onChange={(e) => set("stock", e.target.value)} required className="u-input" /></Field>
        <Field label="Low-stock threshold"><input type="number" min="0" value={f.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} className="u-input" /></Field>
      </div>

      <Field label="Description">
        <textarea value={f.description} onChange={(e) => set("description", e.target.value)} className="u-textarea" rows={5} placeholder="Authentic diecast collector model in original packaging." />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Highlights (one per line)">
          <textarea value={f.highlights} onChange={(e) => set("highlights", e.target.value)} className="u-textarea" rows={4} />
        </Field>
        <Field label="Tags (comma separated)">
          <textarea value={f.tags} onChange={(e) => set("tags", e.target.value)} className="u-textarea" rows={4} placeholder="red bull, f1, 2024" />
        </Field>
      </div>

  {/* images */}
      <fieldset className="u-card p-5">
        <legend className="u-label px-1">Images ({f.images.length})</legend>
        <div className="mt-4">
          <ImageUploader images={f.images} onChange={(next) => set("images", next)} productName={f.name || undefined} />
        </div>
        <div className="mt-6 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
          <Field label="Image fit" hint="Cover fills the frame; contain shows the whole photo inside it.">
            <select value={f.imageFit} onChange={(e) => set("imageFit", e.target.value as ImageFit)} className="u-select">
              <option value="cover">Cover — fill the frame</option>
              <option value="contain">Contain — show the whole photo</option>
            </select>
          </Field>
          <Field label="Crop anchor" hint="Which edge stays in view when a cover crop trims the photo.">
            <select value={f.imagePosition} onChange={(e) => set("imagePosition", e.target.value as ImagePosition)} className="u-select">
              <option value="center">Centre</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </Field>
          <p className="u-label-txt md:col-span-2">
            First attached photo is the cover — it drives cards, the product index and the gallery.
            Use the cover/arrow controls in the gallery below to reorder or promote another frame.
          </p>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <div className="flex items-center gap-3">
          <button disabled={busy} className="u-btn u-btn-primary">
            {busy ? "Saving…" : editing ? "Save changes" : "Create product"}
          </button>
          <button type="button" onClick={() => router.push("/admin/products")} className="u-btn u-btn-ghost">
            Cancel
          </button>
        </div>

        {editing && initial?.id ? (
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              className="u-btn u-btn-danger"
            >
              Delete product
            </button>
            <ConfirmDialog
              open={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              onConfirm={async () => {
                setBusy(true);
                setError("");
                try {
                  const res = await fetch(`/api/products?id=${initial.id}`, { method: "DELETE" });
                  const data = (await res.json().catch(() => ({}))) as { error?: string; mode?: string; ok?: boolean };
                  if (res.ok || res.status === 404 || data.mode === "already_deleted") {
                    markProductDeletedLocal(initial.id, initial.slug);
                    router.push("/admin/products");
                    router.refresh();
                    return;
                  }
                  throw new Error(data.error || `Delete failed (${res.status})`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Delete failed");
                  setBusy(false);
                  setConfirmDelete(false);
                }
              }}
              title={`Delete “${initial.name}”?`}
              body="This listing will be permanently removed from the storefront and admin panel. Past customer orders and finance snapshots remain intact."
              confirmLabel={busy ? "Deleting…" : "Delete permanently"}
              danger
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
