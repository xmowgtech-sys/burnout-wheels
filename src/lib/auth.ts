import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";
import type { Role, TeamUser } from "./types";
import type { Perm } from "./permissions";
import { can } from "./permissions";

export const SESSION_COOKIE = "bw_session";
const SESSION_TTL_S = 60 * 60 * 24 * 7;

interface SessionPayload {
  uid: number;
  name: string;
  email: string;
  role: Role;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    console.warn("[burnout] SESSION_SECRET missing/short — using a dev-only fallback. Set it in .env.");
    return new TextEncoder().encode("burnout-dev-secret-do-not-use-in-prod-rotate-me");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: TeamUser): Promise<void> {
  const token = await new SignJWT({ uid: user.id, name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_S,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secretKey());
    const { uid, name, email, role } = payload as unknown as SessionPayload;
    if (typeof uid !== "number" || !name || !email) return null;
    return { uid, name, email, role };
  } catch {
    return null;
  }
}

/** Read the session without depending on request cookies (for API routes that receive Request objects). */
export function sessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!raw) return Promise.resolve(null);
  return jwtVerify(raw, secretKey())
    .then(({ payload }) => {
      const { uid, name, email, role } = payload as unknown as SessionPayload;
      if (typeof uid !== "number") return null;
      return { uid, name, email, role } satisfies SessionPayload;
    })
    .catch(() => null);
}

/** Fresh DB-backed user (role/active checked on every call — kickout is instant). */
export async function currentUser(): Promise<TeamUser | null> {
  const session = await readSession();
  if (!session) return null;
  const db = getDb();
  const row = db.prepare("SELECT id, email, name, role, active, createdAt, lastLoginAt FROM users WHERE id = ?").get(session.uid) as
    | { id: number; email: string; name: string; role: Role; active: number; createdAt: string; lastLoginAt: string | null }
    | undefined;
  if (!row || row.active !== 1) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, active: true, createdAt: row.createdAt, lastLoginAt: row.lastLoginAt };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** For API route handlers: 401/403 unless the caller holds every `perms`. */
export async function requireApiUser(...perms: Perm[]): Promise<TeamUser> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Not signed in");
  for (const perm of perms) {
    if (!can(user.role, perm)) throw new ApiError(403, "Your role does not allow this action");
  }
  return user;
}

export function apiErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("[burnout] api error:", err);
  return Response.json({ error: "Something went sideways in the pit lane. Try again." }, { status: 500 });
}

/* ---- in-memory rate limit (single-instance friendly) ---- */
const buckets = new Map<string, { n: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}

export function ipOf(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local"
  );
}
