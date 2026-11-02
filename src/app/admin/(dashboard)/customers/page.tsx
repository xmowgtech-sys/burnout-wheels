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
        <p className="u-label-txt mt-2">
          {customers.length} on file · synced seamlessly from order checkouts and customer accounts.
        </p>
      </header>

      <form method="GET" action="/admin/customers" className="flex items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or phone…"
          className="u-input max-w-sm"
          aria-label="Search customers"
        />
        <button type="submit" className="u-btn u-btn-ghost">
          Search
        </button>
        {q ? (
          <Link href="/admin/customers" className="u-btn u-btn-ghost text-xs">
            Clear
          </Link>
        ) : null}
      </form>

      {customers.length === 0 ? (
        <div className="u-card px-6 py-12 text-center">
          <p className="u-label-txt">No customers found.</p>
          {q ? (
            <Link href="/admin/customers" className="mt-3 inline-block text-xs text-mint hover:underline">
              Reset search
            </Link>
          ) : null}
        </div>
      ) : (
        <Table head={["Customer", "Status", "Orders & Spend", "Addresses", "Latest Order", "Joined", "Action"]}>
          {customers.map((c) => {
            const initials =
              c.name
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "CU";

            let statusTone = "bg-white/10 text-fog border-white/15";
            if (c.statusLabel === "VIP Driver") statusTone = "bg-yellow/15 text-yellow border-yellow/30";
            else if (c.statusLabel === "Regular") statusTone = "bg-mint/15 text-mint border-mint/30";
            else if (c.statusLabel === "Active") statusTone = "bg-sky/15 text-sky border-sky/30";

            return (
              <tr key={c.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {c.picture ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={c.picture} alt="" className="size-9 shrink-0 rounded-full border border-line object-cover" />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="block truncate font-semibold text-white hover:text-mint transition-colors"
                      >
                        {c.name}
                      </Link>
                      <span className="u-label-txt block truncate text-[12px]">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </span>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                    {c.statusLabel || "Lead"}
                  </span>
                </Td>
                <Td>
                  <span className="u-mono block font-bold text-[13px]">{fmtUSD(c.lifetimeValue)}</span>
                  <span className="u-label-txt block text-[11px]">
                    {c.ordersCount} {c.ordersCount === 1 ? "order" : "orders"}
                  </span>
                </Td>
                <Td>
                  <span className="text-[13px] text-white/90">
                    {c.addressCount ?? 1} {(c.addressCount ?? 1) === 1 ? "address" : "addresses"}
                  </span>
                </Td>
                <Td>
                  {c.latestOrder ? (
                    <div>
                      <Link
                        href={`/admin/orders/${c.orders[0]?.id ?? c.latestOrder.number}`}
                        className="u-mono block text-xs font-semibold text-white hover:text-mint transition-colors"
                      >
                        {c.latestOrder.number}
                      </Link>
                      <span className="u-label-txt block text-[11px]">
                        {fmtUSD(c.latestOrder.total)} · {c.latestOrder.status}
                      </span>
                    </div>
                  ) : (
                    <span className="u-label-txt text-xs">—</span>
                  )}
                </Td>
                <Td className="u-label-txt text-xs">{fmtDate(c.createdAt)}</Td>
                <Td>
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="u-btn u-btn-ghost inline-flex items-center gap-1 px-2.5 py-1 text-xs"
                  >
                    Profile →
                  </Link>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
