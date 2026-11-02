import { adminGetOrder } from "@/lib/orders";
import { AdminOrderDetailView, AdminOrderDetailClient } from "@/components/admin/order-detail-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order · Pit wall", robots: { index: false } };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = adminGetOrder(id);

  if (order) {
    return <AdminOrderDetailView order={order} />;
  }

  // Resilient fallback: Serverless Lambdas on Vercel run in isolated instances.
  // Instead of throwing notFound() and rendering a 404 page, the client component
  // resolves the order from browser storage, renders all details & actions, and syncs
  // the order back into the server's SQLite database automatically.
  return <AdminOrderDetailClient fallbackId={id} />;
}
