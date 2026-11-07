"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Tag,
  Lock,
  Zap,
  ShieldCheck,
  UserCheck,
  Plus,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { PageHero, EmptyState } from "@/components/ui";
import { useStore, useToast } from "@/components/store/providers";
import { ShopPayButton } from "@/components/store/shop-pay-button";
import { trackFlow } from "@/components/store/site-monitor";
import { fmtUSD } from "@/lib/money";
import { COD_ADVANCE_LABEL, COD_ADVANCE_PAISE, PAYMENT_HELP, codBalance } from "@/lib/payments";
import type { CustomerAddress } from "@/lib/addresses";

type Stage = "cart" | "details" | "placing" | "error";

interface Applied {
  code: string;
  amount: number;
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
    account?: { id: number; email: string; name?: string | null; phone?: string | null; picture?: string | null };
  } | null>(null);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">("new");
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(true);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [notes, setNotes] = useState("");

  // Billing address separation
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billingName, setBillingName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPincode, setBillingPincode] = useState("");

  // COD acknowledgment checkbox
  const [codAcknowledged, setCodAcknowledged] = useState(false);

  // Identity prompt modal
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState("");
  const [otpNotice, setOtpNotice] = useState("");

  // Order flow state
  const [pendingFormSubmit, setPendingFormSubmit] = useState(false);

  // Storage hydration fallback so cart is never lost on navigation/refresh
  const [fallbackLines, setFallbackLines] = useState<typeof store.lines>([]);
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("bw:cart:v1") || window.sessionStorage.getItem("bw:cart:v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFallbackLines(parsed);
          if (store.lines.length === 0) {
            parsed.forEach((l) => store.add(l, l.qty));
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setCartHydrated(true);
    }
  }, [store]);

  const activeLines = store.lines.length > 0 ? store.lines : fallbackLines;

  const fmt = (n: number) => fmtUSD(n);
  const subtotal = activeLines.reduce((n, l) => n + l.qty * l.price, 0);
  const discount = applied?.amount ?? 0;
  const shippingFee = subtotal - discount >= 249900 ? 0 : shippingMethod === "EXPRESS" ? 19900 : 9900;
  const total = subtotal - discount + shippingFee;

  // Check login status on mount & fetch saved addresses
  useEffect(() => {
    fetch("/api/auth/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.authenticated) {
          setCustomer(data);
          if (data.account) {
            if (data.account.name) setName(data.account.name);
            if (data.account.email) setEmail(data.account.email);
            if (data.account.phone) setPhone(data.account.phone);
          }

          // Fetch saved addresses
          fetch("/api/account/addresses")
            .then((r) => (r.ok ? r.json() : null))
            .then((addrData) => {
              if (addrData && Array.isArray(addrData.addresses) && addrData.addresses.length > 0) {
                setSavedAddresses(addrData.addresses);
                const defaultAddr =
                  addrData.addresses.find((a: CustomerAddress) => a.isDefault) || addrData.addresses[0];
                if (defaultAddr) {
                  setSelectedAddressId(defaultAddr.id);
                  setName(defaultAddr.name);
                  setPhone(defaultAddr.phone);
                  setAddressLine(defaultAddr.addressLine);
                  setCity(defaultAddr.city);
                  setState(defaultAddr.state);
                  setPincode(defaultAddr.pincode);
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // When selected address changes, auto-fill address fields
  const handleSelectAddress = (id: number | "new") => {
    setSelectedAddressId(id);
    if (id === "new") {
      setAddressLine("");
      setCity("");
      setState("");
      setPincode("");
    } else {
      const found = savedAddresses.find((a) => a.id === id);
      if (found) {
        setName(found.name);
        setPhone(found.phone);
        setAddressLine(found.addressLine);
        setCity(found.city);
        setState(found.state);
        setPincode(found.pincode);
      }
    }
  };

  // Funnel: crossing into the checkout sheet
  useEffect(() => {
    if (activeLines.length > 0) trackFlow("checkout_start");
  }, [activeLines.length]);

  // Shop Pay express
  useEffect(() => {
    if (activeLines.length === 0) return;
    const ids = [...new Set(activeLines.map((l) => l.productId))];
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
  }, [activeLines]);

  if (!store.mounted && !cartHydrated) {
    return <PageHero label="Checkout" title="Loading cart" sub="Reading the paddock state…" />;
  }

  // Never hijack screen while the order is currently in-flight
  if (activeLines.length === 0 && stage !== "placing") {
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

  /** Form submit handler: directly places order and auto-connects customer account */
  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stage === "placing") return;
    setError("");

    if (paymentMethod === "COD" && !codAcknowledged) {
      setError("Please confirm the ₹200 COD advance checkbox to proceed.");
      toast("Please confirm the ₹200 COD advance checkbox to proceed", "err");
      return;
    }

    if (email) setOtpEmail(email);

    // Place order directly — customer account is automatically created/connected server-side
    void executePlaceOrder();
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

      void executePlaceOrder();
    } catch (err) {
      setOtpErr(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setOtpBusy(false);
    }
  };

  /** Execute place order: reserves order in DB, saves to storage, and shows the order code popup */
  const executePlaceOrder = async () => {
    setError("");
    setStage("placing");
    const customerName = name.trim() || "Racer";
    const discountTotal = applied?.amount ?? 0;

    // Optionally save address to customer account if requested
    if (customer?.authenticated && selectedAddressId === "new" && saveAddressToAccount) {
      try {
        await fetch("/api/account/addresses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: "Home",
            name: customerName,
            phone: phone.trim(),
            addressLine: addressLine.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            isDefault: savedAddresses.length === 0,
          }),
        });
      } catch {
        /* ignore background address save failure */
      }
    }

    let idempotencyKey = "";
    try {
      const storedKey = window.sessionStorage.getItem("bw:idempotencyKey");
      if (storedKey) {
        idempotencyKey = storedKey;
      } else {
        idempotencyKey = "IDEMP-" + Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
        window.sessionStorage.setItem("bw:idempotencyKey", idempotencyKey);
      }
    } catch {
      idempotencyKey = "IDEMP-" + Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
    }

    const resolvedBillingAddress = sameAsShipping
      ? addressLine.trim()
      : `${billingAddress || ""}, ${billingCity || ""} ${billingState || ""} ${billingPincode || ""}`.trim();

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: activeLines.map((l) => ({ productId: l.productId, slug: l.slug, qty: l.qty })),
          name: customerName,
          email: email.trim(),
          phone: phone.trim(),
          addressLine: addressLine.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          billingAddress: resolvedBillingAddress || undefined,
          shippingMethod,
          paymentMethod,
          discountCode: applied?.code ?? "",
          notes: notes.trim() || undefined,
          idempotencyKey,
          accountId: customer?.account?.id || undefined,
        }),
      });
      const data = (await res.json()) as { number?: string; total?: number; status?: string; error?: string };
      if (!res.ok || !data.number) throw new Error(data.error || "Order failed");
      try {
        window.sessionStorage.removeItem("bw:idempotencyKey");
      } catch {}
      const orderNumber = data.number!;

      // 1. Mark this cart as converted for abandonment telemetry. Order details
      //    are read from the database only — never from browser storage.
      try {
        window.sessionStorage.setItem("bw:orderPlaced", orderNumber);
        window.sessionStorage.removeItem("bw:cartAbandonedNoted");
      } catch {
        /* private mode */
      }
      trackFlow("order_placed", { orderNumber });

      // 3. Clear cart immediately
      try {
        window.sessionStorage.setItem("bw:cart:clear-pending", "1");
      } catch {}
      store.clear();
      setFallbackLines([]);
      try {
        window.localStorage.removeItem("bw:cart:v1");
        window.sessionStorage.removeItem("bw:cart:v1");
      } catch {}

      toast(`Order #${orderNumber} registered successfully!`, "ok");

      // 4. Automatically navigate directly to the order confirmation page
      router.push(`/checkout/success/${orderNumber}?channel=discord`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Order failed";
      setError(msg);
      setStage("error");
      if (msg.toLowerCase().includes("no longer available") || msg.toLowerCase().includes("out of stock")) {
        store.clear();
        setFallbackLines([]);
        try {
          window.localStorage.removeItem("bw:cart:v1");
          window.sessionStorage.removeItem("bw:cart:v1");
        } catch {}
        toast("Removed unavailable item from cart — please select an available piece", "info");
      } else {
        toast("Order didn't land — check the message", "err");
      }
    }
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

          {/* 01: Delivery Target */}
          <fieldset className="flex flex-col gap-4">
            <legend className="u-label">01 — Delivery target &amp; Address</legend>

            {/* Identity Status Banner */}
            {customer?.authenticated ? (
              <div className="flex items-center gap-2 rounded border border-mint/30 bg-mint/[0.06] px-3.5 py-2.5 text-xs text-mint">
                <UserCheck className="size-4 shrink-0 text-mint" />
                <span>
                  Signed in as <strong>{customer.account?.email}</strong> — Orders, saved addresses, and live Shiprocket tracking are saved to your account.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded border border-yellow/30 bg-yellow/[0.04] p-3 text-xs text-fog sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-yellow" />
                  <span>
                    <strong>Save your identity:</strong> Sign in to link your order tracking, address, and invoices to your account.
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

            {/* Saved Addresses Selector (if user has saved addresses) */}
            {savedAddresses.length > 0 && (
              <div className="mb-2">
                <span className="u-label-txt block mb-2">Saved Delivery Addresses</span>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectAddress(addr.id)}
                      className={`u-card flex flex-col items-start p-3.5 text-left transition-all ${
                        selectedAddressId === addr.id ? "border-red bg-red/[0.05]" : "hover:border-line-strong"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-bold text-bone flex items-center gap-1.5">
                          <MapPin className="size-3 text-red" />
                          <span>{addr.label}</span>
                        </span>
                        {addr.isDefault && (
                          <span className="u-badge border-mint text-mint text-[9px]">DEFAULT</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-white truncate">{addr.name}</p>
                      <p className="text-[11.5px] text-fog leading-relaxed mt-0.5 line-clamp-2">
                        {addr.addressLine}, {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className="text-[10px] text-dim mt-1">Ph: {addr.phone}</p>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleSelectAddress("new")}
                    className={`u-card flex flex-col items-center justify-center p-3.5 text-center border-dashed transition-all ${
                      selectedAddressId === "new" ? "border-red bg-red/[0.05]" : "hover:border-line-strong"
                    }`}
                  >
                    <Plus className="size-4 text-fog mb-1" />
                    <span className="text-xs font-semibold text-bone">+ Add new address</span>
                    <span className="text-[10px] text-dim">Deliver to a different location</span>
                  </button>
                </div>
              </div>
            )}

            {/* Address Input Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="u-label-txt">Full name</span>
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="u-input mt-1.5"
                  autoComplete="email"
                />
              </label>
              <label>
                <span className="u-label-txt">Phone</span>
                <input
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  required
                  minLength={6}
                  className="u-input mt-1.5"
                  autoComplete="street-address"
                />
              </label>
              <label>
                <span className="u-label-txt">City</span>
                <input
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="u-input mt-1.5"
                  autoComplete="address-level2"
                />
              </label>
              <label>
                <span className="u-label-txt">State</span>
                <input
                  name="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  className="u-input mt-1.5"
                  autoComplete="address-level1"
                />
              </label>
              <label>
                <span className="u-label-txt">PIN code</span>
                <input
                  name="pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  pattern="\d{6}"
                  inputMode="numeric"
                  className="u-input mt-1.5"
                  autoComplete="postal-code"
                />
              </label>
              <label>
                <span className="u-label-txt">Delivery notes (optional)</span>
                <input
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="u-input mt-1.5"
                  maxLength={600}
                />
              </label>
            </div>

            {/* Checkbox to save new address to customer account */}
            {selectedAddressId === "new" && (
              <label className="mt-2 flex items-center gap-2.5 text-xs text-fog cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddressToAccount}
                  onChange={(e) => setSaveAddressToAccount(e.target.checked)}
                  className="size-4 accent-red"
                />
                <span>Save this address to my account for future orders</span>
              </label>
            )}

            {/* Billing address toggle */}
            <div className="mt-4 border-t border-line pt-4">
              <label className="flex items-center gap-2.5 text-xs text-fog cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(e) => setSameAsShipping(e.target.checked)}
                  className="size-4 accent-red"
                />
                <span className="font-semibold text-bone">Billing address is same as delivery address</span>
              </label>

              {!sameAsShipping && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 rounded border border-line bg-surface p-4">
                  <label>
                    <span className="u-label-txt">Billing Name</span>
                    <input
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                      required={!sameAsShipping}
                      className="u-input mt-1.5 text-xs"
                    />
                  </label>
                  <label>
                    <span className="u-label-txt">Billing Address Line</span>
                    <input
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      required={!sameAsShipping}
                      className="u-input mt-1.5 text-xs"
                    />
                  </label>
                  <label>
                    <span className="u-label-txt">Billing City</span>
                    <input
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      required={!sameAsShipping}
                      className="u-input mt-1.5 text-xs"
                    />
                  </label>
                  <label>
                    <span className="u-label-txt">Billing PIN Code</span>
                    <input
                      value={billingPincode}
                      onChange={(e) => setBillingPincode(e.target.value)}
                      required={!sameAsShipping}
                      className="u-input mt-1.5 text-xs"
                    />
                  </label>
                </div>
              )}
            </div>
          </fieldset>

          {/* 02: Delivery Speed */}
          <fieldset>
            <legend className="u-label">02 — Delivery speed</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { id: "STANDARD", label: "Standard", price: fmtUSD(9900), note: "2–4 business days pan-India" },
                { id: "EXPRESS", label: "Express", price: fmtUSD(19900), note: "Priority pit-lane dispatch" },
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
            <p className="u-label-txt mt-2">Free shipping on orders over ₹2,499 — subtotal after discounts counts.</p>
          </fieldset>

          {/* 03: Payment */}
          <fieldset>
            <legend className="u-label">03 — Payment &amp; COD Choice</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { id: "UPI", label: "UPI", note: "Direct UPI / QR code payment on confirmation" },
                { id: "COD", label: "Cash on delivery", note: `₹200 online security advance, balance at door` },
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
          </fieldset>

          {/* COD Security Advance Section: Clean & Professional, NO Discord or WhatsApp buttons */}
          {paymentMethod === "COD" && (
            <div className="border border-yellow/40 bg-yellow/[0.04] p-5 rounded">
              <p className="u-label text-yellow! flex items-center gap-1.5 font-bold">
                <ShieldCheck className="size-4" /> COD Security Advance — ₹200 Online
              </p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-fog">
                Cash on Delivery requires a mandatory online security advance of ₹200 to secure courier allocation and prevent unverified dispatches. This ₹200 advance is deducted directly from your total order amount — the remaining balance of{" "}
                <strong className="u-mono text-white">{fmt(codBalance(total))}</strong> is paid to the courier partner upon doorstep delivery.
              </p>
              <p className="mt-2 text-[12px] text-dim leading-relaxed">
                You will receive your advance payment options immediately after placing your order. Orders are packed and dispatched pan-India via Shiprocket once the ₹200 advance clears.
              </p>

              {/* One Required Confirmation Checkbox */}
              <label className="mt-4 flex items-start gap-3 rounded border border-yellow/30 bg-coal/60 p-3.5 text-[12.5px] leading-relaxed text-bone cursor-pointer">
                <input
                  type="checkbox"
                  name="codAdvanceAck"
                  checked={codAcknowledged}
                  onChange={(e) => setCodAcknowledged(e.target.checked)}
                  required
                  className="mt-0.5 size-4 accent-red"
                />
                <span>
                  I understand and confirm that the ₹200 online security advance must be paid to confirm dispatch, and the remaining balance of <strong className="text-white">{fmt(codBalance(total))}</strong> will be paid at the door.
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

          {/* Place Order Button */}
          <button
            type="submit"
            disabled={stage === "placing" || (paymentMethod === "COD" && !codAcknowledged)}
            className="u-btn u-btn-primary w-full py-4! text-sm font-bold md:w-auto flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Lock className="size-4" aria-hidden />
            {stage === "placing"
              ? "Reserving order & issuing code…"
              : paymentMethod === "COD"
              ? `Place COD Order — ${fmt(total)}`
              : `Place Order — ${fmt(total)}`}
          </button>
          <p className="u-label-txt">
            Stock reserves immediately when your order is placed. UPI completes on confirmation. COD completes after the {COD_ADVANCE_LABEL} online advance lands.
          </p>
        </form>

        {/* Order Sheet Summary */}
        <aside className="h-fit lg:sticky lg:top-28">
          <div className="u-card p-6 border border-line bg-panel">
            <p className="u-label">Order sheet</p>
            <ul className="mt-4 flex flex-col gap-4">
              {activeLines.map((l) => (
                <li key={l.productId} className="flex gap-3">
                  <span className="u-media relative size-14 shrink-0 border border-line bg-surface">
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

            {/* Discount Code */}
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

          <p className="u-label mt-4 flex items-center gap-2">
            <ShoppingBag className="size-3.5 text-red" aria-hidden /> Items reserved at placement
          </p>
        </aside>
      </div>

      {/* 1. IDENTITY & LOGIN GATE MODAL */}
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
              Before issuing your order code, log in to save your identity so your order history, saved addresses, payment status, and Shiprocket live tracking are linked directly to your account.
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
                  void executePlaceOrder();
                }}
                className="mt-2 text-center text-xs text-dim hover:text-white underline underline-offset-4"
              >
                Skip login and continue as guest →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
