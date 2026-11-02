import { getDb, nowIso } from "./db";

export interface WishlistItem {
  productId: number;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  condition: string;
  addedAt?: string;
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Returns all active wishlist items for a given customer account.
 */
export function getAccountWishlist(accountId: number): WishlistItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT w.productId, p.slug, p.name, p.priceSale, p.images, p.condition, w.createdAt as addedAt
    FROM wishlistItems w
    JOIN products p ON p.id = w.productId
    WHERE w.accountId = ? AND p.status = 'ACTIVE'
    ORDER BY w.createdAt DESC
  `).all(accountId) as {
    productId: number;
    slug: string;
    name: string;
    priceSale: number;
    images: string | null;
    condition: string;
    addedAt: string;
  }[];

  return rows.map((r) => {
    const images = parseImages(r.images);
    return {
      productId: Number(r.productId),
      slug: String(r.slug),
      name: String(r.name),
      price: Number(r.priceSale),
      image: images[0] ?? null,
      condition: String(r.condition || "New / Boxed"),
      addedAt: r.addedAt,
    };
  });
}

/**
 * Toggles a product in customer's wishlist: adds if not present, removes if already present.
 */
export function toggleAccountWishlist(accountId: number, productId: number): { added: boolean; items: WishlistItem[] } {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM wishlistItems WHERE accountId = ? AND productId = ?").get(accountId, productId);
  if (existing) {
    db.prepare("DELETE FROM wishlistItems WHERE accountId = ? AND productId = ?").run(accountId, productId);
    return { added: false, items: getAccountWishlist(accountId) };
  } else {
    // Check product exists
    const prod = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'").get(productId);
    if (prod) {
      db.prepare("INSERT OR IGNORE INTO wishlistItems (accountId, productId, createdAt) VALUES (?,?,?)").run(accountId, productId, nowIso());
    }
    return { added: true, items: getAccountWishlist(accountId) };
  }
}

/**
 * Removes a product from the customer's wishlist.
 */
export function removeAccountWishlist(accountId: number, productId: number): WishlistItem[] {
  const db = getDb();
  db.prepare("DELETE FROM wishlistItems WHERE accountId = ? AND productId = ?").run(accountId, productId);
  return getAccountWishlist(accountId);
}

/**
 * Merges an array of product IDs into the customer's database wishlist (e.g. after login).
 */
export function syncAccountWishlist(accountId: number, productIds: number[]): WishlistItem[] {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return getAccountWishlist(accountId);
  }
  const db = getDb();
  const insertStmt = db.prepare("INSERT OR IGNORE INTO wishlistItems (accountId, productId, createdAt) VALUES (?,?,?)");
  const ts = nowIso();
  for (const pid of productIds) {
    if (typeof pid === "number" && !isNaN(pid)) {
      // Validate product exists
      const prod = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'").get(pid);
      if (prod) {
        insertStmt.run(accountId, pid, ts);
      }
    }
  }
  return getAccountWishlist(accountId);
}
