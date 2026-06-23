#!/usr/bin/env node
// Run: node scanner.js
// Then open http://localhost:3000 in any browser (phone works too on same WiFi)

require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_FILE = path.join(__dirname, "receipts.json");
const HTML_FILE = path.join(__dirname, "index.html");
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("\n❌  ANTHROPIC_API_KEY is not set.");
  console.error("    Create a .env file with: ANTHROPIC_API_KEY=sk-ant-...\n");
  process.exit(1);
}

function loadReceipts() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}

function saveReceipts(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function parseReceipt(base64Image, mediaType, dateOverride) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Image },
          },
          {
            type: "text",
            text: `Parse this grocery receipt. Return ONLY valid JSON, no other text:
{
  "store_name": "store name or null",
  "purchased_at": "YYYY-MM-DD",
  "total_amount": 0.00,
  "items": [
    {
      "name": "item name",
      "category": "Protein|Grains|Vegetables|Fruits|Dairy|Beverages|Snacks|Household|Other",
      "quantity": 1,
      "unit": "lb/oz/kg/each/pack or null",
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ]
}

Categories:
- Protein: meat, poultry, fish, eggs, tofu, beans
- Grains: rice, quinoa, pasta, bread, oats, flour, cereal
- Vegetables: all vegetables
- Fruits: all fruits
- Dairy: milk, cheese, yogurt, butter
- Beverages: juice, water, coffee, tea, drinks, alcohol
- Snacks: chips, cookies, crackers, candy, nuts
- Household: cleaning, paper products, toiletries
- Other: everything else

Skip tax lines, payment lines, and totals. Only include purchased items.`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Claude response");
  const parsed = JSON.parse(match[0]);
  if (dateOverride) parsed.purchased_at = dateOverride;
  return parsed;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(HTML_FILE, "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/receipts") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(loadReceipts()));
    return;
  }

  if (req.method === "POST" && url.pathname === "/upload") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { base64, mediaType, date } = JSON.parse(body);
        const parsed = await parseReceipt(base64, mediaType || "image/jpeg", date || null);
        const receipt = {
          id: randomUUID(),
          store_name: parsed.store_name ?? null,
          purchased_at: parsed.purchased_at ?? new Date().toISOString().slice(0, 10),
          total_amount: parsed.total_amount ?? null,
          items: (parsed.items ?? []).map((item) => ({ ...item, id: randomUUID() })),
          created_at: new Date().toISOString(),
        };
        const receipts = loadReceipts();
        receipts.push(receipt);
        saveReceipts(receipts);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(receipt));
      } catch (e) {
        console.error(e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/receipts/")) {
    const id = url.pathname.split("/")[2];
    saveReceipts(loadReceipts().filter((r) => r.id !== id));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

const server = http.createServer(async (req, res) => {
  try { await handleRequest(req, res); }
  catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅  Receipt scanner is running!`);
  console.log(`\n    Computer:  http://localhost:${PORT}`);
  const nets = require("os").networkInterfaces();
  const ip = Object.values(nets).flat().find((n) => n.family === "IPv4" && !n.internal)?.address;
  if (ip) console.log(`    Phone:     http://${ip}:${PORT}  (must be on same WiFi)`);
  console.log(`\n    Press Ctrl+C to stop.\n`);
});
