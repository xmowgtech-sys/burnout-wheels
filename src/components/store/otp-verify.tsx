"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, SendHorizontal } from "lucide-react";

/**
 * 6-digit email verification code entry. Auto-focuses, auto-advances, supports
 * paste of the whole code, and has a rate-limited resend (PUT /api/auth/verify/otp).
 */
export function OtpVerify({ initialEmail = "" }: { initialEmail?: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resentAt, setResentAt] = useState<number | null>(null);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const oauth = async (path: string, method: string, body: unknown) => {
    const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { res, data: (await res.json()) as { error?: string; note?: string } };
  };

  const setDigit = (i: number, v: string) => {
    if (v.length > 1) {
      // paste (or fast type) — fill from the string position
      const clean = v.replace(/\D/g, "").slice(0, 6 - i);
      if (!clean) return;
      const next = [...digits];
      for (let k = 0; k < clean.length; k++) next[i + k] = clean[k];
      setDigits(next);
      inputs.current[Math.min(i + clean.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = v.replace(/\D/g, "").slice(0, 1);
    setDigits(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "Enter") void submit();
  };

  const submit = async () => {
    if (busy) return;
    const code = digits.join("");
    if (!/^\d{6}$/.test(code)) {
      setMsg({ kind: "err", text: "Enter all six digits." });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const { res, data } = await oauth("/api/auth/verify/otp", "POST", { code });
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Verification failed." });
        setDigits(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }
      setMsg({ kind: "ok", text: "Verified! Taking you to your paddock…" });
      router.replace("/account?verified=1");
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Network hiccup — try again." });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMsg({ kind: "err", text: "Enter your signup email so we can send the fresh code." });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const { res, data } = await oauth("/api/auth/verify/otp", "PUT", { email });
      setResentAt(Date.now());
      setMsg(res.ok ? { kind: "ok", text: data.note ?? "A fresh code is on its way." } : { kind: "err", text: data.error ?? "Resend failed." });
    } catch {
      setMsg({ kind: "err", text: "Network hiccup — try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      {/* coordinates are set to zero so paste targets the first box */}
      <div className="flex justify-center gap-2" onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); setDigit(0, t); } }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            maxLength={6}
            className="u-input h-12! w-11! text-center! text-lg! font-bold! sm:w-12!"
          />
        ))}
      </div>

      {msg && (
        <p role="status" className={`mt-4 text-[13px] font-bold ${msg.kind === "ok" ? "text-mint" : "text-red"}`}>
          {msg.text}
        </p>
      )}

      <button onClick={submit} disabled={busy} className="u-btn u-btn-primary mt-5 w-full justify-center">
        <KeyRound className="size-4" aria-hidden /> Verify account
      </button>

      <div className="mt-4 border-t border-line pt-4">
        <p className="u-label-txt">Codes expire after 10 minutes. Lost it? Send a fresh one.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your signup email"
          autoComplete="email"
          className="u-input mt-2"
        />
        <button onClick={resend} disabled={busy} className="u-btn u-btn-ghost mt-2 w-full justify-center">
          <SendHorizontal className="size-4" aria-hidden /> Resend code {resentAt && <span className="u-badge ml-2 border-mint text-mint">sent</span>}
        </button>
      </div>
    </div>
  );
}
