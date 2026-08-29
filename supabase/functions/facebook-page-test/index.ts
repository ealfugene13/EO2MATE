import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// TEMPORARY TEST CLIENT
const TEST_CLIENT_ID = "ad241271-ad44-4a25-840d-84c71aae1126";
const GRAPH_API_VERSION = "v23.0";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  }
  try {
    // -------------------------------------------------------
    // USE OUR EXISTING TEST CLIENT
    // -------------------------------------------------------
    const clientId = TEST_CLIENT_ID;
    // -------------------------------------------------------
    // FIND FACEBOOK PAGE
    // -------------------------------------------------------
    const { data: page, error: pageError } = await supabaseAdmin.from("fb_pages").select(`
          page_id,
          client_id,
          fb_page_id,
          page_nm,
          status,
          connection_status,
          access_token,
          token_expires_at,
          connected_at,
          last_token_error
        `).eq("client_id", clientId).eq("status", "ACTIVE").limit(1).maybeSingle();
    if (pageError) {
      console.error("Database error:", pageError);
      return jsonResponse({
        success: false,
        error: "DATABASE_ERROR",
        message: pageError.message
      }, 500);
    }
    if (!page) {
      return jsonResponse({
        success: false,
        error: "PAGE_NOT_FOUND",
        message: "No ACTIVE Facebook Page was found for the test client.",
        client_id: clientId
      }, 404);
    }
    // -------------------------------------------------------
    // CHECK TOKEN
    // -------------------------------------------------------
    if (!page.access_token) {
      return jsonResponse({
        success: false,
        error: "NO_ACCESS_TOKEN",
        message: "The Page exists but access_token is NULL.",
        client_id: clientId,
        fb_page_id: page.fb_page_id,
        page_name: page.page_nm
      }, 400);
    }
    // -------------------------------------------------------
    // CALL FACEBOOK GRAPH API
    // -------------------------------------------------------
    const graphUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${page.fb_page_id}`);
    graphUrl.searchParams.set("fields", "id,name");
    graphUrl.searchParams.set("access_token", page.access_token);
    console.log("Calling Facebook Graph API for Page:", page.fb_page_id);
    const graphResponse = await fetch(graphUrl.toString());
    const graphText = await graphResponse.text();
    let graphData;
    try {
      graphData = JSON.parse(graphText);
    } catch  {
      graphData = {
        raw_response: graphText
      };
    }
    // -------------------------------------------------------
    // FACEBOOK ERROR
    // -------------------------------------------------------
    if (!graphResponse.ok) {
      console.error("Facebook API error:", graphData);
      const graphError = typeof graphData.error === "object" && graphData.error !== null ? graphData.error : null;
      const errorMessage = typeof graphError?.message === "string" ? graphError.message : "Facebook Graph API request failed.";
      await supabaseAdmin.from("fb_pages").update({
        connection_status: "ERROR",
        last_token_error: errorMessage,
        updated_at: new Date().toISOString()
      }).eq("page_id", page.page_id);
      return jsonResponse({
        success: false,
        facebook_connected: false,
        error: "FACEBOOK_GRAPH_API_ERROR",
        http_status: graphResponse.status,
        message: errorMessage,
        facebook_error: graphError,
        client_id: clientId,
        fb_page_id: page.fb_page_id,
        page_name: page.page_nm
      }, 401);
    }
    // -------------------------------------------------------
    // FACEBOOK SUCCESS
    // -------------------------------------------------------
    await supabaseAdmin.from("fb_pages").update({
      connection_status: "ACTIVE",
      last_token_error: null,
      updated_at: new Date().toISOString()
    }).eq("page_id", page.page_id);
    return jsonResponse({
      success: true,
      facebook_connected: true,
      message: "Facebook Page access token is valid and the Page is accessible.",
      client: {
        client_id: page.client_id
      },
      page: {
        database_page_id: page.page_id,
        fb_page_id: page.fb_page_id,
        stored_page_name: page.page_nm,
        facebook_page_id: graphData.id ?? null,
        facebook_page_name: graphData.name ?? null
      },
      connection: {
        status: "ACTIVE",
        connected_at: page.connected_at,
        token_expires_at: page.token_expires_at
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({
      success: false,
      error: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unexpected server error."
    }, 500);
  }
});
