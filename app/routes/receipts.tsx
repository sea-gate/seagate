import {
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
  redirect,
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Form, Link, useActionData, useNavigation, useLoaderData } from "@remix-run/react";
import { randomUUID } from "node:crypto";
import { parseReceiptImage } from "~/lib/claude.server";
import { saveReceipt, loadAllReceipts } from "~/lib/receipt-store.server";

export async function loader(_: LoaderFunctionArgs) {
  const receipts = await loadAllReceipts();
  return json({ receipts });
}

export async function action({ request }: ActionFunctionArgs) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY is not set in your .env file." }, { status: 500 });
  }

  const uploadHandler = unstable_createMemoryUploadHandler({ maxPartSize: 15_000_000 });
  const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  const file = formData.get("receipt") as File | null;
  const dateOverride = formData.get("date") as string | null;

  if (!file || file.size === 0) {
    return json({ error: "Please select a receipt image." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mediaType = file.type || "image/jpeg";

  let parsed;
  try {
    parsed = await parseReceiptImage(base64, mediaType);
  } catch (e) {
    return json({ error: `Could not parse receipt: ${String(e)}` }, { status: 500 });
  }

  const receipt = await saveReceipt({
    store_name: parsed.store_name,
    purchased_at: dateOverride || parsed.purchased_at || new Date().toISOString().slice(0, 10),
    total_amount: parsed.total_amount,
    items: parsed.items.map((item) => ({ ...item, id: randomUUID() })),
  });

  return redirect(`/receipts/${receipt.id}`);
}

export default function Receipts() {
  const { receipts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const uploading = nav.state === "submitting";

  const label: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    marginBottom: "0.35rem",
    fontSize: "0.875rem",
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Receipt scanner</h1>
        <Link to="/budget" style={{ fontSize: "0.875rem" }}>View budget →</Link>
      </div>
      <p style={{ color: "#666", marginTop: 0 }}>
        Upload a photo of a grocery receipt and we'll log every item automatically.
      </p>

      <Form
        method="post"
        encType="multipart/form-data"
        style={{
          background: "#f8f8f8",
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ marginBottom: "1rem" }}>
          <label style={label} htmlFor="receipt">Receipt photo</label>
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/*"
            capture="environment"
            required
            style={{ display: "block" }}
          />
        </div>
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={label} htmlFor="date">
            Date <span style={{ fontWeight: 400, color: "#888" }}>(optional — overrides what's on the receipt)</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            style={{
              padding: "0.4rem 0.6rem",
              border: "1px solid #ccc",
              borderRadius: 4,
              fontSize: "0.9rem",
            }}
          />
        </div>
        {actionData?.error && (
          <p style={{ color: "#c0392b", marginBottom: "1rem" }}>{actionData.error}</p>
        )}
        <button
          type="submit"
          disabled={uploading}
          style={{
            background: uploading ? "#aaa" : "#2c3e50",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "0.6rem 1.4rem",
            fontSize: "1rem",
            cursor: uploading ? "default" : "pointer",
          }}
        >
          {uploading ? "Scanning receipt…" : "Scan receipt"}
        </button>
      </Form>

      {receipts.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Past receipts</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "0.4rem 0.75rem" }}>Date</th>
                <th style={{ padding: "0.4rem 0.75rem" }}>Store</th>
                <th style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>Items</th>
                <th style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>Total</th>
                <th style={{ padding: "0.4rem 0.75rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "0.4rem 0.75rem" }}>{r.purchased_at}</td>
                  <td style={{ padding: "0.4rem 0.75rem" }}>{r.store_name ?? "—"}</td>
                  <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>{r.items.length}</td>
                  <td style={{ padding: "0.4rem 0.75rem", textAlign: "right" }}>
                    {r.total_amount != null ? `$${r.total_amount.toFixed(2)}` : "—"}
                  </td>
                  <td style={{ padding: "0.4rem 0.75rem" }}>
                    <Link to={`/receipts/${r.id}`} style={{ fontSize: "0.85rem" }}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
