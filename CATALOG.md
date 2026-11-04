# Publishing the catalog (free Vercel plan)

Vercel has no permanent disk. Products added in the **live** admin are stored in a
temporary database and disappear on a cold start or redeploy.

The permanent catalog lives in two places in the repository:

- `src/lib/seed-catalog.ts` — the product data
- `public/uploads/` — the product photos

## Add or edit a product

1. Start the local site:

   ```powershell
   npm run dev
   ```

2. Open <http://localhost:3000/admin/products> and add or edit the product.
   Upload its photo there as usual.

3. Publish it to the live site:

   ```powershell
   npm run catalog:publish
   ```

4. Wait about 1–2 minutes for Vercel to redeploy, then check
   <https://theburnoutwheels-vert.vercel.app/shop>.

`catalog:publish` does three things:

- exports every **ACTIVE** product from `data/burnout.db` into `src/lib/seed-catalog.ts`
- copies every referenced photo from `data/uploads/` into `public/uploads/`
- commits and pushes only those files, which triggers the Vercel deploy

If you only want to refresh the seed file without committing, run:

```powershell
npm run seed:export
```

## Delete a product

Delete or archive the product in the local admin, then run
`npm run catalog:publish`. It is removed from the seed and disappears after the
Vercel redeploy.

## Important limits of the free plan

- **Never add products in the live Vercel admin.** They are temporary.
- **Orders and customer accounts are also temporary on Vercel.** If you start
  taking real orders, either move to a host with a persistent disk or set up a
  hosted database.
- Order safety net: create a Discord webhook for your order channel, then add it
  to Vercel as the environment variable `DISCORD_WEBHOOK_URL`. Every new order is
  posted there, so the details survive even if the Vercel database resets.

## Prices

Prices are stored in paise (`29900` = ₹299). Change them in the local admin,
then run `npm run catalog:publish`.
