import { fmtUSD } from "./money";
import type { OrderWithRelations } from "./types";

/** One-line delivery address assembled from the order record. */
export function orderAddress(order: OrderWithRelations): string {
  return [order.addressLine, order.city, order.state, order.pincode, order.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

/** GST is included in the charged total, not added on top. */
export function orderTaxesTotal(order: Pick<OrderWithRelations, "taxesTotal" | "subtotal">): number {
  return order.taxesTotal ?? Math.round(order.subtotal * 0.18);
}

export function orderPaymentStatus(order: Pick<OrderWithRelations, "paymentStatus" | "status">): string {
  return (
    order.paymentStatus ||
    (order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_REVIEW" ? "PENDING" : "PAID")
  );
}

/** Human-readable product line, including condition/scale when recorded. */
export function orderItemLine(item: OrderWithRelations["items"][number]): string {
  const meta = [item.condition, item.scale].filter(Boolean).join(" · ");
  return `${item.qty} × ${item.name}${meta ? ` (${meta})` : ""} — ${fmtUSD(item.price * item.qty)} (${fmtUSD(item.price)} each)`;
}

/**
 * Plain-text snapshot of an order. Used by the admin "Copy details" action so
 * an operator can preserve everything before a serverless instance is recycled.
 */
export function formatOrderSummary(order: OrderWithRelations): string {
  const placed = new Date(order.placedAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const taxes = orderTaxesTotal(order);
  const payment = `${order.paymentMethod}${order.paymentChannel ? ` via ${order.paymentChannel}` : ""} — ${orderPaymentStatus(order)}`;
  const discount =
    order.discountTotal > 0
      ? `−${fmtUSD(order.discountTotal)}${order.discountCode ? ` (${order.discountCode})` : ""}`
      : "—";

  const lines = [
    `ORDER #${order.number}`,
    `Placed: ${placed}`,
    `Status: ${order.status}`,
    `Payment: ${payment}`,
    "",
    "CUSTOMER",
    `Name: ${order.name}`,
    `Email: ${order.email}`,
    `Phone: ${order.phone || "—"}`,
    "",
    "DELIVER TO",
    orderAddress(order) || "—",
    order.billingAddress ? `Billing: ${order.billingAddress}` : "",
    "",
    "ITEMS",
    order.items.length > 0
      ? order.items.map((item) => `• ${orderItemLine(item)}`).join("\n")
      : `• Order total ${fmtUSD(order.total)} (line items unavailable)`,
    "",
    `Subtotal: ${fmtUSD(order.subtotal)}`,
    `Discount: ${discount}`,
    `Shipping: ${order.shippingFee === 0 ? "FREE" : fmtUSD(order.shippingFee)}`,
    `GST (18%, included): ${fmtUSD(taxes)}`,
    `TOTAL: ${fmtUSD(order.total)}`,
    "",
    `Shipping method: ${order.shippingMethod}`,
    `Tracking: ${order.trackingCarrier || order.trackingNumber ? `${order.trackingCarrier || "Courier"} ${order.trackingNumber || ""}`.trim() : "—"}`,
    `Notes: ${order.notes || "—"}`,
  ];

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
