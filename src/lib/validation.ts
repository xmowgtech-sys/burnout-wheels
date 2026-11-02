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
        qty: z.coerce.number().int().min(1).max(10),
      })
    )
    .min(1, "Your cart is empty")
    .max(20, "Too many line items"),
  name: z.string().trim().min(2, "Enter the delivery name").max(120),
  email: z.string().trim().email("Enter a valid email").max(190).toLowerCase(),
  phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,15})$/, "Enter a valid phone number").max(25).optional().or(z.literal("")),
  addressLine: z.string().trim().min(6, "Enter the full street address").max(240),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits"),
  country: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
  shippingMethod: z.enum(["STANDARD", "EXPRESS"]),
  paymentMethod: z.enum(["UPI", "COD"]),
  discountCode: z.string().trim().max(24).optional().or(z.literal("")),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(3, "Name needs at least 3 characters").max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only")
    .max(180),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  category: z.string().trim().min(2).max(60),
  scale: z.string().trim().max(12).optional().or(z.literal("")),
  condition: z.enum(["NEW", "LIKE_NEW", "GRADED", "PRE_OWNED"]),
  description: z.string().trim().max(4000),
  highlights: z.array(z.string().trim().max(220)).max(8),
  tags: z.array(z.string().trim().max(40)).max(12),
  images: z.array(z.string().trim().url("Image URLs must be valid links").or(z.string().regex(/^\/(api\/files|uploads)\//, "Upload a new image or use a valid URL"))).max(10),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  imagePosition: z.enum(["center", "top", "bottom", "left", "right"]).default("center"),
  priceSale: z
    .number({ invalid_type_error: "Sale price is required" })
    .int("Sale price must be whole paise")
    .min(100, "Sale price at least ₹1")
    .max(500000000, "Sale price is too high"),
  priceCost: z
    .number({ invalid_type_error: "Cost price is required" })
    .int("Cost price must be whole paise")
    .min(0, "Cost price at least ₹0")
    .max(500000000, "Cost price is too high"),
  feePercent: z.coerce.number().min(0).max(40),
  stock: z.coerce.number().int().min(0).max(9999),
  lowStockThreshold: z.coerce.number().int().min(0).max(999),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
  featured: z.boolean(),
  dropAt: z.string().trim().optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
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

export const chatSettingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1).max(40),
  greeting: z.string().trim().min(1).max(500),
  suggestProducts: z.boolean(),
  showStock: z.boolean(),
  leadCapture: z.boolean(),
  handoffEmail: z.string().trim().email("Enter a valid handoff email").max(190).or(z.literal("")),
  handoffWebhook: z.string().trim().url("Webhook must be a valid URL").max(500).or(z.literal("")),
  faqs: z
    .array(
      z.object({
        keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
        answer: z.string().trim().min(2).max(800),
      })
    )
    .max(16),
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

export const contactOrderLookup = z.object({
  number: z.string().trim().min(4).max(40),
  email: z.string().trim().email().max(190).toLowerCase(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type DiscountInput = z.infer<typeof discountSchema>;

/** Convert a checkout payload's rupee amounts into minor units at the boundary. */
export function normalizeProductInput(raw: Record<string, unknown>) {
  const parsed = productInputSchema.safeParse(raw);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  return { ok: false as const, error: firstError(parsed.error) };
}

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Check the highlighted fields";
}
