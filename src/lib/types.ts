export type Role = "OWNER" | "ADMIN" | "STAFF";

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";
export type ProductCondition = "NEW" | "LIKE_NEW" | "GRADED" | "PRE_OWNED";
export type ProductRarity = "STANDARD" | "RARE" | "UNIQUE";
export type ImageFit = "cover" | "contain";
export type ImagePosition = "center" | "top" | "bottom" | "left" | "right";
export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: "New / Boxed",
  LIKE_NEW: "Like New",
  GRADED: "Graded / Sealed",
  PRE_OWNED: "Pre-owned",
};
export const RARITY_LABELS: Record<ProductRarity, string> = {
  STANDARD: "Standard",
  RARE: "Rare",
  UNIQUE: "Unique / 1 of 1",
};

export interface Product {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  scale: string | null;
  condition: ProductCondition;
  description: string;
  highlights: string[];
  tags: string[];
  images: string[];
  /** How photos sit inside cards/gallery: cover fills the frame, contain shows the whole shot. */
  imageFit: ImageFit;
  /** Crop anchor when the frame is a different shape to the photo. */
  imagePosition: ImagePosition;
  priceSale: number; // minor units (paise)
  priceCost: number; // minor units
  feePercent: number;
  stock: number;
  lowStockThreshold: number;
  status: ProductStatus;
  featured: boolean;
  /** Sequential drop number shown on cards and the product page. */
  dropNumber: number;
  /** Collector tag used for the rarity badge and shop filter. */
  rarity: ProductRarity;
  dropAt: string | null;
  source?: string; // LOCAL | SHOPIFY
  shopifyVariantId?: string | null; // numeric Shopify variant id — powers the Shop Pay express button
  createdAt: string;
  updatedAt: string;
}

export type PaymentChannel = "DISCORD" | "WHATSAPP" | "RAZORPAY";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_REVIEW"
  | "PAID"
  | "PROCESSING"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_REVIEW: "Payment in review",
  PAID: "Paid",
  PROCESSING: "Processing",
  PACKING: "Packing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const REVENUE_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "PACKING", "SHIPPED", "DELIVERED"];

export interface Order {
  id: number;
  number: string;
  status: OrderStatus;
  paymentMethod: "UPI" | "COD";
  paymentChannel: PaymentChannel | null;
  paymentReference: string | null;
  paymentClaimedAt: string | null;
  shippingMethod: "STANDARD" | "EXPRESS";
  email: string;
  name: string;
  phone: string | null;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  notes: string | null;
  subtotal: number;
  discountTotal: number;
  discountCode: string | null;
  shippingFee: number;
  total: number;
  costTotal: number;
  feesTotal: number;
  profit: number;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  shiprocketOrderId: string | null;
  shiprocketShipmentId: string | null;
  shiprocketAwb: string | null;
  shiprocketStatus: string | null;
  shiprocketLabelUrl: string | null;
  refundedAt: string | null;
  customerId: number | null;
  source?: string; // LOCAL | SHOPIFY
  isArchived?: number;
  archivedAt?: string | null;
  idempotencyKey?: string | null;
  billingAddress?: string | null;
  taxesTotal?: number;
  paymentStatus?: string;
  placedAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  name: string;
  slug: string | null;
  condition: string | null;
  scale: string | null;
  image: string | null;
  price: number;
  cost: number;
  qty: number;
}

export interface OrderEvent {
  id: number;
  orderId: number;
  status: string;
  note: string | null;
  actor: string | null;
  createdAt: string;
}

export interface OrderWithRelations extends Order {
  items: OrderItem[];
  events: OrderEvent[];
}

export interface Customer {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  ordersCount: number;
  lifetimeValue: number;
  createdAt: string;
  lastOrderAt: string | null;
  notes?: string;
  status?: string;
  accountId?: number | null;
}

export interface CustomerWithOrders extends Customer {
  picture?: string | null;
  verified?: boolean;
  googleLinked?: boolean;
  addressCount?: number;
  statusLabel?: string;
  orders: { id: number; number: string; status: OrderStatus; total: number; placedAt: string }[];
  latestOrder?: { number: string; total: number; status: OrderStatus; placedAt: string } | null;
}

export type DiscountType = "PERCENT" | "FLAT";

export interface Discount {
  id: number;
  code: string;
  type: DiscountType;
  value: number;
  minSubtotal: number;
  maxUses: number; // 0 = unlimited
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface Review {
  id: number;
  productId: number;
  productName?: string;
  name: string;
  email: string;
  rating: number;
  title: string;
  body: string;
  status: "PENDING" | "PUBLISHED" | "REJECTED";
  createdAt: string;
}

export interface HomeSettings {
  heroDesktopImage: string;
  heroMobileImage: string;
  heroFit: ImageFit;
  heroPosition: ImagePosition;
  heroKicker: string;
  /** Two poster lines, separated by a newline. */
  heroHeadline: string;
  heroSubline: string;
  heroDropProductId: number | null;
  featuredProductId: number | null;
  /** Optional override for the featured section shot. Empty = product cover. */
  featuredImage: string;
  featuredImageFit: ImageFit;
  featuredImagePosition: ImagePosition;
  featuredLabel: string;
  tickerItems: string[];
  gridProductIds: number[];
  gridTitle: string;
  gridSubline: string;
  trustTitle: string;
  trustSubline: string;
  newsletterTitle: string;
  newsletterSubline: string;
  showPitWall: boolean;
  showProductIndex: boolean;
}

export interface StorefrontSettings {
  shipping: { standard: number; express: number; freeOver: number };
  returnsDays: number;
  paymentMethods: ("UPI" | "COD")[];
  home: HomeSettings;
}

export interface TrustpilotSettings {
  mode: "coming_soon" | "live";
  profileUrl: string;
  note: string;
}

/**
 * Discord order routing. Two separate webhooks are supported: the billing
 * channel that customers are told to join, and a private admin log. Either can
 * be left blank to fall back to the server environment variables.
 */
export interface DiscordSettings {
  billingWebhookUrl: string;
  adminWebhookUrl: string;
  checkoutUrl: string;
}

export interface TeamUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ActivityRow {
  id: number;
  actor: string;
  action: string;
  entity: string;
  detail: string;
  createdAt: string;
}

export type OpsLevel = "INFO" | "WARN" | "ERROR";
export type OpsSource = "WEB" | "API" | "SRV";

export interface OpsEvent {
  id: number;
  source: OpsSource;
  level: OpsLevel;
  type: string; // js_error | api_fail | upload_fail | page_slow | flow | flow_drop | webhook | sync
  path: string;
  message: string;
  meta: string;
  createdAt: string;
}

export interface SyncLog {
  id: number;
  provider: string;
  job: string;
  status: "OK" | "FAIL";
  detail: string;
  items: number;
  durationMs: number;
  createdAt: string;
}

/** Storefront customer account (separate from admin team users). */
export interface Account {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  picture: string | null;
  passwordHash: string | null;
  googleId: string | null;
  verified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
