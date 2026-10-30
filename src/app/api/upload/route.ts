import type { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logActivity } from "@/lib/analytics";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const MAX_BYTES = 10 * 1024 * 1024;

/** POST multipart — admin image upload to data/uploads (products.manage). */
export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser();
    if (!can(me.role, "products.manage")) return Response.json({ error: "Not allowed for your role" }, { status: 403 });
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return Response.json({ error: "No files sent" }, { status: 422 });

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) return Response.json({ error: `${file.name} is over 10MB` }, { status: 413 });
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED.has(ext)) return Response.json({ error: `${file.name}: only jpg, png, webp, avif, gif` }, { status: 415 });
      const name = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      writeFileSync(path.join(UPLOAD_DIR, name), buf);
      urls.push(`/api/files/${name}`);
    }
    logActivity(me.email, "upload", "files", `${urls.length} file(s)`);
    return Response.json({ urls }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
