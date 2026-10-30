import { SettingsPanel } from "@/components/admin/settings-panel";
import { getStorefront, getTrustpilot } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Pit wall", robots: { index: false } };

export default function SettingsAdminPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Command deck</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Settings</h1>
      </header>
      <SettingsPanel storefront={getStorefront()} trustpilot={getTrustpilot()} />
    </div>
  );
}
