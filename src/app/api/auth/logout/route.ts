import { destroyCustomerSession } from "@/lib/accounts";
import { destroySession } from "@/lib/auth";

/** POST — clears customer AND team sessions (one endpoint used by store + admin). */
export async function POST() {
  await destroyCustomerSession();
  await destroySession();
  return Response.json({ ok: true });
}
