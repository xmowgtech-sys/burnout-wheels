import Link from "next/link";
import { adminFindOrderExact } from "@/lib/orders";
import { hydrateOrderByNumber } from "@/lib/order-store";
import { AdminOrderDetailView } from "@/components/admin/order-detail-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order · Pit wall", robots: { index: false } };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await hydrateOrderByNumber(id, { refresh: true });
  const order = adminFindOrderExact(id);

  if (order) {
    return <AdminOrderDetailView order={order} />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Order not found</h1>
      <p className="text-sm text-fog">
        No order with reference <span className="font-mono text-bone">{id}</span> exists in the
        Pit Wall. It may have been deleted — use the Orders list to find the live record.
      </p>
      <Link href="/admin/orders" className="u-btn u-btn-primary">
        Back to Orders
      </Link>
    </div>
  );
}
