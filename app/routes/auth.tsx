import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { env } from "~/lib/shopify.server";
import crypto from "node:crypto";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? env("SHOPIFY_SHOP");
  const clientId = env("SHOPIFY_CLIENT_ID");
  const scopes = env("SHOPIFY_SCOPES");
  const redirectUri = env("SHOPIFY_REDIRECT_URI");
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return redirect(authUrl.toString(), {
    headers: {
      "Set-Cookie": `shopify_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
}
