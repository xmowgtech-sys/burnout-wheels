import { fmtUSD } from "./money";
import { sendMail } from "./mailer";
import { logEvent } from "./ops";
import { siteUrl } from "./site";
import { ORDER_STATUS_LABELS, type OrderStatus, type OrderWithRelations } from "./types";

export const DEFAULT_DISCORD_CHECKOUT_URL = "https://discord.com/invite/6QVmX4kbez";

/* ============================================================================
 * Privacy Masking for Public Discord Webhooks (DISCORD_WEBHOOK_URL)
 * ============================================================================ */

/**
 * Masks a customer's name with stars so public Discord channels never expose
 * personal identity, e.g. "Amanjot" -> "Am***T", "Rohan Sharma" -> "Ro***A".
 */
export function maskCustomerName(rawName: string | null | undefined): string {
  const clean = (rawName ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "Cu***R";
  if (clean.length === 1) return `${clean.toUpperCase()}***`;
  if (clean.length === 2) return `${clean[0].toUpperCase()}***${clean[1].toUpperCase()}`;
  const firstTwo = clean[0].toUpperCase() + clean[1].toLowerCase();
  const lastChar = clean[clean.length - 1].toUpperCase();
  return `${firstTwo}***${lastChar}`;
}

/**
 * Masks an order number so only the prefix and final 2-character suffix remain
 * visible in public Discord channels, e.g. "BW-4FJ8QK-0Q" -> "BW-XXXXXX-0Q".
 */
export function maskOrderNumber(rawOrderId: string | null | undefined): string {
  const clean = (rawOrderId ?? "").trim().toUpperCase();
  if (!clean) return "BW-XXXXXX-XX";

  const parts = clean.split("-");
  if (parts.length >= 3) {
    const prefix = parts[0];
    const suffix = parts[parts.length - 1];
    const maskedMiddle = parts
      .slice(1, -1)
      .map((seg) => "X".repeat(Math.max(seg.length, 6)))
      .join("-");
    return `${prefix}-${maskedMiddle}-${suffix}`;
  }

  if (clean.length <= 4) return `${clean.slice(0, 1)}***${clean.slice(-1)}`;
  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(-2);
  const middleLen = Math.max(4, clean.length - 4);
  return `${prefix}-${"X".repeat(middleLen)}${suffix}`;
}

export interface PublicDiscordOrderInput {
  orderNumber: string;
  customerName: string;
  totalMinor: number;
  units: number;
  paymentMethod: string;
  paymentChannel?: string | null;
  shippingMethod?: string | null;
  items?: { name: string; qty: number; price: number; scale?: string | null; condition?: string | null }[];
  checkoutUrl?: string;
}

/**
 * Builds the privacy-safe Discord webhook payload for `DISCORD_WEBHOOK_URL` /
 * public `#billing`. Contains ZERO personal details (no email, phone, address,
 * full name, or full order number) and adds a `#checkout` payment button + link.
 */
export function buildPublicDiscordOrderPayload(input: PublicDiscordOrderInput): Record<string, unknown> {
  const maskedName = maskCustomerName(input.customerName);
  const maskedOrderId = maskOrderNumber(input.orderNumber);
  const checkoutLink = input.checkoutUrl?.trim() || DEFAULT_DISCORD_CHECKOUT_URL;
  const clamp = (value: string, max = 1024) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

  const itemLines =
    input.items && input.items.length > 0
      ? input.items.map((item) => {
          const meta = [item.scale].filter(Boolean).join(" · ");
          return `• **${item.qty}×** ${item.name}${meta ? ` (${meta})` : ""} — ${fmtUSD(item.price * item.qty)}`;
        })
      : [];

  const color = input.paymentChannel === "WHATSAPP" ? 3066993 : 14747136; // mint or racing red

  return {
    content: `🏎️ **New Order Placed** — [Name - **${maskedName}**, Order ID - **${maskedOrderId}**]`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `Order · ${maskedOrderId}`,
        description: [
          `**[Name - ${maskedName}, Order ID - ${maskedOrderId}]**`,
          `${input.units > 0 ? `${input.units} unit${input.units === 1 ? "" : "s"}` : "Order"} · **${fmtUSD(input.totalMinor)}** · ${input.shippingMethod || "STANDARD"} shipping`,
        ].join("\n"),
        color,
        fields: [
          { name: "Customer", value: `\`${maskedName}\``, inline: true },
          { name: "Order ID", value: `\`${maskedOrderId}\``, inline: true },
          {
            name: "Payment",
            value: clamp(
              `${input.paymentMethod}${input.paymentChannel ? ` · via ${input.paymentChannel}` : ""}`
            ),
            inline: true,
          },
          {
            name: `Items${input.units > 0 ? ` (${input.units})` : ""}`,
            value: clamp(itemLines.length > 0 ? itemLines.join("\n") : `Order total ${fmtUSD(input.totalMinor)}`),
            inline: false,
          },
          {
            name: "Next Step — Complete Payment",
            value: `**Make Payment with this Order ID**\n👉 [Go to #checkout to make payment](${checkoutLink})`,
            inline: false,
          },
        ],
        footer: {
          text: "Burnout Wheels · Make Payment with this Order ID in #checkout",
        },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Make Payment with this Order ID (#checkout)",
            url: checkoutLink,
          },
        ],
      },
    ],
  };
}

