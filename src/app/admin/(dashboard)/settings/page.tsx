import { SettingsPanel } from "@/components/admin/settings-panel";
import { getStorefront, getTrustpilot, getDiscord, resolveDiscordWebhooks } from "@/lib/settings";
import { listProducts } from "@/lib/catalog";
import { ensureCatalogHydrated } from "@/lib/catalog-store";
import { getPayments } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Pit wall", robots: { index: false } };

export default async function SettingsAdminPage() {
  await ensureCatalogHydrated();
  const pay = getPayments();
  const savedDiscord = getDiscord();
  const effectiveDiscord = resolveDiscordWebhooks();
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Command deck</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Settings</h1>
      </header>
      <SettingsPanel
        storefront={getStorefront()}
        trustpilot={getTrustpilot()}
        products={listProducts({ status: "ACTIVE", limit: 200, sort: "newest" })}
        payments={{ keyId: pay?.razorpayKeyId ?? "", upiVpa: pay?.upiVpa ?? "", secretSet: Boolean(pay?.razorpayKeyId) }}
        discord={{
          ...savedDiscord,
          effectiveBilling: effectiveDiscord.billing,
          effectiveAdmin: effectiveDiscord.admin,
          envBilling: Boolean(
            process.env.DISCORD_BILLING_WEBHOOK_URL?.trim() ||
              process.env.DISCORD_ORDERS_WEBHOOK_URL?.trim() ||
              process.env.DISCORD_WEBHOOK_URL?.trim()
          ),
          envAdmin: Boolean(
            process.env.DISCORD_ADMIN_WEBHOOK_URL?.trim() ||
              process.env.DISCORD_ORDERS_WEBHOOK_URL?.trim() ||
              process.env.DISCORD_WEBHOOK_URL?.trim()
          ),
        }}
      />
    </div>
  );
}
