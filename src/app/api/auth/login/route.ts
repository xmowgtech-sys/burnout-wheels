import { getDb, run, nowIso } from "@/lib/db";
import { createSession, verifyPassword, rateLimit, ipOf } from "@/lib/auth";
import { logActivity } from "@/lib/analytics";

export async function POST(req: Request) {
  try {
    if (!rateLimit(`login:${ipOf(req)}`, 10, 10 * 60_000)) {
      return Response.json({ error: "Too many attempts — pit wall cools down for 10 minutes" }, { status: 429 });
    }
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) return Response.json({ error: "Email and password required" }, { status: 422 });

    const db = getDb();
    const user = db
      .prepare("SELECT id, email, passwordHash, name, role, active FROM users WHERE LOWER(email) = ?")
      .get(email) as
      | { id: number; email: string; passwordHash: string; name: string; role: "OWNER" | "ADMIN" | "STAFF"; active: number }
      | undefined;

    if (!user || user.active !== 1) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return Response.json({ error: "Invalid credentials" }, { status: 401 });

    run(db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?"), nowIso(), user.id);
    await createSession(user as never);
    logActivity(user.email, "auth.login", "team", `role=${user.role}`);

    return Response.json({ ok: true, role: user.role, name: user.name });
  } catch {
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
