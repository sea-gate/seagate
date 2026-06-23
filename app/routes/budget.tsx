import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { loadAllReceipts } from "~/lib/receipt-store.server";

const CATEGORY_COLORS: Record<string, string> = {
  Protein: "#e74c3c",
  Grains: "#e67e22",
  Vegetables: "#27ae60",
  Fruits: "#f39c12",
  Dairy: "#3498db",
  Beverages: "#9b59b6",
  Snacks: "#e91e63",
  Household: "#607d8b",
  Other: "#95a5a6",
};

type MonthSummary = {
  month: string;
  totalSpend: number;
  byCategory: Record<string, number>;
  topItems: { name: string; category: string; total: number }[];
};

export async function loader(_: LoaderFunctionArgs) {
  const receipts = await loadAllReceipts();

  const monthMap = new Map<string, { totalSpend: number; byCategory: Record<string, number>; itemMap: Map<string, { category: string; total: number }> }>();

  for (const receipt of receipts) {
    const month = receipt.purchased_at.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { totalSpend: 0, byCategory: {}, itemMap: new Map() });
    }
    const bucket = monthMap.get(month)!;

    for (const item of receipt.items) {
      bucket.totalSpend += item.total_price;
      bucket.byCategory[item.category] = (bucket.byCategory[item.category] ?? 0) + item.total_price;

      const key = item.name.toLowerCase().trim();
      const existing = bucket.itemMap.get(key);
      if (existing) {
        existing.total += item.total_price;
      } else {
        bucket.itemMap.set(key, { category: item.category, total: item.total_price });
      }
    }
  }

  const months: MonthSummary[] = [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, data]) => ({
      month,
      totalSpend: data.totalSpend,
      byCategory: data.byCategory,
      topItems: [...data.itemMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20),
    }));

  return json({ months, receiptCount: receipts.length });
}

export default function Budget() {
  const { months, receiptCount } = useLoaderData<typeof loader>();

  if (months.length === 0) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Food budget</h1>
        <p style={{ color: "#666" }}>No receipts yet.</p>
        <Link to="/receipts">Upload your first receipt →</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Food budget</h1>
        <Link to="/receipts" style={{ fontSize: "0.875rem" }}>+ Upload receipt</Link>
      </div>
      <p style={{ color: "#666", marginTop: 0 }}>
        {receiptCount} receipt{receiptCount !== 1 ? "s" : ""} scanned
      </p>

      {months.map((m) => (
        <section
          key={m.month}
          style={{
            marginBottom: "2.5rem",
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Month header */}
          <div
            style={{
              background: "#2c3e50",
              color: "#fff",
              padding: "0.75rem 1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong style={{ fontSize: "1.1rem" }}>{formatMonth(m.month)}</strong>
            <strong>${m.totalSpend.toFixed(2)}</strong>
          </div>

          {/* Category breakdown */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #eee" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#888", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              By category
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {Object.entries(m.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, total]) => (
                  <div
                    key={cat}
                    style={{
                      background: CATEGORY_COLORS[cat] ?? "#999",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "0.3rem 0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{cat}</span>
                    <span style={{ opacity: 0.85 }}> ${total.toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top items */}
          <div style={{ padding: "0.75rem 1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#888", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Top items
            </div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {m.topItems.map((item) => (
                  <tr key={item.name} style={{ borderBottom: "1px solid #f5f5f5" }}>
                    <td style={{ padding: "0.3rem 0", textTransform: "capitalize" }}>{item.name}</td>
                    <td style={{ padding: "0.3rem 0.5rem" }}>
                      <span
                        style={{
                          background: CATEGORY_COLORS[item.category] ?? "#999",
                          color: "#fff",
                          borderRadius: 4,
                          padding: "0.1rem 0.4rem",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: "0.3rem 0", textAlign: "right", fontWeight: 600 }}>
                      ${item.total.toFixed(2)}
                    </td>
                    <td style={{ padding: "0.3rem 0 0.3rem 0.75rem", width: 120 }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          background: CATEGORY_COLORS[item.category] ?? "#999",
                          width: `${Math.min(100, (item.total / m.topItems[0].total) * 100)}%`,
                          opacity: 0.7,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}

function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}
