/**
 * Same-browser recovery for the order confirmation page.
 *
 * Durable snapshots (order-store.ts) are the real fix, but a checkout redirect
 * can reach a different serverless instance before the Blob write is visible.
 * The checkout API therefore also seals a small, encrypted copy of the order in
 * an HttpOnly cookie. If both SQLite and Blob miss, the confirmation page can
 * still show the customer their real order instead of "order not found".
 *
 * The payload is encrypted with SESSION_SECRET (AES-256-GCM), so the cookie
 * never exposes names, addresses, or email in plaintext.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { OrderStatus, OrderWithRelations, PaymentChannel } from "./types";

export const RECOVERY_COOKIE_NAME = "bw_order_recovery";
export const RECOVERY_COOKIE_PATH = "/checkout/success";
export const RECOVERY_COOKIE_MAX_AGE = 60 * 60 * 24; // one day

interface RecoveryItem {
  productId: number | null;
  name: string;
  slug: string | null;
  condition: string | null;
  scale: string | null;
  image: string | null;
  price: number;
  qty: number;
}

interface RecoveryPayload {
  v: 1;
  exp: number;
  order: {
    number: string;
    status: string;
    paymentMethod: string;
    paymentChannel: string | null;
    shippingMethod: string;
    email: string;
    name: string;
    total: number;
    subtotal: number;
    shippingFee: number;
    placedAt: string;
    updatedAt: string;
    isArchived?: number;
  };
  items: RecoveryItem[];
}

let cachedKey: Buffer | null = null;
let cachedSecret: string | null = null;

function key(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedKey = scryptSync(secret, "burnout-order-recovery-v1", 32);
  cachedSecret = secret;
  return cachedKey;
}

function b64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

/** Encrypt an order into a compact, tamper-proof cookie value. */
export function sealOrderRecovery(order: OrderWithRelations): string | null {
  const encryptionKey = key();
  if (!encryptionKey) return null;

  const payload: RecoveryPayload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + RECOVERY_COOKIE_MAX_AGE,
    order: {
      number: order.number,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentChannel: order.paymentChannel ?? null,
      shippingMethod: order.shippingMethod,
      email: order.email,
      name: order.name,
      total: order.total,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      placedAt: order.placedAt,
      updatedAt: order.updatedAt,
      isArchived: Number(order.isArchived ?? 0),
    },
    items: (order.items ?? []).map((item) => ({
      productId: item.productId ?? null,
      name: item.name,
      slug: item.slug ?? null,
      condition: item.condition ?? null,
      scale: item.scale ?? null,
      image: item.image ?? null,
      price: item.price,
      qty: item.qty,
    })),
  };

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", b64url(iv), b64url(tag), b64url(ciphertext)].join(".");
}

/** Decrypt the cookie and turn it back into the shape the success page expects. */
export function openOrderRecovery(token: string | undefined | null): OrderWithRelations | null {
  if (!token) return null;
  const encryptionKey = key();
  if (!encryptionKey) return null;

  try {
    const [version, ivPart, tagPart, cipherPart] = token.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !cipherPart) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(cipherPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as RecoveryPayload;

    if (payload?.v !== 1 || !payload.order?.number) return null;
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) return null;

    const number = String(payload.order.number).toUpperCase();
    return {
      id: 0,
      number,
      status: payload.order.status as OrderStatus,
      paymentMethod: payload.order.paymentMethod as "UPI" | "COD",
      paymentChannel: (payload.order.paymentChannel as PaymentChannel | null) ?? null,
      paymentReference: null,
      paymentClaimedAt: null,
      shippingMethod: payload.order.shippingMethod as "STANDARD" | "EXPRESS",
      email: String(payload.order.email ?? ""),
      name: String(payload.order.name ?? "Racer"),
      phone: null,
      addressLine: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      notes: null,
      subtotal: Number(payload.order.subtotal ?? 0),
      discountTotal: 0,
      discountCode: null,
      shippingFee: Number(payload.order.shippingFee ?? 0),
      total: Number(payload.order.total ?? 0),
      costTotal: 0,
      feesTotal: 0,
      profit: 0,
      trackingCarrier: null,
      trackingNumber: null,
      shiprocketOrderId: null,
      shiprocketShipmentId: null,
      shiprocketAwb: null,
      shiprocketStatus: null,
      shiprocketLabelUrl: null,
      refundedAt: null,
      customerId: null,
      isArchived: Number(payload.order.isArchived ?? 0),
      placedAt: String(payload.order.placedAt ?? new Date().toISOString()),
      updatedAt: String(payload.order.updatedAt ?? new Date().toISOString()),
      items: (payload.items ?? []).map((item, index) => ({
        id: index + 1,
        orderId: 0,
        productId: item.productId ?? null,
        name: String(item.name ?? "Item"),
        slug: item.slug ?? null,
        condition: item.condition ?? null,
        scale: item.scale ?? null,
        image: item.image ?? null,
        price: Number(item.price ?? 0),
        cost: 0,
        qty: Number(item.qty ?? 1),
      })),
      events: [],
    };
  } catch {
    return null;
  }
}
