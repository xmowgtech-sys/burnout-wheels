"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, User, Mail, LogIn, UserPlus, KeyRound, ShieldCheck, Flag, Wrench, Timer, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium motorsport auth sheets — shared by Login, Signup and Reset screens.
 * Includes Google OAuth, One-Time Code (OTP) login, and Password login.
 */

function GoogleButton({ from }: { from: "store" | "admin" }) {
  return (
    <a href={`/api/auth/google?from=${from}`} className="u-auth-google" aria-label="Continue with Google">
      <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L2.18 7.07C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.86-3c-1.08.72-2.45 1.16-3.42 1.16-2.86 0-5.29-1.93-6.16-4.53l-3.66 2.84C3.99 20.53 7.7 23 12 23z" />
      </svg>
      Continue with Google
    </a>
  );
}

function Sheet({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <div className="u-card anim-rise overflow-hidden">
        <div className="border-b border-line bg-coal px-7 py-6">
          <p className="u-label">Driver entrance</p>
          <h1 className="u-h2 mt-2">{title}</h1>
          <p className="u-label-txt mt-2">{sub}</p>
        </div>
        <div className="p-7">{children}</div>
      </div>
    </div>
  );
}

function TeamPledge() {
  return (
    <ul className="mt-7 grid gap-2.5 text-[12.5px] leading-relaxed text-fog">
      <li className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-mint" aria-hidden /> Passwords live as bcrypt hashes; sessions are secure httpOnly cookies.</li>
      <li className="flex items-start gap-2.5"><Timer className="mt-0.5 size-3.5 shrink-0 text-sky" aria-hidden /> OTP sign-in codes expire in 10 minutes; single-use only.</li>
      <li className="flex items-start gap-2.5"><Wrench className="mt-0.5 size-3.5 shrink-0 text-yellow" aria-hidden /> Crew is reachable 24/7 — Discord billing or WhatsApp.</li>
    </ul>
  );
}

/* ---------------- login ---------------- */

