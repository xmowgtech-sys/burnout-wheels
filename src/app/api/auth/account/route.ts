import { readCustomerSession, deleteAccount, destroyCustomerSession, accountById, accountByEmail, createAccount } from "@/lib/accounts";
import { rateLimit } from "@/lib/auth";
import { logEvent } from "@/lib/ops";

/** GET — returns the signed-in customer account (id, email, name, picture, verified). */
export async function GET() {
  try {
    const session = await readCustomerSession();
    if (!session) return Response.json({ authenticated: false });
    let acc = accountById(session.aid) ?? accountByEmail(session.email);
    if (!acc) {
      try {
        acc = createAccount({
          email: session.email,
          name: session.name || undefined,
          picture: session.picture ?? undefined,
          verified: true,
        });
      } catch {
        acc = accountByEmail(session.email);
      }
    }

    return Response.json({
      authenticated: true,
      account: {
        id: acc?.id ?? session.aid,
        email: acc?.email ?? session.email,
        name: acc?.name ?? session.name,
        phone: acc?.phone ?? null,
        picture: acc?.picture ?? session.picture ?? null,
        verified: acc?.verified ?? true,
      },
    });
  } catch {
    return Response.json({ authenticated: false });
  }
}

/** DELETE — permanently delete the signed-in customer account.
 *  Removes the profile + verification tokens; past orders stay purely for accounting
 *  and the session cookie is cleared, ending access immediately. */
export async function DELETE() {
  try {
    const session = await readCustomerSession();
    if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
    if (!rateLimit(`acct-del:${session.email}`, 3, 60 * 60_000)) {
      return Response.json({ error: "Too many requests — wait an hour." }, { status: 429 });
    }

    deleteAccount(session.email);
    await destroyCustomerSession();
    logEvent({ source: "API", level: "WARN", type: "account_delete", path: "/api/auth/account", message: `Customer deleted account (${session.email})` });
    return Response.json({ ok: true });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/auth/account", message: err instanceof Error ? err.message : "account deletion crash" });
    return Response.json({ error: "Deletion hit a snag. Try again." }, { status: 500 });
  }
}
