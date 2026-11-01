"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ImagePlus, Link2, RefreshCcw, Star, Trash2, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 12;
const BATCH_URL = "/api/upload";

interface UploadItem {
  key: string;
  file?: File;
  name: string;
  size: number;
  preview?: string; // object URL, only for fresh files
  status: "queued" | "uploading" | "done" | "error";
  progress: number; // 0..100
  error?: string;
  url?: string; // final /api/files/... URL once done
}

/** Uploads one file via XHR so we get real progress events.
 *  Resolves { ok, url?, error? } — server returns per-file results, so HTTP 201 can still carry failures. */
function uploadOne(
  file: File,
  onProgress: (pct: number) => void,
  signal: { aborted: boolean }
): Promise<{ ok: boolean; url?: string; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", BATCH_URL);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && !signal.aborted) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    });
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText) as {
          results?: { name: string; ok: boolean; url?: string; error?: string }[];
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300) {
          const mine = data.results?.find((r) => r.name === file.name);
          if (mine?.ok && mine.url) resolve({ ok: true, url: mine.url });
          else resolve({ ok: false, error: mine?.error ?? data.error ?? "Server rejected the file." });
        } else {
          resolve({ ok: false, error: data.error ?? `Upload failed (${xhr.status}).` });
        }
      } catch {
        resolve({ ok: false, error: `Upload failed (${xhr.status}) — unexpected server response.` });
      }
    });
    xhr.addEventListener("error", () => resolve({ ok: false, error: "Network cut out mid-upload — press retry." }));
    xhr.addEventListener("abort", () => resolve({ ok: false, error: "Upload cancelled." }));
    xhr.addEventListener("timeout", () => resolve({ ok: false, error: "Upload timed out — try a smaller file." }));
    const fd = new FormData();
    fd.append("files", file);
    xhr.timeout = 120_000;
    xhr.send(fd);
    if (signal.aborted) xhr.abort();
  });
}

interface Props {
  images: string[];
  onChange: (next: string[]) => void;
  productName?: string;
}

/**
 * Full product-image manager: drag-drop + picker, multi-file with live progress,
 * client+server validation, per-file retry, drag/arrow reordering, cover selection,
 * replace-in-place and delete (with server-side file cleanup), plus URL adds.
 * `images[0]` is the cover — PDP gallery and product cards always read index 0.
 */
