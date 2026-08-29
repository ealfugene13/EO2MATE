import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const PAYMONGO_SETUP_URL = "https://dashboard.paymongo.com/signup";
const PAYMONGO_DASHBOARD_URL = "https://dashboard.paymongo.com/login";
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    }
  });
}
function getBearerToken(req) {
  const header = req.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
async function resolveClient(req) {
  const token = getBearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED: Missing bearer token.");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new Error(`UNAUTHORIZED: ${userError?.message || "Invalid session."}`);
  }
  const { data: clientUser, error } = await supabase.from("client_users").select("client_id, role, status").eq("user_id", userData.user.id).eq("status", "ACTIVE").maybeSingle();
  if (error) throw new Error(`client_users lookup failed: ${error.message}`);
  if (!clientUser) throw new Error("CLIENT_NOT_FOUND: Login is not mapped to an active client.");
  return clientUser;
}
Deno.serve(async (req)=>{
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        }
      });
    }
    if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "METHOD_NOT_ALLOWED"
      }, 405);
    }
    const clientUser = await resolveClient(req);
    let { data: account, error } = await supabase.from("client_payment_accounts").select("*").eq("client_id", clientUser.client_id).eq("provider", "PAYMONGO").maybeSingle();
    if (error) throw new Error(`client_payment_accounts lookup failed: ${error.message}`);
    if (!account) {
      const insertResult = await supabase.from("client_payment_accounts").insert({
        client_id: clientUser.client_id,
        provider: "PAYMONGO",
        account_status: "NOT_CONFIGURED",
        payment_enabled: false
      }).select("*").single();
      if (insertResult.error) {
        throw new Error(`client_payment_accounts insert failed: ${insertResult.error.message}`);
      }
      account = insertResult.data;
    }
    return jsonResponse({
      success: true,
      client_id: clientUser.client_id,
      provider: "PAYMONGO",
      account_status: account.account_status,
      paymongo_account_id: account.paymongo_account_id || null,
      payment_enabled: Boolean(account.payment_enabled),
      setup_url: PAYMONGO_SETUP_URL,
      dashboard_url: PAYMONGO_DASHBOARD_URL,
      online_checkout_available: String(account.account_status).toUpperCase() === "ACTIVE" && account.payment_enabled === true
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const unauthorized = message.startsWith("UNAUTHORIZED:");
    return jsonResponse({
      success: false,
      error: unauthorized ? "UNAUTHORIZED" : "CLIENT_PAYMENT_STATUS_FAILED",
      message
    }, unauthorized ? 401 : 500);
  }
});
