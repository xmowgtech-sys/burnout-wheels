import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pit wall sign-in · Burnout Wheels", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ google?: string; next?: string }> }) {
  const { google } = await searchParams;
  const notice =
    google === "unconfigured"
      ? "Google sign-in isn't configured on this deployment yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use the team password."
      : google === "no_admin"
        ? "That Google address isn't a team member here. Ask the owner to add it in Team settings first."
        : google === "failed"
          ? "Google handshake failed — try again or use the team password."
          : undefined;

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="u-gridlines fixed inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3">
          {/* brand mark — same wheel badge as the storefront logo */}
          <span className="relative grid size-10 place-items-center overflow-hidden rounded-sm bg-red">
            <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
              <circle cx="16" cy="16" r="11" fill="none" stroke="#fff" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="3" fill="none" stroke="#fff" strokeWidth="1.5" />
              <g stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
                <line x1="8.2" y1="6.5" x2="23.8" y2="25.5" />
                <line x1="23.8" y1="6.5" x2="8.2" y2="25.5" />
              </g>
            </svg>
          </span>
          <div>
            <p className="u-mono text-sm font-bold uppercase tracking-widest">Burnout Wheels</p>
            <p className="u-label">Pit wall access</p>
          </div>
        </div>
        <div className="u-card mt-6 p-7">
          <p className="u-h2">Sign in</p>
          <p className="u-label-txt mt-2">Racing ops only. Sessions live 7 days on this device.</p>
          <Suspense fallback={<div className="u-skeleton mt-8 h-24 w-full" aria-hidden />}>
            <LoginForm googleNotice={notice} />
          </Suspense>
        </div>
        <p className="u-label mt-6">Locked out? Ping the crew channel — owners reset passwords directly in the team panel.</p>
      </div>
    </div>
  );
}
