import { getShopifyConfig } from "@/lib/shopify";
import { recentSyncs } from "@/lib/ops";
import { ShopifyPanel } from "@/components/admin/shopify-panel";

export const metadata = { title: "Shopify sync — Pit wall" };

export default function ShopifyPage() {
  const cfg = getShopifyConfig();
  const logs = recentSyncs(30);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="u-label">Real store</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Shopify</h1>
        <p className="u-label-txt mt-2">Connect the live store — products, inventory, orders, customers and carts sync on demand; webhooks stream updates in real time.</p>
      </header>
      <ShopifyPanel
        connected={Boolean(cfg)}
        domain={cfg?.shopDomain ?? ""}
        apiVersion={cfg?.apiVersion ?? "2024-10"}
        secretSet={Boolean(cfg?.webhookSecret)}
        logs={logs}
      />
    </div>
  );
}
