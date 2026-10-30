import { NextResponse, type NextRequest } from "next/server";
import { getDb, run, nowIso } from "@/lib/db";
import { requireApiUser, apiErrorResponse, hashPassword } from "@/lib/auth";
import { teamCreateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/analytics";
import type { Role } from "@/lib/permissions";

type UserRow = { id: number; email: string; name: string; role: string; active: number; lastLoginAt: string | null; createdAt: string };

/** GET — team roster (team.manage, OWNER only in practice via permissions). */
export async function GET() {
  try {
    await requireApiUser("team.manage");
    const rows = (getDb().prepare("SELECT id, email, name, role, active, lastLoginAt, createdAt FROM users ORDER BY id ASC").all() as UserRow[])
      .map((u) => ({ ...u, active: u.active === 1 }));
    return Response.json({ team: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST — invite a teammate (team.manage). */
export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser("team.manage");
    const parsed = teamCreateSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid member" }, { status: 422 });
    const db = getDb();
    const email = parsed.data.email.toLowerCase();
    if (db.prepare("SELECT 1 FROM users WHERE LOWER(email) = ?").get(email)) {
      return Response.json({ error: "That email is already on the team" }, { status: 409 });
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const role: Role = parsed.data.role;
    const info = run(
      db.prepare("INSERT INTO users (email, passwordHash, name, role, active, createdAt, lastLoginAt) VALUES (?,?,?,?,1,?,?)"),
      email, passwordHash, parsed.data.name, role, nowIso(), null
    );
    logActivity(me.email, "team.create", "team", `${email} as ${role}`);
    return Response.json({ ok: true, id: info.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — toggle active / change role (team.manage). */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireApiUser("team.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    const body = (await req.json()) as { active?: boolean; role?: Role };
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    if (id === me.id) return Response.json({ error: "You can't change your own access — ask another owner" }, { status: 422 });
    const db = getDb();
    const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id) as { id: number; role: string } | undefined;
    if (!target) return Response.json({ error: "Member not found" }, { status: 404 });
    if (target.role === "OWNER" && (body.active === false || (body.role && body.role !== "OWNER"))) {
      return Response.json({ error: "Owners can't be demoted or deactivated" }, { status: 422 });
    }
    if (typeof body.active === "boolean") run(db.prepare("UPDATE users SET active = ? WHERE id = ?"), body.active ? 1 : 0, id);
    if (body.role) run(db.prepare("UPDATE users SET role = ? WHERE id = ?"), body.role, id);
    logActivity(me.email, "team.update", "team", `#${id}`);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE ?id= — remove a member (team.manage). Owners are protected. */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireApiUser("team.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    if (id === me.id) return Response.json({ error: "You can't remove yourself" }, { status: 422 });
    const db = getDb();
    const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: string } | undefined;
    if (!target) return Response.json({ error: "Member not found" }, { status: 404 });
    if (target.role === "OWNER") return Response.json({ error: "Owners can't be removed" }, { status: 422 });
    run(db.prepare("DELETE FROM users WHERE id = ?"), id);
    logActivity(me.email, "team.delete", "team", `#${id}`);
    return Response.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

void NextResponse;