export function ImageUploader({ images, onChange, productName }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [dropHover, setDropHover] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const urlsRef = useRef(new Map<string, string>());
  const seqRef = useRef(0);

  // revoke object URLs on unmount
  useEffect(() => {
    const map = urlsRef.current;
    return () => {
      map.forEach((u) => URL.revokeObjectURL(u));
      map.clear();
    };
  }, []);

  const patchItem = useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }, []);

  const validate = useCallback((file: File): string | null => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ext || !ALLOWED_EXT.has(ext)) return "Unsupported type — use JPG, PNG, WEBP, AVIF or GIF.";
    if (file.size === 0) return "File is empty (0 KB).";
    if (file.size > MAX_BYTES) return `${(file.size / 1024 / 1024).toFixed(1)} MB — over the 10 MB limit.`;
    if (images.length >= MAX_IMAGES) return `Room for ${MAX_IMAGES - images.length} more image(s) — remove one first (max ${MAX_IMAGES}).`;
    return null;
  }, [images.length]);

  /** One file: validate → upload with progress → commit to image list (or mark error/retryable). */
  const handleFile = useCallback(async (file: File, signal: { aborted: boolean }) => {
    const invalid = validate(file);
    const key = `u${++seqRef.current}`;
    const url = invalid ? undefined : URL.createObjectURL(file);
    if (url) urlsRef.current.set(key, url);

    const committed = invalid !== null;
    if (committed) {
      setItems((prev) => [
        ...prev,
        { key, name: file.name, size: file.size, status: "error", progress: 0, error: invalid ?? undefined },
      ]);
      return;
    }

    setItems((prev) => [
      ...prev,
      { key, file, name: file.name, size: file.size, preview: url, status: "uploading", progress: 0 },
    ]);

    const res = await uploadOne(file, (pct) => patchItem(key, { progress: pct }), signal);

    if (signal.aborted) return;
    if (res.ok && res.url) {
      patchItem(key, { status: "done", progress: 100, url: res.url });
      // replace-in-place: swap the target slot instead of appending
      const slot = replaceTargetRef.current;
      if (slot !== null) {
        replaceTargetRef.current = null;
        const old = images[slot];
        onChange([...images.slice(0, slot), res.url, ...images.slice(slot + 1)]);
        if (old?.startsWith("/api/files/")) {
          void fetch(`${BATCH_URL}?file=${encodeURIComponent(old.slice("/api/files/".length))}`, { method: "DELETE" });
        }
      } else if (!images.includes(res.url)) {
        onChange([...images, res.url]);
      }
    } else {
      patchItem(key, { status: "error", progress: 0, error: res.error ?? "Upload failed." });
    }
  }, [images, onChange, patchItem, validate]);

  /** Concurrency-limited queue (3 at a time keeps progress bars legible and the pipe warm). */
  const acceptFiles = useCallback((files: File[]) => {
    if (replaceTargetRef.current !== null) return; // replace flow handles single files in pickReplace
    // client-side count guard before anything uploads
    const room = MAX_IMAGES - images.length;
    if (files.length > room) {
      setNotice(`That's ${files.length} images but only ${Math.max(0, room)} slot(s) left — box holds ${MAX_IMAGES} photos.`);
    }
    setNotice("");
    const signal = { aborted: false };
    const queue = files.slice();
    void (async () => {
      const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file || signal.aborted) return;
          await handleFile(file, signal);
        }
      });
      await Promise.all(workers);
      // keep the done cards visible briefly so progress is perceivable, then clear
      window.setTimeout(() => {
        setItems((prev) => {
          prev.filter((it) => it.status === "done").forEach((it) => {
            const u = urlsRef.current.get(it.key);
            if (u) {
              URL.revokeObjectURL(u);
              urlsRef.current.delete(it.key);
            }
          });
          return prev.filter((it) => it.status !== "done");
        });
      }, 1400);
    })();
  }, [images.length, handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropHover(false);
    replaceTargetRef.current = null;
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f instanceof File);
    if (files.length) acceptFiles(files);
  }, [acceptFiles]);

  const onPick = useCallback((files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!list.length) return;
    acceptFiles(list);
  }, [acceptFiles]);

  const pickReplace = useCallback((index: number) => {
    replaceTargetRef.current = index;
    inputRef.current?.click();
  }, []);

  const setCover = useCallback((index: number) => {
    if (index === 0) return;
    next([...images.slice(0, index), ...images.slice(index + 1), images[index]!]); // rotate to front
    // cover = position 0 — keep list order otherwise
  }, [images]);

  const next = onChange;

  const move = useCallback((i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const copy = [...images];
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    next(copy);
  }, [images, next]);

  const to = useCallback((from: number, toIndex: number) => {
    const copy = [...images];
    const [v] = copy.splice(from, 1);
    if (v) {
      copy.splice(toIndex, 0, v);
      next(copy);
    }
  }, [images, next]);

  const remove = useCallback((i: number) => {
    const gone = images[i];
    if (!gone) return;
    next(images.filter((_, j) => j !== i));
    // uploaded files get cleaned up server-side so uploads don't accumulate
    if (gone.startsWith("/api/files/")) {
      void fetch(`${BATCH_URL}?file=${encodeURIComponent(gone.slice("/api/files/".length))}`, { method: "DELETE" });
    }
  }, [images, next]);

  const addUrl = useCallback(() => {
    const raw = urlInput.trim();
    const ok = /^https?:\/\/.+/i.test(raw) || raw.startsWith("/api/files/");
    if (!ok) {
      setNotice("That doesn't look like an image URL — it should start with https://");
      return;
    }
    if (images.includes(raw)) {
      setNotice("That image is already attached.");
      return;
    }
    if (images.length >= MAX_IMAGES) {
      setNotice(`Box is full — ${MAX_IMAGES} photos max. Remove one first.`);
      return;
    }
    next([...images, raw]);
    setUrlInput("");
    setNotice("");
  }, [urlInput, images, next]);

  const itemsBlock = useMemo(() => {
    if (items.length === 0) return null;
    return (
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.key} className={cn("flex items-center gap-3 border px-3 py-2.5", it.status === "error" ? "border-red/60 bg-red/5" : "border-line bg-white/[0.02]")}>
            {it.preview ? (
              <span className="u-media size-10 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.preview} alt="" className="size-full object-cover" />
              </span>
            ) : (
              <span className="grid size-10 shrink-0 place-items-center bg-white/[0.04]">
                {it.status === "error" ? <AlertTriangle className="size-4 text-red" aria-hidden /> : <ImagePlus className="size-4 text-fog" aria-hidden />}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">{it.name}</span>
              <span className="u-label text-dim!">{(it.size / 1024).toFixed(0)} KB</span>
              {it.status === "uploading" && (
                <span className="mt-1.5 block h-1 w-full bg-white/10" role="progressbar" aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100}>
                  <span className="block h-full bg-red transition-all" style={{ width: `${it.progress}%` }} />
                </span>
              )}
              {it.status === "error" && <span className="mt-0.5 block text-[12px] leading-snug text-red">{it.error}</span>}
              {it.status === "done" && <span className="mt-0.5 block text-[12px] text-mint">Attached ✓</span>}
            </span>
            {it.status === "error" && it.file && (
              <button type="button" onClick={() => void handleFile(it.file!, { aborted: false })} className="u-btn u-btn-ghost px-2! py-1.5!" aria-label={`Retry ${it.name}`}>
                <RefreshCcw className="size-3.5" aria-hidden /> Retry
              </button>
            )}
            {it.status === "error" && !it.file && (
              <button type="button" onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))} className="u-label hover:text-bone" aria-label="Dismiss">
                Dismiss
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }, [items, handleFile]);

  return (
    <div>
      {/* drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={onDrop}
        onClick={() => {
          replaceTargetRef.current = null;
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            replaceTargetRef.current = null;
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload product images — drop files here or press Enter to browse"
        className={cn(
          "cursor-pointer border-2 border-dashed px-6 py-8 text-center transition-colors outline-none",
          dropHover ? "border-red bg-red/[0.06]" : "border-line hover:border-line-strong focus-visible:border-red"
        )}
      >
        <Upload className="mx-auto size-6 text-red" aria-hidden />
        <p className="mt-3 text-sm font-bold uppercase tracking-wide">Drop product photos here</p>
        <p className="u-label-txt mt-1">or click to browse — JPG · PNG · WEBP · AVIF · GIF, max 10 MB each, {MAX_IMAGES} photos per product</p>
        <p className="u-label-txt mt-1 text-dim!">First photo = cover shot (used on cards and the gallery hero)</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        hidden
        onChange={(e) => onPick(e.target.files)}
        aria-label="Choose product images"
      />

      {/* in-flight items */}
      {itemsBlock}

      {notice && <p role="status" className="mt-3 border border-yellow/50 bg-yellow/[0.07] px-3 py-2 text-[12px] text-yellow">{notice}</p>}

      {/* committed gallery */}
      {images.length === 0 ? (
        <p className="u-label-txt mt-4">No photos yet — the product needs at least one to publish on the storefront.</p>
      ) : (
        <>
          <p className="u-label mt-5 flex items-center gap-2">Attached photos ({images.length}/{MAX_IMAGES}) <span className="text-dim! font-normal!">— drag the handle to reorder</span></p>
          <ul ref={listRef} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((src, i) => (
              <li
                key={src + i}
                draggable
                onDragStart={(e) => {
                  dragIndexRef.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragIndexRef.current !== null && dragIndexRef.current !== i) to(dragIndexRef.current, i);
                  dragIndexRef.current = null;
                }}
                className={cn("u-media group relative aspect-[4/3]", dragIndexRef.current === i && "opacity-50")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={productName ? `${productName} image ${i + 1}` : `Image ${i + 1}`} className="absolute inset-0 size-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 bg-mint px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                    <Star className="size-3" aria-hidden /> Cover
                  </span>
                )}
                {i > 0 && <span className="u-badge absolute left-2 top-2 bg-ink/80">{i + 1}</span>}
                <div className="absolute inset-x-0 bottom-0 z-10 hidden gap-1 bg-ink/90 p-2 group-hover:flex group-focus-within:flex" aria-label={`Actions for image ${i + 1}`}>
                  {i !== 0 && (
                    <button type="button" onClick={() => setCover(i)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-bone hover:text-yellow" title="Set as cover">
                      <Star className="size-3.5" aria-hidden /> Cover
                    </button>
                  )}
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-6 place-items-center text-bone hover:text-yellow disabled:opacity-30" aria-label="Move earlier">
                    <ArrowLeft className="size-3" aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="grid size-6 place-items-center text-bone hover:text-yellow disabled:opacity-30" aria-label="Move later">
                    <ArrowRight className="size-3" aria-hidden />
                  </button>
                  <button type="button" onClick={() => pickReplace(i)} className="flex items-center gap-1 px-2 py-1 text-[11px] text-bone hover:text-yellow" title="Replace file">
                    <RefreshCcw className="size-3" aria-hidden /> Swap
                  </button>
                  <button type="button" onClick={() => remove(i)} className="flex items-center gap-1 px-2 py-1 text-[11px] text-bone hover:text-red" title="Delete photo">
                    <Trash2 className="size-3" aria-hidden /> Delete
                  </button>
                </div>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 lg:hidden">
                  <button type="button" onClick={() => move(i, -1)} className="grid size-6 place-items-center bg-ink/80 text-white" aria-label="Move earlier"><ArrowUp className="size-3" /></button>
                  <button type="button" onClick={() => move(i, 1)} className="grid size-6 place-items-center bg-ink/80 text-white" aria-label="Move later"><ArrowDown className="size-3" /></button>
                  <button type="button" onClick={() => remove(i)} className="grid size-6 place-items-center bg-ink/80 text-white hover:text-red" aria-label="Delete photo"><X className="size-3" /></button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* URL add — kept for CDN/licensed photography */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="…or paste an image URL (https://…)"
          className="u-input flex-1"
          aria-label="Image URL"
        />
        <button type="button" onClick={addUrl} className="u-btn u-btn-ghost">
          <Link2 className="size-4" aria-hidden /> Add URL
        </button>
      </div>
    </div>
  );
}
