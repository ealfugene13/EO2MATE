import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function json(data, status = 200) {
  return Response.json(data, {
    status
  });
}
function getString(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}
async function getUser(req) {
  const auth = req.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
async function getClientMembership(userId, clientId) {
  const { data, error } = await supabase.from("client_users").select("*").eq("user_id", userId).eq("client_id", clientId).eq("status", "ACTIVE").maybeSingle();
  if (error) throw new Error(`client_users lookup failed: ${error.message}`);
  return data;
}
function normalizeRole(membership) {
  return String(membership?.role || membership?.user_role || "").trim().toUpperCase();
}
async function findPage(clientId, fbPageId) {
  const { data, error } = await supabase.from("fb_pages").select("*").eq("client_id", clientId).eq("fb_page_id", fbPageId).maybeSingle();
  if (error) throw new Error(`fb_pages lookup failed: ${error.message}`);
  return data;
}
async function findAuctionPost(clientId, postRef) {
  let query = supabase.from("auction_posts").select("*").eq("client_id", clientId);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postRef)) {
    query = query.eq("post_id", postRef);
  } else {
    query = query.eq("fb_post_id", postRef);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`auction_posts lookup failed: ${error.message}`);
  return data;
}
async function setControl(params) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("eo2mate_automation_controls").upsert({
    client_id: params.clientId,
    scope_type: params.scopeType,
    scope_id: params.scopeId,
    is_enabled: params.enabled,
    reason: params.reason,
    changed_by_user_id: params.userId,
    changed_by_fb_page_id: null,
    changed_at: now,
    updated_at: now
  }, {
    onConflict: "client_id,scope_type,scope_id"
  }).select("*").single();
  if (error) {
    throw new Error(`automation control update failed: ${error.message}`);
  }
  return data;
}
async function listControls(clientId) {
  const [{ data: controls, error: controlError }, { data: pages, error: pageError }] = await Promise.all([
    supabase.from("eo2mate_automation_controls").select("*").eq("client_id", clientId).order("scope_type", {
      ascending: true
    }).order("changed_at", {
      ascending: false
    }),
    supabase.from("fb_pages").select("fb_page_id,page_name,status,connected_at").eq("client_id", clientId).order("connected_at", {
      ascending: true
    })
  ]);
  if (controlError) {
    throw new Error(`automation controls lookup failed: ${controlError.message}`);
  }
  if (pageError) {
    throw new Error(`fb_pages lookup failed: ${pageError.message}`);
  }
  return {
    controls: controls || [],
    pages: pages || []
  };
}
Deno.serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return json({
        success: false,
        error: "METHOD_NOT_ALLOWED"
      }, 405);
    }
    const user = await getUser(req);
    if (!user) {
      return json({
        success: false,
        error: "UNAUTHORIZED"
      }, 401);
    }
    let body;
    try {
      body = await req.json();
    } catch  {
      return json({
        success: false,
        error: "INVALID_JSON"
      }, 400);
    }
    const action = String(body?.action || "LIST").trim().toUpperCase();
    const clientId = getString(body?.client_id);
    if (!clientId) {
      return json({
        success: false,
        error: "CLIENT_ID_REQUIRED"
      }, 400);
    }
    const membership = await getClientMembership(user.id, clientId);
    if (!membership) {
      return json({
        success: false,
        error: "FORBIDDEN"
      }, 403);
    }
    const role = normalizeRole(membership);
    if (action === "LIST") {
      const result = await listControls(clientId);
      return json({
        success: true,
        role,
        ...result
      });
    }
    if (action !== "SET") {
      return json({
        success: false,
        error: "UNSUPPORTED_ACTION"
      }, 400);
    }
    const scopeType = String(body?.scope_type || "").trim().toUpperCase();
    const requestedEnabled = body?.is_enabled;
    const reason = getString(body?.reason);
    if (![
      "CLIENT",
      "PAGE",
      "POST"
    ].includes(scopeType)) {
      return json({
        success: false,
        error: "INVALID_SCOPE_TYPE"
      }, 400);
    }
    if (typeof requestedEnabled !== "boolean") {
      return json({
        success: false,
        error: "IS_ENABLED_REQUIRED"
      }, 400);
    }
    /*
     * Subscription/client suspension is platform control.
     * Only SUPER_ADMIN may change the CLIENT scope.
     *
     * PAGE scope may be managed by ADMIN/OWNER/SUPER_ADMIN
     * for that client's own connected Pages.
     *
     * POST scope is normally managed from the Facebook Page
     * main-post EO2MATE ON/OFF comment, but SUPER_ADMIN may
     * also override it here if needed.
     */ if (scopeType === "CLIENT" && role !== "SUPER_ADMIN") {
      return json({
        success: false,
        error: "SUPER_ADMIN_REQUIRED",
        message: "Client-level automation suspension requires SUPER_ADMIN."
      }, 403);
    }
    if (scopeType === "PAGE" && ![
      "ADMIN",
      "OWNER",
      "SUPER_ADMIN"
    ].includes(role)) {
      return json({
        success: false,
        error: "ADMIN_REQUIRED"
      }, 403);
    }
    if (scopeType === "POST" && role !== "SUPER_ADMIN") {
      return json({
        success: false,
        error: "SUPER_ADMIN_REQUIRED",
        message: "Post-level UI override requires SUPER_ADMIN. Page owners can use EO2MATE ON/OFF on the Facebook post."
      }, 403);
    }
    let scopeId = getString(body?.scope_id);
    if (scopeType === "CLIENT") {
      scopeId = clientId;
    }
    if (!scopeId) {
      return json({
        success: false,
        error: "SCOPE_ID_REQUIRED"
      }, 400);
    }
    if (scopeType === "PAGE") {
      const page = await findPage(clientId, scopeId);
      if (!page) {
        return json({
          success: false,
          error: "PAGE_NOT_FOUND"
        }, 404);
      }
    }
    if (scopeType === "POST") {
      const post = await findAuctionPost(clientId, scopeId);
      if (!post) {
        return json({
          success: false,
          error: "POST_NOT_FOUND"
        }, 404);
      }
      scopeId = String(post.post_id);
    }
    if (requestedEnabled === false && !reason) {
      return json({
        success: false,
        error: "REASON_REQUIRED",
        message: "Please provide a reason when disabling automation."
      }, 400);
    }
    const control = await setControl({
      clientId,
      scopeType: scopeType,
      scopeId,
      enabled: requestedEnabled,
      reason,
      userId: user.id
    });
    return json({
      success: true,
      action: "SET",
      role,
      control
    });
  } catch (error) {
    console.error(error);
    return json({
      success: false,
      error: "AUTOMATION_ADMIN_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
