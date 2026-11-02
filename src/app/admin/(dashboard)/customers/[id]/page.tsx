import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/orders";
import { fmtUSD, fmtDate } from "@/lib/money";
import { StatusBadge, Table, Td } from "@/components/admin/admin-ui";
import { CustomerNotesEditor } from "@/components/admin/customer-notes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer Profile · Pit wall", robots: { index: false } };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getCustomerDetail(id);
  if (!detail) notFound();

  const { customer, account, statusLabel, addresses, orders, timeline } = detail;

  const initials =
    customer.name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CU";

  let statusTone = "bg-white/10 text-fog border-white/15";
  if (statusLabel === "VIP Driver") statusTone = "bg-yellow/15 text-yellow border-yellow/30";
  else if (statusLabel === "Regular") statusTone = "bg-mint/15 text-mint border-mint/30";
  else if (statusLabel === "Active") statusTone = "bg-sky/15 text-sky border-sky/30";

  const avgOrderValue =
    customer.ordersCount > 0 ? Math.round(customer.lifetimeValue / customer.ordersCount) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-1.5 text-xs text-fog hover:text-white transition-colors mb-3"
        >
          ← Back to Customers
        </Link>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {account?.picture ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={account.picture}
                alt=""
                className="size-16 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white">
                {initials}
              </span>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="u-h1 text-2xl md:text-3xl">{customer.name}</h1>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusTone}`}>
                  {statusLabel}
                </span>
                {customer.status && customer.status !== "ACTIVE" ? (
                  <span className="rounded bg-yellow/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-yellow">
                    {customer.status}
                  </span>
                ) : null}
              </div>
              <p className="u-label-txt mt-1 text-[13px]">
                {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ""}
                {account?.verified ? (
                  <span className="ml-2 text-mint">✓ Verified Account</span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-fog">Customer ID #{customer.id}</p>
            <p className="u-label-txt mt-1">Since {fmtDate(customer.createdAt)}</p>
          </div>
        </header>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="u-card p-4">
          <p className="u-label">Lifetime Value</p>
          <p className="u-mono mt-2 text-2xl font-bold text-mint">{fmtUSD(customer.lifetimeValue)}</p>
          <p className="u-label-txt mt-1 text-[11px]">Cumulative revenue</p>
        </div>
        <div className="u-card p-4">
          <p className="u-label">Total Orders</p>
          <p className="u-mono mt-2 text-2xl font-bold">{customer.ordersCount}</p>
          <p className="u-label-txt mt-1 text-[11px]">{orders.length} in system records</p>
        </div>
        <div className="u-card p-4">
          <p className="u-label">Average Order Value</p>
          <p className="u-mono mt-2 text-2xl font-bold">{customer.ordersCount > 0 ? fmtUSD(avgOrderValue) : "—"}</p>
          <p className="u-label-txt mt-1 text-[11px]">Per checkout spend</p>
        </div>
        <div className="u-card p-4">
          <p className="u-label">Last Order</p>
          <p className="mt-2 text-[15px] font-semibold">
            {customer.lastOrderAt ? fmtDate(customer.lastOrderAt) : "No orders yet"}
          </p>
          <p className="u-label-txt mt-1 text-[11px]">
            {customer.lastOrderAt ? "Most recent checkout" : "Lead account"}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left Column: Order History & Activity Timeline */}
        <div className="flex flex-col gap-8">
          {/* Order History */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="u-label">Order History ({orders.length})</h2>
              {orders.length > 0 ? (
                <span className="text-xs text-fog">Synced across logins & guest checkouts</span>
              ) : null}
            </div>

            {orders.length === 0 ? (
              <div className="u-card p-8 text-center text-fog text-sm">
                No orders recorded for this customer yet.
              </div>
            ) : (
              <Table head={["Order #", "Status", "Items", "Payment", "Total", "Action"]}>
                {orders.map((o) => {
                  const paymentStatus =
                    o.paymentStatus ||
                    (o.status === "PENDING_PAYMENT" || o.status === "PAYMENT_REVIEW" ? "PENDING" : "PAID");
                  const itemsPreview = o.items.map((i) => `${i.name} (×${i.qty})`).join(", ");
                  return (
                    <tr key={o.id}>
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="u-mono block font-semibold text-white hover:text-mint transition-colors"
                        >
                          {o.number}
                        </Link>
                        <span className="u-label-txt block text-[11px]">{fmtDate(o.placedAt)}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={o.status} />
                      </Td>
                      <Td>
                        <span className="block max-w-[200px] truncate text-xs text-white/90" title={itemsPreview}>
                          {itemsPreview || `${o.items.length} items`}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-xs font-medium">
                          {o.paymentMethod}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            paymentStatus === "PAID" ? "text-mint" : "text-yellow"
                          }`}
                        >
                          {paymentStatus}
                        </span>
                      </Td>
                      <Td>
                        <span className="u-mono block font-bold text-xs">{fmtUSD(o.total)}</span>
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="u-btn u-btn-ghost inline-flex items-center px-2 py-1 text-xs"
                        >
                          View →
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </section>

          {/* Activity Timeline */}
          <section>
            <h2 className="u-label mb-3">Customer Activity Timeline</h2>
            {timeline.length === 0 ? (
              <div className="u-card p-6 text-center text-xs text-fog">No activity recorded yet.</div>
            ) : (
              <ol className="u-card p-5 flex flex-col divide-y divide-line">
                {timeline.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-mint" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-white">{item.action}</span>
                        <span className="text-xs text-fog shrink-0">{fmtDate(item.date)}</span>
                      </div>
                      {item.note ? (
                        <p className="mt-1 text-xs text-fog leading-relaxed">{item.note}</p>
                      ) : null}
                      {item.actor ? (
                        <span className="u-label-txt mt-1 block text-[11px]">Actor: {item.actor}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Right Column: CRM Notes & Saved Addresses */}
        <div className="flex flex-col gap-6">
          <CustomerNotesEditor
            customerId={customer.id}
            initialNotes={customer.notes || ""}
            initialStatus={customer.status || "ACTIVE"}
          />

          {/* Saved Addresses */}
          <section className="u-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="u-label">Delivery Addresses ({addresses.length})</p>
              <span className="text-[11px] text-fog">Saved & past checkouts</span>
            </div>

            {addresses.length === 0 ? (
              <p className="text-xs text-fog py-4 text-center">No delivery addresses on file.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {addresses.map((addr, idx) => (
                  <div
                    key={addr.id || idx}
                    className="rounded border border-line bg-white/2 p-3 text-xs flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white/90">{addr.label || `Address #${idx + 1}`}</span>
                      {addr.isDefault ? (
                        <span className="rounded bg-mint/15 px-1.5 py-0.5 text-[10px] font-semibold text-mint">
                          Default
                        </span>
                      ) : null}
                    </div>
                    {addr.name ? <p className="font-medium text-white">{addr.name}</p> : null}
                    {addr.phone ? <p className="text-fog">{addr.phone}</p> : null}
                    <p className="text-fog leading-relaxed mt-0.5">
                      {addr.addressLine}, {addr.city}, {addr.state} {addr.pincode}, {addr.country}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Connected User Account */}
          <section className="u-card p-5 text-xs flex flex-col gap-2">
            <p className="u-label">Account Linkage</p>
            {account ? (
              <div className="space-y-1.5">
                <p className="text-white/90">
                  Linked Paddock ID: <span className="font-mono text-mint">#{account.id}</span>
                </p>
                <p className="text-fog">Email: {account.email}</p>
                {account.verified ? (
                  <span className="inline-block rounded bg-mint/15 px-2 py-0.5 text-[11px] font-medium text-mint">
                    Verified Credentials
                  </span>
                ) : (
                  <span className="inline-block rounded bg-yellow/15 px-2 py-0.5 text-[11px] font-medium text-yellow">
                    Unverified Email
                  </span>
                )}
              </div>
            ) : (
              <p className="text-fog">
                Guest checkout profile · Not yet registered with a password account. Will automatically link on signup.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
