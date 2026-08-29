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
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
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
    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({
        success: false,
        error: "UNAUTHORIZED",
        message: "Missing bearer token."
      }, 401);
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({
        success: false,
        error: "UNAUTHORIZED",
        message: userError?.message || "Invalid session."
      }, 401);
    }
    const { data: clientUser, error: clientUserError } = await supabase.from("client_users").select("client_id, role, status").eq("user_id", userData.user.id).eq("status", "ACTIVE").maybeSingle();
    if (clientUserError) throw new Error(`client_users lookup failed: ${clientUserError.message}`);
    if (!clientUser) {
      return jsonResponse({
        success: false,
        error: "CLIENT_NOT_FOUND",
        message: "Login is not mapped to an active client."
      }, 404);
    }
    const { data: rows, error: pageError } = await supabase.from("fb_pages").select("*").eq("client_id", clientUser.client_id).order("created_at", {
      ascending: false
    });
    if (pageError) throw new Error(`fb_pages lookup failed: ${pageError.message}`);
    const pages = (rows || []).map((row)=>({
        fb_page_id: row.fb_page_id ?? null,
        page_name: row.page_name ?? row.fb_page_name ?? row.name ?? null,
        status: row.status ?? "ACTIVE",
        connected_at: row.connected_at ?? row.created_at ?? null,
        updated_at: row.updated_at ?? row.token_updated_at ?? null,
        token_present: Boolean(row.access_token)
      }));
    const activePages = pages.filter((page)=>String(page.status || "").toUpperCase() === "ACTIVE");
    return jsonResponse({
      success: true,
      client_id: clientUser.client_id,
      connected: activePages.length > 0,
      page_count: pages.length,
      active_page_count: activePages.length,
      pages
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "FACEBOOK_CONNECTION_STATUS_FAILED",
      message: getErrorMessage(error)
    }, 500);
  }
});
