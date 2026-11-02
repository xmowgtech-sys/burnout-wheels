import type { NextRequest } from "next/server";
import { z } from "zod";
import { readCustomerSession, accountByEmail, accountById } from "@/lib/accounts";
import {
  listCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "@/lib/addresses";

const addressSchema = z.object({
  id: z.number().optional(),
  label: z.string().trim().max(30).optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z.string().trim().min(7, "Phone number is too short").max(20),
  addressLine: z.string().trim().min(5, "Address line is too short").max(200),
  city: z.string().trim().min(2, "City is required").max(60),
  state: z.string().trim().min(2, "State is required").max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  country: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});

async function requireCustomer() {
  const session = await readCustomerSession();
  if (!session) return null;
  const acc = accountById(session.aid) ?? accountByEmail(session.email);
  return acc ?? { id: session.aid, email: session.email };
}

/** GET — returns customer's saved addresses */
export async function GET() {
  const customer = await requireCustomer();
  if (!customer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const addresses = listCustomerAddresses(customer.id);
  return Response.json({ addresses });
}

/** POST — create or update a saved address */
export async function POST(req: NextRequest) {
  const customer = await requireCustomer();
  if (!customer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid address data" }, { status: 422 });
  }

  if (parsed.data.id) {
    const updated = updateCustomerAddress(parsed.data.id, customer.id, parsed.data);
    if (!updated) return Response.json({ error: "Address not found" }, { status: 404 });
    return Response.json({ address: updated });
  }

  const created = createCustomerAddress(customer.id, parsed.data);
  return Response.json({ address: created }, { status: 201 });
}

/** PATCH ?id=&action=default — set default address */
export async function PATCH(req: NextRequest) {
  const customer = await requireCustomer();
  if (!customer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "id parameter required" }, { status: 400 });

  const success = setDefaultCustomerAddress(id, customer.id);
  if (!success) return Response.json({ error: "Address not found" }, { status: 404 });

  return Response.json({ ok: true });
}

/** DELETE ?id= — delete a saved address */
export async function DELETE(req: NextRequest) {
  const customer = await requireCustomer();
  if (!customer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return Response.json({ error: "id parameter required" }, { status: 400 });

  const success = deleteCustomerAddress(id, customer.id);
  if (!success) return Response.json({ error: "Address not found" }, { status: 404 });

  return Response.json({ ok: true });
}
