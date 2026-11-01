"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { Table, Td, ConfirmDialog } from "@/components/admin/admin-ui";
import { fmtUSD } from "@/lib/money";
import { cn } from "@/lib/utils";

type DiscountRow = {
  id: number; code: string; type: string; value: number; minSubtotal: number;
  maxUses: number; usedCount: number; startsAt: string | null; endsAt: string | null; active: boolean;
  createdAt: string;
};

export function DiscountsPanel({ rows }: { rows: DiscountRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("10");
  const [min, setMin] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [delId, setDelId] = useState<number | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          value: type === "PERCENT" ? Number(value) : Math.round(Number(value) * 100),
          minSubtotal: min ? Math.round(Number(min) * 100) : 0,
          maxUses: maxUses ? Number(maxUses) : 0,
          active: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setCode(""); setMin(""); setMaxUses(""); router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const toggle = async (d: DiscountRow) => {
    await fetch(`/api/discounts?id=${d.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    router.refresh();
  };

  const del = async () => {
    if (delId) await fetch(`/api/discounts?id=${delId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={create} className="u-card grid items-end gap-3 p-5 md:grid-cols-[1fr_120px_120px_140px_140px_auto]">
        <label><span className="u-label-txt">Code</span><input value={code} onChange={(e) => setCode(e.target.value)} required className="u-input mt-1.5 uppercase!" placeholder="WELCOME10" /></label>
        <label><span className="u-label-txt">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as never)} className="u-select mt-1.5"><option value="PERCENT">%</option><option value="FLAT">₹ flat</option></select>
        </label>
        <label><span className="u-label-txt">Value</span><input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} required className="u-input mt-1.5" /></label>
        <label><span className="u-label-txt">Min cart ₹</span><input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} className="u-input mt-1.5" /></label>
        <label><span className="u-label-txt">Max uses (0=∞)</span><input type="number" min="0" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="u-input mt-1.5" /></label>
        <button disabled={busy} className="u-btn u-btn-primary py-3!"><Plus className="size-4" /> Create</button>
        {err && <p role="alert" className="text-[12px] text-red md:col-span-5">{err}</p>}
      </form>

      {rows.length === 0 ? (
        <p className="u-card px-6 py-12 text-center u-label-txt">No codes yet.</p>
      ) : (
        <Table head={["Code", "Value", "Min cart", "Used / Max", "Active", "Deactivate/Delete"]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <Td className="u-mono font-bold">{d.code}</Td>
              <Td className="u-mono">{d.type === "PERCENT" ? `${d.value}%` : fmtUSD(d.value)}</Td>
              <Td className="u-mono">{d.minSubtotal ? fmtUSD(d.minSubtotal) : "—"}</Td>
              <Td className="u-mono">{d.usedCount} / {d.maxUses === 0 ? "∞" : d.maxUses}</Td>
              <Td><span className={cn("u-badge", d.active ? "border-mint text-mint" : "border-dim text-dim")}>{d.active ? "ACTIVE" : "OFF"}</span></Td>
              <Td>
                <div className="flex gap-1.5">
                  <button onClick={() => toggle(d)} className="u-btn u-btn-ghost px-2! py-2!" aria-label="Toggle active">{d.active ? "Disable" : "Enable"}</button>
                  <button onClick={() => setDelId(d.id)} className="u-btn u-btn-danger px-2! py-2!" aria-label="Delete code"><Trash2 className="size-3.5" /></button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <ConfirmDialog open={delId !== null} onClose={() => setDelId(null)} onConfirm={del} title="Delete code?" body="Used codes keep their history on orders; the code itself stops working instantly." confirmLabel="Delete" danger />
    </div>
  );
}
