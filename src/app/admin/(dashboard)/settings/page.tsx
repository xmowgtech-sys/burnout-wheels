import { SettingsPanel } from "@/components/admin/settings-panel";
import { getStorefront, getTrustpilot } from "@/lib/settings";
import { getPayments } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Pit wall", robots: { index: false } };

export default function SettingsAdminPage() {
  const pay = getPayments();
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Command deck</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Settings</h1>
      </header>
      <SettingsPanel
        storefront={getStorefront()}
        trustpilot={getTrustpilot()}
        payments={{ keyId: pay?.razorpayKeyId ?? "", upiVpa: pay?.upiVpa ?? "", secretSet: Boolean(pay?.razorpayKeyId) }}
      />
    </div>
  );
}
