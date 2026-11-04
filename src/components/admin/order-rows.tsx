"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  RefreshCw,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  Truck,
  Package,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StatusBadge, ConfirmDialog } from "@/components/admin/admin-ui";
import { fmtUSD, fmtDate } from "@/lib/money";
import type { OrderWithRelations, OrderStatus, OpsEvent, SyncLog } from "@/lib/types";

/* -------------------------------------------------------------
 * Order Actions Component (used in Order Detail Page)
 * ------------------------------------------------------------- */
export function OrderActions({ order }: { order: OrderWithRelations }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [trackingC, setTrackingC] = useState("");
  const [trackingN, setTrackingN] = useState("");
  const [shipAwb, setShipAwb] = useState(order.shiprocketAwb ?? "");
  const [shipOrderId, setShipOrderId] = useState(order.shiprocketOrderId ?? "");
  const [shipLabelUrl, setShipLabelUrl] = useState(order.shiprocketLabelUrl ?? "");

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showFeedback = (msg: string, isErr = false) => {
    if (isErr) {
      setErr(msg);
      setSuccess("");
    } else {
      setSuccess(msg);
      setErr("");
      setTimeout(() => setSuccess(""), 4000);
    }
  };

  const patch = async (body: Record<string, unknown>, successNote?: string) => {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(order.number)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Update failed");
      showFeedback(successNote || data.message || "Order updated successfully!");
      router.refresh();
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Update failed", true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(order.number)}&hard=true`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      router.push("/admin/orders");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Delete failed", true);
      setBusy(false);
    }
  };

  const saveShiprocket = () => {
    patch(
      {
        shiprocketAwb: shipAwb,
        shiprocketOrderId: shipOrderId,
        shiprocketLabelUrl: shipLabelUrl,
        trackingCarrier: "Shiprocket",
        trackingNumber: shipAwb,
      },
      "Shiprocket details saved and linked!"
    );
  };

  const saveManualCourier = () => {
    if (!trackingC && !trackingN) return;
    patch(
      { trackingCarrier: trackingC, trackingNumber: trackingN },
      "Courier and tracking number saved!"
    );
  };

  const isArchived = Boolean(order.isArchived);

  return (
    <div className="flex flex-col gap-5">
      {/* Feedback Banners */}
      {err && (
        <div role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red rounded flex items-center justify-between">
          <span>{err}</span>
          <button type="button" onClick={() => setErr("")} className="text-red font-bold ml-2">×</button>
        </div>
      )}
      {success && (
        <div role="status" className="border border-mint bg-mint/10 px-4 py-3 text-[13px] text-mint rounded flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Check className="size-4" /> {success}
          </span>
          <button type="button" onClick={() => setSuccess("")} className="text-mint font-bold ml-2">×</button>
        </div>
      )}

      {/* Archived Notice */}
      {isArchived && (
        <div className="rounded border border-yellow/50 bg-yellow/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-yellow flex items-center gap-1.5">
            <Archive className="size-4" /> Order is Archived (Soft-Deleted)
          </p>
          <p className="text-[12px] text-fog mt-1">
            This order is archived and hidden from default active order lists. All audit records remain intact.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmRestore(true)}
            className="u-btn u-btn-primary mt-3 text-xs bg-yellow! text-ink! font-bold flex items-center gap-1.5"
          >
            <RotateCcw className="size-3.5" /> Restore Order to Active Lists
          </button>
        </div>
      )}

      {/* Fulfilment & Status Actions */}
      <div className="u-card p-5">
        <p className="u-label">Fulfilment &amp; Order Status</p>
        {order.paymentChannel && (
          <p className="mt-2 text-[12px] font-semibold text-mint">
            Payment route: {order.paymentChannel === "DISCORD" ? "Discord (#billing channel)" : "WhatsApp direct message"}
          </p>
        )}
        {order.status === "PENDING_PAYMENT" && (
          <p className="u-label-txt mt-2">
            {order.paymentMethod === "UPI"
              ? `Awaiting customer payment via ${order.paymentChannel ?? "Discord/WhatsApp"}. Confirm once payment lands.`
              : "COD order — confirm after ₹200 online advance lands."}
          </p>
        )}
        {order.status === "PAYMENT_REVIEW" && (
          <div className="mt-3 border-l-2 border-sky bg-sky/5 p-3">
            <p className="text-[13px] font-semibold text-sky">Payment screenshot submitted by customer — ready to accept</p>
            <p className="u-label-txt mt-1">
              Check {order.paymentChannel === "DISCORD" ? "Discord #billing" : "WhatsApp"} for Order #{order.number}. Click below to confirm.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {/* Quick Primary Accept */}
          {/* Quick Primary Accept */}
          {(order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_REVIEW") && (
            <button
              disabled={busy}
              onClick={() => patch({ to: "PAID", note: "Accepted & confirmed by operator" }, "Order accepted and stock confirmed!")}
              className="u-btn u-btn-primary bg-mint! text-ink! font-bold"
            >
              ✓ Accept &amp; Confirm Order
            </button>
          )}

          {(order.status === "PAID" || order.status === "PAYMENT_REVIEW" || order.status === "PACKING") && (
            <button
              disabled={busy}
              onClick={() => patch({ to: "PROCESSING", note: "Order moved to processing" }, "Marked as Processing!")}
              className="u-btn u-btn-primary bg-sky/20! border-sky! text-sky! font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Mark Processing
            </button>
          )}

          {(order.status === "PAID" || order.status === "PROCESSING") && (
            <button
              disabled={busy}
              onClick={() => patch({ to: "PACKING", note: "Order moved to packing station" }, "Marked as Packing!")}
              className="u-btn u-btn-primary font-bold flex items-center gap-1.5"
            >
              <Package className="size-3.5" /> Mark Packed (Packing)
            </button>
          )}

          {(order.status === "PAID" || order.status === "PROCESSING" || order.status === "PACKING") && (
            <button
              disabled={busy}
              onClick={() =>
                patch(
                  {
                    to: "SHIPPED",
                    note: "Order dispatched to courier",
                    trackingCarrier: trackingC || order.trackingCarrier || "Shiprocket",
                    trackingNumber: trackingN || order.trackingNumber || shipAwb || "",
                  },
                  "Marked as Shipped!"
                )
              }
              className="u-btn u-btn-primary bg-sky! text-ink! font-bold flex items-center gap-1.5"
            >
              <Truck className="size-3.5" /> Mark Shipped (Dispatched)
            </button>
          )}

          {order.status === "SHIPPED" && (
            <button
              disabled={busy}
              onClick={() => patch({ to: "DELIVERED", note: "Confirmed delivered to customer" }, "Marked as Delivered!")}
              className="u-btn u-btn-primary bg-mint! text-ink! font-bold flex items-center gap-1.5"
            >
              <Check className="size-3.5" /> Mark Delivered
            </button>
          )}

          {/* Cancellation button */}
          {order.status !== "CANCELLED" && order.status !== "REFUNDED" && order.status !== "DELIVERED" && (
            <button
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
              className="u-btn u-btn-ghost text-xs text-red hover:bg-red/10"
            >
              Cancel Order…
            </button>
          )}

          {/* Refund button */}
          {order.status !== "REFUNDED" && (order.status === "PAID" || order.status === "PACKING" || order.status === "SHIPPED" || order.status === "DELIVERED") && (
            <button
              disabled={busy}
              onClick={() => setConfirmRefund(true)}
              className="u-btn u-btn-danger text-xs"
            >
              Refund Order…
            </button>
          )}
        </div>
      </div>

      {/* Shiprocket Fulfilment Card */}
      <div className="u-card p-5">
        <div className="flex items-center justify-between">
          <p className="u-label">Shiprocket Fulfilment</p>
          <a
            href="https://app.shiprocket.in/orders"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-red underline underline-offset-2 hover:text-white flex items-center gap-1"
          >
            <span>Open Shiprocket</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
        <p className="u-label-txt mt-1">Dispatch parcel using Shiprocket with customer delivery address.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="u-label-txt">Shiprocket AWB Number</span>
            <input
              value={shipAwb}
              onChange={(e) => setShipAwb(e.target.value)}
              placeholder="e.g. 143256789012"
              className="u-input mt-1.5"
            />
          </label>
          <label className="block">
            <span className="u-label-txt">Shiprocket Order ID</span>
            <input
              value={shipOrderId}
              onChange={(e) => setShipOrderId(e.target.value)}
              placeholder="e.g. SR-892147"
              className="u-input mt-1.5"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="u-label-txt">Shipping Label / Tracking Link (optional)</span>
            <input
              value={shipLabelUrl}
              onChange={(e) => setShipLabelUrl(e.target.value)}
              placeholder="https://shiprocket.co/tracking/..."
              className="u-input mt-1.5"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button disabled={busy} onClick={saveShiprocket} className="u-btn u-btn-primary">
            {busy ? "Saving…" : "Save Shiprocket Info"}
          </button>
          {order.shiprocketAwb ? (
            <span className="u-mono text-[12px] text-mint">AWB: {order.shiprocketAwb}</span>
          ) : null}
        </div>
      </div>

      {/* Manual Courier / Tracking */}
      <div className="u-card p-5">
        <p className="u-label">Manual Tracking / Courier</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block flex-1 min-w-40">
            <span className="u-label-txt">Carrier</span>
            <input
              value={trackingC}
              onChange={(e) => setTrackingC(e.target.value)}
              placeholder={order.trackingCarrier ?? "Shiprocket / Delhivery / BlueDart"}
              className="u-input mt-1.5"
            />
          </label>
          <label className="block flex-1 min-w-40">
            <span className="u-label-txt">Tracking number</span>
            <input
              value={trackingN}
              onChange={(e) => setTrackingN(e.target.value)}
              placeholder={order.trackingNumber ?? "AWB…"}
              className="u-input mt-1.5"
            />
          </label>
          <button disabled={busy} onClick={saveManualCourier} className="u-btn u-btn-ghost">
            Save Courier
          </button>
        </div>
        {order.trackingNumber ? (
          <p className="u-label-txt mt-2 text-mint">
            Current: {order.trackingCarrier || "Courier"} · {order.trackingNumber}
          </p>
        ) : null}
      </div>

      {/* Archive / Delete Section */}
      <div className="u-card p-5 border-dashed">
        <p className="u-label text-dim">Order Management &amp; Storage</p>
        <p className="text-[12px] text-fog mt-1">
          Soft-deleting archives the order and keeps full audit history. It can be viewed under &quot;Archived&quot; and restored safely.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!isArchived ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmArchive(true)}
              className="u-btn u-btn-ghost text-xs text-yellow hover:bg-yellow/10 flex items-center gap-1.5"
            >
              <Archive className="size-3.5" /> Archive Order (Soft-Delete)
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRestore(true)}
              className="u-btn u-btn-primary text-xs bg-yellow! text-ink! font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="size-3.5" /> Restore from Archive
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className="u-btn u-btn-ghost text-xs text-red hover:bg-red/10 flex items-center gap-1.5 ml-auto"
          >
            <Trash2 className="size-3.5" /> Delete Permanently
          </button>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this order?"
        body={`Cancel order #${order.number}? Stock returns to catalog automatically. The customer will be notified.`}
        confirmLabel="Cancel order"
        danger
        onConfirm={() => patch({ to: "CANCELLED", note: "Order cancelled by operator" }, "Order cancelled and stock restored.")}
      />

      <ConfirmDialog
        open={confirmRefund}
        onClose={() => setConfirmRefund(false)}
        title="Mark as refunded?"
        body={`Mark order #${order.number} as refunded? This records the refund timestamp in audit trails.`}
        confirmLabel="Mark refunded"
        danger
        onConfirm={() => patch({ to: "REFUNDED", note: "Refund processed by operator" }, "Order marked as refunded.")}
      />

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this order?"
        body={`Archive order #${order.number}? The order will be hidden from default order lists but can be restored anytime from the Archived filter.`}
        confirmLabel="Archive order"
        onConfirm={() => patch({ action: "archive" }, "Order safely archived!")}
      />

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="Restore this order?"
        body={`Restore order #${order.number} to active order lists?`}
        confirmLabel="Restore order"
        onConfirm={() => patch({ action: "restore" }, "Order restored to active lists!")}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Permanently DELETE this order?"
        body={`WARNING: This permanently removes order #${order.number} and its line items from the database. This action CANNOT be recovered. Use Archive instead for safe storage.`}
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleDelete}
      />

      <Link href="/admin/orders" className="u-btn u-btn-ghost self-start mt-2">
        ← Back to orders list
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------
 * Orders Table Component (with live polling, filters, logs)
 * ------------------------------------------------------------- */
