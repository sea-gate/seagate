import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { loadReceipt } from "~/lib/receipt-store.server";

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

export async function loader({ params }: LoaderFunctionArgs) {
  const receipt = await loadReceipt(params.id!);
  if (!receipt) throw new Response("Receipt not found", { status: 404 });
  return json({ receipt });
}

export default function ReceiptDetail() {
  const { receipt } = useLoaderData<typeof loader>();

  const byCategory = receipt.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.total_price;
    return acc;
  }, {});

  const td: React.CSSProperties = { padding: "0.45rem 0.75rem", borderBottom: "1px solid #f0f0f0" };
  const tdR: React.CSSProperties = { ...td, textAlign: "right" };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
      <Link to="/receipts" style={{ fontSize: "0.85rem", color: "#666" }}>← All receipts</Link>

      <h1 style={{ marginBottom: "0.15rem", marginTop: "0.75rem" }}>
        {receipt.store_name ?? "Receipt"}
      </h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        {receipt.purchased_at}
        {receipt.total_amount != null && (
          <> · <strong>${receipt.total_amount.toFixed(2)} total</strong></>
        )}
      </p>

      {/* Category summary pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, total]) => (
            <span
              key={cat}
              style={{
                background: CATEGORY_COLORS[cat] ?? "#999",
                color: "#fff",
                borderRadius: 20,
                padding: "0.25rem 0.75rem",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {cat} · ${total.toFixed(2)}
            </span>
          ))}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
            <th style={{ padding: "0.45rem 0.75rem" }}>Item</th>
            <th style={{ padding: "0.45rem 0.75rem" }}>Category</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "right" }}>Qty</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "right" }}>Unit price</th>
            <th style={{ padding: "0.45rem 0.75rem", textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item) => (
            <tr key={item.id}>
              <td style={td}>{item.name}</td>
              <td style={td}>
                <span
                  style={{
                    background: CATEGORY_COLORS[item.category] ?? "#999",
                    color: "#fff",
                    borderRadius: 4,
                    padding: "0.1rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {item.category}
                </span>
              </td>
              <td style={tdR}>
                {item.quantity}{item.unit ? ` ${item.unit}` : ""}
              </td>
              <td style={tdR}>
                {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : "—"}
              </td>
              <td style={tdR}>${item.total_price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "1.5rem" }}>
        <Link to="/budget" style={{ marginRight: "1rem" }}>View monthly budget →</Link>
        <Link to="/receipts">Upload another receipt →</Link>
      </div>
    </main>
  );
}
