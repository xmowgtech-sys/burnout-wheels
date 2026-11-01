import { destroyCustomerSession } from "@/lib/accounts";
import { destroySession } from "@/lib/auth";

/**
 * POST — clears customer AND team sessions (one endpoint used by store + admin).
 * Plain form posts (Accept: text/html) get a 303 redirect to the home page;
 * fetch() callers get JSON and navigate themselves.
 */
export async function POST(req: Request) {
  await destroyCustomerSession();
  await destroySession();
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(null, { status: 303, headers: { location: "/" } });
  }
  return Response.json({ ok: true, redirect: "/" });
}
