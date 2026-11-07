/**
 * Store contact details — the single source of truth.
 * Change the phone number here and every WhatsApp/tel link across the site updates:
 * announcement banner, footer, trust page, policy pages.
 */

const PHONE_LOCAL = "7837147831";
const PHONE_CC = "91"; // India country code
const PHONE_E164 = `${PHONE_CC}${PHONE_LOCAL}`;

export const CONTACT = {
  phoneDisplay: `+91 ${PHONE_LOCAL}`,
  phoneTel: `tel:+${PHONE_E164}`,
  /** wa.me needs the full international format; opens WhatsApp with a prefilled enquiry. */
  whatsapp:
    `https://wa.me/${PHONE_E164}?text=` +
    encodeURIComponent("Hi Burnout Wheels — I have an enquiry:"),
  whatsappHref: `https://wa.me/${PHONE_E164}?text=Hi%20Burnout%20Wheels%20%E2%80%94%20I%20have%20an%20enquiry%3A`,
  whatsappCod: `https://wa.me/${PHONE_E164}?text=${encodeURIComponent(
    "Hi Burnout Wheels — I want to pay the ₹200 online advance for a COD order."
  )}`,
  whatsappPayment: `https://wa.me/${PHONE_E164}?text=${encodeURIComponent(
    "Hi Burnout Wheels — I need help completing a payment for my order."
  )}`,
  discord: "https://discord.gg/WRZDQEnA2",
  discordLabel: "discord.gg/WRZDQEnA2",
  email: "theburnoutwheels@gmail.com",
  address: "1-Floor, PP - 370, Greater Mohali, Emaar, Sector - 108, Mohali - 140307, Punjab, India",
} as const;