/* ============================================================================
 * Automated Customer Order Status Notifications (Email + WhatsApp)
 * ============================================================================ */

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Standard 10-digit Indian mobile numbers -> prepend country code 91
  if (digits.length === 10) return `91${digits}`;
  // Leading 0 + 10-digit Indian mobile number -> replace leading 0 with 91
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

interface StatusCopy {
  headline: string;
  summary: string;
  accentHex: string;
}

export function describeOrderStatus(status: OrderStatus, order: Pick<OrderWithRelations, "trackingCarrier" | "trackingNumber" | "shiprocketAwb">): StatusCopy {
  switch (status) {
    case "PAID":
      return {
        headline: "Order Accepted & Confirmed",
        summary: "Your payment has been verified and your die-cast allocation is confirmed in the Burnout Wheels paddock.",
        accentHex: "#2dd4a0",
      };
    case "PROCESSING":
      return {
        headline: "Order In Processing",
        summary: "Our pit crew is inspecting the casting, card, and seal before moving it to the packing bay.",
        accentHex: "#7cb8ff",
      };
    case "PACKING":
      return {
        headline: "Order Being Packed",
        summary: "Your model is being collector-packed with corner protection and bubble wrap for dispatch.",
        accentHex: "#ff7a1a",
      };
    case "SHIPPED": {
      const carrier = order.trackingCarrier || "our courier partner";
      const code = order.trackingNumber || order.shiprocketAwb;
      return {
        headline: "Order Shipped & On The Way",
        summary: code
          ? `Your parcel has left the paddock via ${carrier} (Tracking / AWB: ${code}).`
          : `Your parcel has been handed over to ${carrier} and is on its way to you.`,
        accentHex: "#7cb8ff",
      };
    }
    case "DELIVERED":
      return {
        headline: "Order Delivered",
        summary: "Your Burnout Wheels order has been marked delivered. Enjoy the addition to your garage!",
        accentHex: "#2dd4a0",
      };
    case "CANCELLED":
      return {
        headline: "Order Cancelled",
        summary: "Your order has been cancelled and reserved inventory has been released back to the grid.",
        accentHex: "#e10600",
      };
    case "REFUNDED":
      return {
        headline: "Order Refunded",
        summary: "Your refund has been recorded by the Burnout Wheels team.",
        accentHex: "#a78bfa",
      };
    case "PAYMENT_REVIEW":
      return {
        headline: "Payment Under Review",
        summary: "We received your payment reference and our team is verifying it now.",
        accentHex: "#ffe600",
      };
    default:
      return {
        headline: `Order Update: ${ORDER_STATUS_LABELS[status] ?? status}`,
        summary: "Your order status has been updated in our system.",
        accentHex: "#e10600",
      };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOrderStatusEmail(
  order: OrderWithRelations,
  previousStatus?: OrderStatus | null,
  note?: string
): { to: string; subject: string; body: string; html: string } {
  const copy = describeOrderStatus(order.status, order);
  const trackLink = `${siteUrl()}/track?order=${encodeURIComponent(order.number)}`;
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
  const prevLabel = previousStatus ? ORDER_STATUS_LABELS[previousStatus] ?? previousStatus : null;
  const trackingCode = order.trackingNumber || order.shiprocketAwb || "";
  const carrier = order.trackingCarrier || (order.shiprocketAwb ? "Shiprocket" : "");

  const itemsText = order.items
    .map((it) => `  - ${it.qty}x ${it.name} (${fmtUSD(it.price * it.qty)})`)
    .join("\n");

  const lines = [
    `Hi ${order.name || "Collector"},`,
    "",
    `${copy.headline} — Order #${order.number}`,
    prevLabel && prevLabel !== statusLabel ? `Status update: ${prevLabel} -> ${statusLabel}` : `Current status: ${statusLabel}`,
    "",
    copy.summary,
  ];

  if (trackingCode) {
    lines.push("", `Courier: ${carrier || "Assigned courier"}`, `Tracking / AWB: ${trackingCode}`);
  }
  if (order.shiprocketLabelUrl) {
    lines.push(`Tracking link: ${order.shiprocketLabelUrl}`);
  }
  if (note && !note.toLowerCase().startsWith("status changed to")) {
    lines.push("", `Pit note: ${note}`);
  }
  if (itemsText) {
    lines.push("", "Order items:", itemsText);
  }
  lines.push("", `Order total: ${fmtUSD(order.total)}`, `Track your order anytime: ${trackLink}`, "", "— Burnout Wheels Pit Crew");

  const itemsHtml = order.items
    .map(
      (it) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #24262e;color:#f4f4f2;font-size:13px;">${it.qty}&times; ${escapeHtml(it.name)}</td><td style="padding:8px 0;border-bottom:1px solid #24262e;color:#a5a5ad;font-size:13px;text-align:right;font-family:monospace;">${escapeHtml(fmtUSD(it.price * it.qty))}</td></tr>`
    )
    .join("");

  const trackingHtml = trackingCode
    ? `<div style="margin:18px 0;padding:14px 16px;background:#14161b;border-left:3px solid ${copy.accentHex};">
         <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a5a5ad;">Shipment Tracking</div>
         <div style="margin-top:6px;font-size:14px;color:#f4f4f2;font-family:monospace;">${escapeHtml(carrier || "Courier")} &middot; ${escapeHtml(trackingCode)}</div>
         ${order.shiprocketLabelUrl ? `<a href="${escapeHtml(order.shiprocketLabelUrl)}" style="display:inline-block;margin-top:8px;color:#7cb8ff;font-size:12px;">Open courier tracking &rarr;</a>` : ""}
       </div>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0a0a0c;color:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#0f1013;border:1px solid #262830;">
      <div style="height:3px;background:${copy.accentHex};"></div>
      <div style="padding:28px 24px;">
        <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#a5a5ad;">Burnout / Wheels &middot; Order #${escapeHtml(order.number)}</div>
        <h1 style="margin:10px 0 6px;font-size:22px;line-height:1.2;text-transform:uppercase;color:#f4f4f2;">${escapeHtml(copy.headline)}</h1>
        ${prevLabel && prevLabel !== statusLabel ? `<div style="font-size:12px;color:${copy.accentHex};font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(prevLabel)} &rarr; ${escapeHtml(statusLabel)}</div>` : ""}
        <p style="margin:16px 0;font-size:14px;line-height:1.6;color:#d0d0d6;">Hi ${escapeHtml(order.name || "Collector")},<br/><br/>${escapeHtml(copy.summary)}</p>
        ${trackingHtml}
        ${itemsHtml ? `<table style="width:100%;border-collapse:collapse;margin:18px 0;">${itemsHtml}<tr><td style="padding:12px 0 0;font-size:13px;font-weight:700;color:#f4f4f2;">Total</td><td style="padding:12px 0 0;font-size:14px;font-weight:700;color:#f4f4f2;text-align:right;font-family:monospace;">${escapeHtml(fmtUSD(order.total))}</td></tr></table>` : ""}
        <div style="margin-top:24px;">
          <a href="${escapeHtml(trackLink)}" style="display:inline-block;padding:12px 22px;background:#e10600;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Track Order #${escapeHtml(order.number)}</a>
        </div>
        <p style="margin:24px 0 0;font-size:11px;color:#6f6f78;">Burnout Wheels Die-Cast Pit Lane &middot; Automated order status alert.</p>
      </div>
    </div>
  </body>
</html>`;

  return {
    to: order.email,
    subject: `${copy.headline} · Order #${order.number} — Burnout Wheels`,
    body: lines.join("\n"),
    html,
  };
}

export function buildOrderStatusWhatsApp(
  order: OrderWithRelations,
  previousStatus?: OrderStatus | null
): { phone: string | null; text: string; waLink: string | null } {
  const copy = describeOrderStatus(order.status, order);
  const phone = normalizeWhatsAppPhone(order.phone);
  const trackLink = `${siteUrl()}/track?order=${encodeURIComponent(order.number)}`;
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
  const prevLabel = previousStatus ? ORDER_STATUS_LABELS[previousStatus] ?? previousStatus : null;
  const trackingCode = order.trackingNumber || order.shiprocketAwb || "";
  const carrier = order.trackingCarrier || (order.shiprocketAwb ? "Shiprocket" : "");

  const parts = [
    `🏎️ *Burnout Wheels — ${copy.headline}*`,
    `Hi ${order.name || "Collector"},`,
    prevLabel && prevLabel !== statusLabel
      ? `Order *#${order.number}* moved from *${prevLabel}* → *${statusLabel}*.`
      : `Order *#${order.number}* is now *${statusLabel}*.`,
    copy.summary,
  ];

  if (trackingCode) {
    parts.push(`📦 Tracking: *${carrier || "Courier"}* · \`${trackingCode}\``);
  }
  if (order.shiprocketLabelUrl) {
    parts.push(`🔗 Courier link: ${order.shiprocketLabelUrl}`);
  }
  parts.push(`Track live: ${trackLink}`);

  const text = parts.join("\n");
  const waLink = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
  return { phone, text, waLink };
}

export interface OrderNotificationSummary {
  email: {
    attempted: boolean;
    delivered: boolean;
    note: string;
  };
  whatsapp: {
    attempted: boolean;
    delivered: boolean;
    provider: "cloud_api" | "webhook" | "manual_link" | "none";
    note: string;
    waLink: string | null;
  };
}

export function getNotificationProviderStatus() {
  return {
    smtpConfigured: Boolean(
      process.env.SMTP_HOST?.trim() &&
        process.env.SMTP_USER?.trim() &&
        process.env.SMTP_PASSWORD?.trim()
    ),
    whatsappCloudConfigured: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    ),
    whatsappWebhookConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_URL?.trim()),
  };
}

