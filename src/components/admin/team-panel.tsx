"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Table, Td, ConfirmDialog } from "./admin-ui";
import { PERM_LABELS, PERMS, ROLE_PERMS, type Perm, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type TeamRow = { id: number; email: string; name: string; role: Role; active: boolean; lastLoginAt: string | null };

export function TeamPanel({ me, team }: { me: { id: number; role: Role }; team: TeamRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [delId, setDelId] = useState<number | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setName(""); setEmail(""); setPassword("");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/team?id=${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const del = async () => {
    if (delId) {
      await fetch(`/api/team?id=${delId}`, { method: "DELETE" });
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={create} className="u-card grid items-end gap-3 p-5 md:grid-cols-[1fr_1fr_180px_120px_auto]">
        <label><span className="u-label-txt">Name</span><input value={name} onChange={(e) => setName(e.target.value)} required className="u-input mt-1.5" /></label>
        <label><span className="u-label-txt">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="u-input mt-1.5" /></label>
        <label><span className="u-label-txt">Temporary password</span><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="u-input mt-1.5 !font-mono !text-[13px]" placeholder="min 8 chars" /></label>
        <label><span className="u-label-txt">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="u-select mt-1.5">
            <option value="STAFF">STAFF</option>
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
        </label>
        <button disabled={busy} className="u-btn u-btn-primary !py-3"><Plus className="size-4" /> Add member</button>
        {err && <p role="alert" className="text-[12px] text-red md:col-span-5">{err}</p>}
      </form>

      <Table head={["Member", "Role", "Active", "Last login", "Actions"]}>
        {team.map((u) => {
          const isSelf = u.id === me.id;
          return (
            <tr key={u.id}>
              <Td>
                <span className="block font-semibold">{u.name}{isSelf && <span className="u-label ml-2">(you)</span>}</span>
                <span className="u-label-txt">{u.email}</span>
              </Td>
              <Td>
                <select
                  value={u.role}
                  onChange={(e) => patch(u.id, { role: e.target.value })}
                  disabled={busy || isSelf || u.role === "OWNER"}
                  className="u-select !w-auto !py-2"
                  aria-label={`Role for ${u.email}`}
                >
                  {(["STAFF", "ADMIN", "OWNER"] as Role[]).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Td>
              <Td><span className={cn("u-badge", u.active ? "border-mint text-mint" : "border-dim text-dim")}>{u.active ? "ACTIVE" : "OFF"}</span></Td>
              <Td className="u-label-txt">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "never"}</Td>
              <Td>
                <div className="flex gap-1.5">
                  {!isSelf && u.role !== "OWNER" && (
                    <button onClick={() => patch(u.id, { active: !u.active })} disabled={busy} className="u-btn u-btn-ghost !px-3 !py-2">
                      {u.active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                  {!isSelf && u.role !== "OWNER" && (
                    <button onClick={() => setDelId(u.id)} className="u-btn u-btn-danger !px-2.5 !py-2" aria-label={`Remove ${u.email}`}><Trash2 className="size-3.5" /></button>
                  )}
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>

      <ConfirmDialog open={delId !== null} onClose={() => setDelId(null)} onConfirm={del} title="Remove this member?" body="Their login stops working immediately. Orders and logs stay attributed." confirmLabel="Remove" danger />

      {/* permission matrix */}
      <section className="u-card overflow-x-auto p-5" aria-label="Permission matrix">
        <p className="u-label">Role permissions</p>
        <table className="mt-4 w-full min-w-[560px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="u-label py-2.5">Permission</th>
              {(["OWNER", "ADMIN", "STAFF"] as Role[]).map((r) => <th key={r} className="u-label py-2.5">{r}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PERMS.map((p: Perm) => (
              <tr key={p}>
                <td className="py-2.5 font-medium">{PERM_LABELS[p]}</td>
                {(["OWNER", "ADMIN", "STAFF"] as Role[]).map((r) => (
                  <td key={r} className="py-2.5">
                    {ROLE_PERMS[r].includes(p) ? <span className="text-mint">✓</span> : <span className="text-dim">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
