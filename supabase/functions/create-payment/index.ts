import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYMONGO_SECRET_KEY = Deno.env.get("PAYMONGO_SECRET_KEY");
const PROD_PAYMONGO_SECRET_KEY = Deno.env.get("PROD_PAYMONGO_SECRET_KEY");
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not configured.");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
}
/* =========================================================
   CORS
   ========================================================= */ /*
 * Add your production domain here later.
 *
 * Example:
 * https://app.yourdomain.com
 */ const ALLOWED_ORIGINS = [
  "https://ealfugene13.github.io"
];
function getCorsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  /*
   * Requests from Edge Function tester / server-to-server
   * may have no Origin header.
   */ const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    ...allowedOrigin ? {
      "Access-Control-Allow-Origin": allowedOrigin
    } : {},
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
/* =========================================================
   SUPABASE CLIENT
   ========================================================= */ const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
console.info("create-payment started");
/* =========================================================
   LOGGING
   ========================================================= */ function log(message, data) {
  if (data !== undefined) {
    console.log(message, data);
  } else {
    console.log(message);
  }
}
function errorLog(message, data) {
  if (data !== undefined) {
    console.error(message, data);
  } else {
    console.error(message);
  }
}
/* =========================================================
   ERROR MESSAGE
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
      return JSON.stringify(error);
    } catch  {
      return "Unknown error";
    }
  }
  return String(error);
}
/* =========================================================
   STRING
   ========================================================= */ function getString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const result = String(value).trim();
  return result || null;
}
/* =========================================================
   UUID
   ========================================================= */ function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
