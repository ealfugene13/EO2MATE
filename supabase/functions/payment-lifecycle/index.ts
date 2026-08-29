import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYMENT_LIFECYCLE_SECRET = Deno.env.get("PAYMENT_LIFECYCLE_SECRET") || "";
const META_GRAPH_VERSION = "v23.0";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
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
async function getPageAccessToken(fbPageId) {
  const { data, error } = await supabase.from("fb_pages").select("access_token").eq("fb_page_id", fbPageId).maybeSingle();
  if (error) throw new Error(`fb_pages lookup failed: ${error.message}`);
  if (!data?.access_token) throw new Error(`No token for Page ${fbPageId}.`);
  return String(data.access_token);
}
async function sendMessengerMessage(fbPageId, psid, message) {
  try {
    const token = await getPageAccessToken(fbPageId);
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient: {
          id: psid
        },
        messaging_type: "RESPONSE",
        message: {
          text: message
        }
      })
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("Messenger expiry notification failed", {
        status: response.status,
        text
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Messenger expiry notification failed", error);
    return false;
  }
}
async function getLatestPendingGroupPayment(orderGroupId) {
  const { data, error } = await supabase.from("payments").select("*").eq("order_group_id", orderGroupId).eq("status", "pending").is("expired_at", null).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) throw new Error(`payments lookup failed: ${error.message}`);
  return data;
}
async function getGroupClaim(orderGroupId) {
  const { data, error } = await supabase.from("messenger_payment_claims").select("*").eq("order_group_id", orderGroupId).not("claimed_psid", "is", null).order("claimed_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) throw new Error(`group claim lookup failed: ${error.message}`);
  return data;
}
async function expireGroup(group) {
  const groupId = String(group.order_group_id);
  const paymentWindowHours = await getClientNumberSetting(getString(group.client_id), "PAYMENT_DEADLINE_HOURS", 24);
  const payment = await getLatestPendingGroupPayment(groupId);
  if (!payment) {
    return {
      expired: false,
      reason: "NO_PENDING_PAYMENT"
    };
  }
  const paymentCreatedAt = new Date(String(payment.created_at || ""));
  if (Number.isNaN(paymentCreatedAt.getTime())) {
    return {
      expired: false,
      reason: "INVALID_PAYMENT_CREATED_AT"
    };
  }
  const normalDeadline = new Date(paymentCreatedAt.getTime() + paymentWindowHours * 60 * 60 * 1000);
  const reopenedDeadlineRaw = group.payment_reopen_deadline_at || null;
  const reopenedDeadline = reopenedDeadlineRaw ? new Date(String(reopenedDeadlineRaw)) : null;
  const effectiveDeadline = reopenedDeadline && !Number.isNaN(reopenedDeadline.getTime()) && group.payment_reopened_at ? reopenedDeadline : normalDeadline;
  if (Date.now() < effectiveDeadline.getTime()) {
    if (!group.payment_deadline_at) {
      await supabase.from("order_groups").update({
        payment_deadline_at: normalDeadline.toISOString(),
        updated_at: new Date().toISOString()
      }).eq("order_group_id", groupId);
    }
    return {
      expired: false,
      reason: "NOT_DUE",
      deadline_at: effectiveDeadline.toISOString()
    };
  }
  const now = new Date().toISOString();
  // Atomic claim: only one worker may expire this group.
  const { data: claimedGroup, error: claimError } = await supabase.from("order_groups").update({
    group_status: "CANCELLED",
    payment_deadline_at: group.payment_deadline_at || normalDeadline.toISOString(),
    payment_expired_at: now,
    updated_at: now
  }).eq("order_group_id", groupId).is("payment_expired_at", null).select("*").maybeSingle();
  if (claimError) {
    throw new Error(`order group expiry claim failed: ${claimError.message}`);
  }
  if (!claimedGroup) {
    return {
      expired: false,
      reason: "ALREADY_EXPIRED_OR_CLAIMED"
    };
  }
  const { data: orders, error: orderError } = await supabase.from("orders").update({
    order_status: "CANCELLED",
    payment_status: "PENDING",
    payment_deadline_at: group.payment_deadline_at || normalDeadline.toISOString(),
    payment_expired_at: now,
    updated_at: now
  }).eq("order_group_id", groupId).neq("order_status", "CANCELLED").select("order_id,bid_winner_id");
  if (orderError) throw new Error(`orders expiry failed: ${orderError.message}`);
  const winnerIds = (orders || []).map((row)=>getString(row.bid_winner_id)).filter(Boolean);
  if (winnerIds.length > 0) {
    const { error: winnerError } = await supabase.from("auction_winners").update({
      status: "CANCELLED",
      payment_deadline_at: group.payment_deadline_at || normalDeadline.toISOString(),
      payment_expired_at: now,
      forfeiture_reason: `PAYMENT_NOT_RECEIVED_WITHIN_${paymentWindowHours}_HOURS`
    }).in("bid_winner_id", winnerIds).neq("status", "CONFIRMED");
    if (winnerError) {
      throw new Error(`auction_winners expiry failed: ${winnerError.message}`);
    }
  }
  const { error: paymentError } = await supabase.from("payments").update({
    expired_at: now,
    updated_at: now
  }).eq("payment_id", payment.payment_id).eq("status", "pending").is("expired_at", null);
  if (paymentError) {
    throw new Error(`payment expiry failed: ${paymentError.message}`);
  }
  let notificationSent = false;
  const claim = await getGroupClaim(groupId);
  const fbPageId = getString(claim?.fb_page_id);
  const psid = getString(claim?.claimed_psid);
  if (fbPageId && psid) {
    notificationSent = await sendMessengerMessage(fbPageId, psid, [
      "⚠️ Payment period expired",
      "",
      `Your ${paymentWindowHours}-hour payment window has ended and payment was not received.`,
      "",
      "Your auction win has been forfeited.",
      "",
      "If you still want to complete the purchase, please contact the Page admin. An admin may manually reopen the payment window."
    ].join("\n"));
  }
  if (notificationSent) {
    await supabase.from("order_groups").update({
      payment_expiry_notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("order_group_id", groupId);
  }
  return {
    expired: true,
    order_group_id: groupId,
    winner_count: winnerIds.length,
    notification_sent: notificationSent,
    deadline_at: effectiveDeadline.toISOString()
  };
}
Deno.serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return Response.json({
        success: false,
        error: "METHOD_NOT_ALLOWED"
      }, {
        status: 405
      });
    }
    if (!PAYMENT_LIFECYCLE_SECRET) {
      return Response.json({
        success: false,
        error: "PAYMENT_LIFECYCLE_SECRET_NOT_CONFIGURED"
      }, {
        status: 500
      });
    }
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${PAYMENT_LIFECYCLE_SECRET}`) {
      return Response.json({
        success: false,
        error: "UNAUTHORIZED"
      }, {
        status: 401
      });
    }
    const { data: groups, error } = await supabase.from("order_groups").select("*").eq("group_status", "PAYMENT_PENDING").is("payment_expired_at", null);
    if (error) {
      throw new Error(`order_groups expiry lookup failed: ${error.message}`);
    }
    let expired = 0;
    let skipped = 0;
    let failed = 0;
    const details = [];
    for (const group of groups || []){
      try {
        const result = await expireGroup(group);
        if (result.expired) expired += 1;
        else skipped += 1;
        details.push(result);
      } catch (error) {
        failed += 1;
        details.push({
          order_group_id: group.order_group_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return Response.json({
      success: true,
      candidates: groups?.length || 0,
      expired,
      skipped,
      failed,
      details,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    return Response.json({
      success: false,
      error: "PAYMENT_LIFECYCLE_FAILED",
      message: error instanceof Error ? error.message : String(error)
    }, {
      status: 500
    });
  }
});
