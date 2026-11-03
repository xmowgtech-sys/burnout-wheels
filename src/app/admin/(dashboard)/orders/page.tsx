import Link from "next/link";
import { OrdersTable } from "@/components/admin/order-rows";
import { adminListOrders } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders · Pit wall", robots: { index: false } };

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "PAYMENT_REVIEW", label: "Awaiting Acceptance" },
  { key: "PENDING_PAYMENT", label: "Awaiting payment" },
  { key: "PAID", label: "Accepted & Paid" },
  { key: "PROCESSING", label: "Processing" },
  { key: "PACKING", label: "Packing" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ARCHIVED", label: "Archived (Soft-Deleted)" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    fulfilmentStatus?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as OrderStatus | "ALL" | "ARCHIVED" | undefined) ?? "ALL";
  const q = sp.q ?? "";
  const paymentMethod = sp.paymentMethod ?? "ALL";
  const paymentStatus = sp.paymentStatus ?? "ALL";
  const fulfilmentStatus = sp.fulfilmentStatus ?? "ALL";

  const orders = adminListOrders({
    status,
    q: q || undefined,
    paymentMethod,
    paymentStatus,
    fulfilmentStatus,
    includeArchived: status === "ARCHIVED",
  });
  const pendingAcceptanceCount = orders.filter((o) => (o.status === "PAYMENT_REVIEW" || o.status === "PENDING_PAYMENT") && !o.isArchived).length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Fulfilment</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Orders</h1>
      </header>

      {/* Notice for new orders awaiting acceptance */}
      {pendingAcceptanceCount > 0 && (
        <div className="border border-yellow/50 bg-yellow/[0.06] p-4 flex flex-wrap items-center justify-between gap-3 rounded">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-yellow/20 text-yellow font-black text-sm">
              {pendingAcceptanceCount}
            </span>
            <div>
              <p className="text-sm font-bold text-white">
                {pendingAcceptanceCount} Order{pendingAcceptanceCount > 1 ? "s" : ""} Awaiting Your Acceptance
              </p>
              <p className="text-xs text-fog mt-0.5">
                Triggered automatically by customer checkout. Verify payment screenshot or note on Discord/WhatsApp, then click &quot;Accept Order&quot; below.
              </p>
            </div>
          </div>
          <Link
            href="/admin/orders?status=PAYMENT_REVIEW"
            className="u-btn u-btn-primary bg-yellow! text-ink! text-xs font-bold px-3! py-1.5!"
          >
            Filter Pending Acceptance →
          </Link>
        </div>
      )}

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

      <OrdersTable
        orders={orders}
        initialStatus={status}
        initialQ={q}
        initialPaymentMethod={paymentMethod}
        initialPaymentStatus={paymentStatus}
        initialFulfilmentStatus={fulfilmentStatus}
      />
    </div>
  );
}
