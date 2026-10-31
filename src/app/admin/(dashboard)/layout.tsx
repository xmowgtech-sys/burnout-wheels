import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ROLE_PERMS } from "@/lib/permissions";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return (
    <AdminShell user={user.email} role={user.role} canPerms={[...ROLE_PERMS[user.role]]}>
      {children}
    </AdminShell>
  );
}
