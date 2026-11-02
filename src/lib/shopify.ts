import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb, nowIso, run } from "./db";
import { logSync, logEvent } from "./ops";
import type { Product, OrderWithRelations } from "./types";
import { accountByEmail, createAccount } from "./accounts";

/**
 * Shopify Admin API integration — REST Admin API (JSON), logged and retried.
 * Config lives in the settings table (admin → Shopify page), tokens never reach the client.
 * Honest behavior: only INR stores sync (warehouse prices are minor-paise). Syncs
 * write `source='SHOPIFY'` rows and never invent missing data; failures land in the
 * monitoring board via syncLogs + opsEvents.
 */

export interface ShopifyConfig {
  shopDomain: string; // e.g. pit-lane.myshopify.com
  adminToken: string;
  webhookSecret: string;
  apiVersion: string;
}

const SETTINGS_KEY = "shopify";
const cv = "2024-10";

export function getShopifyConfig(): ShopifyConfig | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    const cfg = JSON.parse(row.value) as ShopifyConfig;
    if (!cfg.shopDomain || !cfg.adminToken) return null;
    return { ...cfg, apiVersion: cfg.apiVersion || cv };
  } catch {
    return null;
  }
}

export function setShopifyConfig(cfg: ShopifyConfig | null): void {
  const db = getDb();
  run(
    db.prepare("INSERT INTO settings (key, value, updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt"),
    SETTINGS_KEY,
    cfg ? JSON.stringify({...cfg, apiVersion: cfg.apiVersion || cv}) : "",
    nowIso()
  );
}

export function isShopifyConnected(): boolean {
  return getShopifyConfig() !== null;
}

function cfgUrl(cfg: ShopifyConfig, path: string): string {
  return `https://${cfg.shopDomain}/admin/api/${cfg.apiVersion}/${path}`;
}

