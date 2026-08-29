import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
/* =========================================================
   CORS
   ========================================================= */ const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};
/* =========================================================
   RESPONSE
   ========================================================= */ function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
/* =========================================================
   SERVER
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -----------------------------------------------------
         CORS
         ----------------------------------------------------- */ if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders
      });
    }
    /* -----------------------------------------------------
         METHOD
         ----------------------------------------------------- */ if (req.method !== "GET") {
      return jsonResponse({
        success: false,
        error: "Method Not Allowed"
      }, 405);
    }
    /* -----------------------------------------------------
         CLIENT ID
         ----------------------------------------------------- */ const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");
    if (!clientId) {
      return jsonResponse({
        success: false,
        error: "client_id is required."
      }, 400);
    }
    /* -----------------------------------------------------
         VALIDATE CLIENT
         ----------------------------------------------------- */ const { data: client, error: clientError } = await supabase.from("master_clients").select("client_id, name, status").eq("client_id", clientId).maybeSingle();
    if (clientError) {
      throw new Error(`master_clients lookup failed: ${clientError.message}`);
    }
    if (!client) {
      return jsonResponse({
        success: false,
        error: "Client was not found."
      }, 404);
    }
    /* -----------------------------------------------------
         FACEBOOK PAGES
         ----------------------------------------------------- */ const { data: pages, error: pagesError } = await supabase.from("fb_pages").select(`
              page_id,
              fb_page_id,
              page_nm,
              status,
              connection_status,
              connected_at
            `).eq("client_id", clientId).order("created_at", {
      ascending: true
    });
    if (pagesError) {
      throw new Error(`fb_pages lookup failed: ${pagesError.message}`);
    }
    /*
       * SECURITY:
       *
       * We intentionally DO NOT return:
       *
       * access_token
       * token_expires_at
       * last_token_error
       */ return jsonResponse({
      success: true,
      client: {
        client_id: client.client_id,
        name: client.name,
        status: client.status
      },
      pages: pages || []
    });
  } catch (error) {
    console.error("CLIENT PAGES ERROR", error);
    return jsonResponse({
      success: false,
      error: String(error)
    }, 500);
  }
});
