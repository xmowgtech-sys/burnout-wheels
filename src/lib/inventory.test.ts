import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLowStockSummary,
  filterLowStockProducts,
  getStockFillPercent,
  getStockSeverity,
  getSuggestedRestockQty,
  isLowStock,
  sortLowStockProducts,
  validateRestockDelta,
} from "./inventory";

test("getStockSeverity and isLowStock classify out, below, at_threshold, and healthy accurately", () => {
  assert.equal(getStockSeverity(0, 3), "out");
  assert.equal(getStockSeverity(0, 0), "out");
  assert.equal(getStockSeverity(2, 5), "below");
  assert.equal(getStockSeverity(1, 1), "at_threshold");
  assert.equal(getStockSeverity(6, 5), "healthy");

  assert.equal(isLowStock(0, 2), true);
  assert.equal(isLowStock(1, 2), true);
  assert.equal(isLowStock(2, 2), true);
  assert.equal(isLowStock(3, 2), false);
});

test("getSuggestedRestockQty guarantees a single click clears threshold cleanly", () => {
  assert.equal(getSuggestedRestockQty(1, 1), 5);
  assert.equal(getSuggestedRestockQty(0, 1), 10);
  assert.equal(getSuggestedRestockQty(2, 10), 15);
  assert.equal(getSuggestedRestockQty(0, 0), 5);

  for (const [stock, threshold] of [
    [0, 1],
    [1, 1],
    [2, 5],
    [4, 12],
    [0, 20],
  ]) {
    const qty = getSuggestedRestockQty(stock, threshold);
    assert.ok(stock + qty > threshold, `Expected ${stock} + ${qty} > ${threshold}`);
  }
});

test("validateRestockDelta rejects invalid, zero, negative, float, and oversized values", () => {
  assert.deepEqual(validateRestockDelta(5), { ok: true, qty: 5 });
  assert.deepEqual(validateRestockDelta("12"), { ok: true, qty: 12 });
  assert.equal(validateRestockDelta(0).ok, false);
  assert.equal(validateRestockDelta(-3).ok, false);
  assert.equal(validateRestockDelta(2.5).ok, false);
  assert.equal(validateRestockDelta("abc").ok, false);
  assert.equal(validateRestockDelta(50000).ok, false);
});

test("sortLowStockProducts prioritizes out-of-stock, then lowest stock/threshold ratio, then name", () => {
  const items = [
    { name: "Ferrari F50", stock: 1, lowStockThreshold: 1 },
    { name: "Williams Blue", stock: 0, lowStockThreshold: 2 },
    { name: "RB20 F1", stock: 1, lowStockThreshold: 4 },
    { name: "Apex GT", stock: 0, lowStockThreshold: 1 },
  ];
  const sorted = sortLowStockProducts(items);
  assert.deepEqual(
    sorted.map((p) => p.name),
    ["Apex GT", "Williams Blue", "RB20 F1", "Ferrari F50"]
  );
});

test("filterLowStockProducts and computeLowStockSummary calculate counts accurately", () => {
  const items = [
    { name: "A", stock: 0, lowStockThreshold: 2 },
    { name: "B", stock: 1, lowStockThreshold: 3 },
    { name: "C", stock: 1, lowStockThreshold: 1 },
  ];

  assert.equal(filterLowStockProducts(items, "all").length, 3);
  assert.equal(filterLowStockProducts(items, "out").length, 1);
  assert.equal(filterLowStockProducts(items, "low").length, 2);

  const summary = computeLowStockSummary(items);
  assert.equal(summary.totalAlerts, 3);
  assert.equal(summary.outOfStockCount, 1);
  assert.equal(summary.belowThresholdCount, 1);
  assert.equal(summary.atThresholdCount, 1);
  // Needed to exceed threshold (threshold + 1): (3-0) + (4-1) + (2-1) = 3 + 3 + 1 = 7
  assert.equal(summary.totalUnitsShort, 7);

  assert.equal(getStockFillPercent(0, 5), 0);
  assert.equal(getStockFillPercent(5, 5), 50);
  assert.equal(getStockFillPercent(10, 5), 100);
});
