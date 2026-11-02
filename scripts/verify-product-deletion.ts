import { createProduct, deleteProduct, getProductById, listProducts } from "../src/lib/catalog";
import { getDb, ensureSeedProducts } from "../src/lib/db";
import { normalizeProductInput } from "../src/lib/validation";

async function run() {
  console.log("=== Testing Product Deletion Resilience ===");
  const db = getDb();

  // 1. Create a product to test deletion
  const input = normalizeProductInput({
    name: "Audi Sport Quattro S1 E2",
    category: "Rally Legends",
    priceSale: 259900,
    priceCost: 120000,
    stock: 15,
    description: "Group B monster diecast.",
    images: ["/uploads/u-mvw91pc7-esyi8.jpg"],
  });
  if (!input.ok) throw new Error("Failed to normalize input");

  const product = createProduct(input.data);
  console.log("✓ Created test product, ID:", product.id, "Slug:", product.slug);

  const beforeDelete = getProductById(product.id);
  if (!beforeDelete) throw new Error("Product should exist before deletion");

  // 2. Perform deletion
  const delResult = deleteProduct(product.id);
  console.log("✓ deleteProduct executed successfully. Mode:", delResult.mode);

  // 3. Verify it is gone from products table
  const afterDelete = getProductById(product.id);
  if (afterDelete) throw new Error("Product still exists in DB after deletion!");
  console.log("✓ Verified product is removed from products table");

  // 4. Verify slug is recorded in deleted_products table
  const deletedRow = db.prepare("SELECT * FROM deleted_products WHERE slug = ?").get(product.slug) as { slug: string } | undefined;
  if (!deletedRow) throw new Error("Slug was not logged in deleted_products table");
  console.log("✓ Verified slug is recorded in deleted_products table:", deletedRow.slug);

  // 5. Test that calling ensureSeedProducts or sync does NOT resurrect deleted products
  ensureSeedProducts(db);
  const stillDeleted = getProductById(product.id);
  if (stillDeleted) throw new Error("Product was resurrected by ensureSeedProducts!");
  console.log("✓ Verified ensureSeedProducts does not resurrect deleted product");

  // 6. Test deleting a seed product
  const seedProd = db.prepare("SELECT id, slug, name FROM products WHERE slug = 'ferrari-f40-competizione-rosso'").get() as { id: number; slug: string; name: string } | undefined;
  if (seedProd) {
    console.log(`Testing deletion of seed product: ${seedProd.name} (${seedProd.slug})`);
    deleteProduct(seedProd.id);
    const checkSeedGone = getProductById(seedProd.id);
    if (checkSeedGone) throw new Error("Seed product was not deleted");

    // Call ensureSeedProducts to prove seed product will NOT come back
    ensureSeedProducts(db);
    const checkSeedResurrected = db.prepare("SELECT id FROM products WHERE slug = 'ferrari-f40-competizione-rosso'").get();
    if (checkSeedResurrected) throw new Error("Seed product was resurrected after being deleted!");
    console.log("✓ Verified seed product deletion is PERMANENT and never resurrected by cold-start seeds!");
  }

  // 7. Verify listing in storefront catalog excludes deleted items
  const activeProducts = listProducts({ status: "ACTIVE" });
  const foundAudi = activeProducts.some((p) => p.slug === product.slug);
  const foundFerrari = activeProducts.some((p) => p.slug === "ferrari-f40-competizione-rosso");
  if (foundAudi || foundFerrari) throw new Error("Deleted products found in active listing!");
  console.log("✓ Verified storefront listProducts excludes all deleted items");

  console.log("==================================================");
  console.log("ALL PRODUCT DELETION CHECKS PASSED WITH 100% SUCCESS!");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