export function LoginForm({ googleParam, googleReason }: { googleParam?: string; googleReason?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const next = params.get("next");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setNeedsVerify(res.status === 403);
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; note?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send code");
      setOtpSent(true);
      setNotice(data.note ?? "A 6-digit code has been sent to your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP code");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: otpCode }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setBusy(false);
    }
  };

  return (
    <Sheet title="Sign in" sub="Your orders, wishlist sync and tracking — all in the paddock.">
      {googleParam === "unconfigured" && (
        <div role="status" className="mb-5 border border-yellow/50 bg-yellow/[0.08] p-4 text-[12.5px] leading-relaxed text-yellow">
          <p className="font-bold uppercase tracking-wider">Google OAuth Not Configured</p>
          <p className="mt-1 text-fog">
            Add <code className="text-white">GOOGLE_CLIENT_ID</code> and <code className="text-white">GOOGLE_CLIENT_SECRET</code> to your Vercel project environment variables, or sign in below with OTP or email.
          </p>
        </div>
      )}
      {googleParam === "failed" && (
        <div role="status" className="mb-5 border border-red/60 bg-red/[0.08] p-4 text-[12.5px] leading-relaxed text-red">
          <p className="font-bold uppercase tracking-wider">Google Sign-in Incomplete</p>
          <p className="mt-1 text-fog">
            {googleReason ? `Details: ${googleReason}. ` : "Handshake rejected. "}
            Ensure <code className="text-white">https://theburnoutwheels-vert.vercel.app/api/auth/google/callback</code> is added under Authorized Redirect URIs in Google Cloud Console.
          </p>
        </div>
      )}

      {/* Auth Method Tabs */}
      <div className="mb-5 grid grid-cols-2 gap-1 border border-line bg-surface/50 p-1">
        <button
          type="button"
          onClick={() => {
            setMethod("otp");
            setError("");
            setNotice("");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold uppercase tracking-wider transition-colors",
            method === "otp" ? "border border-line-strong bg-coal text-white shadow-sm" : "text-fog hover:text-white"
          )}
        >
          <Sparkles className="size-3.5 text-mint" aria-hidden /> OTP Code
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod("password");
            setError("");
            setNotice("");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold uppercase tracking-wider transition-colors",
            method === "password" ? "border border-line-strong bg-coal text-white shadow-sm" : "text-fog hover:text-white"
          )}
        >
          <KeyRound className="size-3.5 text-sky" aria-hidden /> Password
        </button>
      </div>

      {method === "otp" ? (
        !otpSent ? (
          /* Step 1: Request OTP */
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <label className="block">
              <span className="u-label-txt">Email address</span>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="u-input pl-10!"
                  placeholder="you@grid.io"
                />
              </div>
            </label>
            {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[12.5px] text-red">{error}</p>}
            <button disabled={busy} className="u-btn u-btn-primary">
              <LogIn className="size-4" aria-hidden />
              {busy ? "Sending 6-digit code…" : "Send sign-in code →"}
            </button>
            <p className="text-center text-[11.5px] text-fog">
              No password needed. We'll send a one-time 6-digit code to verify your session.
            </p>
          </form>
        ) : (
          /* Step 2: Enter 6-digit code */
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-sm border border-line bg-surface/40 px-3 py-2 text-[12.5px]">
              <span className="truncate text-fog">Code sent to <strong className="text-bone">{email}</strong></span>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode("");
                  setError("");
                }}
                className="shrink-0 text-red underline hover:text-red/80 ml-2"
              >
                Change
              </button>
            </div>
            {notice && <p role="status" className="border border-sky/50 bg-sky/[0.07] px-4 py-3 text-[12.5px] text-sky">{notice}</p>}
            <label className="block">
              <span className="u-label-txt">Enter 6-digit code</span>
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="u-input pl-10! text-center font-mono text-xl tracking-[0.3em] font-bold"
                  placeholder="••••••"
                />
              </div>
            </label>
            {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[12.5px] text-red">{error}</p>}
            <button disabled={busy || otpCode.length !== 6} className="u-btn u-btn-primary">
              <LogIn className="size-4" aria-hidden />
              {busy ? "Verifying code…" : "Sign in to paddock"}
            </button>
            <div className="flex items-center justify-between text-[12px] text-fog">
              <span>Didn't receive it?</span>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={busy}
                className="flex items-center gap-1 text-red hover:underline"
              >
                <RefreshCw className="size-3" aria-hidden /> Resend code
              </button>
            </div>
          </form>
        )
      ) : (
        /* Password Sign-in */
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="u-label-txt">Email</span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="u-input pl-10!" placeholder="you@grid.io" />
            </div>
          </label>
          <label className="block">
            <span className="u-label-txt">Password</span>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="u-input pl-10!" />
            </div>
          </label>
          {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[12.5px] text-red">{error}</p>}
          {needsVerify && (
            <Link href={`/verify?email=${encodeURIComponent(email)}`} className="u-btn u-btn-primary w-full">Enter the 6-digit code →</Link>
          )}
          {notice && <p role="status" className="border border-sky/50 bg-sky/[0.07] px-4 py-3 text-[12.5px] text-sky">{notice}</p>}
          <button disabled={busy} className="u-btn u-btn-primary"><LogIn className="size-4" aria-hidden />{busy ? "Checking pass…" : "Sign in"}</button>
        </form>
      )}

      <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="u-label text-dim!">or</span><span className="h-px flex-1 bg-line" /></div>
      <GoogleButton from="store" />
      <div className="mt-6 flex items-center justify-between text-[13px]">
        <Link href="/signup" className="hover:text-red text-fog underline-offset-4 hover:underline">New here? Create account</Link>
        <Link href="/reset" className="hover:text-red text-fog underline-offset-4 hover:underline">Forgot password?</Link>
      </div>
      <TeamPledge />
    </Sheet>
  );
}

/* ---------------- signup ---------------- */

