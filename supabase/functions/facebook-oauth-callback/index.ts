import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const META_APP_ID = Deno.env.get("META_APP_ID");
const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
const FRONTEND_URL = "https://ealfugene13.github.io/EO2MATE/";
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;
/* =========================================================
   ENVIRONMENT VALIDATION
   ========================================================= */ if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}
if (!META_APP_ID) {
  throw new Error("Missing META_APP_ID");
}
if (!META_APP_SECRET) {
  throw new Error("Missing META_APP_SECRET");
}
/* =========================================================
   SUPABASE ADMIN CLIENT
   ========================================================= */ const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
console.info("facebook-oauth-callback started");
/* =========================================================
   SERVER
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -------------------------------------------------------
       CALLBACK MUST BE GET
       ------------------------------------------------------- */ if (req.method !== "GET") {
      return htmlResponse(`
        <h2>OAuth error</h2>

        <p>
          Facebook OAuth callback must use GET.
        </p>
        `, 405);
    }
    const requestUrl = new URL(req.url);
    /* -------------------------------------------------------
       FACEBOOK CALLBACK PARAMETERS
       ------------------------------------------------------- */ const code = requestUrl.searchParams.get("code");
    const stateToken = requestUrl.searchParams.get("state");
    const facebookError = requestUrl.searchParams.get("error");
    const facebookErrorDescription = requestUrl.searchParams.get("error_description");
    /* -------------------------------------------------------
       FACEBOOK CANCELLED / ERROR
       ------------------------------------------------------- */ if (facebookError) {
      console.error("Facebook OAuth error:", facebookError, facebookErrorDescription);
      return htmlResponse(`
        <h2>
          Facebook connection cancelled
        </h2>

        <p>
          ${escapeHtml(facebookErrorDescription || facebookError)}
        </p>

        <p>
          Please return to Auctomation
          and try again.
        </p>
        `, 400);
    }
    /* -------------------------------------------------------
       VALIDATE CODE
       ------------------------------------------------------- */ if (!code) {
      return htmlResponse(`
        <h2>OAuth error</h2>

        <p>
          Missing Facebook authorization code.
        </p>
        `, 400);
    }
    /* -------------------------------------------------------
       VALIDATE STATE
       ------------------------------------------------------- */ if (!stateToken) {
      return htmlResponse(`
        <h2>OAuth error</h2>

        <p>
          Missing OAuth state.
        </p>
        `, 400);
    }
    /* -------------------------------------------------------
       LOOK UP OAUTH STATE
       ------------------------------------------------------- */ const { data: oauthState, error: stateLookupError } = await supabaseAdmin.from("facebook_oauth_states").select(`
          state_id,
          client_id,
          state_token,
          expires_at,
          used_at
        `).eq("state_token", stateToken).maybeSingle();
    if (stateLookupError) {
      console.error("OAuth state lookup error:", stateLookupError);
      throw new Error(`OAuth state lookup error: ${stateLookupError.message}`);
    }
    if (!oauthState) {
      return htmlResponse(`
        <h2>OAuth error</h2>

        <p>
          Invalid OAuth state.
        </p>
        `, 400);
    }
    /* -------------------------------------------------------
       CHECK IF STATE WAS ALREADY USED
       ------------------------------------------------------- */ if (oauthState.used_at) {
      return htmlResponse(`
        <h2>OAuth error</h2>

        <p>
          This OAuth request has already been used.
        </p>
        `, 400);
    }
    /* -------------------------------------------------------
       CHECK STATE EXPIRATION
       ------------------------------------------------------- */ if (new Date(oauthState.expires_at).getTime() < Date.now()) {
      return htmlResponse(`
        <h2>OAuth error</h2>

        <p>
          The OAuth request has expired.
          Please start the connection again.
        </p>
        `, 400);
    }
    const clientId = String(oauthState.client_id);
    console.info("OAuth state validated for client:", clientId);
    /* -------------------------------------------------------
       MARK STATE AS USED
       ------------------------------------------------------- */ const { error: markUsedError } = await supabaseAdmin.from("facebook_oauth_states").update({
      used_at: new Date().toISOString()
    }).eq("state_id", oauthState.state_id).is("used_at", null);
    if (markUsedError) {
      console.error("Unable to mark OAuth state used:", markUsedError);
      throw new Error(`Unable to mark OAuth state used: ${markUsedError.message}`);
    }
    /* -------------------------------------------------------
       EXCHANGE AUTHORIZATION CODE
       ------------------------------------------------------- */ const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", META_APP_ID);
    tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", CALLBACK_URL);
    tokenUrl.searchParams.set("code", code);
    console.info("Exchanging Facebook authorization code...");
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Facebook token exchange failed:", tokenData);
      throw new Error(`Facebook token exchange failed: ${JSON.stringify(tokenData)}`);
    }
    const userAccessToken = String(tokenData.access_token);
    console.info("Facebook authorization code exchanged successfully.");
    /* -------------------------------------------------------
       GET FACEBOOK USER
       ------------------------------------------------------- */ const meUrl = new URL("https://graph.facebook.com/v23.0/me");
    meUrl.searchParams.set("fields", "id,name");
    meUrl.searchParams.set("access_token", userAccessToken);
    const meResponse = await fetch(meUrl.toString());
    const meData = await meResponse.json();
    if (!meResponse.ok || !meData.id) {
      console.error("Unable to retrieve Facebook user:", meData);
      throw new Error(`Unable to retrieve Facebook user: ${JSON.stringify(meData)}`);
    }
    console.info("Facebook user:", meData.id, meData.name);
    /* -------------------------------------------------------
       GET FACEBOOK PAGES
       ------------------------------------------------------- */ const pagesUrl = new URL("https://graph.facebook.com/v23.0/me/accounts");
    pagesUrl.searchParams.set("fields", "id,name,access_token");
    pagesUrl.searchParams.set("access_token", userAccessToken);
    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();
    if (!pagesResponse.ok) {
      console.error("Unable to retrieve Facebook Pages:", pagesData);
      throw new Error(`Unable to retrieve Facebook Pages: ${JSON.stringify(pagesData)}`);
    }
    const pages = Array.isArray(pagesData.data) ? pagesData.data : [];
    console.info(`Facebook returned ${pages.length} Page(s)`);
    /* =======================================================
       PROCESS FACEBOOK PAGES
       ======================================================= */ const savedPages = [];
    for (const page of pages){
      if (!page?.id) {
        continue;
      }
      const fbPageId = String(page.id);
      const pageName = page.name || "Facebook Page";
      const pageAccessToken = page.access_token ? String(page.access_token) : null;
      if (!pageAccessToken) {
        console.warn("Facebook did not return Page access token:", fbPageId, pageName);
        continue;
      }
      /* -----------------------------------------------------
         VALIDATE PAGE ACCESS TOKEN
         ----------------------------------------------------- */ const debugUrl = new URL("https://graph.facebook.com/v23.0/debug_token");
      debugUrl.searchParams.set("input_token", pageAccessToken);
      debugUrl.searchParams.set("access_token", `${META_APP_ID}|${META_APP_SECRET}`);
      let tokenExpiresAt = null;
      let tokenIsValid = false;
      try {
        const debugResponse = await fetch(debugUrl.toString());
        const debugData = await debugResponse.json();
        if (debugResponse.ok && debugData?.data?.is_valid === true) {
          tokenIsValid = true;
          if (debugData.data.expires_at) {
            const expiresAtUnix = Number(debugData.data.expires_at);
            if (Number.isFinite(expiresAtUnix) && expiresAtUnix > 0) {
              tokenExpiresAt = new Date(expiresAtUnix * 1000).toISOString();
            }
          }
          console.info("Page token validated:", fbPageId, pageName);
        } else {
          console.error("Page token validation failed:", fbPageId, pageName, debugData);
        }
      } catch (tokenValidationError) {
        console.error("Page token validation request failed:", getErrorMessage(tokenValidationError));
      }
      /* -----------------------------------------------------
         PREPARE PAGE RECORD
         ----------------------------------------------------- */ const now = new Date().toISOString();
      const pageRecord = {
        client_id: clientId,
        fb_page_id: fbPageId,
        page_nm: pageName,
        status: "ACTIVE",
        access_token: pageAccessToken,
        token_expires_at: tokenExpiresAt,
        connection_status: tokenIsValid ? "ACTIVE" : "ERROR",
        last_token_error: tokenIsValid ? null : "Unable to validate Facebook Page access token.",
        connected_at: now,
        updated_at: now
      };
      /* =====================================================
         UPSERT FACEBOOK PAGE
         =====================================================

         IMPORTANT:

         fb_page_id is globally unique.

         Therefore we use fb_page_id as the conflict target.

         If this Facebook Page already exists:
             UPDATE the existing row.

         If it does not exist:
             INSERT a new row.

         This prevents:
         uq_fb_pages_fb_page_id duplicate key errors.
         ===================================================== */ console.info("Saving Facebook Page:", {
        fb_page_id: fbPageId,
        page_nm: pageName,
        client_id: clientId
      });
      const { data: savedPage, error: upsertError } = await supabaseAdmin.from("fb_pages").upsert(pageRecord, {
        onConflict: "fb_page_id"
      }).select(`
            page_id,
            client_id,
            fb_page_id,
            page_nm,
            status,
            connection_status,
            token_expires_at
          `).single();
      if (upsertError) {
        console.error("Page upsert error:", upsertError);
        throw new Error(`Page upsert error: ${upsertError.message}`);
      }
      if (!savedPage) {
        throw new Error(`Page upsert returned no record for Facebook Page ${fbPageId}`);
      }
      console.info("Facebook Page saved successfully:", {
        page_id: savedPage.page_id,
        fb_page_id: savedPage.fb_page_id,
        page_nm: savedPage.page_nm,
        client_id: savedPage.client_id,
        connection_status: savedPage.connection_status
      });
      savedPages.push({
        page_id: savedPage.page_id,
        fb_page_id: savedPage.fb_page_id,
        page_nm: savedPage.page_nm,
        client_id: savedPage.client_id,
        connection_status: savedPage.connection_status,
        token_expires_at: savedPage.token_expires_at
      });
    }
    /* -------------------------------------------------------
       NO USABLE PAGE
       ------------------------------------------------------- */ if (savedPages.length === 0) {
      return htmlResponse(`
        <h2>
          Facebook account connected,
          but no usable Page was found
        </h2>

        <p>
          Facebook account:
          <strong>
            ${escapeHtml(meData.name || meData.id)}
          </strong>
        </p>

        <p>
          No usable Facebook Page access token
          was returned.
        </p>

        <p>
          Please verify that this Facebook account
          has the required access to the Page.
        </p>
        `, 400);
    }
    /* =======================================================
       SUCCESS REDIRECT
       ======================================================= */ const frontendRedirect = new URL(FRONTEND_URL);
    frontendRedirect.searchParams.set("client_id", clientId);
    frontendRedirect.searchParams.set("facebook_connected", "true");
    frontendRedirect.searchParams.set("pages_connected", String(savedPages.length));
    console.info("Facebook OAuth successful.");
    console.info("Client:", clientId);
    console.info("Pages connected:", savedPages.length);
    console.info("Redirecting browser to:", frontendRedirect.toString());
    return Response.redirect(frontendRedirect.toString(), 302);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error("facebook-oauth-callback error:", errorMessage, error);
    return htmlResponse(`
      <h2>
        Facebook connection failed
      </h2>

      <pre>
${escapeHtml(errorMessage)}
      </pre>

      <p>
        Please return to Auctomation
        and try again.
      </p>
      `, 500);
  }
});
/* =========================================================
   ERROR MESSAGE NORMALIZER
   ========================================================= */ function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error;
    if (typeof obj.message === "string") {
      return obj.message;
    }
    try {
      return JSON.stringify(error, null, 2);
    } catch  {
      return "Unknown object error";
    }
  }
  return String(error);
}
/* =========================================================
   HTML RESPONSE
   ========================================================= */ function htmlResponse(html, status = 200) {
  return new Response(`<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>
    Auctomation - Facebook Connection
  </title>

</head>


<body style="
  font-family: Arial, sans-serif;
  max-width: 700px;
  margin: 50px auto;
  padding: 20px;
">

${html}

</body>

</html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
/* =========================================================
   HTML ESCAPING
   ========================================================= */ function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
