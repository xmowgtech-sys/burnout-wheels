"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (state === "ok") {
    return <p className="text-sm text-mint">Locked in — drop-day telemetry goes straight to that inbox. No spam laps.</p>;
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setState("busy");
        try {
          const res = await fetch("/api/leads", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: form.get("email") }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error || "Failed");
          setState("ok");
        } catch (err) {
          setState("err");
          setMsg(err instanceof Error ? err.message : "Failed");
        }
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <input name="email" type="email" required placeholder="paddock@your-mail.in" className="u-input sm:max-w-xs" aria-label="Email address" />
      <button disabled={state === "busy"} className="u-btn u-btn-primary">
        {state === "busy" ? "Joining…" : "Join paddock list"}
      </button>
      {state === "err" && <p className="text-[13px] text-red">{msg}</p>}
    </form>
  );
}
