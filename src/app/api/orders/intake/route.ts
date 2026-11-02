import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { intakeOrder } from "@/lib/orders";
import { requireApiUser, apiErrorResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const me = await requireApiUser("orders.manage");
    const body = (await req.json()) as {
      orderNumber?: string;
      name?: string;
      email?: string;
      phone?: string;
      total?: number;
      channel?: "DISCORD" | "WHATSAPP";
      status?: string;
      notes?: string;
    };

    if (!body.orderNumber || !body.orderNumber.trim()) {
      return Response.json({ error: "Order number is required." }, { status: 400 });
    }

    const order = intakeOrder({
      orderNumber: body.orderNumber,
      name: body.name,
      email: body.email,
      phone: body.phone,
      total: body.total,
      paymentChannel: body.channel,
      status: (body.status as never) || "PAID",
      notes: body.notes,
      actor: me.email,
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath("/shop");
    revalidatePath("/");

    return Response.json({ ok: true, order }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
