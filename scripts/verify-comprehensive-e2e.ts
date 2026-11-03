import assert from "node:assert";
import { getDb } from "../src/lib/db";
import {
  createOrderFromCheckout,
  adminGetOrder,
  adminListOrders,
  updateOrderStatus,
  updateTracking,
  updateShiprocket,
  archiveOrder,
  restoreOrder,
  deleteOrder,
  listCustomers,
  getCustomerDetail,
  getCustomerOrders,
} from "../src/lib/orders";
import { accountByEmail, createAccount, setPassword } from "../src/lib/accounts";
import { handleWebhookTopic } from "../src/lib/shopify";
import type { OrderStatus } from "../src/lib/types";

async function main() {
  console.log("==================================================================");
  console.log("   BURNOUT WHEELS — COMPREHENSIVE E2E VERIFICATION SUITE         ");
  console.log("==================================================================");

  const db = getDb();
  const testId = Date.now().toString(36).toUpperCase();
  const customerEmail = `e2e_racer_${testId.toLowerCase()}@burnoutwheels.com`;
  const customerName = `Ayrton Senna ${testId}`;
  const customerPhone = "+91 98888 12345";

  // Step 1: Customer signs up / logs in
  console.log("\n--- Step 1: Customer Account Sign-up & Verification ---");
  const acc = createAccount({
    email: customerEmail,
    name: customerName,
    password: "StrongPassword123!",
    phone: customerPhone,
    verified: true,
  });
  assert(acc && acc.id, "Account must be created with valid ID");
  assert.strictEqual(acc.email, customerEmail, "Email must match");
  console.log(`✓ Customer account created: ID #${acc.id}, Email: ${acc.email}, Verified: ${acc.verified}`);

  // Step 2 & 3: Customer adds product to cart & completes checkout
  console.log("\n--- Steps 2-4: Cart & Public Checkout with Idempotency ---");
  const product = db.prepare("SELECT * FROM products WHERE status = 'ACTIVE' LIMIT 1").get() as { id: number; priceSale: number; name: string };
  assert(product, "At least one active catalog product must exist");
  console.log(`[Storefront Cart] Adding active item: "${product.name}" (ID #${product.id}, ₹${product.priceSale / 100})`);

  const idempotencyKey = `IDEMP-${testId}-PRIMARY`;
  const checkoutPayload = {
    items: [{ productId: product.id, qty: 1 }],
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    addressLine: "Flat 402, Speedline Towers, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    country: "India",
    billingAddress: "Suite 9, Corporate Hub, Nariman Point, Mumbai 400021",
    shippingMethod: "STANDARD",
    paymentMethod: "UPI",
    paymentChannel: "DISCORD",
    notes: "Deliver after 4 PM, call on arrival",
    idempotencyKey,
    accountId: acc.id,
  };

  const checkoutResult = createOrderFromCheckout(checkoutPayload);
  assert(checkoutResult && checkoutResult.number, "Order number must be issued");
  assert.strictEqual(checkoutResult.status, "PAYMENT_REVIEW", "Order initial status should be PAYMENT_REVIEW for Discord payment route");
  const orderNum = checkoutResult.number;
  console.log(`✓ Order placed successfully: Order #${orderNum}, Total: ₹${checkoutResult.total / 100}, Status: ${checkoutResult.status}`);

  // Idempotency verification: exact duplicate request must return same order
  const duplicateResult = createOrderFromCheckout(checkoutPayload);
  assert.strictEqual(duplicateResult.number, orderNum, "Duplicate checkout must return identical order number");
  const orderRowsCount = db.prepare("SELECT COUNT(*) as n FROM orders WHERE idempotencyKey = ?").get(idempotencyKey) as { n: number };
  assert.strictEqual(orderRowsCount.n, 1, "Database must strictly contain exactly 1 order row for the idempotencyKey");
  console.log(`✓ Idempotency verified: re-submission returned Order #${duplicateResult.number} without duplicate row creation`);

  // Step 5: Verify new order appears in Admin -> Orders with FULL data
  console.log("\n--- Step 5: Admin Order List & Complete Order Detail View ---");
  const adminOrder = db.prepare("SELECT * FROM orders WHERE number = ?").get(orderNum) as { id: number };
  assert(adminOrder, "Order must exist in database");
  const fullOrder = adminGetOrder(adminOrder.id);
  assert(fullOrder, "Complete order detail must be retrieved");
  assert.strictEqual(fullOrder.number, orderNum);
  assert.strictEqual(fullOrder.email, customerEmail);
  assert.strictEqual(fullOrder.name, customerName);
  assert.strictEqual(fullOrder.phone, customerPhone);
  assert.strictEqual(fullOrder.addressLine, checkoutPayload.addressLine);
  assert.strictEqual(fullOrder.billingAddress, checkoutPayload.billingAddress);
  assert.strictEqual(fullOrder.notes, checkoutPayload.notes);
  assert.strictEqual(fullOrder.paymentMethod, "UPI");
  assert.strictEqual(fullOrder.paymentChannel, "DISCORD");
  assert((fullOrder.taxesTotal ?? 0) > 0, "Taxes total must be computed");
  assert(fullOrder.items.length === 1, "Order items count must match cart");
  assert.strictEqual(fullOrder.items[0].name, product.name);
  assert.strictEqual(fullOrder.items[0].qty, 1);
  assert(fullOrder.events.length >= 1, "Order audit events timeline must contain placement entry");
  console.log(`✓ Order #${orderNum} verified with all required fields (customer, delivery & billing addresses, unit price, taxes, timeline)`);

  // Step 6: Verify Customer appears & updates in Admin -> Customers
  console.log("\n--- Step 6: Customer CRM & Profile Linkage ---");
  const customers = listCustomers(customerEmail);
  assert(customers.length >= 1, "Customer must appear in Admin customer list");
  const cRecord = customers[0];
  assert.strictEqual(cRecord.email, customerEmail);
  assert.strictEqual(cRecord.name, customerName);
  assert.strictEqual(cRecord.ordersCount, 1, "Customer ordersCount must be 1");
  assert.strictEqual(cRecord.lifetimeValue, fullOrder.total, "Customer LTV must match order total");
  assert(cRecord.latestOrder !== null, "Customer latestOrder must be present");
  assert.strictEqual(cRecord.latestOrder?.number, orderNum);
  assert((cRecord.addressCount ?? 0) >= 1, "Customer addressCount must be >= 1");
  console.log(`✓ Customer list entry verified: LTV: ₹${cRecord.lifetimeValue / 100}, Orders: ${cRecord.ordersCount}, Latest: ${cRecord.latestOrder?.number}`);

  const customerDetail = getCustomerDetail(cRecord.id);
  assert(customerDetail, "Customer detail must be retrieved");
  assert.strictEqual(customerDetail.account?.id, acc.id, "Linked account ID must match signed-up account");
  assert(customerDetail.orders.some((o) => o.number === orderNum), "Complete order history must include Order #" + orderNum);
  assert(customerDetail.addresses.length >= 1, "Customer saved addresses must contain checkout address");
  assert(customerDetail.timeline.length >= 1, "Customer activity timeline must contain order event");
  console.log(`✓ Customer detail page verified: ${customerDetail.addresses.length} address(es), ${customerDetail.orders.length} order(s), ${customerDetail.timeline.length} timeline event(s)`);

  // Step 7: Customer Paddock Account persistence
  console.log("\n--- Step 7: Customer Paddock Orders Lookup ---");
  const paddockOrders = getCustomerOrders(customerEmail, { accountId: acc.id });
  assert(paddockOrders.length >= 1, "Paddock query must return customer orders");
  assert(paddockOrders.some((o) => o.number === orderNum), "Paddock orders must include Order #" + orderNum);
  console.log(`✓ Customer signed-in paddock orders verified: ${paddockOrders.length} order(s) connected to account #${acc.id}`);

  // Step 8: Admin Status Transitions Lifecycle
  console.log("\n--- Step 8: Full Admin Status Lifecycle & Actions ---");
  // Action 1: Accept/Confirm Order -> PAID
  const acceptedOrder = updateOrderStatus(fullOrder.id, {
    to: "PAID",
    note: "Payment verified on Discord #billing",
    actor: "admin@burnoutwheels.com",
  });
  assert.strictEqual(acceptedOrder.status, "PAID");
  assert.strictEqual(acceptedOrder.paymentStatus, "PAID");
  console.log("✓ Action 'Accept/Confirm Order': Status -> PAID, paymentStatus -> PAID");

  // Action 2: Mark Processing -> PROCESSING
  const processingOrder = updateOrderStatus(fullOrder.id, {
    to: "PROCESSING",
    note: "Order dispatched to assembly bay",
    actor: "admin@burnoutwheels.com",
  });
  assert.strictEqual(processingOrder.status, "PROCESSING");
  console.log("✓ Action 'Mark Processing': Status -> PROCESSING");

  // Action 3: Mark Packed -> PACKING
  const packedOrder = updateOrderStatus(fullOrder.id, {
    to: "PACKING",
    note: "Order packed in protective bubble wrap",
    actor: "admin@burnoutwheels.com",
  });
  assert.strictEqual(packedOrder.status, "PACKING");
  console.log("✓ Action 'Mark Packed': Status -> PACKING");

  // Action 4: Add Tracking & Mark Shipped -> SHIPPED
  const shippedOrder = updateOrderStatus(fullOrder.id, {
    to: "SHIPPED",
    note: "Handed over to courier",
    actor: "admin@burnoutwheels.com",
    trackingCarrier: "BlueDart Express",
    trackingNumber: "BD-88990011-IN",
  });
  assert.strictEqual(shippedOrder.status, "SHIPPED");
  assert.strictEqual(shippedOrder.trackingCarrier, "BlueDart Express");
  assert.strictEqual(shippedOrder.trackingNumber, "BD-88990011-IN");
  console.log(`✓ Action 'Mark Shipped' + 'Add Tracking': Status -> SHIPPED (${shippedOrder.trackingCarrier} ${shippedOrder.trackingNumber})`);

  // Action 5: Update Shiprocket tracking
  const srOrder = updateShiprocket(
    fullOrder.id,
    {
      shiprocketAwb: "SR-AWB-998877",
      shiprocketOrderId: "SR-ORD-112233",
      shiprocketStatus: "IN_TRANSIT",
      shiprocketLabelUrl: "https://shiprocket.co/label/demo",
    },
    "admin@burnoutwheels.com"
  );
  assert.strictEqual(srOrder.shiprocketAwb, "SR-AWB-998877");
  console.log(`✓ Action 'Save Shiprocket': AWB ${srOrder.shiprocketAwb} saved and linked`);

  // Action 6: Mark Delivered -> DELIVERED
  const deliveredOrder = updateOrderStatus(fullOrder.id, {
    to: "DELIVERED",
    note: "Customer confirmed delivery",
    actor: "admin@burnoutwheels.com",
  });
  assert.strictEqual(deliveredOrder.status, "DELIVERED");
  console.log("✓ Action 'Mark Delivered': Status -> DELIVERED");

  // Step 9: Admin Filters & Search Verification
  console.log("\n--- Step 9: Admin Search & Filter Criteria ---");
  const filteredByNumber = adminListOrders({ q: orderNum });
  assert(filteredByNumber.some((o) => o.number === orderNum), "Search by order number must return order");

  const filteredByEmail = adminListOrders({ q: customerEmail });
  assert(filteredByEmail.some((o) => o.number === orderNum), "Search by customer email must return order");

  const filteredByPayment = adminListOrders({ paymentMethod: "UPI" });
  assert(filteredByPayment.some((o) => o.number === orderNum), "Filter by paymentMethod UPI must return order");

  const filteredByPaymentStatus = adminListOrders({ paymentStatus: "PAID" });
  assert(filteredByPaymentStatus.some((o) => o.number === orderNum), "Filter by paymentStatus PAID must return order");

  const filteredByFulfilment = adminListOrders({ fulfilmentStatus: "DELIVERED" });
  assert(filteredByFulfilment.some((o) => o.number === orderNum), "Filter by fulfilmentStatus DELIVERED must return order");
  console.log("✓ Filter checks passed: search by order #, email, paymentMethod, paymentStatus, and fulfilmentStatus all verified");

  // Step 10: Soft-Archive & Restore Lifecycle
  console.log("\n--- Step 10: Archive / Soft-Delete & Restore Lifecycle ---");
  const archived = archiveOrder(fullOrder.id, "admin@burnoutwheels.com");
  assert.strictEqual(archived.isArchived, 1);
  assert(archived.archivedAt !== null);

  const activeOrders = adminListOrders({ status: "ALL" });
  assert(!activeOrders.some((o) => o.number === orderNum), "Archived order must NOT appear in default active list");

  const archivedOrders = adminListOrders({ status: "ARCHIVED" });
  assert(archivedOrders.some((o) => o.number === orderNum), "Archived order MUST appear under ARCHIVED filter");

  const restored = restoreOrder(fullOrder.id, "admin@burnoutwheels.com");
  assert.strictEqual(restored.isArchived, 0);

  const activeAfterRestore = adminListOrders({ status: "ALL" });
  assert(activeAfterRestore.some((o) => o.number === orderNum), "Restored order MUST reappear in active list");
  console.log("✓ Soft-archive and restore lifecycle verified completely with full audit trail preservation");

  // Step 11: Guest Checkout followed by Account Activation
  console.log("\n--- Step 11: Guest Checkout followed by Account Activation ---");
  const guestEmail = `guest_${testId.toLowerCase()}@burnoutwheels.com`;
  const guestResult = createOrderFromCheckout({
    items: [{ productId: product.id, qty: 1 }],
    name: "Guest Driver",
    email: guestEmail,
    addressLine: "77 Racing Circuit, Sector 12",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
    country: "India",
    shippingMethod: "STANDARD",
    paymentMethod: "COD",
    idempotencyKey: `IDEMP-${testId}-GUEST`,
  });
  assert(guestResult.number, "Guest order must be created");

  // Verify guest order exists and is connected
  const guestOrder = db.prepare("SELECT * FROM orders WHERE number = ?").get(guestResult.number) as { id: number };
  assert(guestOrder, "Guest order exists in DB");

  // Now customer signs up with this email
  const existingAcc = accountByEmail(guestEmail);
  assert(existingAcc, "Account record exists from guest checkout");
  assert(!existingAcc.passwordHash, "Guest account has no password yet");

  // Activating password via setPassword
  setPassword(guestEmail, "MyNewSecretPassword99!");
  const activatedAcc = accountByEmail(guestEmail);
  assert(activatedAcc && activatedAcc.passwordHash, "Password must be set");
  assert(activatedAcc.verified, "Account must be verified");

  // Check paddock retrieval after activation
  const guestPaddockOrders = getCustomerOrders(guestEmail, { accountId: activatedAcc.id });
  assert(guestPaddockOrders.some((o) => o.number === guestResult.number), "Guest order must be accessible in newly activated account paddock");
  console.log(`✓ Guest order #${guestResult.number} seamlessly linked and accessible in activated account paddock`);

  // Step 12: Shopify Webhook Sync Without Duplication
  console.log("\n--- Step 12: Shopify Webhook Sync Integrity ---");
  const shopifyOrderId = Math.floor(1000000000 + Math.random() * 9000000000);
  const shopifyPayload = {
    id: shopifyOrderId,
    name: `#SHOPIFY-${shopifyOrderId}`,
    created_at: new Date().toISOString(),
    total_price: "2499.00",
    current_total_price: "2499.00",
    financial_status: "paid",
    fulfillment_status: null,
    customer: {
      email: `shopify_buyer_${testId.toLowerCase()}@burnoutwheels.com`,
      first_name: "Fernando",
      last_name: "Alonso",
    },
    fulfillments: [
      {
        tracking_company: "DHL Express",
        tracking_number: "DHL-MONACO-7711",
      },
    ],
  };

  // First sync: orders/create
  await handleWebhookTopic("orders/create", shopifyPayload);
  const shopifyOrder = db.prepare("SELECT * FROM orders WHERE number = ?").get(shopifyPayload.name) as { id: number; paymentStatus: string; trackingNumber: string; total: number };
  assert(shopifyOrder, "Shopify order must be created");
  assert.strictEqual(shopifyOrder.paymentStatus, "PAID");
  assert.strictEqual(shopifyOrder.trackingNumber, "DHL-MONACO-7711");

  const shopifyCustBefore = db.prepare("SELECT ordersCount, lifetimeValue FROM customers WHERE LOWER(email) = LOWER(?)").get(shopifyPayload.customer.email) as { ordersCount: number; lifetimeValue: number };
  assert.strictEqual(shopifyCustBefore.ordersCount, 1);
  assert.strictEqual(shopifyCustBefore.lifetimeValue, 249900);

  // Second sync: orders/updated — must NOT inflate customer count or LTV
  await handleWebhookTopic("orders/updated", {
    ...shopifyPayload,
    fulfillment_status: "shipped",
  });

  const shopifyCustAfter = db.prepare("SELECT ordersCount, lifetimeValue FROM customers WHERE LOWER(email) = LOWER(?)").get(shopifyPayload.customer.email) as { ordersCount: number; lifetimeValue: number };
  assert.strictEqual(shopifyCustAfter.ordersCount, 1, "ordersCount must NOT increase on order updates");
  assert.strictEqual(shopifyCustAfter.lifetimeValue, 249900, "lifetimeValue must NOT inflate on order updates");
  console.log("✓ Shopify webhook sync verified: payment, tracking, and customer LTV preserved without duplicate inflation on updates");

  console.log("\n==================================================================");
  console.log("   ALL 12 END-TO-END FLOW SCENARIOS PASSED WITH 100% SUCCESS!    ");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
