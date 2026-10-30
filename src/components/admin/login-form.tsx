"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
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
      const res = await fetch("/api/auth/login", {
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
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
      <label className="block">
        <span className="u-label-txt">Email</span>
        <input name="email" type="email" required autoComplete="email" className="u-input mt-1.5" placeholder="owner@burnoutwheels.in" />
      </label>
      <label className="block">
        <span className="u-label-txt">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="u-input mt-1.5" />
      </label>
      {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[13px] text-red">{error}</p>}
      <button disabled={busy} className="u-btn u-btn-primary w-full !py-3.5">{busy ? "Checking telemetry…" : "Enter the pit wall"}</button>
    </form>
  );
}
