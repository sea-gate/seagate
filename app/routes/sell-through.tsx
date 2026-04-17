import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { fetchAllOrders, loadToken } from "~/lib/shopify.server";

type CustomerMonth = {
  customerId: number;
  name: string;
  email: string;
  month: string;
  orderCount: number;
  totalValue: number;
  avgDaysBetweenOrders: number | null;
};

export async function loader(_: LoaderFunctionArgs) {
  const token = await loadToken();
  if (!token) {
    return json({ needsAuth: true as const });
  }

  const orders = await fetchAllOrders({
    shop: token.shop,
    accessToken: token.accessToken,
    sinceDays: 365,
  });

  const bulk = orders.filter((o) => Number(o.total_price) >= 500 && o.customer);

  type Bucket = {
    customerId: number;
    name: string;
    email: string;
    month: string;
    dates: Date[];
    total: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const o of bulk) {
    const c = o.customer!;
    const created = new Date(o.created_at);
    const month = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = `${c.id}:${month}`;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || `#${c.id}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.dates.push(created);
      existing.total += Number(o.total_price);
    } else {
      buckets.set(key, {
        customerId: c.id,
        name,
        email: c.email ?? "",
        month,
        dates: [created],
        total: Number(o.total_price),
      });
    }
  }

  const rows: CustomerMonth[] = [...buckets.values()]
    .map((b) => {
      const sorted = b.dates.slice().sort((a, b) => a.getTime() - b.getTime());
      let avg: number | null = null;
      if (sorted.length > 1) {
        const gaps: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / 86400_000);
        }
        avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      }
      return {
        customerId: b.customerId,
        name: b.name,
        email: b.email,
        month: b.month,
        orderCount: b.dates.length,
        totalValue: b.total,
        avgDaysBetweenOrders: avg,
      };
    })
    .sort((a, b) => (b.month === a.month ? b.totalValue - a.totalValue : b.month.localeCompare(a.month)));

  return json({ needsAuth: false as const, shop: token.shop, rows });
}

export default function SellThrough() {
  const data = useLoaderData<typeof loader>();

  if (data.needsAuth) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Sell-through analytics</h1>
        <p>Not connected to Shopify yet.</p>
        <Link to="/auth">Connect Shopify →</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Order cadence — bulk customers (≥ $500)</h1>
      <p style={{ color: "#666" }}>Store: {data.shop} · last 365 days</p>
      {data.rows.length === 0 ? (
        <p>No bulk orders found.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem" }}>Month</th>
              <th style={{ padding: "0.5rem" }}>Customer</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>Orders</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>Total $</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>Avg days between</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={`${r.customerId}-${r.month}`} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "0.5rem" }}>{r.month}</td>
                <td style={{ padding: "0.5rem" }}>
                  {r.name}
                  {r.email ? <span style={{ color: "#888" }}> · {r.email}</span> : null}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{r.orderCount}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>${r.totalValue.toFixed(2)}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                  {r.avgDaysBetweenOrders == null ? "—" : r.avgDaysBetweenOrders.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
