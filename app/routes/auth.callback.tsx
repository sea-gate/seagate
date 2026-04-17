import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import crypto from "node:crypto";
import { env, exchangeCodeForToken, saveToken } from "~/lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");
  const hmac = url.searchParams.get("hmac");

  if (!code || !shop || !state || !hmac) {
    throw new Response("Missing OAuth params", { status: 400 });
  }

  const cookie = request.headers.get("cookie") ?? "";
  const cookieState = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("shopify_oauth_state="))
    ?.split("=")[1];
  if (cookieState !== state) {
    throw new Response("State mismatch", { status: 400 });
  }

  if (!verifyHmac(url.searchParams, env("SHOPIFY_CLIENT_SECRET"))) {
    throw new Response("Invalid HMAC", { status: 400 });
  }

  const token = await exchangeCodeForToken({ shop, code });
  await saveToken(token);

  return redirect("/sell-through");
}

function verifyHmac(params: URLSearchParams, secret: string): boolean {
  const provided = params.get("hmac");
  if (!provided) return false;
  const entries: [string, string][] = [];
  params.forEach((v, k) => {
    if (k !== "hmac" && k !== "signature") entries.push([k, v]);
  });
  entries.sort(([a], [b]) => a.localeCompare(b));
  const message = entries.map(([k, v]) => `${k}=${v}`).join("&");
  const computed = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(computed));
}
