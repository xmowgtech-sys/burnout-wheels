"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Tag, Lock, Zap, Copy, Check, ShieldCheck, UserCheck, Sparkles, LogIn, ArrowRight } from "lucide-react";
import { PageHero, EmptyState } from "@/components/ui";
import { useStore, useToast } from "@/components/store/providers";
import { ShopPayButton } from "@/components/store/shop-pay-button";
import { trackFlow } from "@/components/store/site-monitor";
import { fmtUSD } from "@/lib/money";
import { COD_ADVANCE_LABEL, COD_ADVANCE_PAISE, PAYMENT_HELP, codBalance } from "@/lib/payments";

type Stage = "cart" | "details" | "placing" | "paying" | "error";

interface Applied {
  code: string;
  amount: number;
}

interface PlacedOrderState {
  number: string;
  total: number;
  name: string;
  email: string;
  channel: "DISCORD" | "WHATSAPP";
}

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

  // Authentication & customer identity
  const [customer, setCustomer] = useState<{
    authenticated: boolean;
    account?: { id: number; email: string; name?: string | null; picture?: string | null };
  } | null>(null);

  // Identity prompt modal
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState("");
  const [otpNotice, setOtpNotice] = useState("");

  // Order confirmation modal
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderState | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const fmt = (n: number) => fmtUSD(n);
  const subtotal = store.subtotal();
  const discount = applied?.amount ?? 0;
  const shippingFee = subtotal - discount >= 249900 ? 0 : shippingMethod === "EXPRESS" ? 19900 : 9900;
  const total = subtotal - discount + shippingFee;

  // Check login status on mount
  useEffect(() => {
    fetch("/api/auth/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCustomer(data);
      })
      .catch(() => {});
  }, []);

  // Funnel: crossing into the checkout sheet
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

  // Shop Pay express
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
          <EmptyState
            title="Cart empty"
            body="The grid is open. Find your piece and come back — checkout takes under a minute."
            action={
              <Link href="/shop" className="u-btn u-btn-primary">
                Browse the grid
              </Link>
            }
          />
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
      const data = (await res.json()) as { valid?: boolean; amount?: number; error?: string };
      if (!res.ok || !data.valid) {
        setCodeErr(data.error || "Code not recognized or expired.");
        setApplied(null);
      } else {
        setApplied({ code: clean, amount: data.amount ?? 0 });
        setCode("");
        toast(`Applied ${clean} — ₹${Math.round((data.amount ?? 0) / 100)} off`, "ok");
      }
    } catch {
      setCodeErr("Could not check code right now.");
    } finally {
      setCodeBusy(false);
    }
  };

  /** Form submit handler: checks if user is logged in before giving order code */
  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stage === "placing") return;
    setError("");
    const form = new FormData(e.currentTarget);
    setPendingFormData(form);

    const emailVal = String(form.get("email") || "");
    if (emailVal) setOtpEmail(emailVal);

    // If user is not authenticated, prompt them to log in to save identity for order tracking
    if (!customer?.authenticated) {
      setShowIdentityModal(true);
      return;
    }

    // Authenticated: proceed to place order directly
    void executePlaceOrder(form);
  };

  /** Send OTP from inside the identity modal */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail) {
      setOtpErr("Please enter your email.");
      return;
    }
    setOtpBusy(true);
    setOtpErr("");
    setOtpNotice("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = (await res.json()) as { error?: string; note?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send code.");
      setOtpSent(true);
      setOtpNotice(data.note ?? "6-digit verification code sent to your inbox!");
    } catch (err) {
      setOtpErr(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setOtpBusy(false);
    }
  };

  /** Verify OTP and log in customer, then automatically place order */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setOtpErr("Please enter the 6-digit code.");
      return;
    }
    setOtpBusy(true);
    setOtpErr("");
    try {
      const res = await fetch("/api/auth/otp/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean; account?: { id: number; email: string; name?: string | null } };
      if (!res.ok) throw new Error(data.error ?? "Invalid code.");

      setCustomer({
        authenticated: true,
        account: data.account ?? { id: 1, email: otpEmail },
      });
      setShowIdentityModal(false);
      toast("Identity saved! Placing your order now…", "ok");

      if (pendingFormData) {
        void executePlaceOrder(pendingFormData);
      }
    } catch (err) {
      setOtpErr(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setOtpBusy(false);
    }
  };

  /** Execute place order: reserves order in DB, saves to storage, and shows the order code popup */
  const executePlaceOrder = async (form: FormData) => {
    setError("");
    setStage("placing");
    const email = String(form.get("email"));
    const customerName = String(form.get("name") || "Racer");
    const phone = String(form.get("phone") || "");
    const address = String(form.get("addressLine") || "");
    const city = String(form.get("city") || "");
    const state = String(form.get("state") || "");
    const pincode = String(form.get("pincode") || "");
    const discountTotal = applied?.amount ?? 0;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: store.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          name: customerName,
          email,
          phone,
          addressLine: address,
          city,
          state,
          pincode,
          shippingMethod,
          paymentMethod,
          paymentChannel: "DISCORD",
          discountCode: applied?.code ?? "",
          notes: form.get("notes"),
        }),
      });
      const data = (await res.json()) as { number?: string; total?: number; status?: string; error?: string };
      if (!res.ok || !data.number) throw new Error(data.error || "Order failed");
      const orderNumber = data.number!;
      const totalAmount = data.total || total;

      // 1. Copy order number to clipboard immediately
      try {
        await navigator.clipboard.writeText(orderNumber);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 3000);
      } catch {
        /* Clipboard fallback */
      }

      // 2. Persist order details in client storage so success page renders 100% reliably
      const orderSummary = {
        number: orderNumber,
        name: customerName,
        email,
        phone,
        addressLine: address,
        city,
        state,
        pincode,
        total: totalAmount,
        subtotal,
        shippingFee,
        discountTotal,
        paymentMethod,
        paymentChannel: "DISCORD",
        shippingMethod,
        status: "PAYMENT_REVIEW",
        placedAt: new Date().toISOString(),
        items: store.lines.map((l) => ({
          id: l.productId,
          productId: l.productId,
          name: l.name,
          slug: l.slug,
          price: l.price,
          qty: l.qty,
          image: l.image,
          condition: l.condition,
        })),
      };
      try {
        window.sessionStorage.setItem("bw:lastOrder", JSON.stringify(orderSummary));
        window.sessionStorage.setItem("bw:orderPlaced", orderNumber);
        window.sessionStorage.removeItem("bw:cartAbandonedNoted");
      } catch {
        /* private mode */
      }
      trackFlow("order_placed", { orderNumber });

      // 3. Clear cart
      store.clear();

      // 4. Open the Order Code & Payment Modal
      setPlacedOrder({
        number: orderNumber,
        total: totalAmount,
        name: customerName,
        email,
        channel: "DISCORD",
      });
      setStage("details");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Order failed";
      setError(msg);
      setStage("error");
      if (msg.toLowerCase().includes("no longer available") || msg.toLowerCase().includes("out of stock")) {
        store.clear();
        toast("Removed unavailable item from cart", "info");
      } else {
        toast("Order didn't land — check the message", "err");
      }
    }
  };

  const copyOrderNumber = () => {
    if (!placedOrder) return;
    navigator.clipboard.writeText(placedOrder.number);
    setCopiedCode(true);
    toast(`Order #${placedOrder.number} copied to clipboard!`, "ok");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handlePayDiscord = () => {
    if (!placedOrder) return;
    window.open("https://discord.gg/WRZDQEnA2", "_blank");
    router.push(
      `/checkout/success/${placedOrder.number}?email=${encodeURIComponent(placedOrder.email)}&channel=discord&name=${encodeURIComponent(
        placedOrder.name
      )}&total=${placedOrder.total}`
    );
  };

  const handlePayWhatsApp = () => {
    if (!placedOrder) return;
    const totalRupees = Math.round(placedOrder.total / 100);
    const waMsg = encodeURIComponent(
      `Hi Burnout Wheels! I placed Order #${placedOrder.number} for ₹${totalRupees.toLocaleString(
        "en-IN"
      )}. My name is ${placedOrder.name}. Please send the QR code for payment.`
    );
    window.open(`https://wa.me/917889079186?text=${waMsg}`, "_blank");
    router.push(
      `/checkout/success/${placedOrder.number}?email=${encodeURIComponent(placedOrder.email)}&channel=whatsapp&name=${encodeURIComponent(
        placedOrder.name
      )}&total=${placedOrder.total}`
    );
  };

  return (
    <>
      <PageHero
        label="Checkout"
        title="Settle the order"
        sub={`Stock reserves the second this lands. No card storage — UPI, COD with a ${COD_ADVANCE_LABEL} online advance, or PayPal arranged live with a human.`}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 md:px-8 lg:grid-cols-[1fr_420px]">
        <form onSubmit={onFormSubmit} className="flex flex-col gap-10" noValidate={false}>
          {/* express checkout — Shop Pay (only when the whole cart is Shopify-connected) */}
          {shopPay && (
            <div className="u-card p-5">
              <p className="u-label flex items-center gap-2">
                <Zap className="size-3.5 text-yellow" aria-hidden /> Express checkout
              </p>
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

            {/* Identity Status Banner */}
            {customer?.authenticated ? (
              <div className="flex items-center gap-2 rounded border border-mint/30 bg-mint/[0.06] px-3.5 py-2.5 text-xs text-mint">
                <UserCheck className="size-4 shrink-0 text-mint" />
                <span>
                  Identity verified as <strong>{customer.account?.email}</strong> — Orders and live Shiprocket tracking will be saved to your account.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded border border-yellow/30 bg-yellow/[0.04] p-3 text-xs text-fog sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-yellow" />
                  <span>
                    <strong>Save your identity:</strong> Sign in so your order tracking, invoice, and history are saved to your profile.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/auth/google?from=store&back=/checkout"
                    className="u-btn u-btn-ghost px-2.5! py-1! text-[11px]! font-semibold"
                  >
                    Google Sign-In
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowIdentityModal(true)}
                    className="u-btn u-btn-ghost px-2.5! py-1! text-[11px]! font-semibold"
                  >
                    OTP Sign-In
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="u-label-txt">Full name</span>
                <input
                  name="name"
                  defaultValue={customer?.account?.name || ""}
                  required
                  minLength={2}
                  className="u-input mt-1.5"
                  autoComplete="name"
                />
              </label>
              <label>
                <span className="u-label-txt">Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={customer?.account?.email || ""}
                  required
                  className="u-input mt-1.5"
                  autoComplete="email"
                />
              </label>
              <label>
                <span className="u-label-txt">Phone</span>
                <input
                  name="phone"
                  required
                  pattern={"[+\\d][\\d\\s\\-]{7,15}"}
                  className="u-input mt-1.5"
                  autoComplete="tel"
                />
              </label>
              <label>
                <span className="u-label-txt">Address line</span>
                <input
                  name="addressLine"
                  required
                  minLength={6}
                  className="u-input mt-1.5"
                  autoComplete="street-address"
                />
              </label>
              <label>
                <span className="u-label-txt">City</span>
                <input name="city" required className="u-input mt-1.5" autoComplete="address-level2" />
              </label>
              <label>
                <span className="u-label-txt">State</span>
                <input name="state" required className="u-input mt-1.5" autoComplete="address-level1" />
              </label>
              <label>
                <span className="u-label-txt">PIN code</span>
                <input
                  name="pincode"
                  required
                  pattern="\d{6}"
                  inputMode="numeric"
                  className="u-input mt-1.5"
                  autoComplete="postal-code"
                />
              </label>
              <label>
                <span className="u-label-txt">Delivery notes (optional)</span>
                <input name="notes" className="u-input mt-1.5" maxLength={600} />
              </label>
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
                  className={`u-card flex cursor-pointer items-center gap-4 p-4 transition-colors ${
                    shippingMethod === opt.id ? "border-red" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value={opt.id}
                    checked={shippingMethod === opt.id}
                    onChange={() => setShippingMethod(opt.id as never)}
                    className="accent-red"
                  />
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
                <label
                  key={opt.id}
                  className={`u-card flex cursor-pointer items-start gap-4 p-4 transition-colors ${
                    paymentMethod === opt.id ? "border-red" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="pm"
                    value={opt.id}
                    checked={paymentMethod === opt.id}
                    onChange={() => setPaymentMethod(opt.id as never)}
                    className="mt-1 accent-red"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold">{opt.label}</span>
                    <span className="u-label-txt mt-0.5 block normal-case! tracking-normal!">{opt.note}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="u-label-txt mt-3">
              PayPal or a live UPI assist? Arrange it with a human on{" "}
              <a
                href={PAYMENT_HELP.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bone underline underline-offset-4"
              >
                WhatsApp
              </a>{" "}
              or{" "}
              <a
                href={PAYMENT_HELP.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bone underline underline-offset-4"
              >
                Discord
              </a>{" "}
              before placing the order.
            </p>
          </fieldset>

          {paymentMethod === "COD" && (
            <div className="border border-yellow/30 bg-yellow/[0.045] p-5">
              <p className="u-label text-yellow!">COD security advance — {COD_ADVANCE_LABEL} online</p>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">
                We pack COD orders only after the {COD_ADVANCE_LABEL} advance lands. Pay it live with a human on WhatsApp or Discord (UPI or PayPal). It is part of your total, not an extra fee — the balance of{" "}
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
              ? "Placing order & reserving code…"
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
                    <span className="u-label-txt">
                      ×{l.qty} · {l.condition}
                    </span>
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
                <button
                  type="button"
                  onClick={applyCode}
                  disabled={codeBusy}
                  className="u-btn u-btn-ghost px-3! py-2!"
                >
                  {codeBusy ? "…" : "Apply"}
                </button>
              </div>
              {codeErr && <p className="mt-2 text-[12px] text-red">{codeErr}</p>}
            </div>
            <dl className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-fog">Subtotal</dt>
                <dd className="u-mono">{fmt(subtotal)}</dd>
              </div>
              {applied && (
                <div className="flex justify-between text-mint">
                  <dt>Code {applied.code}</dt>
                  <dd className="u-mono">−{fmt(applied.amount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-fog">Shipping</dt>
                <dd className="u-mono">{shippingFee === 0 ? "FREE" : fmt(shippingFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd className="u-mono">{fmt(total)}</dd>
              </div>
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
          <p className="u-label mt-4 flex items-center gap-2">
            <ShoppingBag className="size-3.5 text-red" aria-hidden /> Items reserved at placement
          </p>
        </aside>
      </div>

      {/* 1. IDENTITY & LOGIN GATE MODAL: "Save your identity for order tracking and more" */}
      {showIdentityModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-md anim-fade"
          role="dialog"
          aria-modal="true"
          aria-label="Save your identity"
        >
          <div className="u-card relative w-full max-w-md border border-line bg-panel p-6 sm:p-8 anim-rise">
            <button
              type="button"
              onClick={() => setShowIdentityModal(false)}
              className="absolute right-4 top-4 text-dim hover:text-white text-base"
              aria-label="Close"
            >
              ✕
            </button>
            <span className="inline-flex items-center gap-1.5 rounded bg-yellow/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow">
              <ShieldCheck className="size-3" /> Identity Protection
            </span>
            <h2 className="u-h2 mt-2 text-2xl font-bold">Save your identity first</h2>
            <p className="mt-2 text-xs text-fog leading-relaxed">
              Before giving you your order code, log in to save your identity so your order history, payment status, and Shiprocket live tracking are linked directly to your account.
            </p>

            <div className="mt-6 flex flex-col gap-4">
              {/* Google OAuth Option */}
              <a
                href="/api/auth/google?from=store&back=/checkout"
                className="u-auth-google w-full justify-center text-sm font-semibold py-3!"
              >
                <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.18 7.07C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.86-3c-1.08.72-2.45 1.16-3.42 1.16-2.86 0-5.29-1.93-6.16-4.53l-3.66 2.84C3.99 20.53 7.7 23 12 23z"
                  />
                </svg>
                <span>Continue with Google</span>
              </a>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] uppercase tracking-wider text-dim">or email otp</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              {/* Inline OTP Section */}
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="flex flex-col gap-2.5">
                  <label className="text-[11px] text-fog">
                    <span>Email address for OTP</span>
                    <input
                      type="email"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      required
                      placeholder="driver@burnoutwheels.com"
                      className="u-input mt-1 text-xs"
                    />
                  </label>
                  {otpErr && <p className="text-[11px] text-red">{otpErr}</p>}
                  <button
                    type="submit"
                    disabled={otpBusy}
                    className="u-btn u-btn-secondary w-full py-2.5! text-xs font-semibold"
                  >
                    {otpBusy ? "Sending 6-digit code…" : "Send 6-digit OTP"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="flex flex-col gap-2.5">
                  <div className="rounded border border-mint/30 bg-mint/5 p-2 text-[11px] text-mint">
                    {otpNotice || "6-digit code dispatched to your inbox!"}
                  </div>
                  <label className="text-[11px] text-fog">
                    <span>Enter 6-digit OTP code</span>
                    <input
                      type="text"
                      pattern="\d{6}"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      required
                      placeholder="123456"
                      className="u-input mt-1 u-mono text-center text-lg tracking-widest"
                      autoFocus
                    />
                  </label>
                  {otpErr && <p className="text-[11px] text-red">{otpErr}</p>}
                  <button
                    type="submit"
                    disabled={otpBusy || otpCode.length !== 6}
                    className="u-btn u-btn-primary w-full py-2.5! text-xs font-semibold"
                  >
                    {otpBusy ? "Verifying…" : "Verify & Reserve Order"}
                  </button>
                </form>
              )}

              {/* Guest fallback option */}
              <button
                type="button"
                onClick={() => {
                  setShowIdentityModal(false);
                  if (pendingFormData) {
                    void executePlaceOrder(pendingFormData);
                  }
                }}
                className="mt-2 text-center text-xs text-dim hover:text-white underline underline-offset-4"
              >
                Skip login and continue as guest →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ORDER RESERVED & PAYMENT POPUP: Highlighted Order Number + Copy Button + Instructions + Direct Discord/WhatsApp */}
      {placedOrder && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/90 p-4 backdrop-blur-md anim-fade"
          role="dialog"
          aria-modal="true"
          aria-label="Order reserved and payment instructions"
        >
          <div className="u-card relative w-full max-w-lg border-2 border-red/60 bg-panel p-6 sm:p-8 anim-rise shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <span className="inline-flex items-center gap-1 rounded bg-mint/15 px-2 py-0.5 text-[10px] font-bold text-mint uppercase tracking-wider">
                  <Check className="size-3" /> Order Reserved
                </span>
                <h2 className="u-h2 mt-1 text-2xl font-black text-white">Your Order Number</h2>
              </div>
              <span className="u-mono text-lg font-bold text-bone">
                ₹{Math.round(placedOrder.total / 100).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Prominently Highlighted Order Number with Copy Button */}
            <div className="mt-5 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-red bg-red/[0.08] p-5 text-center shadow-inner">
              <p className="u-label text-dim">Copy and drop this inside #billing or WhatsApp</p>
              <p className="u-mono text-3xl font-black tracking-widest text-white sm:text-4xl selection:bg-red selection:text-white">
                {placedOrder.number}
              </p>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="u-btn u-btn-primary mt-2 flex items-center gap-2 px-5! py-2.5! text-xs font-bold transition-transform active:scale-95"
              >
                {copiedCode ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
                <span>{copiedCode ? "Copied to Clipboard! ✓" : "Copy Order Number"}</span>
              </button>
            </div>

            {/* Clear Instructions */}
            <div className="mt-5 rounded border border-line bg-surface p-4 text-left">
              <p className="u-label text-white">What to do next:</p>
              <ol className="mt-2.5 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-fog">
                <li className="flex items-start gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-red text-[11px] font-bold text-white">
                    1
                  </span>
                  <span>
                    <strong>Copy your order number</strong> ({placedOrder.number}) using the button above.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-red text-[11px] font-bold text-white">
                    2
                  </span>
                  <span>
                    <strong>Drop it inside Discord #billing or WhatsApp below</strong> to receive the payment QR code.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-red text-[11px] font-bold text-white">
                    3
                  </span>
                  <span>
                    <strong>Scan &amp; Pay:</strong> A real agent verifies the payment, marks the product as{" "}
                    <strong className="text-white">SOLD</strong> in our store, and dispatches via{" "}
                    <strong className="text-white">Shiprocket</strong> with doorstep tracking!
                  </span>
                </li>
              </ol>
            </div>

            {/* Direct Action Buttons: Discord and WhatsApp */}
            <div className="mt-5 flex flex-col gap-3">
              {/* Discord Option */}
              <button
                type="button"
                onClick={handlePayDiscord}
                className="u-card group relative flex flex-col items-start gap-1.5 border-2 border-red bg-red/[0.06] p-4 text-left transition-all hover:bg-red/[0.12]"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-base font-bold text-bone flex items-center gap-2">
                    Pay on Discord
                  </span>
                  <span className="u-badge bg-red text-white text-[10px] font-bold">
                    MOST POPULAR
                  </span>
                </div>
                <p className="text-[12px] text-fog leading-relaxed">
                  Drops you into our Discord server. Drop your order number inside the{" "}
                  <strong className="text-white">#billing</strong> channel to complete payment via QR code.
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-red group-hover:translate-x-1 transition-transform">
                  <span>Continue to Discord #billing (discord.gg/WRZDQEnA2)</span>
                  <span>→</span>
                </div>
              </button>

              {/* WhatsApp Option */}
              <button
                type="button"
                onClick={handlePayWhatsApp}
                className="u-card group relative flex flex-col items-start gap-1.5 border border-line bg-surface p-4 text-left transition-all hover:border-mint hover:bg-mint/[0.04]"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-base font-bold text-bone flex items-center gap-2">
                    Pay on WhatsApp
                  </span>
                  <span className="u-badge border-mint text-mint text-[10px] font-bold">
                    DIRECT CHAT
                  </span>
                </div>
                <p className="text-[12px] text-fog leading-relaxed">
                  Chat directly with our team. Send your order number and our agent will send you the QR code for payment.
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-mint group-hover:translate-x-1 transition-transform">
                  <span>Continue to WhatsApp (+91 78890 79186)</span>
                  <span>→</span>
                </div>
              </button>
            </div>

            {/* Link to order status / success page */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/checkout/success/${placedOrder.number}?email=${encodeURIComponent(
                      placedOrder.email
                    )}&channel=discord&name=${encodeURIComponent(placedOrder.name)}&total=${placedOrder.total}`
                  )
                }
                className="text-xs text-dim hover:text-white underline underline-offset-4"
              >
                View full order confirmation &amp; UPI QR code on site →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