export function OrdersTable({
  orders,
  initialStatus = "ALL",
  initialQ = "",
  initialPaymentMethod = "ALL",
  initialPaymentStatus = "ALL",
  initialFulfilmentStatus = "ALL",
}: {
  orders: OrderWithRelations[];
  initialStatus?: string;
  initialQ?: string;
  initialPaymentMethod?: string;
  initialPaymentStatus?: string;
  initialFulfilmentStatus?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<OrderWithRelations[]>(orders);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchQ, setSearchQ] = useState<string>(initialQ);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>(initialPaymentMethod);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(initialPaymentStatus);
  const [fulfilmentFilter, setFulfilmentFilter] = useState<string>(initialFulfilmentStatus);

  // Sync / Error Logs drawer state
  const [showLogs, setShowLogs] = useState(false);
  const [logsBusy, setLogsBusy] = useState(false);
  const [recentSyncLogs, setRecentSyncLogs] = useState<SyncLog[]>([]);
  const [recentOpsEvents, setRecentOpsEvents] = useState<OpsEvent[]>([]);

  // Sync props when SSR searchParams change
  useEffect(() => {
    setItems(orders);
  }, [orders]);

  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setSearchQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    setPaymentMethodFilter(initialPaymentMethod);
  }, [initialPaymentMethod]);

  useEffect(() => {
    setPaymentStatusFilter(initialPaymentStatus);
  }, [initialPaymentStatus]);

  useEffect(() => {
    setFulfilmentFilter(initialFulfilmentStatus);
  }, [initialFulfilmentStatus]);

  // Fetch orders from API with current filter state
  const fetchOrders = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      const params = new URLSearchParams();
      if (manual) params.set("fresh", "1");
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQ) params.set("q", searchQ);
      if (paymentMethodFilter && paymentMethodFilter !== "ALL") params.set("paymentMethod", paymentMethodFilter);
      if (paymentStatusFilter && paymentStatusFilter !== "ALL") params.set("paymentStatus", paymentStatusFilter);
      if (fulfilmentFilter && fulfilmentFilter !== "ALL") params.set("fulfilmentStatus", fulfilmentFilter);
      if (statusFilter === "ARCHIVED") params.set("includeArchived", "true");

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { orders?: OrderWithRelations[] };
        if (Array.isArray(data.orders)) {
          setItems(data.orders);
          setLastSyncTime(new Date());
        }
      }
    } catch {
      /* network jitter ignored */
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, [statusFilter, searchQ, paymentMethodFilter, paymentStatusFilter, fulfilmentFilter]);

  // Automatic real-time polling every 4 seconds
  useEffect(() => {
    let active = true;
    const interval = setInterval(() => {
      if (active) void fetchOrders(false);
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchOrders]);

  // Load telemetry logs when drawer opened
  const loadLogs = async () => {
    setLogsBusy(true);
    try {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const data = (await res.json()) as { events?: OpsEvent[]; syncs?: SyncLog[] };
        setRecentOpsEvents(data.events ?? []);
        setRecentSyncLogs(data.syncs ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLogsBusy(false);
    }
  };

  const handleToggleLogs = () => {
    if (!showLogs) void loadLogs();
    setShowLogs(!showLogs);
  };

  const handleStatusChange = (orderNumber: string, nextStatus: OrderStatus) => {
    setItems((current) =>
      current.map((o) => (o.number === orderNumber ? { ...o, status: nextStatus } : o))
    );
  };

  const handleQuickArchive = async (e: React.MouseEvent, orderNumber: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(orderNumber)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (res.ok) {
        void fetchOrders();
        router.refresh();
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Live Sync Telemetry Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-surface/60 px-4 py-2.5 text-xs text-fog">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 font-semibold text-mint">
            <span className="size-2 rounded-full bg-mint animate-pulse" />
            Live Orders Listening
          </span>
          <span className="text-dim">·</span>
          <span>
            Last sync: {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchOrders(true)}
            disabled={isRefreshing}
            className="u-btn u-btn-ghost px-2.5! py-1! text-[11px]! font-semibold flex items-center gap-1.5"
            title="Force refresh order list"
          >
            <RefreshCw className={`size-3 ${isRefreshing ? "animate-spin text-mint" : ""}`} />
            <span>{isRefreshing ? "Syncing…" : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleLogs}
            className="u-btn u-btn-ghost px-2.5! py-1! text-[11px]! font-semibold flex items-center gap-1.5 text-bone"
          >
            <Activity className="size-3 text-sky" />
            <span>{showLogs ? "Hide Sync Logs" : "Sync & Error Logs"}</span>
            {showLogs ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>
      </div>

      {/* Expandable Sync & Error Logs Panel */}
      {showLogs && (
        <div className="rounded border border-sky/40 bg-sky/[0.03] p-4 text-xs anim-fade">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <p className="font-bold text-white flex items-center gap-1.5">
              <Activity className="size-3.5 text-sky" /> Webhook &amp; Order Sync Telemetry
            </p>
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={logsBusy}
              className="text-[11px] text-sky hover:underline"
            >
              {logsBusy ? "Refreshing logs…" : "Refresh telemetry logs"}
            </button>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {/* Shopify / Webhook Syncs */}
            <div>
              <p className="u-label-txt font-semibold text-bone mb-2">Shopify &amp; Gateway Sync Jobs</p>
              {recentSyncLogs.length === 0 ? (
                <p className="text-dim text-[11px]">No recent sync runs logged.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {recentSyncLogs.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded bg-surface p-2 border border-line text-[11px]">
                      <div>
                        <span className="font-semibold text-white">{s.job}</span>
                        {s.detail && <p className="text-dim text-[10px] truncate max-w-xs">{s.detail}</p>}
                      </div>
                      <span className={`u-badge text-[9px] font-bold ${s.status === "OK" ? "text-mint border-mint" : "text-red border-red"}`}>
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Error & Warning Events */}
            <div>
              <p className="u-label-txt font-semibold text-bone mb-2">Operational Events &amp; API Errors</p>
              {recentOpsEvents.length === 0 ? (
                <p className="text-dim text-[11px]">All systems running smooth. Zero error logs.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {recentOpsEvents.slice(0, 10).map((ev) => (
                    <li key={ev.id} className="flex items-start justify-between gap-2 rounded bg-surface p-2 border border-line text-[11px]">
                      <div className="min-w-0">
                        <span className="font-semibold text-white">{ev.type}</span>
                        <p className="text-fog text-[10.5px] truncate">{ev.message || ev.path}</p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${ev.level === "ERROR" ? "bg-red/20 text-red" : "bg-yellow/20 text-yellow"}`}>
                        {ev.level}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar: Search, Payment Method, Fulfilment Status */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search by order #, customer, email, phone, tracking…"
          className="u-input flex-1 min-w-[240px] text-xs"
        />

        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="u-input text-xs w-auto!"
          aria-label="Filter payment method"
        >
          <option value="ALL">All Payment Methods</option>
          <option value="UPI">UPI</option>
          <option value="COD">COD</option>
        </select>

        <select
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value)}
          className="u-input text-xs w-auto!"
          aria-label="Filter payment status"
        >
          <option value="ALL">All Payment Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="REVIEW">Review</option>
          <option value="ADVANCE_PENDING">Advance Pending (COD)</option>
          <option value="REFUNDED">Refunded</option>
        </select>

        <select
          value={fulfilmentFilter}
          onChange={(e) => setFulfilmentFilter(e.target.value)}
          className="u-input text-xs w-auto!"
          aria-label="Filter fulfilment status"
        >
          <option value="ALL">All Fulfilment</option>
          <option value="UNFULFILLED">Unfulfilled (Pending / Paid)</option>
          <option value="PROCESSING">Processing</option>
          <option value="PACKING">Packing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
        </select>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between text-xs text-fog">
        <p className="u-label-txt">{items.length} order{items.length !== 1 ? "s" : ""} shown</p>
      </div>

      {/* Orders List / Table */}
      {items.length === 0 ? (
        <div className="u-card px-6 py-12 text-center flex flex-col items-center justify-center gap-2.5">
          <span className="flex items-center gap-2 text-xs text-fog">
            <span className="size-2 rounded-full bg-mint animate-pulse" /> Live Telemetry Listening
          </span>
          <p className="u-label-txt text-bone font-semibold">No orders matched this filter.</p>
          <p className="text-xs text-dim max-w-sm">
            Customer checkout lands here immediately without manual effort.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface/80 text-[11px] uppercase tracking-wider text-fog">
              <tr>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Fulfilment</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {items.map((order) => (
                <OrderTableRow
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  onQuickArchive={(e) => void handleQuickArchive(e, order.number)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderTableRow({
  order,
  onStatusChange,
  onQuickArchive,
}: {
  order: OrderWithRelations;
  onStatusChange: (orderNumber: string, s: OrderStatus) => void;
  onQuickArchive: (e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acceptedNotice, setAcceptedNotice] = useState(false);

  const isAwaitingAcceptance = order.status === "PAYMENT_REVIEW" || order.status === "PENDING_PAYMENT";

  const copyNumber = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(order.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(order.number)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: "PAID", note: "Accepted by operator from Pit Wall" }),
      });
      if (res.ok) {
        setAcceptedNotice(true);
        onStatusChange(order.number, "PAID");
        setTimeout(() => setAcceptedNotice(false), 3000);
        router.refresh();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const navigateToDetail = () => {
    router.push(`/admin/orders/${order.number}`);
  };

  return (
    <tr
      onClick={navigateToDetail}
      className={`group cursor-pointer transition-colors ${
        isAwaitingAcceptance ? "bg-yellow/[0.03] hover:bg-yellow/[0.08]" : "hover:bg-surface/50"
      }`}
    >
      {/* Order Number */}
      <td className="px-4 py-3.5 font-mono font-bold text-white whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/orders/${order.number}`}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="hover:text-red hover:underline"
          >
            {order.number}
          </Link>
          <button
            type="button"
            onClick={copyNumber}
            className="text-dim hover:text-white transition-colors p-0.5"
            title="Copy Order Number"
          >
            {copied ? <Check className="size-3 text-mint" /> : <Copy className="size-3" />}
          </button>
        </div>
        {order.isArchived === 1 && (
          <span className="inline-block mt-0.5 text-[10px] text-yellow font-sans font-bold">
            [Archived]
          </span>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3.5 text-fog whitespace-nowrap text-[11.5px]">
        {fmtDate(order.placedAt)}
      </td>

      {/* Customer */}
      <td className="px-4 py-3.5">
        <p className="font-semibold text-bone">{order.name}</p>
        <p className="text-[11px] text-dim truncate max-w-[160px]">{order.email}</p>
        {order.phone && <p className="text-[10px] text-dim">{order.phone}</p>}
      </td>

      {/* Payment */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="font-semibold text-white">{order.paymentMethod}</span>
        {order.paymentChannel && (
          <span className="ml-1 text-[10px] text-dim">({order.paymentChannel})</span>
        )}
        <p className="text-[11px] text-fog mt-0.5">
          {order.paymentStatus || (order.status === "PAID" ? "PAID" : "PENDING")}
        </p>
      </td>

      {/* Fulfilment */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        {order.status === "DELIVERED" ? (
          <span className="text-mint font-medium">Delivered</span>
        ) : order.status === "SHIPPED" ? (
          <span className="text-sky font-medium">Shipped</span>
        ) : order.status === "PACKING" ? (
          <span className="text-yellow font-medium">Packing</span>
        ) : (
          <span className="text-dim font-medium">Unfulfilled</span>
        )}
        {order.trackingNumber && (
          <p className="text-[10px] text-dim mt-0.5 font-mono">
            {order.trackingCarrier ?? "AWB"}: {order.trackingNumber}
          </p>
        )}
      </td>

      {/* Total */}
      <td className="px-4 py-3.5 font-mono font-bold text-white whitespace-nowrap">
        {fmtUSD(order.total)}
      </td>

      {/* Status Badge */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <StatusBadge status={order.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {acceptedNotice ? (
            <span className="text-[11px] text-mint font-bold flex items-center gap-1">
              <Check className="size-3 text-mint" /> Accepted
            </span>
          ) : isAwaitingAcceptance ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleAccept}
              className="u-btn u-btn-primary bg-mint! text-ink! text-[11px]! font-bold py-1! px-2.5!"
            >
              {busy ? "…" : "Accept"}
            </button>
          ) : null}

          <Link
            href={`/admin/orders/${order.number}`}
            className="u-btn u-btn-ghost text-[11px]! py-1! px-2!"
          >
            Details →
          </Link>

          {!order.isArchived && (
            <button
              type="button"
              onClick={onQuickArchive}
              className="p-1 text-dim hover:text-yellow transition-colors"
              title="Archive order"
            >
              <Archive className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

