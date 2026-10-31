import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { createSession, rateLimit, ipOf } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

/** POST — team sign-in for the pit wall. Sessions are JWT cookies, role-checked live on every request. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`tlogin:${ipOf(req)}`, 8, 10 * 60_000)) {
      logEvent({ source: "API", level: "WARN", type: "login_fail", path: "/api/auth/team/login", message: "Team login rate limit hit" });
      return Response.json({ error: "Too many attempts — wait ten minutes." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid email and password." }, { status: 422 });
    const { email, password } = parsed.data;

    const db = getDb();
    const row = db.prepare("SELECT id, email, passwordHash, name, role, active, createdAt, lastLoginAt FROM users WHERE email = ?").get(email.trim().toLowerCase()) as
      | { id: number; email: string; passwordHash: string; name: string; role: "OWNER" | "ADMIN" | "STAFF"; active: number; createdAt: string; lastLoginAt: string | null }
      | undefined;
    if (!row || row.active !== 1) {
      logEvent({ source: "API", level: "WARN", type: "login_fail", path: "/api/auth/team/login", message: "Unknown or inactive account" });
      return Response.json({ error: "Wrong email or password." }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) {
      logEvent({ source: "API", level: "WARN", type: "login_fail", path: "/api/auth/team/login", message: "Bad password" });
      return Response.json({ error: "Wrong email or password." }, { status: 401 });
    }

    await createSession({ id: row.id, email: row.email, name: row.name, role: row.role, active: true, createdAt: row.createdAt, lastLoginAt: row.lastLoginAt });
    db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?").run(new Date().toISOString(), row.id);
    return Response.json({ ok: true });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/team/login", message: err instanceof Error ? err.message : "team login crash" });
    return Response.json({ error: "Sign-in hit a snag. Try again." }, { status: 500 });
  }
}
