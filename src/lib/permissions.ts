import type { Role } from "./types";

export type { Role };

export const PERMS = [
  "products.view",
  "products.manage",
  "products.delete",
  "orders.view",
  "orders.manage",
  "customers.view",
  "discounts.manage",
  "reviews.moderate",
  "chatbot.view",
  "chatbot.manage",
  "conversations.reply",
  "finance.view",
  "export",
  "settings.manage",
  "team.manage",
] as const;

export type Perm = (typeof PERMS)[number];

export const ROLE_PERMS: Record<Role, readonly Perm[]> = {
  OWNER: PERMS,
  ADMIN: PERMS.filter((p) => p !== "team.manage"),
  STAFF: [
    "products.view",
    "products.manage",
    "products.delete",
    "orders.view",
    "orders.manage",
    "customers.view",
    "discounts.manage",
    "reviews.moderate",
    "chatbot.view",
    "chatbot.manage",
    "conversations.reply",
  ],
};

export function can(role: Role, perm: Perm): boolean {
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

export const PERM_LABELS: Record<Perm, string> = {
  "products.view": "View catalogue",
  "products.manage": "Create / edit products",
  "products.delete": "Delete products",
  "orders.view": "View orders",
  "orders.manage": "Manage orders & fulfilment",
  "customers.view": "View customers",
  "discounts.manage": "Manage discount codes",
  "reviews.moderate": "Moderate reviews",
  "chatbot.view": "View chatbot conversations",
  "chatbot.manage": "Edit chatbot settings",
  "conversations.reply": "Reply as staff in chat",
  "finance.view": "View finance & margins",
  export: "Export reports",
  "settings.manage": "Store settings & Trustpilot",
  "team.manage": "Manage team & roles",
};
