import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComparisonMatrix,
  computeFreeShippingProgress,
  isCompareItem,
  isRecentlyViewedItem,
  pushRecentlyViewed,
  safeParseArray,
  toggleCompareItem,
  type CompareItem,
  type RecentlyViewedItem,
} from "./collector-utils";

const sampleA: CompareItem = {
  id: 1,
  slug: "red-bull-rb20",
  name: "Red Bull Racing RB20 F1",
  brand: "Mini GT",
  category: "Formula 1",
  scale: "1:64",
  condition: "NEW",
  rarity: "RARE",
  priceSale: 189900,
  stock: 4,
  dropNumber: 1,
  image: "/uploads/rb20.jpg",
};

const sampleB: CompareItem = {
  id: 2,
  slug: "ferrari-f50-red",
  name: "Ferrari F50 Rosso Corsa",
  brand: "Tomica Limited",
  category: "Supercars",
  scale: "1:64",
  condition: "GRADED",
  rarity: "UNIQUE",
  priceSale: 249900,
  stock: 1,
  dropNumber: 2,
  image: "/uploads/f50.jpg",
};

const sampleC: CompareItem = {
  id: 3,
  slug: "porsche-911-gt3",
  name: "Porsche 911 GT3 RS",
  brand: "Hot Wheels",
  category: "Track",
  scale: "1:64",
  condition: "LIKE_NEW",
  rarity: "STANDARD",
  priceSale: 99900,
  stock: 0,
  dropNumber: 3,
  image: null,
};

test("computeFreeShippingProgress handles partial, exact, and over-threshold amounts", () => {
  const zero = computeFreeShippingProgress(0, 249900);
  assert.equal(zero.unlocked, false);
  assert.equal(zero.remaining, 249900);
  assert.equal(zero.percent, 0);

  const half = computeFreeShippingProgress(124950, 249900);
  assert.equal(half.unlocked, false);
  assert.equal(half.remaining, 124950);
  assert.equal(half.percent, 50);

  const exact = computeFreeShippingProgress(249900, 249900);
  assert.equal(exact.unlocked, true);
  assert.equal(exact.remaining, 0);
  assert.equal(exact.percent, 100);

  const over = computeFreeShippingProgress(420000, 249900);
  assert.equal(over.unlocked, true);
  assert.equal(over.remaining, 0);
  assert.equal(over.percent, 100);
});

test("toggleCompareItem adds, removes, and enforces max limit", () => {
  const r1 = toggleCompareItem([], sampleA, 2);
  assert.equal(r1.status, "added");
  assert.equal(r1.next.length, 1);

  const r2 = toggleCompareItem(r1.next, sampleB, 2);
  assert.equal(r2.status, "added");
  assert.equal(r2.next.length, 2);

  const rFull = toggleCompareItem(r2.next, sampleC, 2);
  assert.equal(rFull.status, "full");
  assert.equal(rFull.next.length, 2);

  const rRemove = toggleCompareItem(r2.next, sampleA, 2);
  assert.equal(rRemove.status, "removed");
  assert.deepEqual(
    rRemove.next.map((i) => i.id),
    [2]
  );
});

test("buildComparisonMatrix highlights lowest price and highest rarity accurately", () => {
  const rows = buildComparisonMatrix([sampleA, sampleB, sampleC]);
  const priceRow = rows.find((r) => r.key === "price");
  const rarityRow = rows.find((r) => r.key === "rarity");
  const stockRow = rows.find((r) => r.key === "stock");

  assert.ok(priceRow);
  assert.deepEqual(priceRow.highlightIndices, [2]); // sampleC is cheapest (₹999)

  assert.ok(rarityRow);
  assert.deepEqual(rarityRow.highlightIndices, [1]); // sampleB is UNIQUE

  assert.ok(stockRow);
  assert.deepEqual(stockRow.values, ["4 available", "Only 1 left", "Sold out"]);
});

test("pushRecentlyViewed deduplicates, moves latest to front, and caps length", () => {
  const makeItem = (id: number): RecentlyViewedItem => ({
    id,
    slug: `car-${id}`,
    name: `Car ${id}`,
    category: "F1",
    scale: "1:64",
    priceSale: 100000,
    dropNumber: id,
    image: null,
  });

  let list: RecentlyViewedItem[] = [];
  for (let i = 1; i <= 5; i++) {
    list = pushRecentlyViewed(list, makeItem(i), 3);
  }
  assert.deepEqual(
    list.map((i) => i.id),
    [5, 4, 3]
  );

  // Pushing an existing id moves it to the front without duplicating
  list = pushRecentlyViewed(list, makeItem(3), 3);
  assert.deepEqual(
    list.map((i) => i.id),
    [3, 5, 4]
  );
});

test("safeParseArray gracefully guards malformed JSON and bad items", () => {
  assert.deepEqual(safeParseArray(null, isRecentlyViewedItem), []);
  assert.deepEqual(safeParseArray("{not-json", isRecentlyViewedItem), []);
  assert.deepEqual(safeParseArray(JSON.stringify({ id: 1 }), isRecentlyViewedItem), []);

  const mixed = [
    { id: 10, slug: "ok", name: "Valid", category: "GT", scale: "1:64", priceSale: 50000, dropNumber: 1, image: null },
    { id: "bad", slug: "broken" },
  ];
  const parsedRecent = safeParseArray(JSON.stringify(mixed), isRecentlyViewedItem);
  assert.equal(parsedRecent.length, 1);
  assert.equal(parsedRecent[0].id, 10);

  const parsedCompare = safeParseArray(JSON.stringify([sampleA, { broken: true }]), isCompareItem);
  assert.equal(parsedCompare.length, 1);
  assert.equal(parsedCompare[0].id, 1);
});
