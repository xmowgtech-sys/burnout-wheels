import type { NextRequest } from "next/server";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ordersCsv, productsCsv, pnlCsv } from "@/lib/finance";

/** GET ?type=orders|products|pnl — CSV export (finance.view + export perm). */
export async function GET(req: NextRequest) {
  try {
    const me = await requireApiUser();
    if (!can(me.role, "finance.view") || !can(me.role, "export")) {
      return Response.json({ error: "Not allowed for your role" }, { status: 403 });
    }
    const type = req.nextUrl.searchParams.get("type") ?? "orders";
    let csv: string;
    let filename: string;
    if (type === "products") {
      csv = productsCsv();
      filename = "burnout-products.csv";
    } else if (type === "pnl") {
      csv = pnlCsv();
      filename = "burnout-pnl.csv";
    } else {
      csv = ordersCsv();
      filename = "burnout-orders.csv";
    }
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