/* =========================================================
   JSON RESPONSE
   ========================================================= */ function jsonResponse(req, data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
/* =========================================================
   AUTHENTICATION
   ========================================================= */ async function authenticateRequest(req) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse(req, {
      success: false,
      error: "UNAUTHORIZED",
      message: "Missing Authorization header."
    }, 401);
  }
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return jsonResponse(req, {
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid Authorization header."
    }, 401);
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return jsonResponse(req, {
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid or expired access token."
    }, 401);
  }
  return {
    userId: data.user.id,
    email: data.user.email || null
  };
}
/* =========================================================
   CLIENT ACCESS
   ========================================================= */ async function verifyClientAccess(userId, clientId) {
  const { data, error } = await supabase.from("client_users").select("*").eq("user_id", userId).eq("client_id", clientId).maybeSingle();
  if (error) {
    throw new Error(`client_users lookup failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const role = getString(data.role) || getString(data.user_role) || null;
  return {
    clientId,
    role
  };
}
/* =========================================================
   PAYMENT CAPABILITY
   ========================================================= */ async function findPaymentCapability(clientId) {
  const { data, error } = await supabase.from("client_payment_accounts").select("*").eq("client_id", clientId).eq("provider", "PAYMONGO").maybeSingle();
  if (error) {
    throw new Error(`client_payment_accounts lookup failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  return {
    clientId,
    provider: String(data.provider || "PAYMONGO").trim().toUpperCase(),
    accountStatus: String(data.account_status || data.onboarding_status || "NOT_CONFIGURED").trim().toUpperCase(),
    paymentEnabled: data.payment_enabled === true,
    paymongoAccountId: getString(data.paymongo_account_id)
  };
}
/* =========================================================
   PAYMENT ACCESS CHECK
   ========================================================= */ async function authorizePaymentForClient(req, user, clientId) {
  if (!clientId || !isUuid(clientId)) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_PAYMENT_CLIENT",
      message: "The payment target does not have a valid client."
    }, 500);
  }
  const access = await verifyClientAccess(user.userId, clientId);
  if (!access) {
    /*
     * Do not reveal whether another client's
     * payment target actually exists.
     */ return jsonResponse(req, {
      success: false,
      error: "FORBIDDEN",
      message: "You do not have access to this payment target."
    }, 403);
  }
  const capability = await findPaymentCapability(clientId);
  if (!capability) {
    return jsonResponse(req, {
      success: false,
      error: "PAYMENT_GATEWAY_NOT_ACTIVE",
      message: "Online payment is not enabled for this client.",
      provider: "PAYMONGO",
      account_status: "NOT_CONFIGURED",
      payment_enabled: false
    }, 409);
  }
  if (capability.provider !== "PAYMONGO") {
    return jsonResponse(req, {
      success: false,
      error: "PAYMENT_GATEWAY_NOT_ACTIVE",
      message: "PayMongo is not configured for this client.",
      provider: capability.provider,
      account_status: capability.accountStatus,
      payment_enabled: capability.paymentEnabled
    }, 409);
  }
  if (capability.accountStatus !== "ACTIVE" || capability.paymentEnabled !== true) {
    return jsonResponse(req, {
      success: false,
      error: "PAYMENT_GATEWAY_NOT_ACTIVE",
      message: "Online payment is not active for this client.",
      provider: "PAYMONGO",
      account_status: capability.accountStatus,
      payment_enabled: capability.paymentEnabled
    }, 409);
  }
  return {
    access,
    capability
  };
}
/* =========================================================
   PAYMENT ENVIRONMENT
   ========================================================= */ function normalizePaymentEnvironment(value) {
  const environment = String(value || "").trim().toUpperCase();
  if (environment === "PROD") {
    return "PROD";
  }
  if (environment === "TEST") {
    return "TEST";
  }
  throw new Error(`Invalid or missing payment environment: ${environment || "NULL"}.`);
}
function getPayMongoSecretKey(environment) {
  if (environment === "PROD") {
    if (!PROD_PAYMONGO_SECRET_KEY) {
      throw new Error("PROD_PAYMONGO_SECRET_KEY is not configured.");
    }
    return PROD_PAYMONGO_SECRET_KEY;
  }
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured.");
  }
  return PAYMONGO_SECRET_KEY;
}
/* =========================================================
   EO2MATE RUNTIME SETTINGS
   ========================================================= */ async function getClientSetting(clientId, settingKey) {
  if (clientId) {
    const { data: clientSetting, error: clientError } = await supabase.from("eo2mate_settings").select("setting_value").eq("client_id", clientId).eq("setting_key", settingKey).eq("is_active", true).maybeSingle();
    if (clientError) {
      throw new Error(`EO2MATE client setting lookup failed (${settingKey}): ${clientError.message}`);
    }
    if (clientSetting?.setting_value !== undefined) {
      return String(clientSetting.setting_value);
    }
  }
  const { data: globalSetting, error: globalError } = await supabase.from("eo2mate_settings").select("setting_value").is("client_id", null).eq("setting_key", settingKey).eq("is_active", true).maybeSingle();
  if (globalError) {
    throw new Error(`EO2MATE global setting lookup failed (${settingKey}): ${globalError.message}`);
  }
  return globalSetting?.setting_value !== undefined ? String(globalSetting.setting_value) : null;
}
async function getClientNumberSetting(clientId, settingKey, fallback) {
  const raw = await getClientSetting(clientId, settingKey);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
/* =========================================================
   INTERNAL SERVICE AUTH
   ========================================================= */ function isInternalServiceRequest(req) {
  const authorization = req.headers.get("Authorization") || "";
  const apiKey = req.headers.get("apikey") || "";
  const expected = SUPABASE_SERVICE_ROLE_KEY;
  return authorization === `Bearer ${expected}` && apiKey === expected;
}
/* =========================================================
   PAYMONGO REQUEST
   ========================================================= */ async function paymongoRequest(environment, endpoint, method = "GET", body) {
  const secretKey = getPayMongoSecretKey(environment);
  const auth = btoa(`${secretKey}:`);
  const response = await fetch(`https://api.paymongo.com/v1/${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch  {
    json = {
      raw: text
    };
  }
  if (!response.ok || json?.errors) {
    throw new Error(`PayMongo API error ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}
/* =========================================================
   FIND WINNER
   ========================================================= */ async function findWinner(bidWinnerId) {
  const { data, error } = await supabase.from("auction_winners").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (error) {
    throw new Error(`auction_winners lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Winner ${bidWinnerId} was not found.`);
  }
  return data;
}
/* =========================================================
   FIND AUCTION ITEM
   ========================================================= */ async function findAuctionItem(auctionItemId) {
  const { data, error } = await supabase.from("auction_items").select("*").eq("auction_item_id", auctionItemId).maybeSingle();
  if (error) {
    throw new Error(`auction_items lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Auction item ${auctionItemId} was not found.`);
  }
  return data;
}
/* =========================================================
   FIND AUCTION POST
   ========================================================= */ async function findAuctionPost(postId) {
  const { data, error } = await supabase.from("auction_posts").select("*").eq("post_id", postId).maybeSingle();
  if (error) {
    throw new Error(`auction_posts lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Auction post ${postId} was not found.`);
  }
  return data;
}
/* =========================================================
   RESOLVE WINNER CLIENT
   ========================================================= */ async function resolveWinnerClient(winner) {
  const auctionItemId = getString(winner.auction_item_id);
  if (!auctionItemId) {
    throw new Error("Winner has no auction_item_id.");
  }
  const auctionItem = await findAuctionItem(auctionItemId);
  const postId = getString(auctionItem.auction_post_id);
  if (!postId) {
    throw new Error("Auction item has no auction_post_id.");
  }
  const auctionPost = await findAuctionPost(postId);
  const clientId = getString(auctionPost.client_id);
  if (!clientId) {
    throw new Error("Auction post has no client_id.");
  }
  return {
    clientId,
    auctionItem,
    auctionPost
  };
}
/* =========================================================
   FIND ORDER GROUP
   ========================================================= */ async function findOrderGroup(orderGroupId) {
  const { data, error } = await supabase.from("order_groups").select("*").eq("order_group_id", orderGroupId).maybeSingle();
  if (error) {
    throw new Error(`order_groups lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Order group ${orderGroupId} was not found.`);
  }
  return data;
}
/* =========================================================
   FIND GROUP ORDERS
   ========================================================= */ async function findGroupOrders(orderGroupId) {
  const { data, error } = await supabase.from("orders").select(`
          order_id,
          order_number,
          auction_item_id,
          bid_winner_id,
          buyer_name,
          subtotal,
          order_status,
          auction_items (
            item_label
          )
        `).eq("order_group_id", orderGroupId).neq("order_status", "CANCELLED").order("created_at", {
    ascending: true
  });
  if (error) {
    throw new Error(`group orders lookup failed: ${error.message}`);
  }
  return data || [];
}
/* =========================================================
   FIND EXISTING WINNER PAYMENT
   ========================================================= */ async function findExistingWinnerPayment(bidWinnerId, environment) {
  const { data, error } = await supabase.from("payments").select("*").eq("bid_winner_id", bidWinnerId).eq("environment", environment).in("status", [
    "pending",
    "paid"
  ]).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`winner payment lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   FIND EXISTING GROUP PAYMENT
   ========================================================= */ async function findExistingGroupPayment(orderGroupId, environment) {
  const { data, error } = await supabase.from("payments").select("*").eq("order_group_id", orderGroupId).eq("environment", environment).in("status", [
    "pending",
    "paid"
  ]).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`group payment lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   EXISTING PAYMENT RESPONSE
   ========================================================= */ function existingPaymentResponse(req, existingPayment) {
  const status = String(existingPayment.status).toLowerCase();
  if (status === "paid") {
    return jsonResponse(req, {
      success: true,
      already_paid: true,
      existing_payment: true,
      payment: existingPayment,
      checkout_url: null
    }, 200);
  }
  return null;
}
/* =========================================================
   PAYMENT EXPIRY / REUSE
   ========================================================= */ function getEffectivePaymentDeadline(target) {
  const reopened = getString(target?.payment_reopen_deadline_at);
  const normal = getString(target?.payment_deadline_at);
  const raw = reopened || normal;
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}
function paymentRowIsExpired(payment) {
  if (payment?.expired_at) {
    return true;
  }
  const expiresAt = getString(payment?.expires_at);
  if (!expiresAt) {
    return false;
  }
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return false;
  }
  return expiry.getTime() <= Date.now();
}
async function markPaymentExpired(paymentId) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("payments").update({
    expired_at: now,
    updated_at: now
  }).eq("payment_id", paymentId).is("expired_at", null);
  if (error) {
    throw new Error(`payment expiry update failed: ${error.message}`);
  }
}
async function prepareExistingPaymentForReuse(req, existingPayment, target, forceRefresh = false) {
  const paidResponse = existingPaymentResponse(req, existingPayment);
  if (paidResponse) {
    return paidResponse;
  }
  const status = String(existingPayment?.status || "").trim().toLowerCase();
  if (status !== "pending") {
    return {
      reuseExisting: false,
      replacementForPaymentId: null
    };
  }
  const deadline = getEffectivePaymentDeadline(target);
  if (deadline && deadline.getTime() <= Date.now()) {
    return jsonResponse(req, {
      success: false,
      error: "PAYMENT_WINDOW_EXPIRED",
      message: "The payment window has expired. Please contact the Page admin if you want to request a manual payment extension.",
      payment_deadline_at: deadline.toISOString()
    }, 409);
  }
  const expired = paymentRowIsExpired(existingPayment);
  /*
   * NEW QR:
   *
   * When forceRefresh=true, EO2MATE intentionally retires the
   * current pending checkout and creates a replacement checkout
   * for the SAME winner/order group.
   *
   * The effective 24-hour payment deadline is checked above, so
   * this can never extend the buyer's allowed payment window.
   */ if (!forceRefresh && !expired && existingPayment?.checkout_url) {
    return jsonResponse(req, {
      success: true,
      already_paid: false,
      existing_payment: true,
      reused_checkout: true,
      payment: existingPayment,
      checkout_url: existingPayment.checkout_url
    }, 200);
  }
  const paymentId = getString(existingPayment?.payment_id);
  if (paymentId && !existingPayment?.expired_at) {
    await markPaymentExpired(paymentId);
  }
  return {
    reuseExisting: false,
    replacementForPaymentId: paymentId
  };
}
/* =========================================================
   SET FIRST PAYMENT DEADLINE
   ========================================================= */ async function ensureGroupPaymentDeadline(orderGroup) {
  const existingDeadline = getEffectivePaymentDeadline(orderGroup);
  if (existingDeadline) {
    return existingDeadline;
  }
  const clientId = getString(orderGroup?.client_id);
  const paymentDeadlineHours = await getClientNumberSetting(clientId, "PAYMENT_DEADLINE_HOURS", 24);
  const deadline = new Date(Date.now() + paymentDeadlineHours * 60 * 60 * 1000);
  const { data, error } = await supabase.from("order_groups").update({
    payment_deadline_at: deadline.toISOString(),
    updated_at: new Date().toISOString()
  }).eq("order_group_id", orderGroup.order_group_id).is("payment_deadline_at", null).select("*").maybeSingle();
  if (error) {
    throw new Error(`order group payment deadline update failed: ${error.message}`);
  }
  if (data) {
    return deadline;
  }
  const latest = await findOrderGroup(orderGroup.order_group_id);
  return getEffectivePaymentDeadline(latest) || deadline;
}
/* =========================================================
   SET FIRST WINNER PAYMENT DEADLINE
   ========================================================= */ async function ensureWinnerPaymentDeadline(winner, clientId) {
  const existingDeadline = getEffectivePaymentDeadline(winner);
  if (existingDeadline) {
    return existingDeadline;
  }
  const paymentDeadlineHours = await getClientNumberSetting(clientId, "PAYMENT_DEADLINE_HOURS", 24);
  const deadline = new Date(Date.now() + paymentDeadlineHours * 60 * 60 * 1000);
  const { data, error } = await supabase.from("auction_winners").update({
    payment_deadline_at: deadline.toISOString()
  }).eq("bid_winner_id", winner.bid_winner_id).is("payment_deadline_at", null).select("*").maybeSingle();
  if (error) {
    throw new Error(`winner payment deadline update failed: ${error.message}`);
  }
  return getEffectivePaymentDeadline(data || winner) || deadline;
}
/* =========================================================
   CREATE WINNER PAYMENT RECORD
   ========================================================= */ async function createWinnerPaymentRecord(params) {
  const { data, error } = await supabase.from("payments").insert({
    order_id: params.orderId,
    order_group_id: null,
    auction_item_id: params.auctionItemId,
    bid_winner_id: params.bidWinnerId,
    winning_bid_id: params.winningBidId,
    amount: params.amount,
    currency: "PHP",
    provider: "PAYMONGO",
    environment: params.environment,
    status: "pending",
    checkout_session_id: params.checkoutSessionId,
    checkout_url: params.checkoutUrl,
    replacement_for_payment_id: params.replacementForPaymentId || null
  }).select("*").single();
  if (error) {
    throw new Error(`single payment insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   CREATE GROUP PAYMENT RECORD
   ========================================================= */ async function createGroupPaymentRecord(params) {
  const { data, error } = await supabase.from("payments").insert({
    order_id: null,
    order_group_id: params.orderGroupId,
    auction_item_id: null,
    bid_winner_id: null,
    winning_bid_id: null,
    amount: params.amount,
    currency: "PHP",
    provider: "PAYMONGO",
    environment: params.environment,
    status: "pending",
    checkout_session_id: params.checkoutSessionId,
    checkout_url: params.checkoutUrl,
    replacement_for_payment_id: params.replacementForPaymentId || null
  }).select("*").single();
  if (error) {
    throw new Error(`group payment insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   FIND ORDER FOR WINNER
   ========================================================= */ async function findOrderForWinner(bidWinnerId) {
  const { data, error } = await supabase.from("orders").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (error) {
    throw new Error(`orders lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   CREATE WINNER PAYMONGO CHECKOUT
   ========================================================= */ async function createWinnerPayMongoCheckout(params) {
  const amountInCentavos = Math.round(params.amount * 100);
  if (amountInCentavos <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  const checkoutBody = {
    data: {
      attributes: {
        billing: {
          name: "Auction Winner"
        },
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: `Auction payment - ${params.itemLabel}`,
        reference_number: params.bidWinnerId,
        line_items: [
          {
            currency: "PHP",
            amount: amountInCentavos,
            name: params.itemLabel,
            quantity: 1
          }
        ],
        payment_method_types: [
          "qrph"
        ],
        metadata: {
          payment_type: "AUCTION_WINNER",
          bid_winner_id: params.bidWinnerId,
          auction_item_id: params.auctionItemId,
          environment: params.environment
        }
      }
    }
  };
  const result = await paymongoRequest(params.environment, "checkout_sessions", "POST", checkoutBody);
  const checkout = result?.data;
  if (!checkout) {
    throw new Error("PayMongo returned no checkout session.");
  }
  const checkoutSessionId = getString(checkout.id);
  const checkoutUrl = getString(checkout?.attributes?.checkout_url);
  if (!checkoutSessionId) {
    throw new Error("PayMongo checkout session has no ID.");
  }
  if (!checkoutUrl) {
    throw new Error("PayMongo checkout session has no checkout URL.");
  }
  return {
    checkoutSessionId,
    checkoutUrl,
    raw: checkout
  };
}
/* =========================================================
   CREATE GROUP PAYMONGO CHECKOUT
   ========================================================= */ async function createGroupPayMongoCheckout(params) {
  const orderGroup = params.orderGroup;
  const amount = Number(orderGroup.total_amount);
  const amountInCentavos = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid consolidated payment amount.");
  }
  const itemCount = params.groupOrders.length;
  if (itemCount === 0) {
    throw new Error("Order group has no active items.");
  }
  const lineItemName = itemCount === 1 ? "Consolidated Order - 1 Item" : `Consolidated Order - ${itemCount} Items`;
  const buyerName = getString(orderGroup.shipping_name) || getString(orderGroup.buyer_name) || "Customer";
  const checkoutBody = {
    data: {
      attributes: {
        billing: {
          name: buyerName
        },
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: `Consolidated payment - ${orderGroup.group_number}`,
        reference_number: orderGroup.group_number,
        line_items: [
          {
            currency: "PHP",
            amount: amountInCentavos,
            name: lineItemName,
            quantity: 1
          }
        ],
        payment_method_types: [
          "qrph"
        ],
        metadata: {
          payment_type: "ORDER_GROUP",
          order_group_id: orderGroup.order_group_id,
          group_number: orderGroup.group_number,
          item_count: String(itemCount),
          environment: params.environment
        }
      }
    }
  };
  const result = await paymongoRequest(params.environment, "checkout_sessions", "POST", checkoutBody);
  const checkout = result?.data;
  if (!checkout) {
    throw new Error("PayMongo returned no consolidated checkout session.");
  }
  const checkoutSessionId = getString(checkout.id);
  const checkoutUrl = getString(checkout?.attributes?.checkout_url);
  if (!checkoutSessionId) {
    throw new Error("PayMongo consolidated checkout has no ID.");
  }
  if (!checkoutUrl) {
    throw new Error("PayMongo consolidated checkout has no checkout URL.");
  }
  return {
    checkoutSessionId,
    checkoutUrl,
    raw: checkout
  };
}
/* =========================================================
   MARK GROUP PAYMENT PENDING
   ========================================================= */ async function markGroupPaymentPending(orderGroupId) {
  const { data, error } = await supabase.from("order_groups").update({
    group_status: "PAYMENT_PENDING",
    updated_at: new Date().toISOString()
  }).eq("order_group_id", orderGroupId).in("group_status", [
    "OPEN",
    "READY_FOR_PAYMENT"
  ]).select("*").maybeSingle();
  if (error) {
    throw new Error(`order group PAYMENT_PENDING update failed: ${error.message}`);
  }
  if (!data) {
    const latest = await findOrderGroup(orderGroupId);
    if (String(latest.group_status || "").trim().toUpperCase() === "PAYMENT_PENDING") {
      return latest;
    }
    throw new Error(`Order group could not transition to PAYMENT_PENDING from status ${latest.group_status}.`);
  }
  return data;
}
/* =========================================================
   SINGLE WINNER PAYMENT FLOW
   ========================================================= */ async function processWinnerPayment(req, bidWinnerId, user, internalService, forceRefresh = false) {
  if (!isUuid(bidWinnerId)) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_BID_WINNER_ID"
    }, 400);
  }
  const winner = await findWinner(bidWinnerId);
  const winnerContext = await resolveWinnerClient(winner);
  const environment = normalizePaymentEnvironment(winnerContext.auctionPost.environment);
  if (!internalService) {
    if (!user) {
      return jsonResponse(req, {
        success: false,
        error: "UNAUTHORIZED"
      }, 401);
    }
    const authorization = await authorizePaymentForClient(req, user, winnerContext.clientId);
    if (authorization instanceof Response) {
      return authorization;
    }
  }
  const winnerStatus = String(winner.status).trim().toUpperCase();
  if (winnerStatus === "CANCELLED") {
    return jsonResponse(req, {
      success: false,
      error: "WINNER_CANCELLED",
      message: "This winner has been cancelled."
    }, 400);
  }
  if (winnerStatus !== "PENDING" && winnerStatus !== "CONFIRMED") {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_WINNER_STATUS",
      message: `Winner cannot be paid because status is ${winner.status}.`
    }, 400);
  }
  const order = await findOrderForWinner(bidWinnerId);
  if (order?.client_id && String(order.client_id) !== winnerContext.clientId) {
    throw new Error("Winner/order client ownership mismatch.");
  }
  if (order?.order_group_id) {
    const group = await findOrderGroup(order.order_group_id);
    if (String(group.client_id) !== winnerContext.clientId) {
      throw new Error("Winner/order-group client ownership mismatch.");
    }
    const groupStatus = String(group.group_status).trim().toUpperCase();
    if (groupStatus !== "OPEN") {
      return jsonResponse(req, {
        success: false,
        error: "WINNER_IS_IN_LOCKED_ORDER_GROUP",
        message: "This winner belongs to a consolidated order group. Use order_group_id to create the payment.",
        order_group_id: group.order_group_id,
        group_number: group.group_number,
        group_status: groupStatus
      }, 409);
    }
  }
  await ensureWinnerPaymentDeadline(winner, winnerContext.clientId);
  const latestWinner = await findWinner(bidWinnerId);
  const existingPayment = await findExistingWinnerPayment(bidWinnerId, environment);
  let replacementForPaymentId = null;
  if (existingPayment) {
    const reuse = await prepareExistingPaymentForReuse(req, existingPayment, latestWinner, forceRefresh);
    if (reuse instanceof Response) {
      return reuse;
    }
    replacementForPaymentId = reuse.replacementForPaymentId;
  }
  const amount = Number(winner.winning_amt);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_WINNING_AMOUNT",
      message: "Invalid winning amount."
    }, 400);
  }
  const checkout = await createWinnerPayMongoCheckout({
    amount,
    bidWinnerId,
    auctionItemId: winner.auction_item_id,
    itemLabel: winnerContext.auctionItem.item_label || "Auction Item",
    environment
  });
  const payment = await createWinnerPaymentRecord({
    orderId: order?.order_id || null,
    auctionItemId: winner.auction_item_id,
    bidWinnerId,
    winningBidId: winner.bid_id || null,
    amount,
    checkoutSessionId: checkout.checkoutSessionId,
    checkoutUrl: checkout.checkoutUrl,
    environment,
    replacementForPaymentId
  });
  if (replacementForPaymentId) {
    const { error: replacementError } = await supabase.from("payments").update({
      replaced_by_payment_id: payment.payment_id,
      updated_at: new Date().toISOString()
    }).eq("payment_id", replacementForPaymentId);
    if (replacementError) {
      throw new Error(`old payment replacement link update failed: ${replacementError.message}`);
    }
  }
  return jsonResponse(req, {
    success: true,
    payment_type: "AUCTION_WINNER",
    environment,
    already_paid: false,
    existing_payment: false,
    payment,
    checkout_url: checkout.checkoutUrl
  }, 200);
}
/* =========================================================
   ORDER GROUP ENVIRONMENT
   ========================================================= */ function resolveOrderGroupEnvironment(orderGroup) {
  const raw = getString(orderGroup?.environment);
  /*
   * Existing consolidated-order flow predates EO2MATE
   * auction environment control. Until order_groups gets its
   * own explicit environment column populated by the caller,
   * keep legacy group payments in TEST for safety.
   */ if (!raw) {
    return "TEST";
  }
  return normalizePaymentEnvironment(raw);
}
/* =========================================================
   GROUP PAYMENT FLOW
   ========================================================= */ async function processOrderGroupPayment(req, orderGroupId, user, internalService, forceRefresh = false) {
  if (!isUuid(orderGroupId)) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_ORDER_GROUP_ID"
    }, 400);
  }
  const orderGroup = await findOrderGroup(orderGroupId);
  const environment = resolveOrderGroupEnvironment(orderGroup);
  const clientId = getString(orderGroup.client_id);
  if (!clientId) {
    throw new Error("Order group has no client_id.");
  }
  if (!internalService) {
    if (!user) {
      return jsonResponse(req, {
        success: false,
        error: "UNAUTHORIZED"
      }, 401);
    }
    const authorization = await authorizePaymentForClient(req, user, clientId);
    if (authorization instanceof Response) {
      return authorization;
    }
  } else {
    /*
     * Internal calls come from trusted EO2MATE Edge Functions
     * using the service-role Authorization + apikey pair.
     *
     * We skip client_users authorization, but still require the
     * client's PayMongo capability to be ACTIVE.
     */ const capability = await findPaymentCapability(clientId);
    if (!capability || capability.provider !== "PAYMONGO" || capability.accountStatus !== "ACTIVE" || capability.paymentEnabled !== true) {
      return jsonResponse(req, {
        success: false,
        error: "PAYMENT_GATEWAY_NOT_ACTIVE",
        message: "Online payment is not active for this client."
      }, 409);
    }
  }
  const groupStatus = String(orderGroup.group_status).trim().toUpperCase();
  const paymentDeadline = await ensureGroupPaymentDeadline(orderGroup);
  const existingPayment = await findExistingGroupPayment(orderGroupId, environment);
  let replacementForPaymentId = null;
  if (existingPayment) {
    const latestGroup = await findOrderGroup(orderGroupId);
    const reuse = await prepareExistingPaymentForReuse(req, existingPayment, latestGroup, forceRefresh);
    if (reuse instanceof Response) {
      return reuse;
    }
    replacementForPaymentId = reuse.replacementForPaymentId;
  }
  if (groupStatus === "PAID") {
    return jsonResponse(req, {
      success: true,
      already_paid: true,
      payment_type: "ORDER_GROUP",
      order_group: orderGroup,
      checkout_url: null
    }, 200);
  }
  const lockedAt = getString(orderGroup.locked_at);
  const validManualCheckout = !internalService && groupStatus === "READY_FOR_PAYMENT";
  const validInternalGroupedCheckout = internalService && Boolean(lockedAt) && [
    "OPEN",
    "PAYMENT_PENDING"
  ].includes(groupStatus);
  if (!validManualCheckout && !validInternalGroupedCheckout) {
    return jsonResponse(req, {
      success: false,
      error: "ORDER_GROUP_NOT_READY_FOR_PAYMENT",
      message: internalService ? "Internal grouped checkout requires an OPEN group that has already been locked by EO2MATE." : `Order group cannot create a checkout because its status is ${groupStatus}.`,
      current_status: groupStatus,
      locked_at: lockedAt
    }, 409);
  }
  const groupOrders = await findGroupOrders(orderGroupId);
  if (groupOrders.length === 0) {
    return jsonResponse(req, {
      success: false,
      error: "ORDER_GROUP_HAS_NO_ITEMS",
      message: "The consolidated order has no active items."
    }, 400);
  }
  const { data: ownershipRows, error: ownershipError } = await supabase.from("orders").select("order_id, client_id").eq("order_group_id", orderGroupId).neq("order_status", "CANCELLED");
  if (ownershipError) {
    throw new Error(`group ownership lookup failed: ${ownershipError.message}`);
  }
  for (const row of ownershipRows || []){
    if (String(row.client_id) !== clientId) {
      throw new Error(`Order ${row.order_id} has a client ownership mismatch.`);
    }
  }
  const subtotal = Number(orderGroup.subtotal);
  const shippingFee = Number(orderGroup.shipping_fee || 0);
  const totalAmount = Number(orderGroup.total_amount);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_GROUP_SUBTOTAL"
    }, 400);
  }
  if (!Number.isFinite(shippingFee) || shippingFee < 0) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_GROUP_SHIPPING_FEE"
    }, 400);
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return jsonResponse(req, {
      success: false,
      error: "INVALID_GROUP_TOTAL_AMOUNT"
    }, 400);
  }
  const expectedTotal = Math.round((subtotal + shippingFee) * 100) / 100;
  const actualTotal = Math.round(totalAmount * 100) / 100;
  if (expectedTotal !== actualTotal) {
    return jsonResponse(req, {
      success: false,
      error: "ORDER_GROUP_TOTAL_MISMATCH",
      subtotal,
      shipping_fee: shippingFee,
      expected_total: expectedTotal,
      actual_total: actualTotal
    }, 409);
  }
  if (!internalService && (!getString(orderGroup.shipping_name) || !getString(orderGroup.shipping_phone) || !getString(orderGroup.shipping_address_line1) || !getString(orderGroup.shipping_city) || !getString(orderGroup.shipping_province) || !getString(orderGroup.preferred_courier_code))) {
    return jsonResponse(req, {
      success: false,
      error: "SHIPPING_DETAILS_INCOMPLETE",
      message: "Shipping details and courier must be completed before payment."
    }, 409);
  }
  log("ORDER GROUP CHECKOUT CREATE", {
    orderGroupId,
    groupNumber: orderGroup.group_number,
    environment,
    internalService,
    groupStatus,
    lockedAt,
    itemCount: groupOrders.length,
    subtotal,
    shippingFee,
    totalAmount
  });
  const checkout = await createGroupPayMongoCheckout({
    orderGroup,
    groupOrders,
    environment
  });
  const payment = await createGroupPaymentRecord({
    orderGroupId,
    amount: totalAmount,
    checkoutSessionId: checkout.checkoutSessionId,
    checkoutUrl: checkout.checkoutUrl,
    environment,
    replacementForPaymentId
  });
  if (replacementForPaymentId) {
    const { error: replacementError } = await supabase.from("payments").update({
      replaced_by_payment_id: payment.payment_id,
      updated_at: new Date().toISOString()
    }).eq("payment_id", replacementForPaymentId);
    if (replacementError) {
      throw new Error(`old payment replacement link update failed: ${replacementError.message}`);
    }
  }
  const updatedGroup = await markGroupPaymentPending(orderGroupId);
  return jsonResponse(req, {
    success: true,
    payment_type: "ORDER_GROUP",
    environment,
    already_paid: false,
    existing_payment: false,
    order_group: {
      order_group_id: orderGroup.order_group_id,
      group_number: orderGroup.group_number,
      item_count: groupOrders.length,
      subtotal,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      group_status: updatedGroup.group_status
    },
    payment: {
      payment_id: payment.payment_id,
      order_group_id: payment.order_group_id,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      environment: payment.environment,
      status: payment.status,
      checkout_session_id: payment.checkout_session_id,
      checkout_url: payment.checkout_url
    },
    checkout_url: checkout.checkoutUrl
  }, 200);
}
/* =========================================================
   HTTP HANDLER
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -----------------------------------------------------
         CORS PREFLIGHT
         ----------------------------------------------------- */ if (req.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: getCorsHeaders(req)
      });
    }
    /* -----------------------------------------------------
         METHOD
         ----------------------------------------------------- */ if (req.method !== "POST") {
      return jsonResponse(req, {
        success: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST."
      }, 405);
    }
    /* -----------------------------------------------------
         AUTHENTICATION
         ----------------------------------------------------- */ const internalService = isInternalServiceRequest(req);
    let authenticated = null;
    if (!internalService) {
      const authResult = await authenticateRequest(req);
      if (authResult instanceof Response) {
        return authResult;
      }
      authenticated = authResult;
    }
    /* -----------------------------------------------------
         BODY
         ----------------------------------------------------- */ let body;
    try {
      body = await req.json();
    } catch  {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_JSON",
        message: "Invalid JSON request body."
      }, 400);
    }
    const bidWinnerId = getString(body?.bid_winner_id);
    const orderGroupId = getString(body?.order_group_id);
    const forceRefresh = body?.force_refresh === true;
    if (!bidWinnerId && !orderGroupId) {
      return jsonResponse(req, {
        success: false,
        error: "MISSING_PAYMENT_TARGET",
        message: "Provide bid_winner_id or order_group_id."
      }, 400);
    }
    if (bidWinnerId && orderGroupId) {
      return jsonResponse(req, {
        success: false,
        error: "MULTIPLE_PAYMENT_TARGETS",
        message: "Provide only one of bid_winner_id or order_group_id."
      }, 400);
    }
    if (orderGroupId) {
      return await processOrderGroupPayment(req, orderGroupId, authenticated, internalService, forceRefresh);
    }
    return await processWinnerPayment(req, bidWinnerId, authenticated, internalService, forceRefresh);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    errorLog("CREATE PAYMENT ERROR", {
      error: errorMessage
    });
    return jsonResponse(req, {
      success: false,
      error: "CREATE_PAYMENT_FAILED",
      message: errorMessage
    }, 500);
  }
});
