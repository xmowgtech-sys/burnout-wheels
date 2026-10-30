import Link from "next/link";
import { Table, Td } from "@/components/admin/admin-ui";
import { fmtUSD, fmtDate } from "@/lib/money";
import { listCustomers } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers · Pit wall", robots: { index: false } };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const customers = listCustomers(q || undefined);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="u-label">Paddock register</p>
        <h1 className="u-h1 mt-2 text-3xl md:text-4xl">Customers</h1>
        <p className="u-label-txt mt-2">{customers.length} on file · built automatically from delivered order data.</p>
      </header>

      <form method="GET" action="/admin/customers" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email…" className="u-input max-w-xs" aria-label="Search customers" />
        <button className="u-btn u-btn-ghost">Search</button>
      </form>

      {customers.length === 0 ? (
        <p className="u-card px-6 py-12 text-center u-label-txt">No customers yet.</p>
      ) : (
        <Table head={["Customer", "Orders", "Lifetime value", "Last order", "Since"]}>
          {customers.map((c) => (
            <tr key={c.id}>
              <Td>
                <span className="block font-semibold">{c.name}</span>
                <span className="u-label-txt">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
              </Td>
              <Td className="u-mono">{c.ordersCount}</Td>
              <Td className="u-mono font-bold">{fmtUSD(c.lifetimeValue)}</Td>
              <Td className="u-label-txt">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : "—"}</Td>
              <Td className="u-label-txt">{fmtDate(c.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
