import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderStatusEmail,
  buildOrderStatusWhatsApp,
  buildPublicDiscordOrderPayload,
  DEFAULT_DISCORD_CHECKOUT_URL,
  maskCustomerName,
  maskOrderNumber,
  normalizeWhatsAppPhone,
} from "./notifications";
import type { OrderWithRelations } from "./types";

const sampleOrder: OrderWithRelations = {
  id: 42,
  number: "BW-4FJ8QK-0Q",
  status: "SHIPPED",
  paymentMethod: "UPI",
  paymentChannel: "DISCORD",
  paymentReference: "UTR123456",
  paymentClaimedAt: "2026-11-19T10:00:00.000Z",
  shippingMethod: "EXPRESS",
  email: "amanjot.collector@example.com",
  name: "Amanjot",
  phone: "+91 98765-43210",
  addressLine: "123 Pit Lane Sector 108",
  city: "Mohali",
  state: "Punjab",
  pincode: "140307",
  country: "India",
  notes: "Handle box corners carefully",
  subtotal: 49900,
  discountTotal: 0,
  discountCode: null,
  shippingFee: 19900,
  total: 69800,
  costTotal: 30000,
  feesTotal: 0,
  profit: 19900,
  trackingCarrier: "BlueDart",
  trackingNumber: "BD99887766",
  shiprocketOrderId: null,
  shiprocketShipmentId: null,
  shiprocketAwb: null,
  shiprocketStatus: null,
  shiprocketLabelUrl: "https://shiprocket.co/tracking/BD99887766",
  refundedAt: null,
  customerId: 7,
  placedAt: "2026-11-19T09:00:00.000Z",
  updatedAt: "2026-11-19T12:00:00.000Z",
  items: [
    {
      id: 1,
      orderId: 42,
      productId: 1,
      name: "Red Bull Racing RB20 F1",
      slug: "red-bull-racing-rb20-f1",
      condition: "GRADED",
      scale: "1:64",
      image: "/uploads/rb20.jpg",
      price: 49900,
      cost: 30000,
      qty: 1,
    },
  ],
  events: [],
};

test("maskCustomerName stars out middle letters cleanly matching Am***T pattern", () => {
  assert.equal(maskCustomerName("Amanjot"), "Am***T");
  assert.equal(maskCustomerName("Amit"), "Am***T");
  assert.equal(maskCustomerName("Rohan Sharma"), "Ro***A");
  assert.equal(maskCustomerName("Al"), "A***L");
  assert.equal(maskCustomerName("A"), "A***");
  assert.equal(maskCustomerName("   "), "Cu***R");
});

test("maskOrderNumber hides middle order segment matching BW-XXXXXX-0Q pattern", () => {
  assert.equal(maskOrderNumber("BW-4FJ8QK-0Q"), "BW-XXXXXX-0Q");
  assert.equal(maskOrderNumber("bw-99ab12-7z"), "BW-XXXXXX-7Z");
  assert.equal(maskOrderNumber("ORD998811"), "OR-XXXXX11");
});

test("buildPublicDiscordOrderPayload hides all personal details and includes #checkout payment button + link", () => {
  const payload = buildPublicDiscordOrderPayload({
    orderNumber: sampleOrder.number,
    customerName: sampleOrder.name,
    totalMinor: sampleOrder.total,
    units: 1,
    paymentMethod: sampleOrder.paymentMethod,
    paymentChannel: sampleOrder.paymentChannel,
    shippingMethod: sampleOrder.shippingMethod,
    items: sampleOrder.items,
  });

  const serialized = JSON.stringify(payload);

  // Must include masked identity & order ID
  assert.ok(serialized.includes("Am***T"), "Expected masked customer name Am***T");
  assert.ok(serialized.includes("BW-XXXXXX-0Q"), "Expected masked Order ID BW-XXXXXX-0Q");

  // Must NEVER leak personal details
  assert.equal(serialized.includes(sampleOrder.email), false, "Must not leak email");
  assert.equal(serialized.includes(sampleOrder.phone!), false, "Must not leak phone");
  assert.equal(serialized.includes("98765"), false, "Must not leak phone digits");
  assert.equal(serialized.includes(sampleOrder.addressLine), false, "Must not leak address");
  assert.equal(serialized.includes(sampleOrder.number), false, "Must not leak full order number");
  assert.equal(serialized.includes("Amanjot"), false, "Must not leak full customer name");

  // Must include downside message + #checkout invite link & button
  assert.ok(serialized.includes("Make Payment with this Order ID"), "Expected payment CTA prompt");
  assert.ok(serialized.includes(DEFAULT_DISCORD_CHECKOUT_URL), "Expected #checkout Discord invite URL");

  const components = payload.components as Array<{
    type: number;
    components: Array<{ type: number; style: number; label: string; url: string }>;
  }>;
  assert.equal(components.length, 1);
  assert.equal(components[0].components[0].style, 5);
  assert.equal(components[0].components[0].url, DEFAULT_DISCORD_CHECKOUT_URL);
});

test("normalizeWhatsAppPhone converts Indian and international phone formats to E.164 digits", () => {
  assert.equal(normalizeWhatsAppPhone("+91 98765-43210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("9876543210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("09876543210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("+1 (415) 555-0199"), "14155550199");
  assert.equal(normalizeWhatsAppPhone(""), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
});

test("buildOrderStatusEmail and buildOrderStatusWhatsApp include transition details and tracking info", () => {
  const email = buildOrderStatusEmail(sampleOrder, "PAID", "Handed to BlueDart");
  assert.equal(email.to, "amanjot.collector@example.com");
  assert.ok(email.subject.includes("Order Shipped"));
  assert.ok(email.subject.includes("BW-4FJ8QK-0Q"));
  assert.ok(email.body.includes("BlueDart"));
  assert.ok(email.body.includes("BD99887766"));
  assert.ok(email.body.includes("/track?order=BW-4FJ8QK-0Q"));
  assert.ok(email.html.includes("Red Bull Racing RB20 F1"));

  const wa = buildOrderStatusWhatsApp(sampleOrder, "PAID");
  assert.equal(wa.phone, "919876543210");
  assert.ok(wa.text.includes("BW-4FJ8QK-0Q"));
  assert.ok(wa.text.includes("BlueDart"));
  assert.ok(wa.text.includes("BD99887766"));
  assert.ok(wa.waLink?.startsWith("https://wa.me/919876543210?text="));
});
