import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const META_APP_ID = Deno.env.get("META_APP_ID");
const META_CONFIG_ID = Deno.env.get("META_CONFIG_ID");
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;
if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}
if (!META_APP_ID) {
  throw new Error("Missing META_APP_ID");
}
if (!META_CONFIG_ID) {
  throw new Error("Missing META_CONFIG_ID");
}
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
console.info("facebook-oauth-start started");
/* =========================================================
   CORS
   ========================================================= */ const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
/* =========================================================
   SERVER
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -----------------------------------------------------
         CORS PREFLIGHT
         ----------------------------------------------------- */ if (req.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: corsHeaders
      });
    }
    /* -----------------------------------------------------
         METHOD
         ----------------------------------------------------- */ if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use GET or POST."
      }, 405);
    }
    /* -----------------------------------------------------
         GET / POST CLIENT ID
         -----------------------------------------------------

         GET:
         ?client_id=CLIENT_UUID

         POST:
         {
           "client_id": "CLIENT_UUID"
         }

         GET is intended for browser/frontend use.

         POST is useful for direct API testing.
         ----------------------------------------------------- */ let clientId = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      clientId = url.searchParams.get("client_id");
    }
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.client_id) {
          clientId = String(body.client_id).trim();
        }
      } catch  {
      /*
           * Ignore invalid/empty JSON.
           *
           * MISSING_CLIENT_ID is returned below.
           */ }
    }
    if (!clientId) {
      return jsonResponse({
        success: false,
        error: "MISSING_CLIENT_ID",
        message: "client_id is required. Use ?client_id=YOUR_CLIENT_UUID or send it in the JSON body."
      }, 400);
    }
    /* -----------------------------------------------------
         VERIFY CLIENT
         ----------------------------------------------------- */ const { data: client, error: clientError } = await supabaseAdmin.from("master_clients").select(`
            client_id,
            name,
            status
            `).eq("client_id", clientId).maybeSingle();
    if (clientError) {
      console.error("Client lookup error:", clientError);
      return jsonResponse({
        success: false,
        error: "CLIENT_LOOKUP_ERROR",
        message: clientError.message
      }, 500);
    }
    if (!client) {
      return jsonResponse({
        success: false,
        error: "CLIENT_NOT_FOUND",
        message: "The specified client does not exist.",
        client_id: clientId
      }, 404);
    }
    if (client.status !== "ACTIVE") {
      return jsonResponse({
        success: false,
        error: "CLIENT_NOT_ACTIVE",
        message: "This client is not active.",
        client_id: clientId
      }, 403);
    }
    /* -----------------------------------------------------
         GENERATE SECURE STATE
         ----------------------------------------------------- */ const stateBytes = new Uint8Array(32);
    crypto.getRandomValues(stateBytes);
    const stateToken = Array.from(stateBytes).map((byte)=>byte.toString(16).padStart(2, "0")).join("");
    /* -----------------------------------------------------
         STATE EXPIRY
         -----------------------------------------------------

         OAuth state is valid for 10 minutes.
         ----------------------------------------------------- */ const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    /* -----------------------------------------------------
         SAVE OAUTH STATE
         ----------------------------------------------------- */ const { error: stateError } = await supabaseAdmin.from("facebook_oauth_states").insert({
      client_id: clientId,
      state_token: stateToken,
      expires_at: expiresAt,
      used_at: null
    });
    if (stateError) {
      console.error("OAuth state insert error:", stateError);
      return jsonResponse({
        success: false,
        error: "OAUTH_STATE_CREATE_FAILED",
        message: stateError.message
      }, 500);
    }
    /* -----------------------------------------------------
         BUILD FACEBOOK LOGIN FOR BUSINESS URL
         ----------------------------------------------------- */ const facebookUrl = new URL("https://www.facebook.com/v23.0/dialog/oauth");
    facebookUrl.searchParams.set("client_id", META_APP_ID);
    facebookUrl.searchParams.set("redirect_uri", CALLBACK_URL);
    facebookUrl.searchParams.set("state", stateToken);
    facebookUrl.searchParams.set("config_id", META_CONFIG_ID);
    facebookUrl.searchParams.set("response_type", "code");
    const authorizationUrl = facebookUrl.toString();
    console.info("Facebook authorization created", {
      clientId,
      clientName: client.name,
      expiresAt
    });
    /* =====================================================
         GET
         =====================================================

         Browser/frontend flow.

         Redirect directly to Facebook.

         Auctomation website
              ↓
         facebook-oauth-start
              ↓
         Facebook OAuth
         ===================================================== */ if (req.method === "GET") {
      console.info("Redirecting browser to Facebook OAuth", {
        clientId
      });
      return Response.redirect(authorizationUrl, 302);
    }
    /* =====================================================
         POST
         =====================================================

         API/test flow.

         Keep returning the authorization URL as JSON.
         ===================================================== */ return jsonResponse({
      success: true,
      client_id: clientId,
      client_name: client.name,
      expires_at: expiresAt,
      authorization_url: authorizationUrl
    }, 200);
  } catch (error) {
    console.error("facebook-oauth-start error:", error);
    return jsonResponse({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
/* =========================================================
   JSON RESPONSE
   ========================================================= */ function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
