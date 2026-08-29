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
Deno.serve(async (req)=>{
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      });
    }
    if (req.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "METHOD_NOT_ALLOWED"
      }, 405);
    }
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({
        success: false,
        error: "UNAUTHORIZED"
      }, 401);
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({
        success: false,
        error: "UNAUTHORIZED"
      }, 401);
    }
    const { data: clientUser, error: clientUserError } = await supabase.from("client_users").select("client_id").eq("user_id", userData.user.id).eq("status", "ACTIVE").maybeSingle();
    if (clientUserError) throw new Error(clientUserError.message);
    if (!clientUser) return jsonResponse({
      success: false,
      error: "CLIENT_NOT_FOUND"
    }, 404);
    const { data, error } = await supabase.from("client_payment_accounts").upsert({
      client_id: clientUser.client_id,
      provider: "PAYMONGO",
      account_status: "ACCOUNT_CREATED",
      payment_enabled: false,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "client_id,provider"
    }).select("*").single();
    if (error) throw new Error(`payment account update failed: ${error.message}`);
    return jsonResponse({
      success: true,
      provider: "PAYMONGO",
      account_status: data.account_status,
      paymongo_account_id: data.paymongo_account_id || null,
      payment_enabled: Boolean(data.payment_enabled),
      setup_url: "https://dashboard.paymongo.com/signup",
      dashboard_url: "https://dashboard.paymongo.com/login",
      message: "PayMongo account recorded. Automated checkout remains disabled until the account is linked and activated for this client."
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "MARK_PAYMONGO_ACCOUNT_CREATED_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
