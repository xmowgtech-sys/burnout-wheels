# Burnout Wheels —_die-cast collectibles storefront + pit-wall admin_

A full ecommerce build for Hot Wheels & die-cast collectors: cinematic storefront, real
checkout pipeline, and a complete admin dashboard — all backed by SQLite (node:sqlite),
JWT cookie auth, file uploads, Zod validation and honest-by-default data.

> **Data honesty policy (enforced in code):** reviews are human-moderated (never seeded),
> stock counts are real inventory, and the Trustpilot widget stays on `coming_soon`
> until a real profile is connected. Demo orders exist **only** because you seeded them
> (`--no-demo` disables); visit counts come from the real beacon.

---

## Run it

```powershell
# Node 26.13.0 lives at %LOCALAPPDATA%\Programs\nodejs (not on PATH in fresh shells)
$env:Path = "$env:Path;" + (Join-Path $env:LOCALAPPDATA "Programs\nodejs")

npm install
npm run seed          # idempotent: schema + owner + RB20 + settings + demo data
npm run dev           # http://localhost:3000
```

Other scripts: `npm run build` (`next build`), `npm start` (prod), `npm run seed:fresh`
(wipes `data/burnout.db` first), `node scripts/seed.mjs --no-demo` (empty store, owner only).

## Credentials (from `.env`)

- **Owner login:** `owner@burnoutwheels.in` / `pitwall-2026`
- Change in `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) → re-run `npm run seed:fresh`
- Admin panel: `/admin` (auto-redirects to `/admin/login`)

## What ships

**Storefront**
- Cinematic loader (session-once, `prefers-reduced-motion` respected) + F1 hero on real Wikimedia photography
- Home with featured drop, category chips, trust grid, paddock-list signup
- Shop grid with search / category / condition / stock filters + sort
- Product detail: zoomable gallery, honest stock messaging, buy panel, review launcher
- Cart drawer (localStorage `bw:cart:v1`), wishlist, full checkout (UPI/COD, standard/express, free shipping ≥ ₹2,499)
- Order success page + `/track` order tracker (order number + delivery email)
- Shipping, returns, and trust pages — driven by admin-editable settings
- SEO: metadata, Product JSON-LD, sitemap, robots, OpenGraph image

**Admin pit wall** (`/admin`, role-guarded)
- Overview: 28-day revenue/profit/conversion, best sellers, low stock, activity log
- Products: CRUD, draft/archive, image queue (URL add **or** upload to `data/uploads`), live margin preview
- Orders: list + detail, enforced status flow (`PENDING_PAYMENT → PAID → PACKING → SHIPPED → DELIVERED`, refund paths), tracking entry, auto-restock on cancel
- Finance: 12-month P&L, per-product margins, Orders/Products/PnL CSV exports
- Customers, discount codes (this includes the seeded `WELCOME10`), review moderation
- Chatbot: settings form (name, greeting, FAQs, stock/lead toggles, handoff webhook) **and** conversation desk (transcripts, crew replies, resolve)
- Team & roles: OWNER/ADMIN/STAFF with a real permission matrix (`src/lib/permissions.ts`)
- Settings: shipping fees, returns window, payment methods, Trustpilot status

## Stack

Next.js 15.5 (App Router, TS strict) · React 19 · Tailwind v4 · node:sqlite (WAL) ·
jose JWT (`bw_session`, HttpOnly) · bcryptjs · Zod · framer-motion + lenis · lucide-react.
Money is stored in **paise** (minor units) and formatted for India (₹).

## Honest payment model

There is **no fake gateway and no test transactions**: checkout records the order as
`PENDING_PAYMENT`. UPI is confirmed by a human in admin (order → Paid), or the customer
pays cash on delivery. No card data is stored anywhere in the system.

## Notes & quirks

- `fmtUSD()` in `src/lib/money.ts` formats **INR** — the name is kept deliberately (used everywhere).
- Product photography is CC BY-SA Wikimedia Commons (RB20 shots), credited in the footer.
- Uploads live in `data/uploads`, served via `/api/files/*` with immutable caching.
- OneDrive path is fine for npm; just use the PATH prefix above in fresh terminals.
