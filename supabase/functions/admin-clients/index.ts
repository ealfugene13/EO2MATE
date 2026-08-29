import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
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
async function getPlatformAdmin(userId) {
  const { data, error } = await supabase.from("platform_admins").select("*").eq("user_id", userId).eq("status", "ACTIVE").maybeSingle();
  if (error) {
    throw new Error(`platform_admins lookup failed: ${error.message}`);
  }
  return data;
}
async function listClients() {
  const [clientsResult, subscriptionsResult, pagesResult, controlsResult] = await Promise.all([
    supabase.from("master_clients").select("*").order("created_at", {
      ascending: false
    }),
    supabase.from("client_subscriptions").select("*"),
    supabase.from("fb_pages").select("*"),
    supabase.from("eo2mate_automation_controls").select("*").eq("scope_type", "CLIENT")
  ]);
  if (clientsResult.error) {
    throw new Error(`master_clients lookup failed: ${clientsResult.error.message}`);
  }
  if (subscriptionsResult.error) {
    throw new Error(`client_subscriptions lookup failed: ${subscriptionsResult.error.message}`);
  }
  if (pagesResult.error) {
    throw new Error(`fb_pages lookup failed: ${pagesResult.error.message}`);
  }
  if (controlsResult.error) {
    throw new Error(`automation controls lookup failed: ${controlsResult.error.message}`);
  }
  const subscriptions = new Map((subscriptionsResult.data || []).map((row)=>[
      String(row.client_id),
      row
    ]));
  const controls = new Map((controlsResult.data || []).map((row)=>[
      String(row.client_id),
      row
    ]));
  const pagesByClient = new Map();
  for (const rawPage of pagesResult.data || []){
    const page = {
      ...rawPage,
      page_name: getString(rawPage?.page_name) || getString(rawPage?.fb_page_name) || getString(rawPage?.name) || "Facebook Page"
    };
    const key = String(page.client_id);
    const current = pagesByClient.get(key) || [];
    current.push(page);
    pagesByClient.set(key, current);
  }
  return (clientsResult.data || []).map((client)=>{
    const id = String(client.client_id);
    const control = controls.get(id);
    const pages = pagesByClient.get(id) || [];
    return {
      ...client,
      subscription: subscriptions.get(id) || null,
      automation_enabled: control ? control.is_enabled !== false : true,
      automation_reason: control?.reason || null,
      page_count: pages.length,
      active_page_count: pages.filter((page)=>String(page.status || "").toUpperCase() === "ACTIVE").length,
      pages
    };
  });
}
async function updateClient(clientId, body, adminUserId) {
  const now = new Date().toISOString();
  const clientPatch = {
    updated_at: now
  };
  if (body?.name !== undefined) {
    const name = getString(body.name);
    if (!name) {
      throw new Error("Client name cannot be blank.");
    }
    clientPatch.name = name;
  }
  if (body?.status !== undefined) {
    const status = String(body.status).trim().toUpperCase();
    if (![
      "ACTIVE",
      "INACTIVE"
    ].includes(status)) {
      throw new Error("Invalid client status.");
    }
    clientPatch.status = status;
  }
  if (body?.default_environment !== undefined) {
    const environment = String(body.default_environment).trim().toUpperCase();
    if (![
      "CLNT",
      "TEST",
      "PROD"
    ].includes(environment)) {
      throw new Error("Invalid default environment.");
    }
    clientPatch.default_environment = environment;
  }
  if (body?.onboarding_status !== undefined) {
    clientPatch.onboarding_status = String(body.onboarding_status).trim().toUpperCase();
  }
  const { data: client, error: clientError } = await supabase.from("master_clients").update(clientPatch).eq("client_id", clientId).select("*").single();
  if (clientError) {
    throw new Error(`Client update failed: ${clientError.message}`);
  }
  const subscriptionPatch = {
    updated_at: now
  };
  let changeSubscription = false;
  if (body?.subscription_status !== undefined) {
    subscriptionPatch.subscription_status = String(body.subscription_status).trim().toUpperCase();
    changeSubscription = true;
  }
  if (body?.plan_code !== undefined) {
    subscriptionPatch.plan_code = String(body.plan_code).trim().toUpperCase();
    changeSubscription = true;
  }
  if (body?.allowed_environment !== undefined) {
    const environment = String(body.allowed_environment).trim().toUpperCase();
    if (![
      "CLNT",
      "TEST",
      "PROD"
    ].includes(environment)) {
      throw new Error("Invalid allowed environment.");
    }
    subscriptionPatch.allowed_environment = environment;
    subscriptionPatch.payment_mode = environment === "CLNT" ? "MANUAL" : "PAYMONGO";
    changeSubscription = true;
  }
  if (body?.subscription_ends_at !== undefined) {
    subscriptionPatch.ends_at = body.subscription_ends_at || null;
    changeSubscription = true;
  }
  if (body?.subscription_notes !== undefined) {
    subscriptionPatch.notes = getString(body.subscription_notes);
    changeSubscription = true;
  }
  if (changeSubscription) {
    const { error: subscriptionError } = await supabase.from("client_subscriptions").upsert({
      client_id: clientId,
      plan_code: subscriptionPatch.plan_code || "CLNT_TRIAL",
      subscription_status: subscriptionPatch.subscription_status || "TRIAL",
      payment_mode: subscriptionPatch.payment_mode || "MANUAL",
      allowed_environment: subscriptionPatch.allowed_environment || "CLNT",
      ends_at: subscriptionPatch.ends_at === undefined ? null : subscriptionPatch.ends_at,
      notes: subscriptionPatch.notes === undefined ? null : subscriptionPatch.notes,
      updated_at: now
    }, {
      onConflict: "client_id"
    });
    if (subscriptionError) {
      throw new Error(`Subscription update failed: ${subscriptionError.message}`);
    }
  }
  /*
   * Subscription state can automatically suspend/restore the
   * client control. Platform admin may still change it explicitly
   * in Automation Control afterward.
   */ if (body?.subscription_status !== undefined) {
    const subscriptionStatus = String(body.subscription_status).trim().toUpperCase();
    const shouldRun = [
      "TRIAL",
      "ACTIVE"
    ].includes(subscriptionStatus);
    const { error: controlError } = await supabase.from("eo2mate_automation_controls").upsert({
      client_id: clientId,
      scope_type: "CLIENT",
      scope_id: clientId,
      is_enabled: shouldRun,
      reason: shouldRun ? "Subscription active" : `Subscription ${subscriptionStatus}`,
      changed_by_user_id: adminUserId,
      changed_at: now,
      updated_at: now
    }, {
      onConflict: "client_id,scope_type,scope_id"
    });
    if (controlError) {
      throw new Error(`Client automation sync failed: ${controlError.message}`);
    }
  }
  return client;
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }
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
    const admin = await getPlatformAdmin(user.id);
    if (!admin) {
      return json({
        success: false,
        error: "PLATFORM_ADMIN_REQUIRED"
      }, 403);
    }
    let body = {};
    try {
      body = await req.json();
    } catch  {
      body = {};
    }
    const action = String(body?.action || "LIST").trim().toUpperCase();
    if (action === "LIST") {
      return json({
        success: true,
        admin_role: admin.role,
        clients: await listClients()
      });
    }
    if (action === "UPDATE") {
      const clientId = getString(body?.client_id);
      if (!clientId) {
        return json({
          success: false,
          error: "CLIENT_ID_REQUIRED"
        }, 400);
      }
      const client = await updateClient(clientId, body, user.id);
      return json({
        success: true,
        action,
        client
      });
    }
    return json({
      success: false,
      error: "UNSUPPORTED_ACTION"
    }, 400);
  } catch (error) {
    console.error(error);
    return json({
      success: false,
      error: "ADMIN_CLIENTS_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
