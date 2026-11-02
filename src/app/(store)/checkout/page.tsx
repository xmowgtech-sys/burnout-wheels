"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Tag, Lock, Zap } from "lucide-react";
import { PageHero, EmptyState } from "@/components/ui";
import { useStore, useToast } from "@/components/store/providers";
import { ShopPayButton } from "@/components/store/shop-pay-button";
import { trackFlow } from "@/components/store/site-monitor";
import { fmtUSD } from "@/lib/money";
import { COD_ADVANCE_LABEL, COD_ADVANCE_PAISE, PAYMENT_HELP, codBalance } from "@/lib/payments";

type Stage = "cart" | "details" | "placing" | "paying" | "error";

interface RazorpayCheckoutInstance {
  open: () => void;
}

interface RazorpayWindow extends Window {
  Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
  __bwRzpLoading?: Promise<void>;
}
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
  const [shopPay, setShopPay] = useState<{ storeDomain: string; variantIds: number[] } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const fmt = (n: number) => fmtUSD(n);
  const subtotal = store.subtotal();
  const discount = applied?.amount ?? 0;
  const shippingFee = subtotal - discount >= 249900 ? 0 : shippingMethod === "EXPRESS" ? 19900 : 9900;
  const total = subtotal - discount + shippingFee;

  // funnel: crossing into the checkout sheet (once cart is known non-empty)
  useEffect(() => {
    if (store.mounted && store.lines.length > 0) trackFlow("checkout_start");
  }, [store.mounted, store.lines.length]);

  // Auto-clean stale or deleted items from cart
  useEffect(() => {
    if (!store.mounted || store.lines.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products?limit=100");
        if (!res.ok) return;
        const data = (await res.json()) as { products?: { id: number; status: string }[] };
        if (!cancelled && Array.isArray(data.products)) {
          const liveIds = new Set(data.products.filter((p) => p.status === "ACTIVE").map((p) => p.id));
          const deadLines = store.lines.filter((l) => !liveIds.has(l.productId));
          if (deadLines.length > 0) {
            deadLines.forEach((d) => store.remove(d.productId));
            toast(`Cleaned ${deadLines.length} discontinued item(s) from your cart`, "info");
          }
        }
      } catch {
        // network error / offline — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store.mounted, store.lines, store.remove, toast]);

  // Shop Pay express — only offers itself when the whole cart is Shopify-connected
  useEffect(() => {
    if (!store.mounted || store.lines.length === 0) return;
    const ids = [...new Set(store.lines.map((l) => l.productId))];
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/shop-pay/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productIds: ids }),
        });
        const data = (await res.json()) as { eligible?: boolean; storeDomain?: string; variantIds?: number[] };
        if (!cancelled && res.ok && data.eligible && data.storeDomain && data.variantIds) {
          setShopPay({ storeDomain: data.storeDomain, variantIds: data.variantIds });
        } else if (!cancelled) {
          setShopPay(null);
        }
      } catch {
        if (!cancelled) setShopPay(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store.mounted, store.lines]);

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

  /** Loads the Razorpay Checkout script once. */
  const loadRazorpay = (): Promise<RazorpayWindow["Razorpay"] | null> =>
    new Promise((resolve) => {
      const w = window as RazorpayWindow;
      if (w.Razorpay) return resolve(w.Razorpay);
      if (!w.__bwRzpLoading) {
        w.__bwRzpLoading = new Promise<void>((done) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => done();
          s.onerror = () => done(); // resolve with null below
          document.head.appendChild(s);
        });
      }
      w.__bwRzpLoading.then(() => resolve(w.Razorpay ?? null));
    });

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    setPendingFormData(form);
    setShowPaymentModal(true);
  };

  const executePlaceOrder = async (channel: "DISCORD" | "WHATSAPP") => {
    if (!pendingFormData) return;
    setError("");
    setStage("placing");
    const form = pendingFormData;
    const email = String(form.get("email"));
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: store.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          name: form.get("name"),
          email,
          phone: form.get("phone"),
          addressLine: form.get("addressLine"),
          city: form.get("city"),
          state: form.get("state"),
          pincode: form.get("pincode"),
          shippingMethod,
          paymentMethod,
          paymentChannel: channel,
          discountCode: applied?.code ?? "",
          notes: form.get("notes"),
        }),
      });
      const data = (await res.json()) as { number?: string; total?: number; status?: string; error?: string };
      if (!res.ok || !data.number) throw new Error(data.error || "Order failed");
      const orderNumber = data.number!;
      try {
        window.sessionStorage.setItem("bw:orderPlaced", orderNumber);
        window.sessionStorage.removeItem("bw:cartAbandonedNoted");
      } catch { /* private mode */ }
      trackFlow("order_placed", { orderNumber });

      store.clear();
      router.push(`/checkout/success/${orderNumber}?email=${encodeURIComponent(email)}&channel=${channel.toLowerCase()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Order failed";
      setError(msg);
      setStage("error");
      setShowPaymentModal(false);
      if (msg.toLowerCase().includes("no longer available") || msg.toLowerCase().includes("out of stock")) {
        store.clear();
        toast("Removed unavailable item from cart", "info");
      } else {
        toast("Order didn't land — check the message", "err");
      }
    }
  };

  return (
    <>
      <PageHero label="Checkout" title="Settle the order" sub={`Stock reserves the second this lands. No card storage — UPI, COD with a ${COD_ADVANCE_LABEL} online advance, or PayPal arranged live with a human.`} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 md:px-8 lg:grid-cols-[1fr_420px]">
        <form onSubmit={onFormSubmit} className="flex flex-col gap-10" noValidate={false}>
          {/* express checkout — Shop Pay (only when the whole cart is Shopify-connected) */}
          {shopPay && (
            <div className="u-card p-5">
              <p className="u-label flex items-center gap-2"><Zap className="size-3.5 text-yellow" aria-hidden /> Express checkout</p>
              <div className="mt-3">
                <ShopPayButton
                  storeDomain={shopPay.storeDomain}
                  variantIds={shopPay.variantIds}
                  note="Leaves this page for Shop Pay — payment and address run on your Shopify store. The order appears in this dashboard on the next Shopify sync."
                />
              </div>
            </div>
          )}

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
                { id: "COD", label: "Cash on delivery", note: `${COD_ADVANCE_LABEL} online advance, balance at the door` },
              ].map((opt) => (
                <label key={opt.id} className={`u-card flex cursor-pointer items-start gap-4 p-4 transition-colors ${paymentMethod === opt.id ? "border-red" : ""}`}>
                  <input type="radio" name="pm" value={opt.id} checked={paymentMethod === opt.id} onChange={() => setPaymentMethod(opt.id as never)} className="mt-1 accent-red" />
                  <span>
                    <span className="block text-[14px] font-semibold">{opt.label}</span>
                    <span className="u-label-txt mt-0.5 block normal-case! tracking-normal!">{opt.note}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="u-label-txt mt-3">
              PayPal or a live UPI assist? Arrange it with a human on{" "}
              <a href={PAYMENT_HELP.whatsapp} target="_blank" rel="noopener noreferrer" className="text-bone underline underline-offset-4">WhatsApp</a>{" "}
              or{" "}
              <a href={PAYMENT_HELP.discord} target="_blank" rel="noopener noreferrer" className="text-bone underline underline-offset-4">Discord</a>{" "}
              before placing the order.
            </p>
          </fieldset>

          {paymentMethod === "COD" && (
            <div className="border border-yellow/30 bg-yellow/[0.045] p-5">
              <p className="u-label text-yellow!">COD security advance — {COD_ADVANCE_LABEL} online</p>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">
                We pack COD orders only after the {COD_ADVANCE_LABEL} advance lands. Pay it live with a human on
                WhatsApp or Discord (UPI or PayPal). It is part of your total, not an extra fee — the balance of{" "}
                <span className="u-mono text-bone">{fmt(codBalance(total))}</span> is paid to the courier.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={PAYMENT_HELP.whatsappCod}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-btn u-btn-ghost px-3! py-2! text-[10px]!"
                >
                  Pay {COD_ADVANCE_LABEL} on WhatsApp
                </a>
                <a
                  href={PAYMENT_HELP.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-btn u-btn-ghost px-3! py-2! text-[10px]!"
                >
                  Discord
                </a>
              </div>
              <label className="mt-4 flex items-start gap-3 text-[12.5px] leading-relaxed text-fog">
                <input type="checkbox" name="codAdvanceAck" required className="mt-0.5 size-4 accent-red" />
                <span>
                  I understand the {COD_ADVANCE_LABEL} advance must be paid online before this COD order is packed.
                </span>
              </label>
            </div>
          )}

          {stage === "error" && error && (
            <div role="alert" className="border border-red bg-red/10 p-4 text-[13px] text-red flex flex-col gap-2">
              <p className="font-semibold">{error}</p>
              {error.toLowerCase().includes("no longer available") && (
                <button
                  type="button"
                  onClick={() => {
                    store.clear();
                    router.push("/shop");
                  }}
                  className="u-btn u-btn-primary self-start text-xs py-1.5! px-3!"
                >
                  Clear stale cart &amp; browse live grid
                </button>
              )}
            </div>
          )}

          <button type="submit" disabled={stage === "placing"} className="u-btn u-btn-primary w-full py-4! md:w-auto">
            <Lock className="size-4" aria-hidden />
            {stage === "placing"
              ? "Placing order…"
              : paymentMethod === "COD"
                ? `Place COD order — ${fmt(total)}`
                : `Place order — ${fmt(total)}`}
          </button>
          <p className="u-label-txt">
            By placing the order the piece is reserved under your name. UPI completes on confirmation. COD completes
            only after the {COD_ADVANCE_LABEL} online advance lands; the balance is paid at the door.
          </p>
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
                  className="u-input py-2! uppercase!"
                  aria-label="Discount code"
                />
                <button type="button" onClick={applyCode} disabled={codeBusy} className="u-btn u-btn-ghost px-3! py-2!">{codeBusy ? "…" : "Apply"}</button>
              </div>
              {codeErr && <p className="mt-2 text-[12px] text-red">{codeErr}</p>}
            </div>
            <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between"><dt className="text-fog">Subtotal</dt><dd className="u-mono">{fmt(subtotal)}</dd></div>
              {applied && <div className="flex justify-between text-mint"><dt>Code {applied.code}</dt><dd className="u-mono">−{fmt(applied.amount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-fog">Shipping</dt><dd className="u-mono">{shippingFee === 0 ? "FREE" : fmt(shippingFee)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd className="u-mono">{fmt(total)}</dd></div>
              {paymentMethod === "COD" && (
                <>
                  <div className="flex justify-between text-yellow">
                    <dt>COD advance (online)</dt>
                    <dd className="u-mono">{fmt(Math.min(COD_ADVANCE_PAISE, total))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fog">Balance on delivery</dt>
                    <dd className="u-mono">{fmt(codBalance(total))}</dd>
                  </div>
                  <p className="text-[11px] leading-relaxed text-dim">
                    The advance is part of the total, not an extra fee. We pack only after it lands.
                  </p>
                </>
              )}
            </dl>
          </div>

          <div className="mt-4 border border-line bg-panel p-4">
            <p className="u-label">Payment help — live human</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fog">
              UPI, COD advance or PayPal: talk to the crew and pay live. No bot, no fake gateway.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={PAYMENT_HELP.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="u-btn u-btn-ghost px-3! py-2! text-[10px]!"
              >
                WhatsApp
              </a>
              <a
                href={PAYMENT_HELP.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="u-btn u-btn-ghost px-3! py-2! text-[10px]!"
              >
                Discord
              </a>
            </div>
          </div>
          <p className="u-label mt-4 flex items-center gap-2"><ShoppingBag className="size-3.5 text-red" aria-hidden /> Items reserved at placement</p>
        </aside>
      </div>

      {/* WHERE TO PAY SELECTION MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-md anim-fade" role="dialog" aria-modal="true" aria-label="Select payment method">
          <div className="u-card relative w-full max-w-lg border border-line bg-panel p-6 sm:p-8 anim-rise">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-dim hover:text-white text-base"
              aria-label="Close"
            >
              ✕
            </button>
            <p className="u-label text-red">Payment Channel</p>
            <h2 className="u-h2 mt-1 text-2xl font-bold">Where would you like to pay?</h2>
            <p className="mt-2 text-xs text-fog leading-relaxed">
              Stock reserves immediately once placed. Choose your payment method below:
            </p>

            <div className="mt-6 flex flex-col gap-4">
              {/* Discord Option */}
              <button
                type="button"
                onClick={() => executePlaceOrder("DISCORD")}
                disabled={stage === "placing"}
                className="u-card group relative flex flex-col items-start gap-2 border-2 border-red/40 bg-red/[0.04] p-5 text-left transition-all hover:border-red hover:bg-red/[0.08]"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-base font-bold text-bone">
                    Pay on Discord
                  </span>
                  <span className="u-badge bg-red text-white text-[10px] font-bold">
                    MOST POPULAR
                  </span>
                </div>
                <p className="text-[12.5px] text-fog leading-relaxed">
                  Drops you into our Discord server. Drop your order number inside the <strong className="text-white">#billing</strong> channel and scan the QR code to complete payment. A real agent verifies and accepts your order (up to 24h).
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red group-hover:translate-x-1 transition-transform">
                  <span>Continue with Discord #billing</span>
                  <span>→</span>
                </div>
              </button>

              {/* WhatsApp Option */}
              <button
                type="button"
                onClick={() => executePlaceOrder("WHATSAPP")}
                disabled={stage === "placing"}
                className="u-card group relative flex flex-col items-start gap-2 border border-line bg-surface p-5 text-left transition-all hover:border-mint hover:bg-mint/[0.04]"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-base font-bold text-bone">
                    Pay on WhatsApp
                  </span>
                  <span className="u-badge border-mint text-mint text-[10px] font-bold">
                    DIRECT CHAT
                  </span>
                </div>
                <p className="text-[12.5px] text-fog leading-relaxed">
                  Send a message quoting your order number. Our agent will send you the QR code for payment. Once confirmed, we accept and dispatch via <strong className="text-white">Shiprocket</strong>.
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-mint group-hover:translate-x-1 transition-transform">
                  <span>Continue with WhatsApp</span>
                  <span>→</span>
                </div>
              </button>
            </div>

            {stage === "placing" && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-yellow">
                <span className="size-3 animate-spin rounded-full border-2 border-line border-t-yellow" />
                <span>Reserving stock &amp; creating order…</span>
              </div>
            )}

            <p className="mt-6 border-t border-line pt-4 text-[11px] text-dim leading-relaxed">
              Fulfilment: All verified orders are accepted inside our panel and dispatched pan-India through <strong>Shiprocket</strong> with doorstep tracking.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
