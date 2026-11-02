import Link from "next/link";
import { OrdersTable, OrderIntakeCard } from "@/components/admin/order-rows";
import { adminListOrders } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders · Pit wall", robots: { index: false } };

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "PENDING_PAYMENT", label: "Awaiting payment" },
  { key: "PAYMENT_REVIEW", label: "Payment review" },
  { key: "PAID", label: "Paid" },
  { key: "PACKING", label: "Packing" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = (sp.status as OrderStatus | "ALL" | undefined) ?? "ALL";
  const q = sp.q ?? "";
  const orders = adminListOrders({ status: status === "ALL" ? "ALL" : (status as OrderStatus), q: q || undefined });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Fulfilment</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Orders</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/orders?status=${f.key}` : "/admin/orders"}
            data-active={(status === "ALL" && f.key === "") || status === f.key}
            className="u-chip"
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form method="GET" action="/admin/orders" className="flex gap-2">
        {status !== "ALL" && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search number, name, email…" className="u-input max-w-xs" aria-label="Search orders" />
        <button className="u-btn u-btn-ghost">Search</button>
      </form>

      <OrderIntakeCard />

      <p className="u-label-txt">{orders.length} orders shown</p>

      {orders.length === 0 ? (
        <p className="u-card px-6 py-12 text-center u-label-txt">Nothing at this filter. New orders surface the second checkout lands.</p>
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}
