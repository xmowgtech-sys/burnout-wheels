"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, RefreshCcw, Trash2, Upload } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";

/** Single-image picker for storefront settings (hero posters, etc.). */
export function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        results?: { ok: boolean; url?: string; error?: string }[];
        error?: string;
      };
      const mine = data.results?.[0];
      if (!res.ok || !mine?.ok || !mine.url) throw new Error(mine?.error || data.error || "Upload failed");
      onChange(mine.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const addUrl = () => {
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed) && !trimmed.startsWith("/api/files/") && !trimmed.startsWith("/uploads/")) {
      setError("Paste a full https:// image URL or upload a file.");
      return;
    }
    setError("");
    onChange(trimmed);
    setUrl("");
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="u-label-txt">{label}</span>
        {hint ? <span className="u-label-txt text-dim!">{hint}</span> : null}
      </div>

      <div className="mt-2 overflow-hidden border border-line bg-ink">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-40 w-full object-contain" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-dim">
            <ImagePlus className="size-6" aria-hidden />
            <span className="u-label-txt">No poster selected — storefront fallback shows</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="u-btn u-btn-ghost px-2.5! py-2! text-[11px]!">
          {busy ? <RefreshCcw className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="u-btn u-btn-ghost px-2.5! py-2! text-[11px]! text-red!">
            <Trash2 className="size-3.5" aria-hidden /> Remove
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" aria-hidden />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="…or paste an image URL"
            className="u-input py-2! pl-8! text-[12px]!"
            aria-label={`${label} image URL`}
          />
        </div>
        <button type="button" onClick={addUrl} className="u-btn u-btn-ghost px-2.5! py-2! text-[11px]!">Use URL</button>
      </div>

      {error ? <p role="alert" className="u-label-txt mt-1.5 text-red!">{error}</p> : null}
    </div>
  );
}
