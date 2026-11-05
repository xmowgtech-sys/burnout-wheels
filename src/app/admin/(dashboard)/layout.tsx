import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ROLE_PERMS } from "@/lib/permissions";
import { AdminShell } from "@/components/admin/shell";
import { ensureCatalogHydrated } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  await ensureCatalogHydrated();
  return (
    <AdminShell user={user.email} role={user.role} canPerms={[...ROLE_PERMS[user.role]]}>
      {children}
    </AdminShell>
  );
}
