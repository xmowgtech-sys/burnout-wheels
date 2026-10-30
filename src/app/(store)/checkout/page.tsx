"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Tag, Lock } from "lucide-react";
import { PageHero, EmptyState } from "@/components/ui";
import { useStore, useToast } from "@/components/store/providers";
import { fmtUSD } from "@/lib/money";

type Stage = "cart" | "details" | "placing" | "error";
interface Applied { code: string; amount: number }

export default function CheckoutPage() {
  const store = useStore();
  const router = useRouter();
  const { toast } = useToast();
  const [applied, setApplied] = useState<Applied | null>(null);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "COD">("UPI");
  const [stage, setStage] = useState<Stage>("cart");
  const [error, setError] = useState("");

  const fmt = (n: number) => fmtUSD(n);
  const subtotal = store.subtotal();
  const discount = applied?.amount ?? 0;
  const shippingFee = subtotal - discount >= 249900 ? 0 : shippingMethod === "EXPRESS" ? 19900 : 9900;
  const total = subtotal - discount + shippingFee;

  if (!store.mounted) {
    return <PageHero label="Checkout" title="Loading cart" sub="Reading the paddock state…" />;
  }

  if (store.lines.length === 0) {
    return (
      <>
        <PageHero label="Checkout" title="Nothing to settle" sub="Your cart is empty — load a piece first." />
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <EmptyState title="Cart empty" body="The grid is open. Find your piece and come back — checkout takes under a minute." action={<Link href="/shop" className="u-btn u-btn-primary">Browse the grid</Link>} />
        </div>
      </>
    );
  }

  const applyCode = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setCodeBusy(true);
    setCodeErr("");
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: clean, subtotal }),
      });
      const data = (await res.json()) as { code?: string; amount?: number; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error || "Invalid code");
      setApplied({ code: data.code, amount: data.amount ?? 0 });
      toast(`Code ${data.code} applied`);
    } catch (err) {
      setCodeErr(err instanceof Error ? err.message : "Invalid code");
      setApplied(null);
    } finally {
      setCodeBusy(false);
    }
  };

  const placeOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setStage("placing");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: store.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          addressLine: form.get("addressLine"),
          city: form.get("city"),
          state: form.get("state"),
          pincode: form.get("pincode"),
          shippingMethod,
          paymentMethod,
          discountCode: applied?.code ?? "",
          notes: form.get("notes"),
        }),
      });
      const data = (await res.json()) as { number?: string; error?: string };
      if (!res.ok || !data.number) throw new Error(data.error || "Order failed");
      store.clear();
      router.push(`/checkout/success/${data.number}?email=${encodeURIComponent(String(form.get("email")))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
      setStage("error");
      toast("Order didn't land — check the message", "err");
    }
  };

  return (
    <>
      <PageHero label="Checkout" title="Settle the order" sub="Stock reserves the second this lands. No card storage — UPI confirmation or cash on delivery." />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 md:px-8 lg:grid-cols-[1fr_420px]">
        <form onSubmit={placeOrder} className="flex flex-col gap-10" noValidate={false}>
          {/* contact + address */}
          <fieldset className="flex flex-col gap-4">
            <legend className="u-label">01 — Delivery target</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="u-label-txt">Full name</span><input name="name" required minLength={2} className="u-input mt-1.5" autoComplete="name" /></label>
              <label><span className="u-label-txt">Email</span><input name="email" type="email" required className="u-input mt-1.5" autoComplete="email" /></label>
              <label><span className="u-label-txt">Phone</span><input name="phone" required pattern={"[+\\d][\\d\\s\\-]{7,15}"} className="u-input mt-1.5" autoComplete="tel" /></label>
              <label><span className="u-label-txt">Address line</span><input name="addressLine" required minLength={6} className="u-input mt-1.5" autoComplete="street-address" /></label>
              <label><span className="u-label-txt">City</span><input name="city" required className="u-input mt-1.5" autoComplete="address-level2" /></label>
              <label><span className="u-label-txt">State</span><input name="state" required className="u-input mt-1.5" autoComplete="address-level1" /></label>
              <label><span className="u-label-txt">PIN code</span><input name="pincode" required pattern="\d{6}" inputMode="numeric" className="u-input mt-1.5" autoComplete="postal-code" /></label>
              <label><span className="u-label-txt">Delivery notes (optional)</span><input name="notes" className="u-input mt-1.5" maxLength={600} /></label>
            </div>
          </fieldset>

          {/* delivery speed */}
          <fieldset>
            <legend className="u-label">02 — Delivery speed</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { id: "STANDARD", label: "Standard", price: fmtUSD(9900), note: "2–4 business days" },
                { id: "EXPRESS", label: "Express", price: fmtUSD(19900), note: "Priority dispatch" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`u-card flex cursor-pointer items-center gap-4 p-4 transition-colors ${shippingMethod === opt.id ? "border-red" : ""}`}
                >
                  <input type="radio" name="shipping" value={opt.id} checked={shippingMethod === opt.id} onChange={() => setShippingMethod(opt.id as never)} className="accent-red" />
                  <span className="flex-1">
                    <span className="block text-[14px] font-semibold">{opt.label}</span>
                    <span className="u-label-txt mt-0.5 block">{opt.note}</span>
                  </span>
                  <span className="u-mono text-sm">{subtotal - discount >= 249900 ? "FREE" : opt.price}</span>
                </label>
              ))}
            </div>
            <p className="u-label-txt mt-2">Free shipping over ₹2,499 — subtotal after discounts counts.</p>
          </fieldset>

          {/* payment */}
          <fieldset>
            <legend className="u-label">03 — Payment</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { id: "UPI", label: "UPI", note: "Pay on confirmation — we hold your unit while it clears" },
                { id: "COD", label: "Cash on delivery", note: "Pay the courier. ₹0 stored card data, ever" },
              ].map((opt) => (
                <label key={opt.id} className={`u-card flex cursor-pointer items-start gap-4 p-4 transition-colors ${paymentMethod === opt.id ? "border-red" : ""}`}>
                  <input type="radio" name="pm" value={opt.id} checked={paymentMethod === opt.id} onChange={() => setPaymentMethod(opt.id as never)} className="mt-1 accent-red" />
                  <span>
                    <span className="block text-[14px] font-semibold">{opt.label}</span>
                    <span className="u-label-txt mt-0.5 block !normal-case !tracking-normal">{opt.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {stage === "error" && error && (
            <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{error}</p>
          )}

          <button type="submit" disabled={stage === "placing"} className="u-btn u-btn-primary w-full !py-4 md:w-auto">
            <Lock className="size-4" aria-hidden />
            {stage === "placing" ? "Placing order…" : `Place order — ${fmt(total)}`}
          </button>
          <p className="u-label-txt">By placing the order the piece is reserved under your name. Payment completes on UPI confirmation or at the door (COD).</p>
        </form>

        {/* summary */}
        <aside className="h-fit lg:sticky lg:top-28">
          <div className="u-card p-6">
            <p className="u-label">Order sheet</p>
            <ul className="mt-4 flex flex-col gap-4">
              {store.lines.map((l) => (
                <li key={l.productId} className="flex gap-3">
                  <span className="u-media relative size-14 shrink-0">
                    {l.image ? <Image src={l.image} alt={l.name} fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="block truncate text-[13px] font-medium">{l.name}</span>
                    <span className="u-label-txt">×{l.qty} · {l.condition}</span>
                  </span>
                  <span className="u-mono text-[13px]">{fmt(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-dim" aria-hidden />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Discount code"
                  className="u-input !py-2 !uppercase"
                  aria-label="Discount code"
                />
                <button type="button" onClick={applyCode} disabled={codeBusy} className="u-btn u-btn-ghost !px-3 !py-2">{codeBusy ? "…" : "Apply"}</button>
              </div>
              {codeErr && <p className="mt-2 text-[12px] text-red">{codeErr}</p>}
            </div>
            <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between"><dt className="text-fog">Subtotal</dt><dd className="u-mono">{fmt(subtotal)}</dd></div>
              {applied && <div className="flex justify-between text-mint"><dt>Code {applied.code}</dt><dd className="u-mono">−{fmt(applied.amount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-fog">Shipping</dt><dd className="u-mono">{shippingFee === 0 ? "FREE" : fmt(shippingFee)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="u-mono">{fmt(total)}</dd></div>
            </dl>
          </div>
          <p className="u-label mt-4 flex items-center gap-2"><ShoppingBag className="size-3.5 text-red" aria-hidden /> Items reserved at placement</p>
        </aside>
      </div>
    </>
  );
}