async function sendWhatsAppMessage(
  phone: string,
  text: string,
  meta: { orderNumber: string; status: OrderStatus; previousStatus?: OrderStatus | null }
): Promise<{ delivered: boolean; provider: "cloud_api" | "webhook" | "manual_link"; note: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  const customWebhook = process.env.WHATSAPP_WEBHOOK_URL?.trim();

  // 1. Official Meta WhatsApp Business Cloud API
  if (token && phoneNumberId) {
    try {
      const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: true, body: text },
        }),
      });
      if (res.ok) {
        return { delivered: true, provider: "cloud_api", note: "Sent via WhatsApp Cloud API" };
      }
      const errText = await res.text().catch(() => "");
      return {
        delivered: false,
        provider: "cloud_api",
        note: `WhatsApp Cloud API returned ${res.status}: ${errText.slice(0, 160)}`,
      };
    } catch (err) {
      return {
        delivered: false,
        provider: "cloud_api",
        note: `WhatsApp Cloud API failed: ${err instanceof Error ? err.message : "network error"}`,
      };
    }
  }

  // 2. Optional third-party WhatsApp automation webhook (Twilio / WATI / Make / Zapier / Evolution)
  if (customWebhook) {
    try {
      const res = await fetch(customWebhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          channel: "whatsapp",
          to: phone,
          message: text,
          orderNumber: meta.orderNumber,
          status: meta.status,
          previousStatus: meta.previousStatus ?? null,
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        return { delivered: true, provider: "webhook", note: "Sent via WhatsApp automation webhook" };
      }
      const errText = await res.text().catch(() => "");
      return {
        delivered: false,
        provider: "webhook",
        note: `WhatsApp webhook returned ${res.status}: ${errText.slice(0, 160)}`,
      };
    } catch (err) {
      return {
        delivered: false,
        provider: "webhook",
        note: `WhatsApp webhook failed: ${err instanceof Error ? err.message : "network error"}`,
      };
    }
  }

  return {
    delivered: false,
    provider: "manual_link",
    note: "WhatsApp API not configured — 1-click WhatsApp link ready",
  };
}

