import { z } from "zod";

const rupeeField = (label: string, min = 1) =>
  z
    .number({ invalid_type_error: `${label} is required` })
    .int(`${label} must be a whole rupee amount`)
    .min(min, `${label} must be at least ₹${min}`);

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        slug: z.string().trim().optional(),
        qty: z.coerce.number().int().min(1).max(10),
      })
    )
    .min(1, "Your cart is empty")
    .max(20, "Too many line items"),
  idempotencyKey: z.string().trim().max(100).optional(),
  accountId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(2, "Enter the delivery name").max(120),
  email: z.string().trim().email("Enter a valid email").max(190).toLowerCase(),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,15})$/, "Enter a valid phone number").max(25).optional().or(z.literal("")),
  addressLine: z.string().trim().min(6, "Enter the full street address").max(240),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits"),
  country: z.string().trim().max(80).optional(),
  billingAddress: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
  shippingMethod: z.enum(["STANDARD", "EXPRESS"]),
  paymentMethod: z.enum(["UPI", "COD"]),
  paymentChannel: z.enum(["DISCORD", "WHATSAPP", "RAZORPAY"]).optional(),
  discountCode: z.string().trim().max(24).optional().or(z.literal("")),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(160),
  slug: z.string().trim().max(180),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(60),
  scale: z.string().trim().max(20).optional().or(z.literal("")),
  condition: z.enum(["NEW", "LIKE_NEW", "GRADED", "PRE_OWNED"]).default("NEW"),
  description: z.string().trim().max(10000).default(""),
  highlights: z.array(z.string().trim().max(220)).max(20).default([]),
  tags: z.array(z.string().trim().max(60)).max(30).default([]),
  images: z.array(z.string().trim().min(1)).max(20).default([]),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  imagePosition: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
  priceSale: z.coerce.number({ invalid_type_error: "Sale price is required" }).min(100, "Sale price at least ₹1"),
  priceCost: z.coerce.number().min(0).default(0),
  feePercent: z.coerce.number().min(0).max(40).default(2),
  stock: z.coerce.number().int().min(0).max(9999).default(10),
  lowStockThreshold: z.coerce.number().int().min(0).max(999).default(3),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("ACTIVE"),
  featured: z.boolean().default(false),
  /** Sequential drop number — assigned automatically when omitted. */
  dropNumber: z.coerce.number().int().min(0).max(99999).optional(),
  rarity: z.enum(["STANDARD", "RARE", "UNIQUE"]).default("STANDARD"),
  dropAt: z.string().trim().optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  slug: z.string().trim().max(180).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Add your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(190),
  rating: z.coerce.number().int().min(1, "Rate 1–5").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Tell us a bit more (10+ characters)").max(1500),
});

export const discountSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "3–20 letters/numbers/dashes"),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.coerce.number().int().min(1, "Value must be positive").max(100000),
  minSubtotal: rupeeField("Minimum cart value", 0),
  maxUses: z.coerce.number().int().min(0).max(100000),
  startsAt: z.string().trim().optional().or(z.literal("")),
  endsAt: z.string().trim().optional().or(z.literal("")),
  active: z.boolean(),
});

export const teamCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(190).toLowerCase(),
  role: z.enum(["ADMIN", "STAFF"]),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

const homeImage = z.string().trim().max(2000);
const productIdOrNull = z.union([z.number().int().positive(), z.null()]);

const homeSettingsSchema = z.object({
  heroDesktopImage: homeImage,
  heroMobileImage: homeImage,
  heroFit: z.enum(["cover", "contain"]),
  heroPosition: z.enum(["center", "top", "bottom", "left", "right"]),
  heroKicker: z.string().trim().max(120),
  heroHeadline: z.string().trim().max(160),
  heroSubline: z.string().trim().max(600),
  heroDropProductId: productIdOrNull,
  featuredProductId: productIdOrNull,
  featuredImage: homeImage.default(""),
  featuredImageFit: z.enum(["cover", "contain"]).default("cover"),
  featuredImagePosition: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
  featuredLabel: z.string().trim().max(60),
  tickerItems: z.array(z.string().trim().max(120)).max(16),
  gridProductIds: z.array(z.number().int().positive()).max(24),
  gridTitle: z.string().trim().max(80),
  gridSubline: z.string().trim().max(400),
  trustTitle: z.string().trim().max(80),
  trustSubline: z.string().trim().max(400),
  newsletterTitle: z.string().trim().max(120),
  newsletterSubline: z.string().trim().max(400),
  showPitWall: z.boolean(),
  showProductIndex: z.boolean(),
});

