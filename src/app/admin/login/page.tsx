import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pit wall sign-in · Burnout Wheels", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="u-gridlines fixed inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-red text-lg font-black text-white">B</span>
          <div>
            <p className="u-mono text-sm font-bold uppercase tracking-widest">Burnout Wheels</p>
            <p className="u-label">Pit wall access</p>
          </div>
        </div>
        <div className="u-card mt-6 p-7">
          <p className="u-h2">Sign in</p>
          <p className="u-label-txt mt-2">Racing ops only. Sessions live 7 days on this device.</p>
          <Suspense fallback={<div className="u-skeleton mt-8 h-24 w-full" aria-hidden />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="u-label mt-6">Locked out? Ping the crew channel — owners reset passwords directly in the team panel.</p>
      </div>
    </div>
  );
}
