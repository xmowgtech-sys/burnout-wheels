"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  MapPin,
  CreditCard,
  Package,
  ShoppingBag,
  Truck,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Pencil,
  ArrowRight,
  Search,
} from "lucide-react";
import { useStore, useToast } from "@/components/store/providers";
import { fmtUSD } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderWithRelations } from "@/lib/types";
import { COD_ADVANCE_LABEL } from "@/lib/payments";
import type { CustomerAddress, AddressInput } from "@/lib/addresses";

export interface AccountSnapshot {
  email: string;
  name: string;
  phone: string;
  verified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
}

interface Props {
  account: AccountSnapshot;
  orders: OrderWithRelations[];
}

export function AccountSettings({ account, orders }: Props) {
  const router = useRouter();
  const store = useStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"profile" | "addresses" | "billing" | "orders" | "cart" | "track">("profile");

  // Orders State (synced from server props + client storage fallback)
  const [customerOrders, setCustomerOrders] = useState<OrderWithRelations[]>(orders);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("bw:customerOrders");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const userEmail = account.email.trim().toLowerCase();
          const localMatching = parsed.filter(
            (o: { email?: string; number?: string }) =>
              o.number && (!o.email || o.email.trim().toLowerCase() === userEmail)
          );
          if (localMatching.length > 0) {
            setCustomerOrders((prev) => {
              const prevNumbers = new Set(prev.map((o) => o.number.toUpperCase()));
              const toAdd: OrderWithRelations[] = [];
              for (const lo of localMatching) {
                if (!prevNumbers.has(lo.number.toUpperCase())) {
                  toAdd.push({
                    id: Math.floor(Math.random() * 1000000) + 1000,
                    number: lo.number.toUpperCase(),
                    status: lo.status || "PAYMENT_REVIEW",
                    paymentMethod: lo.paymentMethod || "UPI",
                    paymentChannel: lo.paymentChannel || "DISCORD",
                    shippingMethod: lo.shippingMethod || "STANDARD",
                    email: lo.email || account.email,
                    name: lo.name || account.name || "Racer",
                    phone: lo.phone || null,
                    addressLine: lo.addressLine || "",
                    city: lo.city || "",
                    state: lo.state || "",
                    pincode: lo.pincode || "",
                    country: lo.country || "India",
                    subtotal: lo.subtotal || lo.total || 0,
                    discountTotal: lo.discountTotal || 0,
                    shippingFee: lo.shippingFee || 0,
                    total: lo.total || 0,
                    costTotal: 0,
                    feesTotal: 0,
                    profit: 0,
                    source: "LOCAL",
                    placedAt: lo.placedAt || new Date().toISOString(),
                    updatedAt: lo.placedAt || new Date().toISOString(),
                    items: lo.items || [],
                    events: [],
                  } as unknown as OrderWithRelations);
                }
              }
              return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
            });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [account.email, account.name]);

  // Profile State
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pBusy, setPBusy] = useState(false);

  // Password State
  const [currentPass, setCurrentPass] = useState("");
  const [nextPass, setNextPass] = useState("");
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wBusy, setWBusy] = useState(false);

  // Delete Account State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [dMsg, setDMsg] = useState("");
  const [dBusy, setDBusy] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addrForm, setAddrForm] = useState<AddressInput>({
    label: "Home",
    name: account.name || "",
    phone: account.phone || "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    isDefault: false,
  });
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrErr, setAddrErr] = useState("");

  // Track Order State
  const [trackNumber, setTrackNumber] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<{
    found: boolean;
    order?: { number: string; status: string; total: number; shiprocketAwb?: string | null; placedAt: string };
  } | null>(null);

  // Load saved addresses on mount
  const loadAddresses = async () => {
    setAddrLoading(true);
    try {
      const res = await fetch("/api/account/addresses");
      if (res.ok) {
        const data = (await res.json()) as { addresses?: CustomerAddress[] };
        setAddresses(data.addresses ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setAddrLoading(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const saveProfile = async () => {
    setPBusy(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = (await res.json()) as { error?: string };
      setProfileMsg({ ok: res.ok, text: res.ok ? "Profile saved successfully." : data.error ?? "Save failed." });
      if (res.ok) {
        toast("Profile updated", "ok");
        router.refresh();
      }
    } catch {
      setProfileMsg({ ok: false, text: "Network issue — try again." });
    } finally {
      setPBusy(false);
    }
  };

  const savePassword = async () => {
    setWBusy(true);
    setPassMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: currentPass, next: nextPass }),
      });
      const data = (await res.json()) as { error?: string };
      setPassMsg({
        ok: res.ok,
        text: res.ok
          ? account.hasPassword
            ? "Password changed."
            : "Password set — email sign-in is now live."
          : data.error ?? "Failed.",
      });
      if (res.ok) {
        setCurrentPass("");
        setNextPass("");
        toast("Password updated", "ok");
        router.refresh();
      }
    } catch {
      setPassMsg({ ok: false, text: "Network issue — try again." });
    } finally {
      setWBusy(false);
    }
  };

  const deleteMe = async () => {
    setDBusy(true);
    setDMsg("");
    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setDMsg(data.error ?? "Delete failed.");
        return;
      }
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      setDMsg("Network issue — try again.");
    } finally {
      setDBusy(false);
    }
  };

  // Address Actions
  const handleOpenAddAddress = () => {
    setEditingAddress(null);
    setAddrForm({
      label: "Home",
      name: name || account.name || "",
      phone: phone || account.phone || "",
      addressLine: "",
      city: "",
      state: "",
      pincode: "",
      isDefault: addresses.length === 0,
    });
    setAddrErr("");
    setShowAddressModal(true);
  };

  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setAddrForm({
      label: addr.label,
      name: addr.name,
      phone: addr.phone,
      addressLine: addr.addressLine,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: addr.isDefault,
    });
    setAddrErr("");
    setShowAddressModal(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrBusy(true);
    setAddrErr("");
    try {
      const payload = editingAddress ? { ...addrForm, id: editingAddress.id } : addrForm;
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save address");
      setShowAddressModal(false);
      toast(editingAddress ? "Address updated" : "Address saved", "ok");
      await loadAddresses();
    } catch (err) {
      setAddrErr(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setAddrBusy(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!confirm("Are you sure you want to remove this address?")) return;
    try {
      const res = await fetch(`/api/account/addresses?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Address removed", "info");
        await loadAddresses();
      }
    } catch {
      toast("Could not remove address", "err");
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    try {
      const res = await fetch(`/api/account/addresses?id=${id}`, { method: "PATCH" });
      if (res.ok) {
        toast("Default address updated", "ok");
        await loadAddresses();
      }
    } catch {
      toast("Could not update default address", "err");
    }
  };

  // Track Order in Account
  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackNumber.trim().toUpperCase();
    if (!clean) return;
    setTrackLoading(true);

    const found = orders.find((o) => o.number.toUpperCase() === clean);
    if (found) {
      setTrackResult({
        found: true,
        order: {
          number: found.number,
          status: found.status,
          total: found.total,
          shiprocketAwb: found.shiprocketAwb,
          placedAt: found.placedAt,
        },
      });
      setTrackLoading(false);
    } else {
      router.push(`/track?number=${encodeURIComponent(clean)}&email=${encodeURIComponent(account.email)}`);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Tab Navigation */}
      <nav className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3" aria-label="Account Tabs">
        {[
          { id: "profile", label: "Profile", icon: User },
          { id: "addresses", label: `Saved Addresses (${addresses.length})`, icon: MapPin },
          { id: "orders", label: `Orders (${customerOrders.length})`, icon: Package },
          { id: "cart", label: `Cart (${store.count()})`, icon: ShoppingBag },
          { id: "billing", label: "Billing Details", icon: CreditCard },
          { id: "track", label: "Track Order", icon: Truck },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as never)}
              className={`flex items-center gap-2 rounded px-3.5 py-2 text-xs font-semibold transition-all ${
                active
                  ? "bg-red text-white shadow-sm"
                  : "bg-surface text-fog hover:bg-coal hover:text-bone"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 1. PROFILE DETAILS TAB */}
      {activeTab === "profile" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Details Form */}
          <section className="u-card p-6">
            <p className="u-label flex items-center gap-2">
              <Pencil className="size-3.5" /> Profile details
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <label>
                <span className="u-label-txt">Full Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="u-input mt-1"
                  autoComplete="name"
                />
              </label>
              <label>
                <span className="u-label-txt">Phone number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  placeholder="+91 98765 43210"
                  className="u-input mt-1"
                  autoComplete="tel"
                />
              </label>
              <label>
                <span className="u-label-txt">Email address (account ID)</span>
                <input
                  value={account.email}
                  disabled
                  className="u-input mt-1 opacity-60 cursor-not-allowed"
                />
              </label>
              {profileMsg && (
                <p className={`text-xs ${profileMsg.ok ? "text-mint" : "text-red"}`}>
                  {profileMsg.text}
                </p>
              )}
              <button
                type="button"
                onClick={saveProfile}
                disabled={pBusy}
                className="u-btn u-btn-primary mt-2 self-start text-xs py-2!"
              >
                {pBusy ? "Saving…" : "Save profile changes"}
              </button>
            </div>
          </section>

          {/* Password & Security */}
          <section className="u-card p-6">
            <p className="u-label flex items-center gap-2">
              <KeyRound className="size-3.5" /> Security &amp; Password
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {account.hasPassword && (
                <label>
                  <span className="u-label-txt">Current password</span>
                  <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    className="u-input mt-1 text-xs"
                    autoComplete="current-password"
                  />
                </label>
              )}
              <label>
                <span className="u-label-txt">{account.hasPassword ? "New password" : "Set account password"}</span>
                <input
                  type="password"
                  value={nextPass}
                  onChange={(e) => setNextPass(e.target.value)}
                  minLength={8}
                  className="u-input mt-1 text-xs"
                  autoComplete="new-password"
                />
              </label>
              {passMsg && (
                <p className={`text-xs ${passMsg.ok ? "text-mint" : "text-red"}`}>
                  {passMsg.text}
                </p>
              )}
              <button
                type="button"
                onClick={savePassword}
                disabled={wBusy || !nextPass}
                className="u-btn u-btn-secondary mt-2 self-start text-xs py-2!"
              >
                {wBusy ? "Saving…" : account.hasPassword ? "Update password" : "Set password"}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="mt-8 border-t border-line pt-6">
              <p className="u-label text-red">Danger zone</p>
              <p className="mt-1 text-xs text-fog leading-relaxed">
                Permanently delete this account and all saved addresses. Past order numbers remain strictly for accounting.
              </p>
              {!confirmOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="u-btn u-btn-danger mt-3 text-xs py-1.5! px-3!"
                >
                  Delete account…
                </button>
              ) : (
                <div className="mt-3 rounded border border-red/40 bg-red/[0.04] p-3 text-xs">
                  <p className="text-red font-semibold">Type DELETE to confirm account removal:</p>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="u-input mt-2 text-xs uppercase"
                    placeholder="DELETE"
                  />
                  {dMsg && <p className="mt-1 text-xs text-red">{dMsg}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={deleteMe}
                      disabled={confirmText !== "DELETE" || dBusy}
                      className="u-btn u-btn-danger text-xs py-1.5!"
                    >
                      {dBusy ? "Deleting…" : "Confirm permanent delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="u-btn u-btn-ghost text-xs py-1.5!"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* 2. SAVED ADDRESSES TAB */}
      {activeTab === "addresses" && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="u-h2 text-xl font-bold">Saved Delivery Addresses</h2>
              <p className="mt-1 text-xs text-fog">
                Addresses saved here will automatically appear during checkout for one-click selection.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddAddress}
              className="u-btn u-btn-primary flex items-center gap-2 text-xs py-2! px-4!"
            >
              <Plus className="size-3.5" />
              <span>Add New Address</span>
            </button>
          </div>

          {addrLoading ? (
            <p className="u-label text-dim">Loading saved addresses…</p>
          ) : addresses.length === 0 ? (
            <div className="u-card p-8 text-center border-dashed">
              <MapPin className="mx-auto size-8 text-dim mb-2" />
              <p className="text-sm font-semibold text-bone">No saved addresses yet</p>
              <p className="mt-1 text-xs text-fog max-w-sm mx-auto">
                Add your home or paddock address once, and it will automatically populate at checkout.
              </p>
              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="u-btn u-btn-primary mt-4 inline-flex items-center gap-2 text-xs"
              >
                <Plus className="size-3.5" />
                <span>Add your first address</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {addresses.map((addr) => (
                <article
                  key={addr.id}
                  className={`u-card flex flex-col justify-between p-5 transition-all ${
                    addr.isDefault ? "border-mint/60 bg-mint/[0.02]" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded bg-surface px-2 py-0.5 text-xs font-bold text-bone">
                        <MapPin className="size-3 text-red" /> {addr.label}
                      </span>
                      {addr.isDefault ? (
                        <span className="u-badge border-mint text-mint text-[10px]">DEFAULT</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultAddress(addr.id)}
                          className="text-[11px] text-dim hover:text-bone underline"
                        >
                          Set default
                        </button>
                      )}
                    </div>

                    <p className="mt-3 text-sm font-bold text-white">{addr.name}</p>
                    <p className="mt-1 text-xs text-fog leading-relaxed">
                      {addr.addressLine}
                    </p>
                    <p className="text-xs text-fog">
                      {addr.city}, {addr.state} - <strong className="text-bone">{addr.pincode}</strong>
                    </p>
                    <p className="mt-2 text-[11px] text-dim">Phone: {addr.phone}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => handleOpenEditAddress(addr)}
                      className="text-fog hover:text-white flex items-center gap-1"
                    >
                      <Pencil className="size-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-dim hover:text-red flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Add / Edit Address Modal */}
          {showAddressModal && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-md anim-fade"
              role="dialog"
              aria-modal="true"
              aria-label={editingAddress ? "Edit Address" : "Add New Address"}
            >
              <div className="u-card relative w-full max-w-md border border-line bg-panel p-6 anim-rise">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="absolute right-4 top-4 text-dim hover:text-white"
                >
                  ✕
                </button>
                <h3 className="u-h2 text-xl font-bold">
                  {editingAddress ? "Edit delivery address" : "Add new delivery address"}
                </h3>

                <form onSubmit={handleSaveAddress} className="mt-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="u-label-txt">Label</span>
                      <input
                        value={addrForm.label}
                        onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                        placeholder="Home, Office, Garage"
                        className="u-input mt-1 text-xs"
                      />
                    </label>
                    <label>
                      <span className="u-label-txt">Contact Name</span>
                      <input
                        value={addrForm.name}
                        onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })}
                        required
                        className="u-input mt-1 text-xs"
                      />
                    </label>
                  </div>

                  <label>
                    <span className="u-label-txt">Phone Number</span>
                    <input
                      value={addrForm.phone}
                      onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                      required
                      placeholder="+91 98765 43210"
                      className="u-input mt-1 text-xs"
                    />
                  </label>

                  <label>
                    <span className="u-label-txt">Street Address</span>
                    <input
                      value={addrForm.addressLine}
                      onChange={(e) => setAddrForm({ ...addrForm, addressLine: e.target.value })}
                      required
                      placeholder="Flat, building, street, area"
                      className="u-input mt-1 text-xs"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <label>
                      <span className="u-label-txt">City</span>
                      <input
                        value={addrForm.city}
                        onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                        required
                        className="u-input mt-1 text-xs"
                      />
                    </label>
                    <label>
                      <span className="u-label-txt">State</span>
                      <input
                        value={addrForm.state}
                        onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                        required
                        className="u-input mt-1 text-xs"
                      />
                    </label>
                    <label>
                      <span className="u-label-txt">PIN Code</span>
                      <input
                        value={addrForm.pincode}
                        onChange={(e) =>
                          setAddrForm({ ...addrForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })
                        }
                        required
                        pattern="\d{6}"
                        className="u-input mt-1 text-xs"
                      />
                    </label>
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-xs text-fog cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addrForm.isDefault}
                      onChange={(e) => setAddrForm({ ...addrForm, isDefault: e.target.checked })}
                      className="size-4 accent-red"
                    />
                    <span>Set as default delivery address</span>
                  </label>

                  {addrErr && <p className="text-xs text-red">{addrErr}</p>}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(false)}
                      className="u-btn u-btn-ghost text-xs py-2!"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addrBusy}
                      className="u-btn u-btn-primary text-xs py-2! px-4!"
                    >
                      {addrBusy ? "Saving…" : "Save Address"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. ORDERS TAB */}
      {activeTab === "orders" && (
        <section className="flex flex-col gap-6">
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <h2 className="u-h2 text-xl font-bold">Your Order History</h2>
            <Link href="/track" className="text-xs text-fog hover:text-bone underline">
              Track by order number →
            </Link>
          </div>

          {customerOrders.length === 0 ? (
            <div className="u-card p-10 text-center">
              <Package className="mx-auto size-8 text-dim mb-3" />
              <p className="text-sm font-semibold text-bone">No orders yet</p>
              <p className="mt-1 text-xs text-fog">Explore our collection of authentic 1:64 F1 die-cast cars.</p>
              <Link href="/shop" className="u-btn u-btn-primary mt-4 inline-flex text-xs">
                Browse the shop
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {customerOrders.map((o) => (
                <article key={o.id} className="u-card p-5 border border-line bg-panel">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
                    <div>
                      <span className="u-mono text-sm font-bold text-white">{o.number}</span>
                      <span className="u-label-txt ml-3">Placed {o.placedAt.slice(0, 10)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="u-badge border-sky text-sky text-[10px]">
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <span className="u-mono font-bold text-bone">
                        {fmtUSD(o.total)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  {o.items && o.items.length > 0 && (
                    <div className="py-4 flex flex-col gap-3">
                      {o.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <div className="relative size-12 shrink-0 border border-line bg-surface overflow-hidden">
                                <Image src={item.image} alt={item.name} fill sizes="48px" className="object-cover" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-white">{item.name}</p>
                              <p className="text-[11px] text-dim">{item.condition} · ×{item.qty}</p>
                            </div>
                          </div>
                          <span className="u-mono text-xs font-medium text-bone">
                            {fmtUSD(item.price * item.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions & Tracking */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3 text-xs">
                    <div className="flex items-center gap-2">
                      {o.shiprocketAwb ? (
                        <span className="flex items-center gap-1.5 text-mint font-mono font-semibold">
                          <Truck className="size-3.5" /> Shiprocket AWB: {o.shiprocketAwb}
                        </span>
                      ) : (
                        <span className="text-dim">Standard Pan-India Shiprocket dispatch</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/checkout/success/${o.number}`}
                        className="text-fog hover:text-white underline underline-offset-4"
                      >
                        Receipt &amp; Payment →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. CART TAB */}
      {activeTab === "cart" && (
        <section className="flex flex-col gap-6">
          <div className="border-b border-line pb-4 flex items-center justify-between">
            <h2 className="u-h2 text-xl font-bold">Your Active Paddock Cart</h2>
            <span className="u-mono text-xs text-dim">{store.count()} items</span>
          </div>

          {store.lines.length === 0 ? (
            <div className="u-card p-10 text-center">
              <ShoppingBag className="mx-auto size-8 text-dim mb-3" />
              <p className="text-sm font-semibold text-bone">Cart is empty</p>
              <p className="mt-1 text-xs text-fog">No die-cast items are currently staged in your paddock.</p>
              <Link href="/shop" className="u-btn u-btn-primary mt-4 inline-flex text-xs">
                Browse the shop
              </Link>
            </div>
          ) : (
            <div className="u-card p-6 border border-line bg-panel flex flex-col gap-6">
              <div className="divide-y divide-line">
                {store.lines.map((l) => (
                  <div key={l.productId} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                    <div className="flex items-center gap-3">
                      {l.image && (
                        <div className="relative size-14 shrink-0 border border-line bg-surface overflow-hidden">
                          <Image src={l.image} alt={l.name} fill sizes="56px" className="object-cover" />
                        </div>
                      )}
                      <div>
                        <Link href={`/product/${l.slug}`} className="text-sm font-semibold text-white hover:text-red">
                          {l.name}
                        </Link>
                        <p className="text-xs text-dim">{l.condition} · Qty: {l.qty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="u-mono text-sm font-bold text-bone">{fmtUSD(l.price * l.qty)}</span>
                      <button
                        type="button"
                        onClick={() => store.remove(l.productId)}
                        className="text-dim hover:text-red text-xs"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
                <div>
                  <span className="u-label">Cart Subtotal</span>
                  <p className="u-mono text-xl font-bold text-white mt-1">{fmtUSD(store.subtotal())}</p>
                </div>
                <Link href="/checkout" className="u-btn u-btn-primary py-3! px-6! text-xs font-bold flex items-center gap-2">
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. BILLING DETAILS TAB */}
      {activeTab === "billing" && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="u-card p-6 border border-line bg-panel">
            <h3 className="u-label flex items-center gap-2">
              <CreditCard className="size-3.5 text-mint" /> Payment Methods &amp; Billing Protocol
            </h3>
            <div className="mt-4 flex flex-col gap-4 text-xs leading-relaxed text-fog">
              <div className="rounded border border-line bg-surface p-3.5">
                <span className="text-xs font-bold text-white block">UPI / QR Code (Recommended)</span>
                <p className="mt-1 text-dim">
                  Scan the direct QR code or transfer via UPI ID. Payment verification happens with a human agent, and your order is accepted and stock reserved.
                </p>
              </div>
              <div className="rounded border border-line bg-surface p-3.5">
                <span className="text-xs font-bold text-white block">Cash on Delivery (COD)</span>
                <p className="mt-1 text-dim">
                  Available pan-India with a {COD_ADVANCE_LABEL} online security advance. The remaining balance is paid directly to the courier partner upon doorstep delivery.
                </p>
              </div>
            </div>
          </div>

          <div className="u-card p-6 border border-line bg-panel">
            <h3 className="u-label flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-yellow" /> Billing Invoices &amp; Receipts
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-fog">
              Invoices are issued automatically with every verified order. You can access digital receipts and track payment status from your Order History tab at any time.
            </p>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[11px] text-dim">
                Need a GST invoice or business billing assist? Speak with our team directly on Discord #billing or WhatsApp.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 6. TRACK ORDER TAB */}
      {activeTab === "track" && (
        <section className="u-card p-6 border border-line bg-panel max-w-2xl">
          <h2 className="u-h2 text-xl font-bold flex items-center gap-2">
            <Truck className="size-5 text-red" /> Live Order Tracking
          </h2>
          <p className="mt-1 text-xs text-fog">
            All order tracking and live fulfillment updates are handled directly on our Discord server. Share your Order Number with the crew for real-time dispatch and Shiprocket courier telemetry.
          </p>

          {/* Discord Direct Tracking Box */}
          <div className="mt-5 rounded border border-red/40 bg-red/[0.06] p-5">
            <div className="flex items-center justify-between">
              <span className="u-badge bg-red text-white text-[10px] font-bold">OFFICIAL DISCORD TELEMETRY</span>
              <span className="text-xs text-mint font-bold">24/7 Crew Support</span>
            </div>
            <p className="mt-3 text-sm font-bold text-bone">
              Track Your Order on Discord (#billing / #tracking)
            </p>
            <p className="mt-1.5 text-xs text-fog leading-relaxed">
              Drop your order number in our server to get real-time tracking from our dispatch agents.
            </p>
            <a
              href="https://discord.gg/WRZDQEnA2"
              target="_blank"
              rel="noopener noreferrer"
              className="u-btn u-btn-primary mt-4 flex items-center justify-center gap-2 text-xs font-bold w-full sm:w-auto"
            >
              <span>Open Discord Tracking (discord.gg/WRZDQEnA2)</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className="u-label text-dim">Quick Look by Order Number:</p>
            <form onSubmit={handleTrackOrder} className="mt-2.5 flex gap-2">
              <input
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                placeholder="e.g. BW-Z8NNPV-P7"
                className="u-input u-mono uppercase text-sm"
                required
              />
              <button
                type="submit"
                disabled={trackLoading}
                className="u-btn u-btn-primary px-5! text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                <Search className="size-3.5" />
                <span>{trackLoading ? "Searching…" : "Track"}</span>
              </button>
            </form>
          </div>

          {trackResult && trackResult.order && (
            <div className="mt-6 rounded border border-line bg-surface p-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="u-mono font-bold text-white text-base">{trackResult.order.number}</span>
                <span className="u-badge border-sky text-sky text-[10px]">
                  {ORDER_STATUS_LABELS[trackResult.order.status as never] ?? trackResult.order.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-dim block">Placed Date:</span>
                  <span className="text-bone">{trackResult.order.placedAt.slice(0, 10)}</span>
                </div>
                <div>
                  <span className="text-dim block">Courier / AWB:</span>
                  <span className="text-mint font-mono">
                    {trackResult.order.shiprocketAwb || "Pending Courier Scan"}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line flex justify-end">
                <Link
                  href={`/checkout/success/${trackResult.order.number}`}
                  className="text-xs text-red hover:underline flex items-center gap-1"
                >
                  View full order receipt <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
