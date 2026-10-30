"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useStore } from "./providers";
import { fmtUSD } from "@/lib/money";

interface QuickResult {
  id: number;
  slug: string;
  name: string;
  priceSale: number;
  image: string | null;
  category: string;
}

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shipping", label: "Shipping" },
  { href: "/returns", label: "Returns" },
  { href: "/trust", label: "Trust" },
];

export function Header() {
  const store = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? "border-b border-line bg-ink/85 backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:h-[72px] md:px-8">
          <button
            className="u-btn u-btn-ghost !border-line !px-2.5 !py-2.5 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu className="size-4" aria-hidden />
          </button>

          <Link href="/" className="group flex items-center gap-2.5" aria-label="Burnout Wheels home">
            <span className="grid size-8 place-items-center bg-red transition-transform group-hover:rotate-[-6deg]">
              <span className="block h-4 w-[3px] skew-x-[-18deg] bg-bone" aria-hidden />
            </span>
            <span className="text-sm font-extrabold uppercase tracking-[0.18em]">
              Burnout<span className="text-red">/</span>Wheels
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="u-label px-3 py-2 transition-colors hover:!text-bone"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setSearchOpen(true)} className="u-label px-2 py-2.5 hover:text-bone" aria-label="Search">
              <Search className="size-[17px]" aria-hidden />
            </button>
            <Link href="/wishlist" className="relative px-2 py-2.5 text-fog transition-colors hover:text-bone" aria-label="Wishlist">
              <Heart className="size-[17px]" aria-hidden />
              {store.wishlist.length > 0 && (
                <span className="absolute -right-0.5 top-1 grid size-4 place-items-center rounded-full bg-yellow text-[9px] font-bold text-ink">
                  {store.wishlist.length}
                </span>
              )}
            </Link>
            <button
              onClick={store.openCart}
              className="relative px-2 py-2.5 text-fog transition-colors hover:text-bone"
              aria-label={`Cart, ${store.count()} items`}
            >
              <ShoppingBag className="size-[17px]" aria-hidden />
              {store.count() > 0 && (
                <span className="absolute -right-0.5 top-1 grid size-4 place-items-center rounded-full bg-red text-[9px] font-bold text-white">
                  {store.count()}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] anim-fade md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-full flex-col bg-ink">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <span className="u-label">Pit lane index</span>
              <button onClick={() => setMenuOpen(false)} className="u-btn u-btn-ghost !px-2.5 !py-2" aria-label="Close menu">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <nav className="stagger flex flex-col px-6 py-10" aria-label="Mobile">
              {[{ href: "/", label: "Home" }, ...NAV, { href: "/wishlist", label: "Wishlist" }].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="u-h2 border-b border-line py-5 transition-colors hover:text-red"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-6 pb-10">
              <p className="u-label">Burnout/wheels — die-cast pit lane</p>
            </div>
          </div>
        </div>
      )}

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<QuickResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    setBusy(true);
    const t = window.setTimeout(
      () =>
        fetch(`/api/products?q=${encodeURIComponent(term)}&limit=6`, { signal: ctrl.signal })
          .then((r) => r.json())
          .then((data: { products?: QuickResult[] }) => {
            setResults(data.products ?? []);
            setSearched(true);
          })
          .catch(() => undefined)
          .finally(() => setBusy(false)),
      220
    );
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const term = q.trim();
      if (!term) return;
      onClose();
      router.push(`/search?q=${encodeURIComponent(term)}`);
    },
    [q, onClose, router]
  );

  return (
    <div className="fixed inset-0 z-[65] anim-fade" role="dialog" aria-modal="true" aria-label="Search">
      <button aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-ink/85 backdrop-blur-md" />
      <div className="relative mx-auto flex h-full w-full max-w-3xl flex-col px-4 pt-20">
        <form onSubmit={go} className="flex items-center gap-3 border-b border-line-strong pb-4">
          <Search className="size-5 shrink-0 text-fog" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the grid — RB20, Formula 1, scale…"
            className="w-full bg-transparent text-2xl font-bold uppercase tracking-tight outline-none placeholder:text-dim md:text-3xl"
            aria-label="Search products"
            type="search"
            enterKeyHint="search"
          />
          <button type="button" onClick={onClose} className="u-btn u-btn-ghost !px-2.5 !py-2" aria-label="Close search">
            <X className="size-4" aria-hidden />
          </button>
        </form>

        <div className="mt-6 flex-1 overflow-y-auto">
          {busy && <p className="u-label">Scanning telemetry…</p>}
          {!busy && results.map((r) => (
            <Link key={r.id} href={`/product/${r.slug}`} onClick={onClose} className="group flex items-center gap-4 border-b border-line py-3">
              <span className="u-media size-14 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold group-hover:text-red">{r.name}</span>
                <span className="u-label mt-0.5 block">{r.category}</span>
              </span>
              <span className="u-mono text-sm">{fmtUSD(r.priceSale)}</span>
            </Link>
          ))}
          {!busy && searched && results.length === 0 && (
            <div className="py-10 text-center">
              <p className="u-h3">No hits on that sector</p>
              <p className="mt-2 text-sm text-fog">Try “formula 1”, “rb20” or “scale”.</p>
            </div>
          )}
          {q.trim().length >= 2 && !busy && (
            <button onClick={go as never} className="u-label mt-6 block hover:text-bone">
              See all results for “{q.trim()}” →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
