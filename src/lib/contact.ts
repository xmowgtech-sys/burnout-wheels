/**
 * Store contact details — the single source of truth.
 * Change the phone number here and every WhatsApp/tel link across the site updates:
 * announcement banner, footer, trust page, policy pages.
 */

const PHONE_LOCAL = "7889079186"; // temporary enquiry number — swap back to 9876596647 when ready
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
  discord: "https://discord.gg/wwUHm5MaK7",
  discordLabel: "discord.gg/wwUHm5MaK7",
  email: "theburnoutwheels@gmail.com",
  address: "1-Floor, PP - 370, Greater Mohali, Emaar, Sector - 108, Mohali - 140307, Punjab, India",
} as const;
