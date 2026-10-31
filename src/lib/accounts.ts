import { createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb, nowIso } from "./db";
import type { Account } from "./types";
import { logEvent } from "./ops";

/**
 * Storefront customer accounts — separate from the admin `users` (team) table.
 * Password accounts carry a verified flag; Google-supplied emails arrive verified.
 * Sessions are separate JWT cookies (bw_customer) so team access never mixes with customer access.
 */

export const CUSTOMER_COOKIE = "bw_customer";
const TTL_S = 60 * 60 * 24 * 30;

interface CustomerSession {
  aid: number;
  email: string;
  name: string;
}

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  return new TextEncoder().encode(secret && secret.length >= 24 ? `${secret}:customer` : "burnout-customer-dev-secret-rotate-in-prod-x9q");
}

export async function createCustomerSession(acc: Account): Promise<void> {
  const token = await new SignJWT({ aid: acc.id, email: acc.email, name: acc.name ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_S}s`)
    .sign(key());
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: TTL_S, path: "/" });
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}

export async function readCustomerSession(): Promise<CustomerSession | null> {
  try {
    const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.aid !== "number" || typeof payload.email !== "string") return null;
    return { aid: payload.aid, email: payload.email, name: (payload.name as string) ?? "" };
  } catch {
    return null;
  }
}

export function accountByEmail(email: string): Account | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, email, name, phone, picture, passwordHash, googleId, verified, createdAt, lastLoginAt FROM accounts WHERE email = ?")
    .get(email.trim().toLowerCase()) as
    | { id: number; email: string; name: string | null; phone: string | null; picture: string | null; passwordHash: string | null; googleId: string | null; verified: number; createdAt: string; lastLoginAt: string | null }
    | undefined;
  if (!row) return null;
  return { ...row, verified: row.verified === 1 };
}

export function accountById(id: number): Account | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, email, name, phone, picture, passwordHash, googleId, verified, createdAt, lastLoginAt FROM accounts WHERE id = ?")
    .get(id) as
    | { id: number; email: string; name: string | null; phone: string | null; picture: string | null; passwordHash: string | null; googleId: string | null; verified: number; createdAt: string; lastLoginAt: string | null }
    | undefined;
  if (!row) return null;
  return { ...row, verified: row.verified === 1 };
}

/** Password accounts land unverified; Google accounts land verified (Google did the work). */
export function createAccount(input: { email: string; name?: string; password?: string; phone?: string; googleId?: string; picture?: string; verified?: boolean }): Account {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const ts = nowIso();
  db.prepare("INSERT INTO accounts (email, name, phone, passwordHash, googleId, picture, verified, createdAt) VALUES (?,?,?,?,?,?,?,?)").run(
    email,
    input.name?.trim() || null,
    input.phone?.trim() || null,
    input.password ? bcrypt.hashSync(input.password, 10) : null,
    input.googleId ?? null,
    input.picture ?? null,
    input.verified ? 1 : 0,
    ts
  );
  return accountByEmail(email)!;
}

export function tryGoogleLogin(email: string, googleId: string, profile?: { name?: string; picture?: string }): Account | null {
  const db = getDb();
  const emailN = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM accounts WHERE googleId = ?").get(googleId) as { id: number } | undefined;
  if (existing) {
    if (profile?.name || profile?.picture) {
      db.prepare("UPDATE accounts SET name = COALESCE(NULLIF(name, ''), ?), picture = COALESCE(picture, ?) WHERE id = ?")
        .run(profile.name ?? null, profile.picture ?? null, existing.id);
    }
    touchLogin(existing.id);
    return accountById(existing.id);
  }
  // Attach Google to a matching password account (Google proved the mailbox).
  const byEmail = db.prepare("SELECT id FROM accounts WHERE email = ?").get(emailN) as { id: number } | undefined;
  if (byEmail) {
    db.prepare("UPDATE accounts SET googleId = ?, verified = 1, name = COALESCE(NULLIF(name, ''), ?), picture = COALESCE(picture, ?) WHERE id = ?")
      .run(googleId, profile?.name ?? null, profile?.picture ?? null, byEmail.id);
    touchLogin(byEmail.id);
    return accountById(byEmail.id);
  }
  const acc = createAccount({ email: emailN, name: profile?.name, picture: profile?.picture, googleId, verified: true });
  touchLogin(acc.id);
  return acc;
}

export function verifyPassword(acc: Account, plain: string): boolean {
  if (!acc.passwordHash) return false;
  return bcrypt.compareSync(plain, acc.passwordHash);
}

export function touchLogin(id: number): void {
  const db = getDb();
  db.prepare("UPDATE accounts SET lastLoginAt = ? WHERE id = ?").run(nowIso(), id);
}

/* ---------- one-time tokens (verification / reset) ---------- */

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Issues a one-time token. Stores only the SHA-256 — a leaked DB row can't mint a link. */
export function issueToken(email: string, kind: "VERIFY" | "RESET", ttlMs: number): string {
  const db = getDb();
  const raw = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO authTokens (email, kind, token, expiresAt) VALUES (?,?,?,?)").run(
    email.trim().toLowerCase(),
    kind,
    hashToken(raw),
    new Date(Date.now() + ttlMs).toISOString()
  );
  return raw;
}

export function consumeToken(raw: string, kind: "VERIFY" | "RESET"): string | null {
  const db = getDb();
  const row = db.prepare("SELECT email, expiresAt, usedAt FROM authTokens WHERE token = ? AND kind = ?").get(hashToken(raw), kind) as
    | { email: string; expiresAt: string; usedAt: string | null }
    | undefined;
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return null;
  db.prepare("UPDATE authTokens SET usedAt = ? WHERE token = ? AND kind = ?").run(nowIso(), hashToken(raw), kind);
  return row.email;
}

/** 6-digit OTP for email verification — hashed at rest, 10 minute TTL, single-use. */
export function issueOtp(email: string): string {
  const db = getDb();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  db.prepare("INSERT INTO authTokens (email, kind, token, expiresAt) VALUES (?,?,?,?)").run(
    email.trim().toLowerCase(),
    "OTP",
    hashToken(code),
    new Date(Date.now() + 10 * 60_000).toISOString()
  );
  return code;
}

export function consumeOtp(raw: string): string | null {
  const db = getDb();
  const token = hashToken(raw.trim());
  const row = db.prepare("SELECT email, expiresAt, usedAt FROM authTokens WHERE token = ? AND kind = 'OTP'").get(token) as
    | { email: string; expiresAt: string; usedAt: string | null }
    | undefined;
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return null;
  db.prepare("UPDATE authTokens SET usedAt = ? WHERE token = ? AND kind = 'OTP'").run(nowIso(), token);
  return row.email;
}

export function setPassword(email: string, password: string): void {
  const db = getDb();
  db.prepare("UPDATE accounts SET passwordHash = ?, verified = 1 WHERE email = ?").run(bcrypt.hashSync(password, 10), email.trim().toLowerCase());
}

/** Profile edits — name + phone. Returns the fresh row. Email and identity fields are never editable here. */
export function updateProfile(email: string, input: { name?: string; phone?: string }): Account | null {
  const db = getDb();
  const sets: string[] = [];
  const params: string[] = [];
  if (typeof input.name === "string" && input.name.trim()) {
    sets.push("name = ?");
    params.push(input.name.trim().slice(0, 60));
  }
  if (typeof input.phone === "string") {
    sets.push("phone = ?");
    params.push(input.phone.trim().slice(0, 20) || "");
  }
  if (sets.length === 0) return accountByEmail(email);
  params.push(email.trim().toLowerCase());
  db.prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE email = ?`).run(...params);
  return accountByEmail(email);
}

/** Full account deletion: profile + pending tokens. Orders stay for accounting (they reference email/history only). */
export function deleteAccount(email: string): void {
  const db = getDb();
  const emailN = email.trim().toLowerCase();
  db.prepare("DELETE FROM authTokens WHERE email = ?").run(emailN);
  db.prepare("DELETE FROM accounts WHERE email = ?").run(emailN);
}

export function nameOrigin(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

void logEvent;
