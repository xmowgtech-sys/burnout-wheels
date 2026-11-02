const LOCAL_FALLBACK = "http://localhost:3000";

function normalize(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Canonical origin for metadata, sitemap and robots.
 *
 * `NEXT_PUBLIC_SITE_URL` stays the explicit override. On Vercel we fall back to
 * the system-provided production URL so a missing env var never ships
 * `localhost` canonical links to real visitors.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalize(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return normalize(vercel);

  return LOCAL_FALLBACK;
}
