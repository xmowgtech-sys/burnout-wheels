# Burnout Wheels — die-cast collectibles storefront + pit-wall admin

A full ecommerce build for die-cast & F1 collectors: cinematic storefront, real checkout
pipeline, customer accounts, and a complete admin dashboard — all backed by SQLite
(`node:sqlite`), JWT cookie auth, validated uploads, Zod validation and honest-by-default data.

> **Data honesty policy (enforced in code):** reviews are human-moderated (never seeded),
> stock counts are real inventory, no Trustpilot/rating widgets exist until a real profile
> is connected, and visit counts only rise when visitors accept analytics cookies.
> Demo orders exist **only** because you seeded them (`--no-demo` disables).

---

## Run it

```powershell
# Node lives at %LOCALAPPDATA%\Programs\nodejs (not on PATH in fresh shells)
$env:Path = "$env:Path;" + (Join-Path $env:LOCALAPPDATA "Programs\nodejs")

npm install
npm run seed          # idempotent: schema + owner + RB20 + settings + demo data
npm run dev           # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run seed:fresh` (wipes the DB first),
`node scripts/seed.mjs --no-demo` (empty store, owner only).
`npm run typecheck` passes clean.

## Credentials (from `.env`)

- Admin panel: `/admin/login` — password **or** Google (once configured below)
- Storefront customers: `/signup` (email + verification) or Google

## What ships

**Storefront**
- Cinematic session-once loader with the logo + hero on real Wikimedia photography
- Home with featured drop, category chips, trust grid, paddock-list signup
- Shop grid with search / category / condition / stock filters + sort
- Product detail: zoomable gallery, honest stock messaging, buy panel, review launcher
- Cart drawer, wishlist, full checkout (UPI/COD, standard/express, free ≥ ₹2,499)
- Order success page + `/track` tracker
- Policy pages: `/shipping`, `/refund-cancellation`, `/terms`, `/privacy`
- **Cookie consent** (Accept / Reject / Preferences) — analytics beacons stay off until accepted
- Customer accounts: signup → email verification → login, password reset, `/account` order history
- SEO: metadata, Product JSON-LD, sitemap, robots, OpenGraph image

**Admin pit wall** (`/admin`, role-guarded OWNER/ADMIN/STAFF)
- Overview: 28-day revenue/profit/conversion, best sellers, low stock, activity
- Products: CRUD + the **image upload manager** (below)
- Orders: enforced status flow, tracking entry, auto-restock on cancel
- Finance: 12-month P&L, margins, CSV exports
- Customers, discounts, review moderation, chatbot desk + settings
- **Shopify** (`/admin/shopify`): connect your real store, run products/inventory/orders/customers syncs, webhook topic list, sync-log table
- **Monitoring** (`/admin/monitoring`): ops events, funnel + drop-offs, alerts, mail outbox, low stock — all 24h windows
- Team & roles with a real permission matrix (`src/lib/permissions.ts`)
- Settings: shipping fees, payment methods, Trustpilot status

## Product image upload (fully reworked)

Admin → Products → edit → **Images** fieldset:
- Drag-and-drop **or** file picking, multiple at once
- Per-file progress bar, thumbnail previews, per-item **retry** on failure
- Live validation: images only (magic-byte sniffed server-side — renamed `.txt` rejected),
  10 MB max, 12 images max per product
- Reordering (drag or arrow buttons), **first image = card cover**, delete/replace
- Partial success: one bad file never loses the good ones
- Files persist to `data/uploads`, served via `/api/files/*` with immutable caching
- Failed uploads are logged to Admin → Monitoring

## Brand / logo

- `public/logo.svg` — wordmark + wheel ring (header, loader)
- `src/app/icon.svg` — favicon
- To swap in your own logo file: drop your SVG (or PNG) over `public/logo.svg`
  and update `src/app/icon.svg` to match. The admin login badge and social
  metadata will keep working without further changes.

## Google sign-in

1. [console.cloud.google.com](https://console.cloud.google.com) → OAuth client (Web)
2. Authorized redirect URI: `https://YOUR-DOMAIN/api/auth/google/callback`
   (locally: `http://localhost:3000/api/auth/google/callback`)
3. Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in env → restart

Without env vars the buttons honestly say "not configured" — no fake error loops.
- **Store scope:** matches/creates a customer account (Google emails arrive verified).
- **Admin scope:** only signs in team users that already exist and are active —
  OAuth can never escalate a stranger into the pit wall.

## Mail (verification / reset)

Set `SMTP_HOST/PORT/USER/PASSWORD` (any SMTP provider) → real delivery via nodemailer.
Without SMTP, every message is parked in **Admin → Monitoring → Mail outbox**, where an
operator can copy the exact verification/reset link. Tokens are stored as SHA-256 hashes
only, single-use, ≤24h expiry. Passwords are bcrypt (10 rounds). No enumeration: reset
requests always answer identically.

## Cookie consent & site monitoring

- Consent state: `bw:consent:v1` (localStorage) + mirrored `bw_consent` cookie
- Analytics (visits, funnel beacons) fire **only** after acceptance; error/ops
  telemetry is first-party and scrubbed (emails + long tokens stripped)
- Monitored: JS errors, unhandled rejections, failed resources, slow pages/interactions,
  failed uploads, funnel drop-offs (cart abandoned on pagehide)
- Everything lands in `/admin/monitoring`; nothing ever stores form values or passwords

## Shopify

Admin → Shopify → paste your `*.myshopify.com` domain + Admin API token (custom app with
`read_products`, `read_orders`, `read_customers`, `read_inventory`). Syncs retry on
429/5xx with backoff, log every attempt, tag synced rows `SHOPIFY`, and survive a
disconnect. Webhooks: point the listed topics at `/api/webhooks/shopify` (JSON) with the
secret from Shopify's notification — HMAC-verified before parsing; failed processing
returns 500 so Shopify retries. **The store currency must be INR** (this ledger is paise).

## Deploying to Netlify

`netlify.toml` is ready (`@netlify/plugin-nextjs`, Node 22, `.next` publish). Deploy steps:

1. Push this folder to GitHub and "Add new site → Import project" on Netlify
2. Set env vars: `SESSION_SECRET` (32-byte hex), `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   `NEXT_PUBLIC_SITE_URL`, plus Google/SMTP if used
3. Build. **Caveat:** SQLite lives in the function's ephemeral `/tmp` and resets
   per cold start. On Vercel, orders, the product catalog and uploaded photos are
   made durable through a private Vercel Blob store (`BLOB_STORE_ID`). For
   Netlify or another host, either use a persistent disk or add an equivalent
   Blob adapter for `order-store.ts` / `catalog-store.ts`.

## Stack

Next.js 15.5 (App Router, TS strict) · React 19 · Tailwind v4 · node:sqlite (WAL) ·
jose JWT (`bw_session` team / `bw_customer` store) · bcryptjs · Zod · framer-motion +
lenis · lucide-react · nodemailer (optional). Money is stored in **paise** (minor units),
formatted for India (₹).

## Notes & quirks

- `fmtUSD()` in `src/lib/money.ts` formats **INR** — the name is kept deliberately.
- Product photography is CC BY-SA Wikimedia Commons (RB20 shots), credited in the footer.
- The generic `/api/auth/login` is now **customer** login; the team signs in via
  `/api/auth/team/login`. `/api/auth/logout` clears both cookies.
- `orders.returnsDays` remains in the settings JSON for schema compatibility but the
  Returns page/links were removed per store policy — see `/refund-cancellation`.
