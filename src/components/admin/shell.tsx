"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, Wallet, Users, TicketPercent, Star, Bot, Settings2, UserCog, LogOut, Menu, X, ExternalLink, Activity, RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Perm, Role } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  perm: Perm | null;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", perm: null, icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", perm: "products.view", icon: Package },
  { href: "/admin/orders", label: "Orders", perm: "orders.view", icon: ShoppingBag },
  { href: "/admin/finance", label: "Finance", perm: "finance.view", icon: Wallet },
  { href: "/admin/customers", label: "Customers", perm: "customers.view", icon: Users },
  { href: "/admin/discounts", label: "Discounts", perm: "discounts.manage", icon: TicketPercent },
  { href: "/admin/reviews", label: "Reviews", perm: "reviews.moderate", icon: Star },
  { href: "/admin/chatbot", label: "Chatbot", perm: "chatbot.view", icon: Bot },
  { href: "/admin/shopify", label: "Shopify", perm: "settings.manage", icon: RefreshCcw },
  { href: "/admin/monitoring", label: "Monitoring", perm: null, icon: Activity },
  { href: "/admin/settings", label: "Settings", perm: "settings.manage", icon: Settings2 },
  { href: "/admin/team", label: "Team", perm: "team.manage", icon: UserCog },
];

export function AdminShell({
  user,
  role,
  canPerms,
  children,
}: {
  user: string;
  role: Role;
  canPerms: Perm[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const perms = new Set<Perm>(canPerms);

  useEffect(() => setOpen(false), [pathname]);

  const items = NAV.filter((n) => !n.perm || perms.has(n.perm));
  const initials = user.slice(0, 1).toUpperCase();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-ink">
      {/* topbar */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-4 border-b border-line bg-coal/95 px-4 backdrop-blur-md md:px-6">
        <button className="u-btn u-btn-ghost !px-2.5 !py-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-red text-[13px] font-black text-white">B</span>
          <span className="u-mono text-sm font-bold uppercase tracking-widest">Pit wall</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/" target="_blank" className="u-label flex items-center gap-1.5 hover:text-bone">
            Storefront <ExternalLink className="size-3" aria-hidden />
          </Link>
          <span className="u-badge border-line text-fog">{role}</span>
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-[12px] font-bold" title={user}>{initials}</span>
        </div>
      </header>

      {/* sidebar */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-16 z-40 w-64 overflow-y-auto border-r border-line bg-coal px-3 py-6 transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Admin navigation"
      >
        <nav className="flex flex-col gap-1">
          {items.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-semibold text-fog transition-colors",
                  active ? "bg-red/10 text-bone shadow-[inset_2px_0_0_var(--color-red)]" : "hover:bg-white/5 hover:text-bone"
                )}
                aria-current={active ? "page" : undefined}
              >
                <n.icon className="size-4" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="mt-8 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-semibold text-fog transition-colors hover:bg-white/5 hover:text-red">
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </aside>

      {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-ink/60 lg:hidden" />}

      <main className="pb-24 pt-24 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 md:px-8">{children}</div>
      </main>
    </div>
  );
}
