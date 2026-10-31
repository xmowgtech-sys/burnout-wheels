"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, PencilLine, ShieldCheck, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";

export interface AccountSnapshot {
  email: string;
  name: string;
  phone: string;
  verified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
}

export function AccountSettings({ account }: { account: AccountSnapshot }) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pBusy, setPBusy] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wBusy, setWBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [dMsg, setDMsg] = useState("");
  const [dBusy, setDBusy] = useState(false);

  const saveProfile = async () => {
    setPBusy(true); setProfileMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = (await res.json()) as { error?: string };
      setProfileMsg({ ok: res.ok, text: res.ok ? "Profile saved." : (data.error ?? "Save failed.") });
      if (res.ok) router.refresh();
    } catch {
      setProfileMsg({ ok: false, text: "Network hiccup — try again." });
    } finally {
      setPBusy(false);
    }
  };

  const savePassword = async () => {
    setWBusy(true); setPassMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = (await res.json()) as { error?: string };
      setPassMsg({ ok: res.ok, text: res.ok ? (account.hasPassword ? "Password changed." : "Password set — email sign-in is now live.") : (data.error ?? "Failed.") });
      if (res.ok) {
        setCurrent(""); setNext("");
        router.refresh();
      }
    } catch {
      setPassMsg({ ok: false, text: "Network hiccup — try again." });
    } finally {
      setWBusy(false);
    }
  };

  const deleteMe = async () => {
    setDBusy(true); setDMsg("");
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
      setDMsg("Network hiccup — try again.");
    } finally {
      setDBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* profile */}
      <section className="u-card p-5">
        <p className="u-label flex items-center gap-2"><PencilLine className="size-3.5" aria-hidden /> Profile settings</p>
        <label className="mt-4 block">
          <span className="u-label-txt">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="u-input mt-1.5" autoComplete="name" />
        </label>
        <label className="mt-3 block">
          <span className="u-label-txt">Phone (for order updates)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="+91 …" className="u-input mt-1.5" autoComplete="tel" />
        </label>
        <label className="mt-3 block">
          <span className="u-label-txt">Email — the identity key, never editable</span>
          <input value={account.email} readOnly disabled className="u-input mt-1.5 opacity-60" />
        </label>
        {profileMsg && <p role="status" className={`mt-3 text-[13px] font-bold ${profileMsg.ok ? "text-mint" : "text-red"}`}>{profileMsg.text}</p>}
        <button onClick={saveProfile} disabled={pBusy || !name.trim()} className="u-btn u-btn-primary mt-4">Save profile</button>
      </section>

      {/* password */}
      <section className="u-card p-5">
        <p className="u-label flex items-center gap-2"><KeyRound className="size-3.5" aria-hidden /> Password</p>
        {account.hasPassword ? (
          <p className="u-label-txt mt-2">Change your password. You&apos;ll keep your session.</p>
        ) : (
          <p className="u-label-txt mt-2">
            You signed in with {account.googleLinked ? "Google" : "a passwordless account"}, so there&apos;s no password yet.
            Set one to also sign in with email right on this site.
          </p>
        )}
        {account.hasPassword && (
          <label className="mt-4 block">
            <span className="u-label-txt">Current password</span>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="u-input mt-1.5" autoComplete="current-password" />
          </label>
        )}
        <label className="mt-3 block">
          <span className="u-label-txt">{account.hasPassword ? "New password (min 8 characters)" : "Set a password (min 8 characters)"}</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="u-input mt-1.5" autoComplete="new-password" />
        </label>
        {passMsg && <p role="status" className={`mt-3 text-[13px] font-bold ${passMsg.ok ? "text-mint" : "text-red"}`}>{passMsg.text}</p>}
        <button onClick={savePassword} disabled={wBusy || next.length < 8 || (account.hasPassword && !current)} className="u-btn u-btn-primary mt-4">
          {account.hasPassword ? "Change password" : "Set password"}
        </button>
      </section>

      {/* verification */}
      <section className="u-card p-5">
        <p className="u-label flex items-center gap-2">
          {account.verified ? <ShieldCheck className="size-3.5 text-mint" aria-hidden /> : <ShieldAlert className="size-3.5 text-yellow" aria-hidden />} Email verification
        </p>
        {account.verified ? (
          <p className="mt-3 text-[13px] leading-relaxed text-fog">
            This address is verified — the door pass for sign-in, order confirmations and reply-to mails. Nothing further needed.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-fog">
              Not verified yet. Check your inbox for the 6-digit code — the verification screen lives at <span className="u-mono">/verify</span>.
            </p>
            <a href="/verify" className="u-btn u-btn-primary mt-4">Open verification screen</a>
          </>
        )}
      </section>

      {/* danger zone */}
      <section className="u-card !border-red/40 p-5">
        <p className="u-label flex items-center gap-2 text-red"><TriangleAlert className="size-3.5" aria-hidden /> Danger zone</p>
        <p className="u-label-txt mt-2">Delete this account permanently. Your session ends immediately; past order records stay only for accounting and are de-linked from any profile.</p>
        <button onClick={() => setConfirmOpen(true)} className="u-btn mt-4 border-red text-red hover:!bg-red hover:!text-white">Delete account</button>
        {dMsg && <p role="status" className="mt-3 text-[13px] font-bold text-red">{dMsg}</p>}
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm account deletion">
          <div className="u-card w-full max-w-sm p-6">
            <p className="u-label text-red">Confirm deletion</p>
            <p className="mt-3 text-[13px] leading-relaxed text-fog">
              This can&apos;t be undone. Type <span className="u-mono font-bold text-bone">DELETE</span> to confirm — account {account.email} goes away now.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className="u-input mt-3 !font-mono"
              aria-label="Type DELETE to confirm"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setConfirmOpen(false); setConfirmText(""); }} className="u-btn u-btn-ghost !py-2">Cancel</button>
              <button
                onClick={deleteMe}
                disabled={confirmText !== "DELETE" || dBusy}
                className="u-btn u-btn-danger ml-auto !py-2"
              >
                <Trash2 className="size-4" aria-hidden /> Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