export function SignupForm({ googleParam, googleReason }: { googleParam?: string; googleReason?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const data = (await res.json()) as { ok?: boolean; note?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Signup failed");
      setDone(data.note ?? "Account created — check your inbox to verify.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Join the paddock" sub="One account for orders, tracking and drop notices. No spam, ever.">
      {googleParam === "unconfigured" && (
        <div role="status" className="mb-4 border border-yellow/50 bg-yellow/[0.08] p-4 text-[12.5px] leading-relaxed text-yellow">
          <p className="font-bold uppercase tracking-wider">Google OAuth Not Configured</p>
          <p className="mt-1 text-fog">
            Add <code className="text-white">GOOGLE_CLIENT_ID</code> and <code className="text-white">GOOGLE_CLIENT_SECRET</code> to your Vercel project environment variables, or create an account with email below.
          </p>
        </div>
      )}
      {googleParam === "failed" && (
        <div role="status" className="mb-4 border border-red/60 bg-red/[0.08] p-4 text-[12.5px] leading-relaxed text-red">
          <p className="font-bold uppercase tracking-wider">Google Sign-in Incomplete</p>
          <p className="mt-1 text-fog">
            {googleReason ? `Details: ${googleReason}. ` : "Handshake rejected. "}
            Ensure <code className="text-white">https://theburnoutwheels-vert.vercel.app/api/auth/google/callback</code> is added under Authorized Redirect URIs in Google Cloud Console.
          </p>
        </div>
      )}
      {done ? (
        <div className="border border-mint/50 bg-mint/[0.07] p-5">
          <p className="text-[13px] font-bold text-mint">Check your inbox</p>
          <p className="mt-2 text-[13px] leading-relaxed text-bone/85">{done} The verification link expires in 24 hours; ask again from sign-in if it lapses.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block">
            <span className="u-label-txt">Name</span>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
              <input required minLength={1} maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="u-input pl-10!" placeholder="Your name" />
            </div>
          </label>
          <label className="block">
            <span className="u-label-txt">Email</span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="u-input pl-10!" placeholder="you@grid.io" />
            </div>
          </label>
          <label className="block">
            <span className="u-label-txt">Password (8+ characters)</span>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
              <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="u-input pl-10!" />
            </div>
          </label>
          {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[12.5px] text-red">{error}</p>}
          <button disabled={busy} className="u-btn u-btn-primary"><UserPlus className="size-4" aria-hidden />{busy ? "Filing entry…" : "Create account"}</button>
          <p className="u-label-txt">Creating an account means accepting the <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>.</p>
        </form>
      )}
      <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="u-label text-dim!">or</span><span className="h-px flex-1 bg-line" /></div>
      <GoogleButton from="store" />
      <p className="mt-6 text-[13px] text-fog">Already racing? <Link href="/login" className="underline underline-offset-4 hover:text-bone">Sign in</Link></p>
      <TeamPledge />
    </Sheet>
  );
}

/* ---------------- reset (request + set) ---------------- */

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const data = (await res.json()) as { note?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDone(data.note ?? "If that address has an account, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = (await res.json()) as { ok?: boolean; note?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setDone(data.note ?? "Password updated — sign in with the new one.");
      setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Password reset" sub="Rolling a fresh pass takes one link and zero phone calls.">
      {done ? (
        <div className="border border-mint/50 bg-mint/[0.07] p-5 text-[13px] leading-relaxed text-mint">{done} Redirecting to sign-in…</div>
      ) : token ? (
        <form onSubmit={setNewPassword} className="flex flex-col gap-4">
          <p className="u-label-txt flex items-center gap-2"><KeyRound className="size-3.5" aria-hidden /> Choose a new password (8+ characters)</p>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="u-input" aria-label="New password" />
          {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[12.5px] text-red">{error}</p>}
          <button disabled={busy} className="u-btn u-btn-primary">{busy ? "Setting…" : "Set new password"}</button>
        </form>
      ) : (
        <form onSubmit={requestReset} className="flex flex-col gap-4">
          <p className="u-label-txt flex items-center gap-2"><Flag className="size-3.5" aria-hidden /> Enter your account email — the reset link lands in one hour’s window.</p>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="u-input pl-10!" placeholder="you@grid.io" />
          </div>
          {error && <p role="alert" className="border border-red bg-red/10 px-4 py-3 text-[12.5px] text-red">{error}</p>}
          <button disabled={busy} className="u-btn u-btn-primary">{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p className="mt-6 text-[13px] text-fog"><Link href="/login" className="underline underline-offset-4 hover:text-bone">Back to sign in</Link></p>
      <TeamPledge />
    </Sheet>
  );
}
