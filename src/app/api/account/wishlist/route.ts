import type { NextRequest } from "next/server";
import { readCustomerSession } from "@/lib/accounts";
import { getAccountWishlist, toggleAccountWishlist, syncAccountWishlist, removeAccountWishlist } from "@/lib/wishlist";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { logEvent } from "@/lib/ops";

export async function GET() {
  try {
    const session = await readCustomerSession();
    if (!session) {
      return Response.json({ authenticated: false, items: [] });
    }
    await ensureCatalogHydrated();
    const items = getAccountWishlist(session.aid);
    return Response.json({ authenticated: true, items });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/account/wishlist", message: err instanceof Error ? err.message : "wishlist get fail" });
    return Response.json({ authenticated: false, items: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await readCustomerSession();
    if (!session) {
      return Response.json({ authenticated: false, items: [] });
    }

    await ensureCatalogHydrated();
    const body = (await req.json().catch(() => ({}))) as {
      action?: "toggle" | "sync" | "remove";
      productId?: number;
      productIds?: number[];
    };

    if (body.action === "sync" && Array.isArray(body.productIds)) {
      const items = syncAccountWishlist(session.aid, body.productIds);
      return Response.json({ authenticated: true, items });
    }

    if (body.action === "remove" && typeof body.productId === "number") {
      const items = removeAccountWishlist(session.aid, body.productId);
      return Response.json({ authenticated: true, items });
    }

    if (typeof body.productId === "number") {
      const result = toggleAccountWishlist(session.aid, body.productId);
      return Response.json({ authenticated: true, added: result.added, items: result.items });
    }

    return Response.json({ authenticated: true, items: getAccountWishlist(session.aid) });
  } catch (err) {
    logEvent({ source: "API", level: "ERROR", type: "api_fail", path: "/api/account/wishlist", message: err instanceof Error ? err.message : "wishlist post fail" });
    return Response.json({ error: "Wishlist update failed." }, { status: 500 });
  }
}
