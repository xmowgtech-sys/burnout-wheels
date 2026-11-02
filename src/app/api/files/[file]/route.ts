import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
};

/** GET — serve an uploaded file from the resolved uploads dir (works on any FS, incl. /tmp on serverless). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Strip any path traversal — only simple names allowed.
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) {
    return new Response("Bad request", { status: 400 });
  }
  const ext = path.extname(file).toLowerCase();
  if (!TYPES[ext]) return new Response("Unsupported", { status: 415 });
  // Uploaded files live in the writable data dir. Bundled demo images also ship
  // in public/uploads so a cold serverless start (/tmp is empty) still has them.
  const candidates = [
    path.join(UPLOADS_DIR, file),
    // Bundled demo images ship in both data/uploads (repo checkout) and
    // public/uploads (deployment). data/ is gitignored but still present locally.
    path.join(process.cwd(), "data", "uploads", file),
    path.join(process.cwd(), "public", "uploads", file),
  ];
  for (const candidate of candidates) {
    try {
      const buf = await readFile(candidate);
      return new Response(new Uint8Array(buf), {
        headers: {
          "content-type": TYPES[ext],
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // try the next location
    }
  }
  return new Response("Not found", { status: 404 });
}
