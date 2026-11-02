"use client";

import { useState } from "react";

interface CustomerNotesEditorProps {
  customerId: number;
  initialNotes: string;
  initialStatus?: string;
}

export function CustomerNotesEditor({
  customerId,
  initialNotes,
  initialStatus = "ACTIVE",
}: CustomerNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch(`/api/admin/customers?id=${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, status }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update customer notes");
      }

      setStatusMsg({ type: "success", text: "Notes and status saved successfully" });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update customer notes",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="u-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="u-label">Admin Notes & CRM Status</p>
        <span className="text-[11px] text-fog">Internal only</span>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-fog block mb-1.5">
          Account Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="u-input w-full text-xs"
        >
          <option value="ACTIVE">ACTIVE (Standard Customer)</option>
          <option value="VIP">VIP (High Priority)</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
        </select>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-fog block mb-1.5">
          Customer Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add preferences, garage details, order preferences, or support notes..."
          className="u-input w-full resize-y text-[13px] leading-relaxed"
        />
      </div>

      {statusMsg ? (
        <div
          className={`rounded px-3 py-2 text-xs font-medium ${
            statusMsg.type === "success"
              ? "bg-mint/15 text-mint border border-mint/30"
              : "bg-red/15 text-red border border-red/30"
          }`}
        >
          {statusMsg.text}
        </div>
      ) : null}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={saving}
          className="u-btn u-btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Notes"}
        </button>
      </div>
    </form>
  );
}
