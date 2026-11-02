export type Role = "OWNER" | "ADMIN" | "STAFF";

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";
export type ProductCondition = "NEW" | "LIKE_NEW" | "GRADED" | "PRE_OWNED";
export type ImageFit = "cover" | "contain";
export type ImagePosition = "center" | "top" | "bottom" | "left" | "right";
export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: "New / Boxed",
  LIKE_NEW: "Like New",
  GRADED: "Graded / Sealed",
  PRE_OWNED: "Pre-owned",
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
  dropAt: string | null;
  source?: string; // LOCAL | SHOPIFY
  shopifyVariantId?: string | null; // numeric Shopify variant id — powers the Shop Pay express button
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PACKING: "Packing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const REVENUE_STATUSES: OrderStatus[] = ["PAID", "PACKING", "SHIPPED", "DELIVERED"];

export interface Order {
  id: number;
  number: string;
  status: OrderStatus;
  paymentMethod: "UPI" | "COD";
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
  refundedAt: string | null;
  customerId: number | null;
  source?: string; // LOCAL | SHOPIFY
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
}

export interface CustomerWithOrders extends Customer {
  orders: { id: number; number: string; status: OrderStatus; total: number; placedAt: string }[];
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

export type ConversationStatus = "BOT" | "HANDOFF_PENDING" | "HANDOFF_ACTIVE" | "RESOLVED";

export interface Conversation {
  id: number;
  sessionId: string;
  email: string | null;
  name: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: "user" | "bot" | "admin";
  content: string;
  createdAt: string;
}

export interface ConversationWithExcerpt extends Conversation {
  lastMessage: string;
  messageCount: number;
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

export interface ChatbotSettings {
  enabled: boolean;
  name: string;
  greeting: string;
  suggestProducts: boolean;
  showStock: boolean;
  faqs: { keywords: string[]; answer: string }[];
  leadCapture: boolean;
  handoffEmail: string;
  handoffWebhook: string;
}

export interface TrustpilotSettings {
  mode: "coming_soon" | "live";
  profileUrl: string;
  note: string;
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
