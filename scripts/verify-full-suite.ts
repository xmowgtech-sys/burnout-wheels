import assert from "node:assert";
import {
  createOrderFromCheckout,
  adminListOrders,
  adminGetOrder,
  archiveOrder,
  restoreOrder,
  getCustomerDetail,
  updateCustomerNotes,
  getCustomerOrders,
  updateOrderStatus,
} from "../src/lib/orders";
import { getDb } from "../src/lib/db";
import { handleWebhookTopic } from "../src/lib/shopify";

async function main() {
  console.log("==================================================================");
  console.log("   BURNOUT WHEELS — FULL END-TO-END SUITE VERIFICATION (TSX)       ");
  console.log("==================================================================");

  const db = getDb();

  // 1. Fetch an active product
  const product = db.prepare("SELECT * FROM products WHERE status = 'ACTIVE' LIMIT 1").get() as {
    id: number;
    slug: string;
    name: string;
    priceSale: number;
  };
  assert(product, "At least one active product must exist in database");
  console.log(`[Suite] Active product: ${product.name} (id: ${product.id}, ₹${product.priceSale / 100})`);

  // 2. Test createOrderFromCheckout (Simulate real checkout)
  console.log("\n--- Scenario 1: Storefront Checkout Submission ---");
  const testKey = `idemp_suite_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const testEmail = `racer_suite_${Date.now()}@burnoutwheels.com`;

  const checkoutPayload = {
    name: "Lewis Driver",
    email: testEmail,
    phone: "+91 91234 56789",
    addressLine: "Flat 402, Apex Apex, Grand Prix Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
    country: "India",
    billingAddress: "Same as delivery",
    paymentMethod: "UPI" as const,
    paymentChannel: "RAZORPAY",
    shippingMethod: "STANDARD" as const,
    notes: "Urgent delivery before Friday",
    idempotencyKey: testKey,
    items: [
      {
        productId: product.id,
        slug: product.slug,
        qty: 1,
      },
    ],
  };

  const result1 = createOrderFromCheckout(checkoutPayload);
  console.log(`✓ Order placed successfully: Order #${result1.number}, Total: ₹${result1.total / 100}, Status: ${result1.status}`);
  assert(result1.number.startsWith("BW-"), "Order number must start with BW-");
  assert.strictEqual(result1.status, "PAYMENT_REVIEW", "Order with payment channel should start in PAYMENT_REVIEW");

  // 3. Test Idempotency: exact same payload repeated
  console.log("\n--- Scenario 2: Idempotency Protection ---");
  const result2 = createOrderFromCheckout(checkoutPayload);
  console.log(`✓ Repeated checkout returned existing order #${result2.number} without duplicate creation.`);
  assert.strictEqual(result1.number, result2.number, "Idempotent call must return the identical order number");

  const duplicateRows = db.prepare("SELECT COUNT(*) as count FROM orders WHERE idempotencyKey = ?").get(testKey) as { count: number };
  assert.strictEqual(duplicateRows.count, 1, "Database must strictly contain exactly 1 order for idempotencyKey");

  // 4. Test adminGetOrder & updateOrderStatus (Payment confirmation)
  console.log("\n--- Scenario 3: Admin Order Retrieval & Status Lifecycle ---");
  const orderRecord = db.prepare("SELECT id FROM orders WHERE number = ?").get(result1.number) as { id: number };
  let orderDetail = adminGetOrder(orderRecord.id);
  assert(orderDetail, "adminGetOrder returned null");
  assert.strictEqual(orderDetail.number, result1.number);
  assert.strictEqual(orderDetail.email, testEmail);
  assert.strictEqual(orderDetail.idempotencyKey, testKey);
  assert.strictEqual(orderDetail.paymentStatus, "REVIEW");
  assert(orderDetail.taxesTotal !== undefined && orderDetail.taxesTotal > 0, "Taxes must be computed and saved");
  assert.strictEqual(orderDetail.items.length, 1, "Order items must be persisted");
  assert(orderDetail.events.length >= 1, "Order creation event must be logged");

  // Transition order from PAYMENT_REVIEW -> PAID (Accept/Confirm)
  orderDetail = updateOrderStatus(orderRecord.id, {
    to: "PAID",
    actor: "admin@burnoutwheels.com",
    note: "Payment confirmed via Razorpay UPI",
  });
  assert.strictEqual(orderDetail.status, "PAID");
  assert.strictEqual(orderDetail.paymentStatus, "PAID");
  console.log("✓ Admin confirmed order payment: Status -> PAID, paymentStatus -> PAID");

  // Transition order from PAID -> PACKING
  orderDetail = updateOrderStatus(orderRecord.id, {
    to: "PACKING",
    actor: "warehouse@burnoutwheels.com",
  });
  assert.strictEqual(orderDetail.status, "PACKING");
  console.log("✓ Warehouse transition: Status -> PACKING");

  // Transition order from PACKING -> SHIPPED with Tracking
  orderDetail = updateOrderStatus(orderRecord.id, {
    to: "SHIPPED",
    actor: "dispatch@burnoutwheels.com",
    trackingCarrier: "BlueDart Express",
    trackingNumber: "BD9928374IN",
  });
  assert.strictEqual(orderDetail.status, "SHIPPED");
  assert.strictEqual(orderDetail.trackingCarrier, "BlueDart Express");
  assert.strictEqual(orderDetail.trackingNumber, "BD9928374IN");
  console.log("✓ Dispatch transition: Status -> SHIPPED with carrier tracking BD9928374IN");

  // 5. Test adminListOrders with Filters & Search
  console.log("\n--- Scenario 4: Admin List Filters & Search ---");
  const listAll = adminListOrders({ status: "ALL" });
  assert(listAll.some((o) => o.number === result1.number), "Order must be visible in adminListOrders({ status: 'ALL' })");

  const searchByEmail = adminListOrders({ q: testEmail });
  assert.strictEqual(searchByEmail.length, 1, "Search by email must return exact order");
  assert.strictEqual(searchByEmail[0].number, result1.number);

  const searchByNumber = adminListOrders({ q: result1.number });
  assert.strictEqual(searchByNumber.length, 1, "Search by order number must return exact order");

  console.log("✓ Admin listing and searching by number/email verified.");

  // 6. Test Admin Actions: Archiving & Restoring
  console.log("\n--- Scenario 5: Soft-Archive & Restore Lifecycle ---");
  archiveOrder(orderRecord.id, "admin@burnoutwheels.com");
  let activeList = adminListOrders();
  assert(!activeList.some((o) => o.number === result1.number), "Archived order must NOT appear in default active list");

  let archivedList = adminListOrders({ status: "ARCHIVED" });
  assert(archivedList.some((o) => o.number === result1.number), "Archived order must appear in status: ARCHIVED filter");

  restoreOrder(orderRecord.id, "admin@burnoutwheels.com");
  activeList = adminListOrders();
  assert(activeList.some((o) => o.number === result1.number), "Restored order must appear again in active list");
  console.log("✓ Soft-archive and restore lifecycle verified.");

  // 7. Test Customer CRM connection & Details
  console.log("\n--- Scenario 6: Automatic Customer Profile & CRM Linkage ---");
  const custDetail = getCustomerDetail(testEmail);
  assert(custDetail, "Customer detail must be found by email");
  assert.strictEqual(custDetail.customer.email, testEmail);
  assert.strictEqual(custDetail.customer.ordersCount, 1);
  assert.strictEqual(custDetail.customer.lifetimeValue, result1.total);
  assert(custDetail.account, "Linked account must be created for customer");
  assert(custDetail.orders.length >= 1, "Customer order history must contain the placed order");
  assert(custDetail.addresses.length >= 1, "Customer addresses must include the checkout delivery address");
  assert(custDetail.timeline.length >= 1, "Customer activity timeline must include order event");

  // Test updating customer CRM notes & status
  updateCustomerNotes(custDetail.customer.id, "VIP Customer with fast-lane delivery", "VIP");
  const updatedCustDetail = getCustomerDetail(testEmail);
  assert.strictEqual(updatedCustDetail?.customer.notes, "VIP Customer with fast-lane delivery");
  assert.strictEqual(updatedCustDetail?.customer.status, "VIP");
  console.log("✓ Customer CRM profile, addresses, order history, and notes successfully verified.");

  // 8. Test Customer Paddock Account orders lookup
  console.log("\n--- Scenario 7: Customer Paddock Orders Lookup ---");
  const paddockOrders = getCustomerOrders(testEmail);
  assert(paddockOrders.some((o) => o.number === result1.number), "Paddock orders must return the order placed by customer");
  console.log(`✓ Customer paddock order query returned ${paddockOrders.length} orders linked to customer account.`);

  // 9. Test Shopify Order & Webhook Sync
  console.log("\n--- Scenario 8: Shopify Sync & Webhook Processing ---");
  const shopifyWebhookPayload = {
    id: 9988776655,
    name: "#BW-SP-9001",
    created_at: new Date().toISOString(),
    financial_status: "paid",
    fulfillment_status: "fulfilled",
    total_price: "2499.00",
    current_total_price: "2499.00",
    subtotal_price: "2499.00",
    current_subtotal_price: "2499.00",
    total_discounts: "0.00",
    customer: {
      first_name: "Max",
      last_name: "Verstappen",
      email: "shopify_racer@burnoutwheels.com",
    },
    fulfillments: [
      {
        tracking_company: "DHL Express",
        tracking_number: "DHL-MONACO-9911",
      },
    ],
  };

  await handleWebhookTopic("orders/create", {} as any, shopifyWebhookPayload as any);

  const syncedShopifyOrder = db.prepare("SELECT * FROM orders WHERE number = ?").get("#BW-SP-9001") as any;
  assert(syncedShopifyOrder, "Shopify order must exist in DB");
  assert.strictEqual(syncedShopifyOrder.paymentStatus, "PAID");
  assert.strictEqual(syncedShopifyOrder.status, "DELIVERED");
  assert.strictEqual(syncedShopifyOrder.trackingCarrier, "DHL Express");
  assert.strictEqual(syncedShopifyOrder.trackingNumber, "DHL-MONACO-9911");
  console.log("✓ Shopify order successfully synced with tracking carrier, number, and PAID payment status.");

  console.log("\n==================================================================");
  console.log("   ALL 8 END-TO-END SCENARIOS COMPLETED AND FULLY VERIFIED!       ");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
