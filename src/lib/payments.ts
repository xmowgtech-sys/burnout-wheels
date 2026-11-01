import { CONTACT } from "./contact";

/**
 * Payment policy — single source of truth.
 *
 * COD is not free-to-place: the owner requires a ₹200 online advance before an
 * order is packed, because packed-then-refused COD parcels cost real money.
 * The advance is adjusted against the order total; the balance is paid to the
 * courier. UPI and PayPal can also be completed live with a human on
 * WhatsApp/Discord — the site never claims a gateway it does not have.
 */
export const COD_ADVANCE_PAISE = 20_000;
export const COD_ADVANCE_LABEL = "₹200";

export const PAYMENT_HELP = {
  whatsapp: CONTACT.whatsappPayment,
  whatsappCod: CONTACT.whatsappCod,
  discord: CONTACT.discord,
  email: CONTACT.email,
} as const;

/** Balance still owed to the courier after the online COD advance. */
export function codBalance(totalPaise: number): number {
  return Math.max(0, totalPaise - COD_ADVANCE_PAISE);
}
