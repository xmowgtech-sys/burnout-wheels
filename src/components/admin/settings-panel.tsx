"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StorefrontSettings, TrustpilotSettings } from "@/lib/types";

export function SettingsPanel({
  storefront,
  trustpilot,
  payments,
}: {
  storefront: StorefrontSettings;
  trustpilot: TrustpilotSettings;
  payments: { keyId: string; upiVpa: string; secretSet: boolean };
}) {
  const router = useRouter();
  const [store, setStore] = useState(storefront);
  const [tp, setTp] = useState(trustpilot);
  const [pay, setPay] = useState<{ keyId: string; upiVpa: string; secretSet: boolean; secretRaw?: string }>(payments);
  const [secretRaw, setSecretRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const rupees = (v: string) => Math.max(0, Math.round(Number(v || 0) * 100));

  const saveStore = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/settings?key=storefront", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
        shipping: { standard: rupees(String(store.shipping.standard)), express: rupees(String(store.shipping.express)), freeOver: rupees(String(store.shipping.freeOver)) },
        returnsDays: Number(store.returnsDays),
        paymentMethods: store.paymentMethods.length ? store.paymentMethods : ["UPI"],
      }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Storefront saved.");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  };

  const saveTrust = async () => {
    setBusy(true); setMsg("");
    try {
      const ok = await fetch("/api/settings?key=trustpilot", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tp),
      });
      const data = (await ok.json()) as { error?: string };
      if (!ok.ok) throw new Error(data.error || "Save failed");
      setMsg("Trustpilot status saved.");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  };

  const savePay = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/settings?key=payments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ razorpayKeyId: pay.keyId.trim(), razorpayKeySecret: secretRaw.trim(), upiVpa: pay.upiVpa.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Payments saved.");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-10">
      {msg && <p className="u-label-txt border border-line px-4 py-3" role="status">{msg}</p>}

      {/* storefront */}
      <section className="u-card p-5" aria-labelledby="sf-h">
        <p id="sf-h" className="u-label">Storefront rules</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="u-label-txt">Standard shipping ₹</span>
            <input type="number" step="0.01" min="0" defaultValue={(Number(store.shipping.standard) / 100).toFixed(2)} onChange={(e) => setStore({ ...store, shipping: { ...store.shipping, standard: rupees(e.target.value) } })} className="u-input mt-1.5" />
          </label>
          <label className="block"><span className="u-label-txt">Express shipping ₹</span>
            <input type="number" step="0.01" min="0" defaultValue={(Number(store.shipping.express) / 100).toFixed(2)} onChange={(e) => setStore({ ...store, shipping: { ...store.shipping, express: rupees(e.target.value) } })} className="u-input mt-1.5" />
          </label>
          <label className="block"><span className="u-label-txt">Free shipping over ₹</span>
            <input type="number" step="0.01" min="0" defaultValue={(Number(store.shipping.freeOver) / 100).toFixed(2)} onChange={(e) => setStore({ ...store, shipping: { ...store.shipping, freeOver: rupees(e.target.value) } })} className="u-input mt-1.5" />
          </label>
          <div>
            <span className="u-label-txt">Payment methods</span>
            <div className="mt-1.5 flex gap-4">
              {(["UPI", "COD"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-red" checked={store.paymentMethods.includes(m)} onChange={() => setStore({ ...store, paymentMethods: store.paymentMethods.includes(m) ? store.paymentMethods.filter((x) => x !== m) : [...store.paymentMethods, m] })} />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <button onClick={saveStore} disabled={busy} className="u-btn u-btn-primary mt-6">Save storefront</button>
      </section>

      {/* trustpilot */}
      <section className="u-card p-5" aria-labelledby="tp-h">
        <p id="tp-h" className="u-label">Trustpilot status</p>
        <p className="u-label-txt mt-2">Keeps the storefront honest: “coming soon” shows zero scores anywhere until a real profile connects.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="u-label-txt">Mode</span>
            <select value={tp.mode} onChange={(e) => setTp({ ...tp, mode: e.target.value as never })} className="u-select mt-1.5">
              <option value="coming_soon">Coming soon — no scores shown</option>
              <option value="live">Live — profile linked</option>
            </select>
          </label>
          <label className="block"><span className="u-label-txt">Profile URL</span>
            <input value={tp.profileUrl} onChange={(e) => setTp({ ...tp, profileUrl: e.target.value })} placeholder="https://www.trustpilot.com/review/…" className="u-input mt-1.5" />
          </label>
          <label className="block md:col-span-2"><span className="u-label-txt">Public note (shown on the trust page)</span>
            <textarea value={tp.note} onChange={(e) => setTp({ ...tp, note: e.target.value })} className="u-textarea mt-1.5" rows={2} />
          </label>
        </div>
        <button onClick={saveTrust} disabled={busy} className="u-btn u-btn-primary mt-6">Save Trustpilot status</button>
      </section>

      {/* payments */}
      <section className="u-card p-5" aria-labelledby="pay-h">
        <p id="pay-h" className="u-label">UPI payments — Razorpay</p>
        <p className="u-label-txt mt-2">
          Add your Razorpay key id + secret to switch checkout from manual UPI confirmation to real online payment (UPI, cards, netbanking).
          The secret never leaves the server. Get keys at dashboard.razorpay.com → API keys.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="u-label-txt">Razorpay key id</span>
            <input value={pay.keyId} onChange={(e) => setPay({ ...pay, keyId: e.target.value })} placeholder="rzp_live_… or rzp_test_…" className="u-input mt-1.5 !font-mono !text-[13px]" />
          </label>
          <label className="block"><span className="u-label-txt">Key secret {pay.secretSet && <span className="u-badge ml-2 border-mint text-mint">saved</span>}</span>
            <input type="password" value={secretRaw} onChange={(e) => setSecretRaw(e.target.value)} placeholder={pay.secretSet ? "•••••••• (leave blank to keep)" : "paste the secret"} className="u-input mt-1.5 !font-mono !text-[13px]" />
          </label>
          <label className="block md:col-span-2"><span className="u-label-txt">Manual UPI VPA (fallback — used if Razorpay is off or down)</span>
            <input value={pay.upiVpa} onChange={(e) => setPay({ ...pay, upiVpa: e.target.value })} placeholder="burnoutwheels@upi" className="u-input mt-1.5 !font-mono !text-[13px]" />
          </label>
        </div>
        <button onClick={savePay} disabled={busy} className="u-btn u-btn-primary mt-6">Save payment keys</button>
      </section>
    </div>
  );
}
