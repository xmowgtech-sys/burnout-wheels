"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

export function LoginForm({ googleNotice }: { googleNotice?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/team/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Sign-in failed");
      router.push(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="mt-8">
      {googleNotice && (
        <p role="status" className="mb-5 border border-yellow/50 bg-yellow/[0.07] px-4 py-3 text-[12.5px] text-yellow">{googleNotice}</p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="u-label-txt">Email</span>
          <input name="email" type="email" required autoComplete="email" className="u-input mt-1.5" placeholder="theburnoutwheels@gmail.com" />
        </label>
        <label className="block">
          <span className="u-label-txt">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className="u-input mt-1.5" />
        </label>
        {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{error}</p>}
        <button disabled={busy} className="u-btn u-btn-primary w-full py-3.5!">{busy ? "Checking telemetry…" : "Enter the pit wall"}</button>
      </form>

      <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="u-label text-dim!">or</span><span className="h-px flex-1 bg-line" /></div>
      <a href={next !== "/admin" && next.startsWith("/admin") ? `/api/auth/google?from=admin&back=${encodeURIComponent(next)}` : "/api/auth/google?from=admin"} className="u-auth-google">
        <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.18 7.07C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.86-3c-1.08.72-2.45 1.16-3.42 1.16-2.86 0-5.29-1.93-6.16-4.53l-3.66 2.84C3.99 20.53 7.7 23 12 23z" />
        </svg>
        Continue with Google
      </a>
      <p className="u-label-txt mt-3">Google works for team addresses that already exist here — OAuth never grants access to strangers.</p>
    </div>
  );
}

export function SignInIcon() {
  return <LogIn className="size-4" aria-hidden />;
}
