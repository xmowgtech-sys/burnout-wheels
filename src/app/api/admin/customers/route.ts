import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { listCustomers, getCustomerDetail, updateCustomerNotes } from "@/lib/orders";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";

/** GET — list customers or get single customer detail ?id= or ?email= */
export async function GET(req: NextRequest) {
  try {
    await requireApiUser("customers.view");
    const id = req.nextUrl.searchParams.get("id");
    const email = req.nextUrl.searchParams.get("email");
    const q = req.nextUrl.searchParams.get("q") ?? undefined;

    if (id || email) {
      const detail = getCustomerDetail(id ? Number(id) : email!);
      if (!detail) return Response.json({ error: "Customer not found" }, { status: 404 });
      return Response.json({ customer: detail });
    }

    const customers = listCustomers(q);
    return Response.json({ customers });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH ?id= — update customer notes or status */
export async function PATCH(req: NextRequest) {
  try {
    await requireApiUser("orders.manage");
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const body = (await req.json()) as { notes?: string; status?: string };
    if (body.notes === undefined && body.status === undefined) {
      return Response.json({ error: "Nothing to update" }, { status: 422 });
    }

    updateCustomerNotes(id, body.notes ?? "", body.status);
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${id}`);

    const detail = getCustomerDetail(id);
    return Response.json({ customer: detail, message: "Customer updated successfully" });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
