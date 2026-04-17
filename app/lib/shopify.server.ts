import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const TOKEN_PATH = ".data/shopify-token.json";

type StoredToken = {
  shop: string;
  accessToken: string;
  scope: string;
  savedAt: string;
};

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function apiVersion() {
  return "2025-01";
}

export async function saveToken(token: StoredToken): Promise<void> {
  await mkdir(dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), "utf8");
}

export async function loadToken(): Promise<StoredToken | null> {
  try {
    const raw = await readFile(TOKEN_PATH, "utf8");
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(params: {
  shop: string;
  code: string;
}): Promise<StoredToken> {
  const { shop, code } = params;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env("SHOPIFY_CLIENT_ID"),
      client_secret: env("SHOPIFY_CLIENT_SECRET"),
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; scope: string };
  return {
    shop,
    accessToken: json.access_token,
    scope: json.scope,
    savedAt: new Date().toISOString(),
  };
}

type ShopifyOrder = {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  customer: { id: number; first_name?: string; last_name?: string; email?: string } | null;
};

export async function fetchAllOrders(params: {
  shop: string;
  accessToken: string;
  sinceDays?: number;
}): Promise<ShopifyOrder[]> {
  const { shop, accessToken, sinceDays = 365 } = params;
  const createdAtMin = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const base = `https://${shop}/admin/api/${apiVersion()}`;
  let url: string | null =
    `${base}/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`;
  const all: ShopifyOrder[] = [];
  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Orders fetch failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { orders: ShopifyOrder[] };
    all.push(...data.orders);
    url = parseNextLink(res.headers.get("link"));
  }
  return all;
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const p of parts) {
    const m = p.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}