/**
 * Dispatches automated Email + WhatsApp alerts to the customer whenever an
 * order's status changes. Never throws so order mutations never fail because of
 * an external mail or messaging provider.
 */
export async function notifyCustomerOrderStatusChange(
  order: OrderWithRelations,
  previousStatus?: OrderStatus | null,
  note?: string
): Promise<OrderNotificationSummary> {
  const emailDraft = buildOrderStatusEmail(order, previousStatus, note);
  const waDraft = buildOrderStatusWhatsApp(order, previousStatus);

  let emailResult: OrderNotificationSummary["email"] = {
    attempted: false,
    delivered: false,
    note: "No customer email on order",
  };

  let whatsappResult: OrderNotificationSummary["whatsapp"] = {
    attempted: false,
    delivered: false,
    provider: "none",
    note: "No customer phone on order",
    waLink: null,
  };

  await Promise.all([
    (async () => {
      if (!order.email?.trim()) return;
      try {
        const res = await sendMail(emailDraft);
        emailResult = { attempted: true, delivered: res.delivered, note: res.note };
      } catch (err) {
        emailResult = {
          attempted: true,
          delivered: false,
          note: err instanceof Error ? err.message : "Email dispatch failed",
        };
      }
    })(),
    (async () => {
      if (!waDraft.phone) return;
      try {
        const res = await sendWhatsAppMessage(waDraft.phone, waDraft.text, {
          orderNumber: order.number,
          status: order.status,
          previousStatus,
        });
        whatsappResult = {
          attempted: res.provider !== "manual_link",
          delivered: res.delivered,
          provider: res.provider,
          note: res.note,
          waLink: waDraft.waLink,
        };
      } catch (err) {
        whatsappResult = {
          attempted: true,
          delivered: false,
          provider: "manual_link",
          note: err instanceof Error ? err.message : "WhatsApp dispatch failed",
          waLink: waDraft.waLink,
        };
      }
    })(),
  ]);

  try {
    logEvent({
      source: "SRV",
      level: emailResult.delivered || whatsappResult.delivered ? "INFO" : "WARN",
      type: "order_notify",
      path: `/orders/${order.number}`,
      message: `Order ${order.number} -> ${order.status}: email (${emailResult.note}) · whatsapp (${whatsappResult.note})`,
      meta: JSON.stringify({
        orderNumber: order.number,
        from: previousStatus ?? null,
        to: order.status,
        emailDelivered: emailResult.delivered,
        whatsappDelivered: whatsappResult.delivered,
        whatsappProvider: whatsappResult.provider,
      }),
    });
  } catch {
    /* ignore ops logging failures */
  }

  return { email: emailResult, whatsapp: whatsappResult };
}
