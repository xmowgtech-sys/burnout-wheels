import { createProduct, listProducts, getProductBySlug } from "../src/lib/catalog";
import { normalizeProductInput } from "../src/lib/validation";

async function run() {
  console.log("--- Testing Product Creation & Resilient Validation ---");
  
  // 1. Short description + no slug provided + simple image path
  const testInput = {
    name: "BMW M3 E30 DTM #31",
    category: "Touring Cars",
    priceSale: 229900,
    priceCost: 110000,
    stock: 25,
    description: "Crisp diecast touring car.",
    images: ["/uploads/u-mvw91pc7-esyi8.jpg"],
    highlights: ["DTM racing spec", "BBS cross-spoke wheels"]
  };

  const parsed = normalizeProductInput(testInput);
  if (!parsed.ok) {
    throw new Error(`Normalization failed: ${parsed.error}`);
  }
  console.log("✓ Auto-generated slug:", parsed.data.slug);
  if (!parsed.data.slug || parsed.data.slug !== "bmw-m3-e30-dtm-31") {
    throw new Error(`Unexpected slug: ${parsed.data.slug}`);
  }

  const created = createProduct(parsed.data);
  console.log("✓ Created product in SQLite, ID:", created.id, "Slug:", created.slug);

  // 2. Fetch by slug
  const fetched = getProductBySlug(created.slug);
  if (!fetched || fetched.id !== created.id) {
    throw new Error("Failed to fetch created product by slug");
  }
  console.log("✓ Fetched product by slug successfully:", fetched.name);

  // 3. Duplicate slug creation test (ensure collision resolution works smoothly)
  const dupInput = {
    name: "BMW M3 E30 DTM #31",
    category: "Touring Cars",
    priceSale: 229900,
    priceCost: 110000,
    stock: 10,
    description: "Another copy with same name/slug",
    images: ["/uploads/u-mvw91pc7-esyi8.jpg"],
  };
  const parsedDup = normalizeProductInput(dupInput);
  if (!parsedDup.ok) {
    throw new Error(`Normalization failed for duplicate: ${parsedDup.error}`);
  }
  const createdDup = createProduct(parsedDup.data);
  console.log("✓ Duplicate name handled gracefully without SQL crash. New slug:", createdDup.slug);
  if (createdDup.slug === created.slug) {
    throw new Error("Duplicate slug was not made unique!");
  }

  // 4. List active products
  const list = listProducts({ status: "ACTIVE" });
  console.log(`✓ Active products in catalog: ${list.length}`);
  const found = list.some((p) => p.id === created.id);
  if (!found) {
    throw new Error("Newly created product not found in active list");
  }
  console.log("✓ Verified newly created product is present in shop catalog listings!");

  console.log("=================================================");
  console.log("PRODUCT CREATION VERIFICATION PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
