"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { trackFlow } from "@/components/store/site-monitor";
import { COD_ADVANCE_LABEL } from "@/lib/payments";

/* ========= toast ========= */

interface Toast {
  id: number;
  title: string;
  kind: "ok" | "err" | "info";
}

const ToastCtx = createContext<{ toast: (title: string, kind?: Toast["kind"]) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((title: string, kind: Toast["kind"] = "ok") => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, title, kind }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-24 left-4 z-[90] flex w-[min(88vw,340px)] flex-col gap-2 md:bottom-8 md:left-8">
        {items.map((t) => (
          <div key={t.id} className="u-card pointer-events-auto flex items-center gap-3 px-4 py-3 shadow-2xl">
            {t.kind === "ok" && <CheckCircle2 className="size-4 shrink-0 text-mint" aria-hidden />}
            {t.kind === "err" && <AlertTriangle className="size-4 shrink-0 text-red" aria-hidden />}
            {t.kind === "info" && <Info className="size-4 shrink-0 text-yellow" aria-hidden />}
            <span className="text-[13px] leading-snug text-bone/90">{t.title}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ========= store state (cart + wishlist) ========= */

interface CartLine {
  productId: number;
  slug: string;
  name: string;
  price: number; // minor
  image: string | null;
  condition: string;
  qty: number;
  stock: number;
}

interface StoreState {
  lines: CartLine[];
  wishlist: { productId: number; slug: string; name: string; price: number; image: string | null; condition: string }[];
  cartOpen: boolean;
  mounted: boolean;
  count: () => number;
  subtotal: () => number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleWishlist: (item: CartLine | { productId: number; slug: string; name: string; price: number; image: string | null; condition: string }) => void;
  inWishlist: (productId: number) => boolean;
}

const CartCtx = createContext<StoreState | null>(null);

export function useStore(): StoreState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

const CART_KEY = "bw:cart:v1";
const CLEAR_FLAG = "bw:cart:clear-pending";
const LIST_KEY = "bw:wishlist:v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — ignore */
  }
}

function StoreProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<StoreState["wishlist"]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    let localLines: CartLine[] = [];
    try {
      // A completed checkout sets this flag before navigating. Clear both
      // storage buckets here as well so a slow provider mount cannot rehydrate
      // the cart that was just paid for.
      const mustClear = window.sessionStorage.getItem(CLEAR_FLAG) === "1";
      if (mustClear) {
        window.localStorage.removeItem(CART_KEY);
        window.sessionStorage.removeItem(CART_KEY);
        window.sessionStorage.removeItem(CLEAR_FLAG);
      } else {
        const raw = window.localStorage.getItem(CART_KEY) || window.sessionStorage.getItem(CART_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) localLines = parsed;
        }
      }
    } catch {
      /* ignore */
    }

    const localWish = readJson<StoreState["wishlist"]>(LIST_KEY, []);
    setLines(localLines);
    setWishlist(localWish);
    initialLoadDone.current = true;
    setMounted(true);

    // Sync wishlist with server account if authenticated
    fetch("/api/account/wishlist")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { authenticated?: boolean; items?: StoreState["wishlist"] } | null) => {
        if (data?.authenticated && Array.isArray(data.items)) {
          const serverIds = new Set(data.items.map((i) => i.productId));
          const missingOnServer = localWish.filter((l) => !serverIds.has(l.productId)).map((l) => l.productId);

          const combined = [...data.items];
          for (const l of localWish) {
            if (!serverIds.has(l.productId)) combined.push(l);
          }
          setWishlist(combined);

          if (missingOnServer.length > 0) {
            fetch("/api/account/wishlist", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "sync", productIds: missingOnServer }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    try {
      const serialized = JSON.stringify(lines);
      window.localStorage.setItem(CART_KEY, serialized);
      window.sessionStorage.setItem(CART_KEY, serialized);
    } catch {
      /* ignore */
    }
  }, [lines]);

  useEffect(() => {
    if (initialLoadDone.current) writeJson(LIST_KEY, wishlist);
  }, [wishlist]);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    trackFlow("cart_add", { productId: line.productId });
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === line.productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === line.productId ? { ...l, ...line, qty: Math.min(line.stock || 99, l.qty + qty) } : l
        );
      }
      return [...prev, { ...line, qty }];
    });
    setCartOpen(true);
  }, []);

  const setQty = useCallback((productId: number, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, l.stock || 99) } : l))
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    // Remove the persisted copies first so a provider remount elsewhere in the
    // app cannot resurrect a cart that was just cleared.
    try {
      window.localStorage.removeItem(CART_KEY);
      window.sessionStorage.removeItem(CART_KEY);
    } catch {
      /* private mode */
    }
    setLines([]);
  }, []);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const toggleWishlist = useCallback((item: StoreState["wishlist"][number]) => {
    setWishlist((prev) => {
      const exists = prev.some((w) => w.productId === item.productId);
      return exists ? prev.filter((w) => w.productId !== item.productId) : [...prev, item];
    });
    // Persist to customer account in database if logged in
    fetch("/api/account/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle", productId: item.productId }),
    }).catch(() => {});
  }, []);

  const value = useMemo<StoreState>(() => {
    return {
      lines,
      wishlist,
      cartOpen,
      mounted,
      count: () => lines.reduce((n, l) => n + l.qty, 0),
      subtotal: () => lines.reduce((n, l) => n + l.qty * l.price, 0),
      add,
      setQty,
      remove,
      clear,
      openCart,
      closeCart,
      toggleWishlist,
      inWishlist: (productId) => wishlist.some((w) => w.productId === productId),
    };
  }, [lines, wishlist, cartOpen, mounted, add, setQty, remove, clear, openCart, closeCart, toggleWishlist]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/* ========= cart drawer ========= */

const fmt = (minor: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);

function CartDrawer() {
  const store = useStore();
  const { cartOpen, closeCart, lines, setQty, remove, subtotal } = store;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cartOpen, closeCart]);

  if (!cartOpen) return null;
  const freeOver = 249900;
  const remaining = Math.max(0, freeOver - subtotal());

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Cart">
      <button aria-label="Close cart" onClick={closeCart} className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
      <div
        ref={panelRef}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-coal anim-drawer"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="u-label">Paddock order</p>
            <p className="u-h3 mt-1">Cart</p>
          </div>
          <button onClick={closeCart} className="u-btn u-btn-ghost px-3! py-2!" aria-label="Close cart">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="u-spectrum h-[2px] w-full" aria-hidden />

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="u-label">Empty paddock</p>
            <p className="text-sm text-fog">No metal loaded yet. The grid is waiting.</p>
            <Link href="/shop" onClick={closeCart} className="u-btn u-btn-primary mt-2">
              Browse the shop
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {lines.map((l) => (
                <div key={l.productId} className="flex gap-4 border-b border-line py-4 first:pt-0 last:border-0">
                  <Link href={`/product/${l.slug}`} onClick={closeCart} className="u-media u-media-hover size-20 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.image ? (
                      <img src={l.image} alt={l.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full u-skeleton" />
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold leading-tight">{l.name}</p>
                        <p className="u-label mt-1">{l.condition}</p>
                      </div>
                      <button
                        onClick={() => remove(l.productId)}
                        className="u-label hover:text-red"
                        aria-label={`Remove ${l.name} from cart`}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center border border-line">
                        <button
                          className="px-3 py-1.5 text-fog hover:text-bone"
                          onClick={() => setQty(l.productId, l.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="u-mono min-w-8 text-center text-xs">{l.qty}</span>
                        <button
                          className="px-3 py-1.5 text-fog hover:text-bone disabled:opacity-30"
                          onClick={() => setQty(l.productId, Math.min(l.stock, l.qty + 1))}
                          disabled={l.qty >= l.stock}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <p className="u-mono text-sm font-medium">{fmt(l.price * l.qty)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {remaining > 0 ? (
                <p className="u-label-txt">Add {fmt(remaining)} more for free shipping</p>
              ) : (
                <p className="u-label-txt text-mint">Free shipping unlocked</p>
              )}
              <div className="mt-2 h-1 w-full bg-white/10">
                <div
                  className="u-spectrum h-full transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (subtotal() / freeOver) * 100)}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="u-label">Subtotal</span>
                <span className="u-mono text-lg font-semibold">{fmt(subtotal())}</span>
              </div>
              <Link href="/checkout" onClick={closeCart} className="u-btn u-btn-primary mt-4 w-full flex items-center justify-center gap-2 text-sm font-bold">
                <span>Proceed to Checkout</span>
              </Link>
              <Link href="/cart" onClick={closeCart} className="u-btn u-btn-ghost mt-2 w-full text-xs">
                View full cart
              </Link>
              <p className="u-label-txt mt-3">
                COD needs a {COD_ADVANCE_LABEL} online advance before packing — adjusted against your total.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ========= root ========= */

export function StoreProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreProvider>
        {children}
        <CartDrawer />
      </StoreProvider>
    </ToastProvider>
  );
}
