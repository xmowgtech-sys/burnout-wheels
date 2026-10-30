import { redirect } from "next/navigation";
import { TeamPanel } from "@/components/admin/team-panel";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team · Pit wall", robots: { index: false } };

type UserRow = { id: number; email: string; name: string; role: "OWNER" | "ADMIN" | "STAFF"; active: number; lastLoginAt: string | null };

export default async function TeamPage() {
  const me = await currentUser();
  if (!me) redirect("/admin/login");
  const team = (getDb().prepare("SELECT id, email, name, role, active, lastLoginAt FROM users ORDER BY id ASC").all() as UserRow[])
    .map((u) => ({ ...u, active: u.active === 1 }));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Garage crew</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Team & roles</h1>
        <p className="u-label-txt mt-2">Owners run the roster. ADMIN loses team management; STAFF keeps orders, reviews and chat only.</p>
      </header>
      <TeamPanel me={{ id: me.id, role: me.role }} team={team} />
    </div>
  );
}