export const storefrontSettingsSchema = z.object({
  shipping: z.object({
    standard: z.number({ invalid_type_error: "Standard shipping fee is required" }).int().min(0).max(5000000),
    express: z.number({ invalid_type_error: "Express shipping fee is required" }).int().min(0).max(5000000),
    freeOver: z.number({ invalid_type_error: "Free-shipping threshold is required" }).int().min(100).max(50000000),
  }),
  returnsDays: z.coerce.number().int().min(0).max(90),
  paymentMethods: z.array(z.enum(["UPI", "COD"])).min(1, "Pick at least one payment method"),
  home: homeSettingsSchema.optional(),
});

export const trustpilotSettingsSchema = z.object({
  mode: z.enum(["coming_soon", "live"]),
  profileUrl: z.string().trim().url("Profile URL must be valid").max(300).or(z.literal("")),
  note: z.string().trim().max(400),
});

const optionalHttps = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || /^https:\/\//i.test(value), `${label} must start with https://`);

export const discordSettingsSchema = z.object({
  billingWebhookUrl: optionalHttps("Billing webhook"),
  adminWebhookUrl: optionalHttps("Admin webhook"),
  checkoutUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "Checkout link must be a URL"),
});

export const contactOrderLookup = z.object({
  number: z.string().trim().min(4).max(40),
  email: z.string().trim().email().max(190).toLowerCase(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type DiscountInput = z.infer<typeof discountSchema>;

/** An explicit 0 is a real value (sold out, no fee, no warning). Only blank/NaN use the fallback. */
function numericOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Preprocess and normalize a product payload so minor formatting variations never block creation. */
export function normalizeProductInput(raw: Record<string, unknown>) {
  const name = String(raw.name ?? "").trim();
  let slug = String(raw.slug ?? "").trim();
  if (!slug && name) {
    slug = name;
  }
  slug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) slug = "product-" + Date.now().toString(36);

  const category = String(raw.category ?? "").trim() || "Rare Drops";
  const desc = String(raw.description ?? "").trim() || `${name || "Diecast piece"} — authentic collector item.`;
  const condition = ["NEW", "LIKE_NEW", "GRADED", "PRE_OWNED"].includes(String(raw.condition))
    ? raw.condition
    : "NEW";
  const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(String(raw.status))
    ? raw.status
    : "ACTIVE";

  let rawImages: string[] = [];
  if (Array.isArray(raw.images)) {
    rawImages = raw.images
      .map((img) => String(img || "").trim())
      .filter(Boolean)
      .map((img) => (img.startsWith("http") || img.startsWith("/") || img.startsWith("data:") ? img : `/${img}`));
  }
  if (rawImages.length === 0) {
    rawImages = ["/uploads/u-mvxjll11-0wvz0.png"];
  }

  const cleaned = {
    ...raw,
    name: name || "Collector Piece",
    slug,
    category,
    condition,
    status,
    description: desc,
    images: rawImages,
    brand: raw.brand != null ? String(raw.brand).trim() : "",
    scale: raw.scale != null ? String(raw.scale).trim() : "1:64",
    rarity: ["STANDARD", "RARE", "UNIQUE"].includes(String(raw.rarity)) ? raw.rarity : "STANDARD",
    dropNumber: Math.max(0, Math.round(numericOr(raw.dropNumber, 0))),
    priceSale: Math.max(100, Math.round(numericOr(raw.priceSale, 199900))),
    priceCost: Math.max(0, Math.round(numericOr(raw.priceCost, 0))),
    feePercent: Math.max(0, Math.min(40, numericOr(raw.feePercent, 2))),
    stock: Math.max(0, Math.round(numericOr(raw.stock, 10))),
    lowStockThreshold: Math.max(0, Math.round(numericOr(raw.lowStockThreshold, 3))),
    featured: Boolean(raw.featured),
    dropAt: raw.dropAt != null ? String(raw.dropAt).trim() : "",
    highlights: Array.isArray(raw.highlights)
      ? raw.highlights.map((h) => String(h).trim()).filter(Boolean)
      : [],
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
      : typeof raw.tags === "string"
        ? (raw.tags as string).split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    imageFit: raw.imageFit === "contain" ? "contain" : "cover",
    imagePosition: ["center", "top", "bottom", "left", "right"].includes(String(raw.imagePosition))
      ? raw.imagePosition
      : "center",
  };

  const parsed = productInputSchema.safeParse(cleaned);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  return { ok: false as const, error: firstError(parsed.error) };
}

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the highlighted fields";
}
