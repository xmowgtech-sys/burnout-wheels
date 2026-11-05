# Managing the catalog

The live admin is the normal place to add, edit, hide and delete products:

<https://theburnoutwheels-vert.vercel.app/admin/products>

Product changes are saved to a private **Vercel Blob** store, so they survive
cold starts and redeploys. Uploaded photos are stored in the same Blob store and
served through `/api/files/[name]`.

## Add or edit a product live

1. Sign in at `/admin/login`.
2. Add or edit the product in **Products**.
3. Upload photos as usual. They are saved to Blob, not just the server's
   temporary disk.
4. Click **Save**. The product appears on `/shop` immediately.

Hidden (`DRAFT`), archived and deleted products are remembered too, so a cold
start cannot bring them back.

## Why the repository copy still exists

`src/lib/seed-catalog.ts` and `public/uploads/` are the cold-start seed for a
brand-new deployment that has no Blob snapshot yet. They are also a useful
backup. You do **not** need to edit them for normal live changes.

If you prefer the old local workflow:

1. Run `npm run dev`.
2. Edit products at <http://localhost:3000/admin/products>.
3. Run `npm run catalog:publish` to export the local catalog into the seed and
   push it to GitHub.

## How persistence works

- `catalog/v1/products.json` in Blob is a full snapshot of every product:
  name, price, stock, photos, status and featured flag.
- `catalog/v1/images/…` holds live-uploaded photos.
- On a cold start, the app seeds SQLite from `seed-catalog.ts`, then applies the
  Blob snapshot. Deleted slugs are tombstoned so they stay deleted.
- If Blob is temporarily unavailable, product writes return an error instead of
  overwriting the snapshot with partial data.

Vercel's free Blob tier includes roughly 2,000 advanced operations (`put`,
`list`) and 10,000 simple operations (`get`) per month. A product save uses one
`put`; a checkout uses one `put` for the order and one for the stock update.
Normal store traffic is well inside the free tier.

## Prices

Prices are stored in paise (`29900` = ₹299). Change them in the live admin.

## If product changes look temporary

Check `/api/health`. It should report:

```json
{ "durableCatalog": true, "catalogStore": "vercel-blob-private" }
```

If it says `not-configured`, connect a **private** Vercel Blob store to the
project. Do not use a public store: order snapshots contain customer addresses.
