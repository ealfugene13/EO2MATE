import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TRIAL_DAYS = 14;
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
async function findExistingMembership(userId) {
  const { data, error } = await supabase.from("client_users").select("*").eq("user_id", userId).eq("status", "ACTIVE").order("created_at", {
    ascending: true
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`client_users lookup failed: ${error.message}`);
  }
  return data;
}
async function getOnboardingStatus(userId) {
  const membership = await findExistingMembership(userId);
  if (!membership) {
    return {
      onboarded: false,
      needs_profile: true,
      client: null,
      membership: null,
      subscription: null,
      pages: []
    };
  }
  const [clientResult, subscriptionResult, pagesResult] = await Promise.all([
    supabase.from("master_clients").select("*").eq("client_id", membership.client_id).maybeSingle(),
    supabase.from("client_subscriptions").select("*").eq("client_id", membership.client_id).maybeSingle(),
    supabase.from("fb_pages").select("*").eq("client_id", membership.client_id).order("connected_at", {
      ascending: true
    })
  ]);
  if (clientResult.error) {
    throw new Error(`master_clients lookup failed: ${clientResult.error.message}`);
  }
  if (subscriptionResult.error) {
    throw new Error(`client_subscriptions lookup failed: ${subscriptionResult.error.message}`);
  }
  if (pagesResult.error) {
    throw new Error(`fb_pages lookup failed: ${pagesResult.error.message}`);
  }
  const client = clientResult.data;
  const pages = (pagesResult.data || []).map((page)=>({
      ...page,
      page_name: getString(page?.page_name) || getString(page?.fb_page_name) || getString(page?.name) || "Facebook Page"
    }));
  const onboardingComplete = String(client?.onboarding_status || "").toUpperCase() === "COMPLETE";
  return {
    onboarded: Boolean(client),
    needs_profile: false,
    onboarding_complete: onboardingComplete,
    needs_facebook: pages.length === 0,
    client,
    membership,
    subscription: subscriptionResult.data,
    pages
  };
}
async function createClientForUser(user, body) {
  const existingMembership = await findExistingMembership(user.id);
  if (existingMembership) {
    return getOnboardingStatus(user.id);
  }
  const businessName = getString(body?.business_name);
  const contactEmail = getString(body?.contact_email) || getString(user?.email);
  const contactPhone = getString(body?.contact_phone);
  const timezone = getString(body?.timezone) || "Asia/Manila";
  if (!businessName) {
    throw new Error("Business name is required.");
  }
  if (businessName.length > 120) {
    throw new Error("Business name is too long.");
  }
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  /*
   * We intentionally create the tenant and membership using the
   * service role inside one Edge Function. The browser never gets
   * cross-client write permission.
   */ const { data: client, error: clientError } = await supabase.from("master_clients").insert({
    name: businessName,
    status: "ACTIVE",
    onboarding_status: "IN_PROGRESS",
    onboarding_step: "FACEBOOK",
    default_environment: "CLNT",
    contact_email: contactEmail,
    contact_phone: contactPhone,
    timezone,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    updated_at: now.toISOString()
  }).select("*").single();
  if (clientError) {
    throw new Error(`Client creation failed: ${clientError.message}`);
  }
  try {
    const { error: memberError } = await supabase.from("client_users").insert({
      client_id: client.client_id,
      user_id: user.id,
      role: "OWNER",
      status: "ACTIVE"
    });
    if (memberError) {
      throw new Error(`Client owner creation failed: ${memberError.message}`);
    }
    const { error: subscriptionError } = await supabase.from("client_subscriptions").insert({
      client_id: client.client_id,
      plan_code: "CLNT_TRIAL",
      subscription_status: "TRIAL",
      payment_mode: "MANUAL",
      allowed_environment: "CLNT",
      starts_at: now.toISOString(),
      ends_at: trialEnd.toISOString(),
      notes: "Self-service EO2MATE CLNT trial"
    });
    if (subscriptionError) {
      throw new Error(`Trial subscription creation failed: ${subscriptionError.message}`);
    }
    /*
     * Explicit client control row makes the default visible to the
     * admin control UI while remaining ON.
     */ const { error: controlError } = await supabase.from("eo2mate_automation_controls").upsert({
      client_id: client.client_id,
      scope_type: "CLIENT",
      scope_id: client.client_id,
      is_enabled: true,
      reason: "Initial CLNT trial activation",
      changed_by_user_id: user.id,
      changed_at: now.toISOString(),
      updated_at: now.toISOString()
    }, {
      onConflict: "client_id,scope_type,scope_id"
    });
    if (controlError) {
      throw new Error(`Initial automation control failed: ${controlError.message}`);
    }
  } catch (error) {
    /*
     * Compensating cleanup if tenant provisioning only partially
     * succeeds.
     */ await supabase.from("master_clients").delete().eq("client_id", client.client_id);
    throw error;
  }
  return getOnboardingStatus(user.id);
}
async function cancelOnboarding(userId) {
  const membership = await findExistingMembership(userId);
  if (!membership) {
    return {
      cancelled: true,
      message: "No incomplete client onboarding was found."
    };
  }
  const clientId = String(membership.client_id);
  const [clientResult, pagesResult] = await Promise.all([
    supabase.from("master_clients").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("fb_pages").select("fb_page_id,status").eq("client_id", clientId)
  ]);
  if (clientResult.error) {
    throw new Error(`master_clients lookup failed: ${clientResult.error.message}`);
  }
  if (pagesResult.error) {
    throw new Error(`fb_pages lookup failed: ${pagesResult.error.message}`);
  }
  const client = clientResult.data;
  if (!client) {
    throw new Error("Client profile not found.");
  }
  const onboardingStatus = String(client.onboarding_status || "").trim().toUpperCase();
  if (onboardingStatus === "COMPLETE") {
    throw new Error("Completed onboarding cannot be cancelled from the onboarding screen.");
  }
  if ((pagesResult.data || []).length > 0) {
    throw new Error("Onboarding cannot be cancelled after a Facebook Page has been connected. Contact EO2MATE admin instead.");
  }
  /*
   * Delete draft provisioning in a controlled order.
   * The auth.users account is intentionally NOT deleted.
   */ const { error: controlError } = await supabase.from("eo2mate_automation_controls").delete().eq("client_id", clientId);
  if (controlError) {
    throw new Error(`automation-control cleanup failed: ${controlError.message}`);
  }
  const { error: subscriptionError } = await supabase.from("client_subscriptions").delete().eq("client_id", clientId);
  if (subscriptionError) {
    throw new Error(`subscription cleanup failed: ${subscriptionError.message}`);
  }
  const { error: membershipError } = await supabase.from("client_users").delete().eq("client_id", clientId).eq("user_id", userId);
  if (membershipError) {
    throw new Error(`client membership cleanup failed: ${membershipError.message}`);
  }
  const { error: clientError } = await supabase.from("master_clients").delete().eq("client_id", clientId);
  if (clientError) {
    throw new Error(`draft client cleanup failed: ${clientError.message}`);
  }
  return {
    cancelled: true,
    client_id: clientId,
    auth_account_deleted: false,
    message: "Onboarding cancelled. Your login account was kept, but the draft EO2MATE client profile was removed."
  };
}
async function completeOnboarding(userId) {
  const membership = await findExistingMembership(userId);
  if (!membership) {
    throw new Error("Client membership not found.");
  }
  const { data: pages, error: pageError } = await supabase.from("fb_pages").select("fb_page_id").eq("client_id", membership.client_id).eq("status", "ACTIVE");
  if (pageError) {
    throw new Error(`Facebook Page lookup failed: ${pageError.message}`);
  }
  if (!pages?.length) {
    throw new Error("Connect at least one active Facebook Page before completing onboarding.");
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("master_clients").update({
    onboarding_status: "COMPLETE",
    onboarding_step: "COMPLETE",
    updated_at: now
  }).eq("client_id", membership.client_id);
  if (error) {
    throw new Error(`Onboarding completion failed: ${error.message}`);
  }
  return getOnboardingStatus(userId);
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
    let body = {};
    try {
      body = await req.json();
    } catch  {
      body = {};
    }
    const action = String(body?.action || "STATUS").trim().toUpperCase();
    if (action === "STATUS") {
      return json({
        success: true,
        ...await getOnboardingStatus(user.id)
      });
    }
    if (action === "CREATE_CLIENT") {
      const result = await createClientForUser(user, body);
      return json({
        success: true,
        action,
        ...result
      });
    }
    if (action === "CANCEL") {
      const result = await cancelOnboarding(user.id);
      return json({
        success: true,
        action,
        ...result
      });
    }
    if (action === "COMPLETE") {
      const result = await completeOnboarding(user.id);
      return json({
        success: true,
        action,
        ...result
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
      error: "CLIENT_ONBOARDING_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
