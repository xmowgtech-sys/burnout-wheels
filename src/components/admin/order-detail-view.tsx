"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderActions } from "@/components/admin/order-rows";
import { OrderDetailContent } from "@/components/admin/order-detail-content";
import type { OrderWithRelations } from "@/lib/types";

export function AdminOrderDetailView({ order }: { order: OrderWithRelations }) {
  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/orders"
        className="self-start text-xs text-fog hover:text-white transition-colors inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="size-3" /> Back to Orders
      </Link>
      <OrderDetailContent order={order} actions={<OrderActions order={order} />} />
    </div>
  );
}
