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
async function getClientSetting(clientId, settingKey) {
  if (clientId) {
    const { data, error } = await supabase.from("eo2mate_settings").select("setting_value").eq("client_id", clientId).eq("setting_key", settingKey).eq("is_active", true).maybeSingle();
    if (error) {
      throw new Error(`EO2MATE client setting lookup failed (${settingKey}): ${error.message}`);
    }
    if (data?.setting_value !== undefined) {
      return String(data.setting_value);
    }
  }
  const { data, error } = await supabase.from("eo2mate_settings").select("setting_value").is("client_id", null).eq("setting_key", settingKey).eq("is_active", true).maybeSingle();
  if (error) {
    throw new Error(`EO2MATE global setting lookup failed (${settingKey}): ${error.message}`);
  }
  return data?.setting_value !== undefined ? String(data.setting_value) : null;
}
async function getClientNumberSetting(clientId, settingKey, fallback) {
  const raw = await getClientSetting(clientId, settingKey);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
async function requireClientAdmin(userId, clientId) {
  const { data, error } = await supabase.from("client_users").select("*").eq("user_id", userId).eq("client_id", clientId).maybeSingle();
  if (error) throw new Error(`client_users lookup failed: ${error.message}`);
  if (!data) return false;
  const role = String(data.role || data.user_role || "").trim().toUpperCase();
  // Compatible with common existing EO2MATE roles.
  return [
    "ADMIN",
    "OWNER",
    "SUPER_ADMIN"
  ].includes(role);
}
async function reopenGroupPayment(groupId, hours, reason, performedBy) {
  const { data: group, error: groupError } = await supabase.from("order_groups").select("*").eq("order_group_id", groupId).maybeSingle();
  if (groupError) throw new Error(`order_groups lookup failed: ${groupError.message}`);
  if (!group) throw new Error("Order group not found.");
  const status = String(group.group_status || "").toUpperCase();
  if (status === "PAID" || status === "READY_FOR_DELIVERY") {
    throw new Error("Paid order groups cannot be reopened for payment.");
  }
  const maxReopens = await getClientNumberSetting(getString(group.client_id), "MAX_PAYMENT_REOPENS", 3);
  const currentReopenCount = Number(group.payment_reopen_count || 0);
  if (Number.isFinite(currentReopenCount) && currentReopenCount >= maxReopens) {
    throw new Error(`Maximum payment reopen count reached (${maxReopens}).`);
  }
  const oldDeadline = group.payment_reopen_deadline_at || group.payment_deadline_at || null;
  const now = new Date();
  const newDeadline = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  const { data: updatedGroup, error: updateError } = await supabase.from("order_groups").update({
    group_status: "PAYMENT_PENDING",
    payment_expired_at: null,
    payment_expiry_notified_at: null,
    payment_reopened_at: now.toISOString(),
    payment_reopen_deadline_at: newDeadline,
    payment_reopen_reason: reason,
    payment_reopened_by: performedBy,
    payment_reopen_count: Number(group.payment_reopen_count || 0) + 1,
    updated_at: now.toISOString()
  }).eq("order_group_id", groupId).select("*").single();
  if (updateError) throw new Error(`order_groups reopen failed: ${updateError.message}`);
  const { data: orders, error: ordersError } = await supabase.from("orders").update({
    order_status: "PAYMENT_PENDING",
    payment_status: "PENDING",
    payment_expired_at: null,
    payment_reopened_at: now.toISOString(),
    payment_reopen_deadline_at: newDeadline,
    updated_at: now.toISOString()
  }).eq("order_group_id", groupId).not("payment_expired_at", "is", null).select("order_id,bid_winner_id");
  if (ordersError) throw new Error(`orders reopen failed: ${ordersError.message}`);
  const winnerIds = (orders || []).map((row)=>getString(row.bid_winner_id)).filter(Boolean);
  if (winnerIds.length > 0) {
    const { error: winnerError } = await supabase.from("auction_winners").update({
      status: "PENDING",
      payment_expired_at: null,
      forfeiture_reason: null,
      payment_reopened_at: now.toISOString(),
      payment_reopen_deadline_at: newDeadline
    }).in("bid_winner_id", winnerIds);
    if (winnerError) throw new Error(`auction_winners reopen failed: ${winnerError.message}`);
  }
  // Expire any old local pending checkout so create-payment can generate a replacement.
  const { error: paymentError } = await supabase.from("payments").update({
    expired_at: now.toISOString(),
    updated_at: now.toISOString()
  }).eq("order_group_id", groupId).eq("status", "pending").is("expired_at", null);
  if (paymentError) throw new Error(`payments expiry update failed: ${paymentError.message}`);
  const { error: auditError } = await supabase.from("payment_admin_actions").insert({
    client_id: group.client_id,
    order_group_id: groupId,
    action: "REOPEN_PAYMENT",
    reason,
    old_deadline_at: oldDeadline,
    new_deadline_at: newDeadline,
    performed_by: performedBy
  });
  if (auditError) throw new Error(`payment_admin_actions insert failed: ${auditError.message}`);
  return {
    group: updatedGroup,
    new_deadline_at: newDeadline,
    reopened_winners: winnerIds.length
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
    const body = await req.json();
    const orderGroupId = getString(body?.order_group_id);
    const reason = getString(body?.reason);
    if (!orderGroupId) {
      return json({
        success: false,
        error: "ORDER_GROUP_ID_REQUIRED"
      }, 400);
    }
    const { data: group, error } = await supabase.from("order_groups").select("order_group_id,client_id").eq("order_group_id", orderGroupId).maybeSingle();
    if (error) throw new Error(`order_groups lookup failed: ${error.message}`);
    if (!group) {
      return json({
        success: false,
        error: "NOT_FOUND"
      }, 404);
    }
    const defaultReopenHours = await getClientNumberSetting(getString(group.client_id), "PAYMENT_REOPEN_HOURS", 24);
    const maxReopenHours = await getClientNumberSetting(getString(group.client_id), "MAX_PAYMENT_REOPEN_HOURS", 168);
    const requestedHours = body?.hours === null || body?.hours === undefined || body?.hours === "" ? defaultReopenHours : Number(body.hours);
    if (!Number.isFinite(requestedHours) || requestedHours <= 0 || requestedHours > maxReopenHours) {
      return json({
        success: false,
        error: "INVALID_REOPEN_HOURS",
        message: `Payment reopen hours must be greater than 0 and not more than ${maxReopenHours}.`,
        default_hours: defaultReopenHours,
        max_hours: maxReopenHours
      }, 400);
    }
    const hours = requestedHours;
    const allowed = await requireClientAdmin(user.id, String(group.client_id));
    if (!allowed) {
      return json({
        success: false,
        error: "FORBIDDEN"
      }, 403);
    }
    const result = await reopenGroupPayment(orderGroupId, hours, reason, user.id);
    return json({
      success: true,
      action: "REOPEN_PAYMENT",
      ...result
    });
  } catch (error) {
    console.error(error);
    return json({
      success: false,
      error: "PAYMENT_ADMIN_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
