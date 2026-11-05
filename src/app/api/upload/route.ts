import type { NextRequest } from "next/server";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { requireApiUser, apiErrorResponse, rateLimit, ipOf, ApiError } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logActivity } from "@/lib/analytics";
import { logEvent } from "@/lib/ops";
import { UPLOADS_DIR } from "@/lib/db";
import { catalogImagePath, catalogStoreMode } from "@/lib/catalog-store";

const ALLOWED = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 12;

/** Magic-byte sniffing — a renamed .txt pretending to be a .jpg fails here, not on the storefront. */
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const webp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  const gif = buf.subarray(0, 3).toString("ascii") === "GIF";
  const ftyp = buf.subarray(4, 8).toString("ascii") === "ftyp"; // AVIF/HEIF container
  if (jpg) return "jpg";
  if (png) return "png";
  if (webp) return "webp";
  if (gif) return "gif";
  if (ftyp) return "avif";
  return null;
}

interface UploadResult {
  name: string;
  ok: boolean;
  url?: string;
  error?: string;
}

/** POST multipart — admin image upload. Per-file results: valid files persist,
 *  invalid ones return an error without poisoning the batch. Failed uploads are
 *  logged to the ops board for the monitoring page. */
export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser("products.manage");

    if (!rateLimit(`upload:${ipOf(req)}`, 60, 5 * 60_000)) {
      logEvent({ source: "API", level: "WARN", type: "upload_fail", path: "/api/upload", message: "Rate limit hit — too many uploads in 5 minutes" });
      throw new ApiError(429, "Too many uploads — wait five minutes and try again.");
    }

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      throw new ApiError(422, "No files were attached — choose at least one image.");
    }
    if (files.length > MAX_FILES) {
      throw new ApiError(413, `Up to ${MAX_FILES} images per batch — split large sets.`);
    }

    mkdirSync(UPLOADS_DIR, { recursive: true });
    const results: UploadResult[] = [];

    for (const file of files) {
      try {
        if (file.size === 0) throw new Error("File is empty (0 KB).");
        if (file.size > MAX_BYTES) throw new Error(`${(file.size / 1024 / 1024).toFixed(1)} MB — over the 10 MB limit. Compress it first.`);
        const buf = Buffer.from(await file.arrayBuffer());
        const kind = sniffImage(buf);
        if (!kind) throw new Error("Not a real image — the file content doesn't match jpg/png/webp/avif/gif (renamed files fail this check).");

        // Trust the sniffed kind over the client-provided extension.
        const name = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${kind}`;
        const contentType = kind === "jpg" ? "image/jpeg" : `image/${kind}`;

        // Save to Blob first: that copy is what survives a cold start. A local
        // copy is still written for immediate serving and for `catalog:publish`.
        if (catalogStoreMode() === "blob") {
          await put(catalogImagePath(name), buf, {
            access: "private",
            addRandomSuffix: false,
            contentType,
            cacheControlMaxAge: 60,
          });
        }
        try {
          mkdirSync(UPLOADS_DIR, { recursive: true });
          writeFileSync(path.join(UPLOADS_DIR, name), buf);
        } catch (err) {
          if (catalogStoreMode() !== "blob") throw err;
          // Blob has the durable copy; the ephemeral local write is optional.
        }
        results.push({ name: file.name, ok: true, url: `/api/files/${name}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        results.push({ name: file.name, ok: false, error: message });
        logEvent({
          source: "API",
          level: "ERROR",
          type: "upload_fail",
          path: "/api/upload",
          message: `${file.name}: ${message}`,
          meta: `actor=${me.email} size=${file.size}`,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      logActivity(me.email, "upload", "files", `${okCount} image(s)`);
      logEvent({ source: "API", level: "INFO", type: "upload", path: "/api/upload", message: `${okCount} image(s) uploaded`, meta: `actor=${me.email}` });
    }
    if (okCount === 0 && results.length > 0) {
      throw new ApiError(422, results.map((r) => `${r.name}: ${r.error}`).join(" | "));
    }
    return Response.json({ results, urls: results.filter((r) => r.ok).map((r) => r.url) }, { status: 201 });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/upload", message: err instanceof Error ? err.message : String(err) });
    return apiErrorResponse(err);
  }
}

/** DELETE ?file=<name> — removes a previously uploaded image (replace/delete controls). */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser("products.manage");
    const url = new URL(req.url);
    const file = url.searchParams.get("file") ?? "";
    if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) {
      return Response.json({ error: "Bad file name" }, { status: 400 });
    }
    const target = path.join(UPLOADS_DIR, file);
    if (!target.startsWith(UPLOADS_DIR)) return Response.json({ error: "Bad file name" }, { status: 400 });
    if (catalogStoreMode() === "blob") {
      try {
        await del(catalogImagePath(file));
      } catch (err) {
        // A missing Blob is fine; the local unlink below is best-effort too.
        if (!String(err instanceof Error ? err.message : err).toLowerCase().includes("not found")) {
          logEvent({ source: "API", level: "WARN", type: "upload_fail", path: "/api/upload", message: `Could not delete Blob ${file}`, meta: `actor=${me.email}` });
        }
      }
    }
    try {
      unlinkSync(target);
      logActivity(me.email, "delete", `file:${file}`, "uploaded image removed");
    } catch (err) {
      // Missing file on an ephemeral FS is fine; anything else is a real failure.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logEvent({ source: "API", level: "WARN", type: "upload_fail", path: "/api/upload", message: `Could not delete ${file}`, meta: `actor=${me.email}` });
      }
    }
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
