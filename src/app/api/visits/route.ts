import { bumpVisit } from "@/lib/analytics";

/** POST — once per browser session the storefront pings this to grow the visits counter. */
export async function POST() {
  try {
    bumpVisit();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
