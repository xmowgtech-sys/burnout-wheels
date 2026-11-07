"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageField } from "./image-field";
import type { HomeSettings, Product, StorefrontSettings, TrustpilotSettings } from "@/lib/types";

export function SettingsPanel({
  storefront,
  trustpilot,
  payments,
  products,
}: {
  storefront: StorefrontSettings;
  trustpilot: TrustpilotSettings;
  payments: { keyId: string; upiVpa: string; secretSet: boolean };
  products: Product[];
}) {
  const router = useRouter();
  const [store, setStore] = useState(storefront);
  const [tp, setTp] = useState(trustpilot);
  const [pay, setPay] = useState<{ keyId: string; upiVpa: string; secretSet: boolean; secretRaw?: string }>(payments);
  const [secretRaw, setSecretRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const rupees = (v: string) => Math.max(0, Math.round(Number(v || 0) * 100));
  const setHome = (patch: Partial<HomeSettings>) => setStore((s) => ({ ...s, home: { ...s.home, ...patch } }));
  const productId = (value: string) => (value ? Number(value) : null);
  const toggleGridProduct = (id: number) =>
    setHome({
      gridProductIds: store.home.gridProductIds.includes(id)
        ? store.home.gridProductIds.filter((x) => x !== id)
        : [...store.home.gridProductIds, id],
    });

  const featuredPick =
    products.find((p) => p.id === (store.home.featuredProductId ?? store.home.heroDropProductId)) ??
    products.find((p) => p.featured) ??
    products[0];
  const autoFeaturedImage = featuredPick?.images[0] || store.home.heroDesktopImage;

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
        home: store.home,
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

      {/* home page */}
      <section className="u-card p-5" aria-labelledby="home-h">
        <p id="home-h" className="u-label">Home page — posters, products & copy</p>
        <p className="u-label-txt mt-2">
          The storefront home page reads these values live. Pick a product for the hero drop and the featured
          section, tick the units you want in the home grid, and upload different posters for desktop and phones.
          Empty product pickers fall back to the featured/newest active unit.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <ImageField
            label="Hero poster — desktop"
            hint="≤ 1920px wide"
            value={store.home.heroDesktopImage}
            onChange={(v) => setHome({ heroDesktopImage: v })}
          />
          <ImageField
            label="Hero poster — mobile"
            hint="falls back to desktop"
            value={store.home.heroMobileImage}
            onChange={(v) => setHome({ heroMobileImage: v })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="u-label-txt">Hero poster fit</span>
            <select value={store.home.heroFit} onChange={(e) => setHome({ heroFit: e.target.value as HomeSettings["heroFit"] })} className="u-select mt-1.5">
              <option value="cover">Cover — fill the screen</option>
              <option value="contain">Contain — show the whole poster</option>
            </select>
          </label>
          <label className="block"><span className="u-label-txt">Hero poster anchor</span>
            <select value={store.home.heroPosition} onChange={(e) => setHome({ heroPosition: e.target.value as HomeSettings["heroPosition"] })} className="u-select mt-1.5">
              <option value="center">Centre</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2"><span className="u-label-txt">Hero kicker (small line above the headline)</span>
            <input value={store.home.heroKicker} onChange={(e) => setHome({ heroKicker: e.target.value })} className="u-input mt-1.5" maxLength={120} />
          </label>
          <label className="block"><span className="u-label-txt">Hero headline — two poster lines</span>
            <textarea value={store.home.heroHeadline} onChange={(e) => setHome({ heroHeadline: e.target.value })} className="u-textarea mt-1.5" rows={2} maxLength={160} />
          </label>
          <label className="block"><span className="u-label-txt">Hero subline</span>
            <textarea value={store.home.heroSubline} onChange={(e) => setHome({ heroSubline: e.target.value })} className="u-textarea mt-1.5" rows={2} maxLength={600} />
          </label>
          <label className="block"><span className="u-label-txt">Hero drop product</span>
            <select value={store.home.heroDropProductId ?? ""} onChange={(e) => setHome({ heroDropProductId: productId(e.target.value) })} className="u-select mt-1.5">
              <option value="">Auto — featured product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.status !== "ACTIVE" ? ` (${p.status.toLowerCase()})` : ""}</option>
              ))}
            </select>
          </label>
          <label className="block"><span className="u-label-txt">Featured section product</span>
            <select value={store.home.featuredProductId ?? ""} onChange={(e) => setHome({ featuredProductId: productId(e.target.value) })} className="u-select mt-1.5">
              <option value="">Auto — same as hero drop</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.status !== "ACTIVE" ? ` (${p.status.toLowerCase()})` : ""}</option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2"><span className="u-label-txt">Featured section label</span>
            <input value={store.home.featuredLabel} onChange={(e) => setHome({ featuredLabel: e.target.value })} className="u-input mt-1.5" maxLength={60} placeholder="Featured drop" />
          </label>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <ImageField
            label="Featured drop image — optional"
            hint="blank = product cover photo"
            value={store.home.featuredImage}
            onChange={(v) => setHome({ featuredImage: v })}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3 border border-line bg-ink/40 p-3">
            {autoFeaturedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={autoFeaturedImage} alt="" className="h-14 w-20 shrink-0 border border-line object-cover" />
            ) : (
              <span className="grid h-14 w-20 shrink-0 place-items-center border border-line text-dim" aria-hidden>—</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="u-label">Automatic image</p>
              <p className="u-label-txt mt-1">
                {featuredPick
                  ? `${featuredPick.name}${featuredPick.images[0] ? " — cover frame" : " — no product photo, site hero fallback"}`
                  : "No product picked yet — site hero fallback"}
              </p>
            </div>
            {autoFeaturedImage ? (
              <button
                type="button"
                onClick={() => setHome({ featuredImage: autoFeaturedImage })}
                disabled={store.home.featuredImage === autoFeaturedImage}
                className="u-btn u-btn-ghost px-2.5! py-2! text-[11px]! disabled:opacity-40"
              >
                {store.home.featuredImage === autoFeaturedImage ? "Pinned" : "Use this image"}
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="u-label-txt">Featured image fit</span>
              <select value={store.home.featuredImageFit} onChange={(e) => setHome({ featuredImageFit: e.target.value as HomeSettings["featuredImageFit"] })} className="u-select mt-1.5">
                <option value="cover">Cover — fill the frame</option>
                <option value="contain">Contain — show the whole shot</option>
              </select>
            </label>
            <label className="block"><span className="u-label-txt">Featured image anchor</span>
              <select value={store.home.featuredImagePosition} onChange={(e) => setHome({ featuredImagePosition: e.target.value as HomeSettings["featuredImagePosition"] })} className="u-select mt-1.5">
                <option value="center">Centre</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <p className="u-label-txt mt-2">Framing applies to the custom drop image. With the field empty, the product&apos;s own cover and framing are used automatically.</p>
        </div>

        <label className="mt-4 block"><span className="u-label-txt">Ticker strip — one phrase per line</span>
          <textarea
            value={store.home.tickerItems.join("\n")}
            onChange={(e) => setHome({ tickerItems: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 16) })}
            className="u-textarea mt-1.5"
            rows={4}
          />
        </label>

        <div className="mt-6 border-t border-line pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="u-label">Home grid products</p>
            <button type="button" onClick={() => setHome({ gridProductIds: [] })} className="u-label hover:text-bone">Clear — use newest active</button>
          </div>
          <p className="u-label-txt mt-1">Tick products to pin them to the home grid, in the order shown below. Unticked means auto.</p>
          <div className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto border border-line p-3 sm:grid-cols-2">
            {products.length === 0 ? <p className="u-label-txt">No products yet — add one first.</p> : products.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-2 border border-transparent p-1.5 text-[12.5px] leading-snug hover:border-line">
                <input type="checkbox" className="mt-0.5 accent-red" checked={store.home.gridProductIds.includes(p.id)} onChange={() => toggleGridProduct(p.id)} />
                <span className="min-w-0">
                  <span className="block truncate">{store.home.gridProductIds.indexOf(p.id) >= 0 ? `${store.home.gridProductIds.indexOf(p.id) + 1}. ` : ""}{p.name}</span>
                  <span className="u-label-txt">{p.category} · {p.status.toLowerCase()}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="u-label-txt">Grid heading</span>
            <input value={store.home.gridTitle} onChange={(e) => setHome({ gridTitle: e.target.value })} className="u-input mt-1.5" maxLength={80} />
          </label>
          <label className="block"><span className="u-label-txt">Grid subline</span>
            <input value={store.home.gridSubline} onChange={(e) => setHome({ gridSubline: e.target.value })} className="u-input mt-1.5" maxLength={400} />
          </label>
          <label className="block"><span className="u-label-txt">Trust heading</span>
            <input value={store.home.trustTitle} onChange={(e) => setHome({ trustTitle: e.target.value })} className="u-input mt-1.5" maxLength={80} />
          </label>
          <label className="block"><span className="u-label-txt">Trust subline</span>
            <input value={store.home.trustSubline} onChange={(e) => setHome({ trustSubline: e.target.value })} className="u-input mt-1.5" maxLength={400} />
          </label>
          <label className="block"><span className="u-label-txt">Newsletter heading</span>
            <input value={store.home.newsletterTitle} onChange={(e) => setHome({ newsletterTitle: e.target.value })} className="u-input mt-1.5" maxLength={120} />
          </label>
          <label className="block"><span className="u-label-txt">Newsletter subline</span>
            <input value={store.home.newsletterSubline} onChange={(e) => setHome({ newsletterSubline: e.target.value })} className="u-input mt-1.5" maxLength={400} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="accent-red" checked={store.home.showPitWall} onChange={(e) => setHome({ showPitWall: e.target.checked })} />
            Show the Pit Wall section
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="accent-red" checked={store.home.showProductIndex} onChange={(e) => setHome({ showProductIndex: e.target.checked })} />
            Show the product index section
          </label>
        </div>

        <button onClick={saveStore} disabled={busy} className="u-btn u-btn-primary mt-6">Save home page</button>
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
            <input value={pay.keyId} onChange={(e) => setPay({ ...pay, keyId: e.target.value })} placeholder="rzp_live_… or rzp_test_…" className="u-input mt-1.5 font-mono! text-[13px]!" />
          </label>
          <label className="block"><span className="u-label-txt">Key secret {pay.secretSet && <span className="u-badge ml-2 border-mint text-mint">saved</span>}</span>
            <input type="password" value={secretRaw} onChange={(e) => setSecretRaw(e.target.value)} placeholder={pay.secretSet ? "•••••••• (leave blank to keep)" : "paste the secret"} className="u-input mt-1.5 font-mono! text-[13px]!" />
          </label>
          <label className="block md:col-span-2"><span className="u-label-txt">Manual UPI VPA (fallback — used if Razorpay is off or down)</span>
            <input value={pay.upiVpa} onChange={(e) => setPay({ ...pay, upiVpa: e.target.value })} placeholder="amanjot7@fam" className="u-input mt-1.5 font-mono! text-[13px]!" />
          </label>
        </div>
        <button onClick={savePay} disabled={busy} className="u-btn u-btn-primary mt-6">Save payment keys</button>
      </section>
    </div>
  );
}
