import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { fetchAllOrders, loadToken } from "~/lib/shopify.server";

type CustomerRow = {
  customerId: number;
  name: string;
  email: string;
  orderCount: number;
  totalSpend: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
};

export async function loader(_: LoaderFunctionArgs) {
  const token = await loadToken();
  if (!token) {
    return json({ needsAuth: true as const });
  }

  const orders = await fetchAllOrders({
    shop: token.shop,
    accessToken: token.accessToken,
  });

  type CustomerAccum = {
    customerId: number;
    name: string;
    email: string;
    orderCount: number;
    totalSpend: number;
    lastOrderDate: Date;
  };

  const byCustomer = new Map<number, CustomerAccum>();

  for (const o of orders) {
    if (!o.customer) continue;
    const c = o.customer;
    const created = new Date(o.created_at);
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || `#${c.id}`;
    const existing = byCustomer.get(c.id);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpend += Number(o.total_price);
      if (created > existing.lastOrderDate) existing.lastOrderDate = created;
    } else {
      byCustomer.set(c.id, {
        customerId: c.id,
        name,
        email: c.email ?? "",
        orderCount: 1,
        totalSpend: Number(o.total_price),
        lastOrderDate: created,
      });
    }
  }

  const now = Date.now();
  const rows: CustomerRow[] = [...byCustomer.values()]
    .filter((c) => c.totalSpend >= 500)
    .map((c) => ({
      customerId: c.customerId,
      name: c.name,
      email: c.email,
      orderCount: c.orderCount,
      totalSpend: c.totalSpend,
      lastOrderDate: c.lastOrderDate.toISOString().slice(0, 10),
      daysSinceLastOrder: Math.floor((now - c.lastOrderDate.getTime()) / 86400_000),
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  return json({ needsAuth: false as const, shop: token.shop, rows });
}

export default function SellThrough() {
  const data = useLoaderData<typeof loader>();

  if (data.needsAuth) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Customer analytics</h1>
        <p>Not connected to Shopify yet.</p>
        <Link to="/auth">Connect Shopify →</Link>
      </main>
    );
  }

  const th: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    textAlign: "left",
    borderBottom: "2px solid #ddd",
    whiteSpace: "nowrap",
  };
  const thR: React.CSSProperties = { ...th, textAlign: "right" };
  const td: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #f0f0f0" };
  const tdR: React.CSSProperties = { ...td, textAlign: "right" };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Top customers · all-time spend ≥ $500</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Store: {data.shop} · {data.rows.length} customer{data.rows.length !== 1 ? "s" : ""}
      </p>

      {data.rows.length === 0 ? (
        <p>No customers with $500+ total spend found.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>Customer</th>
              <th style={th}>Email</th>
              <th style={thR}>Orders</th>
              <th style={thR}>Total spent</th>
              <th style={thR}>Last order</th>
              <th style={thR}>Days since</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.customerId}>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.email || <span style={{ color: "#aaa" }}>—</span>}</td>
                <td style={tdR}>{r.orderCount}</td>
                <td style={tdR}>${r.totalSpend.toFixed(2)}</td>
                <td style={tdR}>{r.lastOrderDate}</td>
                <td style={tdR}>
                  <span
                    style={{
                      color:
                        r.daysSinceLastOrder > 90
                          ? "#c0392b"
                          : r.daysSinceLastOrder > 30
                          ? "#e67e22"
                          : "#27ae60",
                      fontWeight: 600,
                    }}
                  >
                    {r.daysSinceLastOrder}d
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
