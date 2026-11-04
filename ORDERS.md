# Durable orders on Vercel

## Why orders used to disappear

Vercel Functions get an ephemeral `/tmp` filesystem. The app's SQLite database
lives there, so every cold start (or every request routed to a different
instance) begins with a fresh database. Checkout wrote the order to one
instance; the confirmation page and admin were served by another instance and
correctly reported "order not found".

The catalog is not affected in the same way because it is restored from
`src/lib/seed-catalog.ts` on every boot. Orders are customer data, so they are
now snapshotted to durable storage.

## What the fix does

- Every checkout writes a private JSON snapshot to Vercel Blob.
- Every admin status, tracking, archive, restore, and payment-channel change
  rewrites that snapshot.
- The success page, admin order list/detail, account order history, Razorpay
  payment endpoints, and `/api/orders` hydrate any missing order back into the
  local SQLite database before reading it.
- A single index blob (`orders/v1/index.json`) lists orders. This avoids Blob
  `list()` calls on every read; listing counts as a more expensive "advanced
  operation".
- Admin URLs and links now use the stable order number
  (`/admin/orders/BW-XXXX-XX`) instead of the ephemeral numeric SQLite id.
- Checkout also sets an encrypted, HttpOnly recovery cookie. Even if Blob is
  not connected yet, the customer sees their real confirmation page immediately
  after checkout on the same browser.

## One-time setup (required for admin durability)

1. Open the Vercel dashboard for the **burnout-wheels** project.
2. Go to **Storage → Create Database → Blob**.
3. Name it something like `burnout-orders`.
4. Choose **Private** access. This cannot be changed later. Order snapshots
   contain names, emails, phone numbers, and addresses.
5. Pick the region closest to the store's customers (for India, a nearby
   region such as `bom1` if offered).
6. Connect the store to the project for **Production**, **Preview**, and
   **Development**.
7. Redeploy the project. Vercel injects `BLOB_STORE_ID` and the OIDC
   credentials automatically.

No `BLOB_READ_WRITE_TOKEN` is required on Vercel when the store is connected
with OIDC. The SDK picks up the short-lived token at runtime.

### CLI alternative

From the project directory:

```bash
npx vercel link
npx vercel blob create-store burnout-orders --access private --yes
npx vercel env pull .env.local
```

Then redeploy.

### Local development

- With no Blob environment variables and `NODE_ENV=development`, orders are
  stored in `data/order-store/` so cold-start behavior can be tested locally.
- With `BLOB_STORE_ID` / `BLOB_READ_WRITE_TOKEN` present (for example after
  `vercel env pull`), the app uses the real private Blob store.
- Set `ORDER_STORE_DISABLED=1` to test the no-durable-store fallback.

## Verify it

1. Open `https://theburnoutwheels-vert.vercel.app/api/health`.
2. It should include:

```json
{ "ok": true, "orderStore": "vercel-blob-private", "durableOrders": true }
```

3. Place a test order.
4. Open the confirmation page and `/admin/orders` in a new private window.
5. Optionally restart/redeploy; the order should still be there.

## If the Blob store is not connected

- `durableOrders` is `false`.
- Checkout still succeeds and the customer confirmation works in the same
  browser via the encrypted recovery cookie.
- Admin cannot recover the order on another instance.
- The Discord webhook alert (if configured) remains the manual safety net.
  Set `DISCORD_WEBHOOK_URL` in Vercel → Settings → Environment Variables.

## Orders lost before this fix

`BW-284VDX-M6` was created before snapshots existed, so there is no durable
copy to hydrate. It cannot be recovered automatically. Check the Discord
`#billing` channel for the checkout alert (name, total, address) and handle that
customer manually. New orders are protected from this point forward.

## Storage notes

- Snapshots are private and only readable by the project's functions.
- Hard-deleting an order writes a PII-free tombstone first, then removes the
  blob, so a deletion cannot be undone by a stale cold-start database.
- The index is protected by ETag/`ifMatch` retries. If it is ever missing, it is
  rebuilt from the order snapshots.