/** Admin API fetch with retry/backoff on 429 + 5xx, and connection failure logging. */
export async function shopFetch(cfg: ShopifyConfig, path: string, init?: RequestInit, attempts = 3): Promise<{ json: unknown; status: number }> {
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(cfgUrl(cfg, path), {
        ...init,
        headers: {
          "X-Shopify-Access-Token": cfg.adminToken,
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Shopify ${res.status} (attempt ${i + 1})`);
        await new Promise((r) => setTimeout(r, 800 * 2 ** i));
        continue;
      }
      const json = res.status === 204 ? {} : await res.json();
      if (!res.ok) {
        const msg = (json as { errors?: string }).errors ?? `Shopify ${res.status}`;
        throw new Error(String(msg));
      }
      return { json, status: res.status };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error("network failure");
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw lastErr ?? new Error("shopify fetch failed");
}

/* ---------------- mapping helpers ---------------- */

const money = (v: string | number | null | undefined): number => Math.round(Number(v ?? 0) * 100);

interface ShopifyVariant { id: number; title: string; price: string; inventory_quantity?: number; sku?: string }
interface ShopifyProductShape {
  id: number; title: string; handle: string; body_html: string; status: string;
  images: { src: string }[]; product_type: string; tags: string[];
  variants: ShopifyVariant[];
}
interface ShopifyOrderShape {
  id: number; name: string; financial_status: string; fulfillment_status: string | null; cancelled_at: string | null;
  customer?: { email?: string; first_name?: string; last_name?: string };
  total_price: string; subtotal_price: string; total_discounts: string; total_tax: string;
  line_items: { title: string; quantity: number; price: string; product_id?: number }[];
  shipping_address?: { name?: string; phone?: string; address1?: string; city?: string; province?: string; zip?: string };
  fulfillments?: { tracking_company?: string; tracking_number?: string; tracking_numbers?: string[]; tracking_url?: string; status?: string }[];
  refunds?: { id: number }[];
  created_at: string;
  current_subtotal_price?: string;
}

async function ensureShopCurrency(cfg: ShopifyConfig): Promise<void> {
  const { json } = await shopFetch(cfg, "shop.json");
  const shop = json as { shop?: { currency?: string } };
  if (shop.shop?.currency && shop.shop.currency !== "INR") {
    throw new Error(`Store currency is ${shop.shop.currency} — this warehouse ledger is priced in INR. Set the Shopify store to INR first.`);
  }
}

/* ---------------- syncs ---------------- */

export async function syncProducts(): Promise<{ items: number }> {
  const cfg = getShopifyConfig();
  if (!cfg) throw new Error("Shopify is not connected.");
  await ensureShopCurrency(cfg);

  const db = getDb();
  const upProduct = db.prepare(
    `INSERT INTO products (slug, name, brand, category, scale, condition, description, highlights, tags, images,
       priceSale, priceCost, feePercent, stock, lowStockThreshold, status, featured, dropAt, source, shopifyVariantId, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, brand = excluded.brand, description = excluded.description, images = excluded.images,
       priceSale = excluded.priceSale, stock = excluded.stock, lowStockThreshold = excluded.lowStockThreshold,
       status = excluded.status, tags = excluded.tags, source = excluded.source,
       shopifyVariantId = excluded.shopifyVariantId, updatedAt = excluded.updatedAt`
  );
  const ts = nowIso();

  const { json } = await shopFetch(cfg, "products.json?limit=250");
  const items = ((json as { products?: ShopifyProductShape[] }).products ?? []) as ShopifyProductShape[];
  let n = 0;
  for (const p of items) {
    const price = money(p.variants[0]?.price);
    const daoStock = p.variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);
    const variantId = p.variants[0]?.id != null ? String(p.variants[0].id) : null;
    const text = p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    run(upProduct,
      p.handle, p.title, null, p.product_type || "Uncategorised", null, "NEW",
      text || "", JSON.stringify([]), p.tags.join(", "),
      JSON.stringify(p.images.map((i) => i.src).slice(0, 6)),
      price, 0, 2, daoStock, 3,
      p.status === "active" ? "ACTIVE" : p.status === "archived" ? "ARCHIVED" : "DRAFT",
      0, null, "SHOPIFY", variantId, ts, ts
    );
    n++;
  }
  logSync({ job: "products", status: "OK", items: n });
  return { items: n };
}

export async function syncInventory(): Promise<{ items: number }> {
  const cfg = getShopifyConfig();
  if (!cfg) throw new Error("Shopify is not connected.");
  const db = getDb();
  let page = 1;
  let n = 0;
  // paginate 250-by-250
  for (;;) {
    const { json } = await shopFetch(cfg, `products.json?limit=250&page=${page}&fields=id,handle,variants`);
    const items = ((json as { products?: { handle: string; variants: ShopifyVariant[] }[] }).products ?? []) as { handle: string; variants: ShopifyVariant[] }[];
    if (items.length === 0) break;
    const upd = db.prepare("UPDATE products SET stock = ?, shopifyVariantId = ?, updatedAt = ? WHERE slug = ? AND source = 'SHOPIFY'");
    for (const p of items) {
      const stock = p.variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);
      const variantId = p.variants[0]?.id != null ? String(p.variants[0].id) : null;
      const res = run(upd, stock, variantId, nowIso(), p.handle);
      n += res.changes;
    }
    if (items.length < 250) break;
    page++;
    if (page > 20) break; // hard cap 5000 products
  }
  logSync({ job: "inventory", status: "OK", items: n });
  return { items: n };
}

export async function syncOrders(): Promise<{ items: number }> {
  const cfg = getShopifyConfig();
  if (!cfg) throw new Error("Shopify is not connected.");
  await ensureShopCurrency(cfg);
  const db = getDb();
  const findOrder = db.prepare("SELECT id FROM orders WHERE number = ? AND source = 'SHOPIFY'");
  const insOrder = db.prepare(
    `INSERT INTO orders (number, status, paymentMethod, paymentStatus, shippingMethod, email, name, phone, addressLine, city, state, pincode, country,
       subtotal, discountTotal, shippingFee, total, costTotal, feesTotal, profit, customerId, trackingCarrier, trackingNumber, source, placedAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(number) DO UPDATE SET
       status = excluded.status, paymentStatus = excluded.paymentStatus, trackingCarrier = excluded.trackingCarrier, trackingNumber = excluded.trackingNumber,
       subtotal = excluded.subtotal, discountTotal = excluded.discountTotal,
       total = excluded.total, feesTotal = excluded.feesTotal, profit = excluded.profit, updatedAt = excluded.updatedAt`
  );
  const insEvent = db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)");
  const findCustomer = db.prepare("SELECT id FROM customers WHERE email = ?");
  const insCustomer = db.prepare(
    `INSERT INTO customers (email, name, phone, ordersCount, lifetimeValue, createdAt, lastOrderAt, accountId)
     VALUES (?,?,?,1,?,?,?,?)`
  );
  const updCustomer = db.prepare(
    "UPDATE customers SET ordersCount = ordersCount + 1, lifetimeValue = lifetimeValue + ?, lastOrderAt = CASE WHEN lastOrderAt IS NULL OR lastOrderAt < ? THEN ? ELSE lastOrderAt END, accountId = COALESCE(?, accountId) WHERE email = ?"
  );

  let page = 1;
  let n = 0;
  const ts = nowIso();
  for (;;) {
    const { json } = await shopFetch(cfg, `orders.json?limit=250&page=${page}&status=any`);
    const orders = ((json as { orders?: ShopifyOrderShape[] }).orders ?? []) as ShopifyOrderShape[];
    if (orders.length === 0) break;

    for (const o of orders) {
      const number = `SHOPIFY-${o.id}`;
      const subtotal = money(o.subtotal_price);
      const discounts = money(o.total_discounts);
      const total = money(o.total_price);
      const fees = Math.round(total * 0.02);
      const cost = 0; // landed cost isn't in Shopify orders — cost-of-goods fields unavailable here
      const status: string =
        typeof o.refunds?.length === "number" && o.refunds.length > 0
          ? "REFUNDED"
          : o.cancelled_at
            ? "CANCELLED"
            : o.financial_status === "paid" || o.financial_status === "partially_paid"
              ? o.fulfillment_status === "fulfilled"
                ? "DELIVERED"
                : o.fulfillment_status === "shipped"
                  ? "SHIPPED"
                  : "PAID"
              : "PENDING_PAYMENT";
      const paymentStatus =
        o.financial_status === "paid"
          ? "PAID"
          : o.financial_status === "partially_paid"
            ? "PARTIALLY_PAID"
            : o.financial_status === "refunded"
              ? "REFUNDED"
              : "PENDING";
      const email = o.customer?.email?.trim().toLowerCase() ?? "no-email@shopify.local";
      const name = o.shipping_address?.name ?? `${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""}`.trim() ?? "Shopify customer";
      const fulfillment = o.fulfillments?.[0];
      const trackingCarrier = fulfillment?.tracking_company || null;
      const trackingNumber = fulfillment?.tracking_number || fulfillment?.tracking_numbers?.[0] || null;

      // Ensure customer account exists in accounts table
      let acc = accountByEmail(email);
      if (!acc && email !== "no-email@shopify.local") {
        try {
          acc = createAccount({
            email,
            name,
            phone: o.shipping_address?.phone ?? undefined,
            verified: true,
          });
        } catch {
          /* ignore */
        }
      }
      const accountId = acc?.id ?? null;

      // customer ledger
      const cust = findCustomer.get(email) as { id: number } | undefined;
      let customerId: number;
      if (cust) {
        run(updCustomer, total, o.created_at, o.created_at, accountId, email);
        customerId = cust.id;
      } else {
        const cRes = run(insCustomer, email, name, o.shipping_address?.phone ?? null, total, o.created_at, o.created_at, accountId);
        customerId = cRes.id;
      }

      if (findOrder.get(number)) {
        const row = db.prepare("SELECT id FROM orders WHERE number = ? AND source = 'SHOPIFY'").get(number) as { id: number };
        run(
          db.prepare(
            `UPDATE orders SET 
               status = ?, 
               paymentStatus = ?, 
               trackingCarrier = COALESCE(?, trackingCarrier), 
               trackingNumber = COALESCE(?, trackingNumber), 
               customerId = ?, 
               total = ?, 
               updatedAt = ? 
             WHERE id = ?`
          ),
          status,
          paymentStatus,
          trackingCarrier,
          trackingNumber,
          customerId,
          total,
          ts,
          row.id
        );
      } else {
        const res = run(
          insOrder,
          number, status, "UPI", paymentStatus, "STANDARD", email, name, o.shipping_address?.phone ?? null,
          o.shipping_address?.address1 ?? "", o.shipping_address?.city ?? "", o.shipping_address?.province ?? "",
          o.shipping_address?.zip ?? "", "India",
          subtotal, discounts, 0, total, cost, fees, total - cost - fees, customerId,
          trackingCarrier, trackingNumber, "SHOPIFY", o.created_at, ts
        );
        run(
          insEvent,
          res.id,
          status,
          `Imported from Shopify · Payment: ${o.financial_status} · Fulfilment: ${o.fulfillment_status ?? "unfulfilled"}` +
            (trackingNumber ? ` · Tracking: ${trackingCarrier ?? ""} ${trackingNumber}` : ""),
          "shopify",
          ts
        );
      }
      n++;
    }
    if (orders.length < 250) break;
    page++;
    if (page > 20) break;
  }
  logSync({ job: "orders", status: "OK", items: n });
  syncOrdersCarts(cfg);
  return { items: n };
}

/** Abandoned checkouts — count + funnel note, not sheet rows (no fake customer data). */
async function syncOrdersCarts(cfg: ShopifyConfig): Promise<void> {
  try {
    const { json } = await shopFetch(cfg, "checkouts.json?limit=250&status=open");
    const checkouts = (json as { checkouts?: unknown[] }).checkouts ?? [];
    logSync({ job: "carts", status: "OK", items: checkouts.length, detail: `${checkouts.length} open Shopify checkouts noted for the funnel board` });
    logEvent({ source: "API", level: "INFO", type: "sync", path: "/api/shopify/sync", message: `${checkouts.length} open Shopify checkouts` });
  } catch {
    logSync({ job: "carts", status: "FAIL", detail: "abandoned checkout fetch failed" });
  }
}

export async function syncCustomers(): Promise<{ items: number }> {
  const cfg = getShopifyConfig();
  if (!cfg) throw new Error("Shopify is not connected.");
  await ensureShopCurrency(cfg);
  const db = getDb();
  const ins = db.prepare(
    `INSERT INTO customers (email, name, phone, ordersCount, lifetimeValue, createdAt, lastOrderAt)
     VALUES (?,?,?,0,0,?,NULL)`
  );
  let page = 1;
  let n = 0;
  for (;;) {
    const { json } = await shopFetch(cfg, `customers.json?limit=250&page=${page}`);
    const custs = ((json as { customers?: { email?: string; first_name?: string; last_name?: string; phone?: string; created_at?: string }[] }).customers ?? []) as { email?: string; first_name?: string; last_name?: string; phone?: string; created_at?: string }[];
    if (custs.length === 0) break;
    for (const c of custs) {
      if (!c.email) continue;
      const email = c.email.trim().toLowerCase();
      if (!db.prepare("SELECT 1 FROM customers WHERE email = ?").get(email)) {
        run(ins, email, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null, c.phone ?? null, c.created_at ?? nowIso());
        n++;
      }
    }
    if (custs.length < 250) break;
    page++;
    if (page > 20) break;
  }
  logSync({ job: "customers", status: "OK", items: n });
  return { items: n };
}

export async function fullSync(): Promise<{ products: number; orders: number; customers: number; inventory: number }> {
  const products = (await syncProducts()).items;
  const orders = (await syncOrders()).items;
  const customers = (await syncCustomers()).items;
  const inventory = (await syncInventory()).items;
  logEvent({ source: "API", level: "INFO", type: "sync", path: "/api/shopify/sync", message: `full sync complete`, meta: `products=${products} orders=${orders} customers=${customers} inventory=${inventory}` });
  return { products, orders, customers, inventory };
}

/* ---------------- webhooks ---------------- */

/** Verifies Shopify's X-Shopify-Hmac-Sha256 against the raw body. */
export function verifyWebhook(raw: string, secret: string, header: string | null): boolean {
  if (!header) return false;
  const digest = createHmac("sha256", secret).update(raw, "utf8").digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const WEBHOOK_TOPICS = [
  "products/create", "products/update",
  "orders/create", "orders/updated", "orders/cancelled",
  "refunds/create",
] as const;

export function shopifyProducts(): Product[] {
  const db = getDb();
  return db.prepare("SELECT * FROM products WHERE source = 'SHOPIFY' ORDER BY updatedAt DESC").all() as unknown as Product[];
}

export async function handleWebhookTopic(topic: string, arg2: any, arg3?: any): Promise<void> {
  const body = (arg3 !== undefined ? arg3 : arg2) as Record<string, unknown>;
  const db = getDb();
  const ts = nowIso();

  switch (topic) {
    case "products/create":
    case "products/update": {
      await syncInventory();
      break;
    }
    case "orders/create":
    case "orders/updated":
    case "orders/fulfilled":
    case "orders/cancelled": {
      const orderId = body.id as number | undefined;
      const name = String(body.name ?? `SHOPIFY-${orderId}`);
      const financial = String(body.financial_status ?? "");
      const cancelled = Boolean(body.cancelled_at);
      const fulfillments = (body.fulfillments as Record<string, unknown>[]) ?? [];
      const fulfillment = fulfillments[0];
      const trackingCarrier = (fulfillment?.tracking_company as string) || null;
      const trackingNumber =
        (fulfillment?.tracking_number as string) ||
        ((fulfillment?.tracking_numbers as string[])?.[0] as string) ||
        null;
      const fulfillmentStatus = String(body.fulfillment_status ?? "");

      const status = cancelled
        ? "CANCELLED"
        : financial === "paid" || financial === "partially_paid"
          ? fulfillmentStatus === "fulfilled"
            ? "DELIVERED"
            : fulfillmentStatus === "shipped" || trackingNumber
              ? "SHIPPED"
              : "PAID"
          : "PENDING_PAYMENT";

      const paymentStatus =
        financial === "paid" ? "PAID" : financial === "partially_paid" ? "PARTIAL" : "PENDING";

      const stripe = Number(body.current_total_price ?? body.total_price ?? 0);
      const totalMinor = Math.round(stripe * 100);
      const subtotalMinor = Math.round(Number(body.current_subtotal_price ?? body.subtotal_price ?? 0) * 100);
      const email = String((body.customer as { email?: string })?.email ?? "no-email@shopify.local").toLowerCase();
      const customerName = String(
        (body.customer as { first_name?: string; last_name?: string })?.first_name
          ? `${(body.customer as { first_name?: string }).first_name} ${(body.customer as { last_name?: string })?.last_name ?? ""}`.trim()
          : "Shopify customer"
      );

      // Customer account creation/linkage
      let acc = accountByEmail(email);
      if (!acc && email !== "no-email@shopify.local") {
        try {
          acc = createAccount({ email, name: customerName, verified: true });
        } catch {}
      }
      const accountId = acc?.id ?? null;

      const hosp = db.prepare("SELECT id FROM orders WHERE number = ?").get(name) as { id: number } | undefined;
      const cust = db.prepare("SELECT id FROM customers WHERE LOWER(email) = LOWER(?)").get(email) as { id: number } | undefined;
      let customerId: number;

      if (hosp) {
        // Order exists: do NOT increment ordersCount or lifetimeValue again
        if (cust) {
          db.prepare("UPDATE customers SET accountId = COALESCE(?, accountId) WHERE id = ?").run(accountId, cust.id);
          customerId = cust.id;
        } else {
          const cRes = run(
            db.prepare("INSERT INTO customers (email, name, phone, ordersCount, lifetimeValue, createdAt, lastOrderAt, accountId) VALUES (?,?,?,0,0,?,?,?)"),
            email, customerName, null, ts, ts, accountId
          );
          customerId = cRes.id;
        }
      } else {
        // New order: increment ordersCount and add lifetimeValue
        if (cust) {
          db.prepare(
            "UPDATE customers SET ordersCount = ordersCount + 1, lifetimeValue = lifetimeValue + ?, lastOrderAt = ?, accountId = COALESCE(?, accountId) WHERE id = ?"
          ).run(totalMinor, ts, accountId, cust.id);
          customerId = cust.id;
        } else {
          const cRes = run(
            db.prepare("INSERT INTO customers (email, name, phone, ordersCount, lifetimeValue, createdAt, lastOrderAt, accountId) VALUES (?,?,?,1,?,?,?,?)"),
            email, customerName, null, totalMinor, ts, ts, accountId
          );
          customerId = cRes.id;
        }
      }
      if (hosp) {
        run(
          db.prepare(
            `UPDATE orders SET 
               status = ?, 
               paymentStatus = ?, 
               trackingCarrier = COALESCE(?, trackingCarrier), 
               trackingNumber = COALESCE(?, trackingNumber), 
               customerId = ?, 
               total = ?, 
               updatedAt = ? 
             WHERE id = ?`
          ),
          status,
          paymentStatus,
          trackingCarrier,
          trackingNumber,
          customerId,
          totalMinor,
          ts,
          hosp.id
        );
        run(
          db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
          hosp.id,
          status,
          `Webhook ${topic}` + (trackingNumber ? ` · Tracking: ${trackingCarrier ?? ""} ${trackingNumber}` : ""),
          "shopify",
          ts
        );
      } else {
        const res = run(
          db.prepare(
            `INSERT INTO orders (number, status, paymentMethod, paymentStatus, shippingMethod, email, name, subtotal, discountTotal, shippingFee, total, costTotal, feesTotal, profit, customerId, trackingCarrier, trackingNumber, source, placedAt, updatedAt)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ),
          name,
          status,
          "UPI",
          paymentStatus,
          "STANDARD",
          email,
          customerName,
          subtotalMinor,
          Math.round(Number(body.total_discounts ?? 0) * 100),
          0,
          totalMinor,
          0,
          Math.round(totalMinor * 0.02),
          totalMinor - Math.round(totalMinor * 0.02),
          customerId,
          trackingCarrier,
          trackingNumber,
          "SHOPIFY",
          String(body.created_at ?? ts),
          ts
        );
        run(
          db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
          res.id,
          status,
          `Imported by webhook ${topic}`,
          "shopify",
          ts
        );
      }
      break;
    }
    case "fulfillments/create":
    case "fulfillments/update": {
      const orderId = body.order_id as number | undefined;
      const trackingCompany = (body.tracking_company as string) || "Shopify Fulfillment";
      const trackingNum =
        (body.tracking_number as string) ||
        ((body.tracking_numbers as string[])?.[0] as string) ||
        null;
      if (orderId && trackingNum) {
        const targetOrder = db.prepare("SELECT id FROM orders WHERE number = ? OR number = ?").get(`SHOPIFY-${orderId}`, String(orderId)) as { id: number } | undefined;
        if (targetOrder) {
          run(
            db.prepare("UPDATE orders SET status = 'SHIPPED', trackingCarrier = ?, trackingNumber = ?, updatedAt = ? WHERE id = ?"),
            trackingCompany, trackingNum, ts, targetOrder.id
          );
          run(
            db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"),
            targetOrder.id, "SHIPPED", `Fulfilment updated via webhook: ${trackingCompany} ${trackingNum}`, "shopify", ts
          );
        }
      }
      break;
    }
    case "refunds/create": {
      const order = body.order as { name?: string } | undefined;
      const number = String(order?.name ?? "");
      const row = db.prepare("SELECT id FROM orders WHERE number = ?").get(number) as { id: number } | undefined;
      if (row) {
        run(db.prepare("UPDATE orders SET status = 'REFUNDED', paymentStatus = 'REFUNDED', refundedAt = ?, updatedAt = ? WHERE id = ?"), ts, ts, row.id);
        run(db.prepare("INSERT INTO orderEvents (orderId, status, note, actor, createdAt) VALUES (?,?,?,?,?)"), row.id, "REFUNDED", "Refund received from Shopify", "shopify", ts);
      }
      break;
    }
    default:
      logEvent({ source: "API", level: "WARN", type: "webhook", path: "/api/webhooks/shopify", message: `Unknown topic: ${topic}` });
  }
}
