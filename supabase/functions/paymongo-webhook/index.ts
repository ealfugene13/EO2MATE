import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYMONGO_WEBHOOK_SECRET = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
const PROD_PAYMONGO_WEBHOOK_SECRET = Deno.env.get("PROD_PAYMONGO_WEBHOOK_SECRET");
const META_GRAPH_VERSION = "v23.0";
if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}
/* =========================================================
   SUPABASE
   ========================================================= */ const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
console.info("paymongo-webhook started");
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
   ERROR
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
   RESPONSE
   ========================================================= */ function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
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
   HEX
   ========================================================= */ function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes)).map((byte)=>byte.toString(16).padStart(2, "0")).join("");
}
/* =========================================================
   SAFE COMPARISON
   ========================================================= */ function safeEqual(first, second) {
  if (first.length !== second.length) {
    return false;
  }
  let result = 0;
  for(let i = 0; i < first.length; i++){
    result |= first.charCodeAt(i) ^ second.charCodeAt(i);
  }
  return result === 0;
}
/* =========================================================
   PAYMONGO SIGNATURE
   ========================================================= */ function parsePaymongoSignature(header) {
  const result = {
    timestamp: null,
    testSignature: null,
    liveSignature: null
  };
  const parts = header.split(",");
  for (const part of parts){
    const [rawKey, ...valueParts] = part.split("=");
    const key = rawKey?.trim();
    const value = valueParts.join("=").trim();
    if (key === "t") {
      result.timestamp = value || null;
    }
    if (key === "te") {
      result.testSignature = value || null;
    }
    if (key === "li") {
      result.liveSignature = value || null;
    }
  }
  return result;
}
/* =========================================================
   HMAC
   ========================================================= */ async function generateHmac(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(signature);
}
/* =========================================================
   VERIFY SIGNATURE
   ========================================================= */ async function verifyPaymongoSignature(signatureHeader, rawBody) {
  const parsed = parsePaymongoSignature(signatureHeader);
  if (!parsed.timestamp) {
    return null;
  }
  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  /*
   * PayMongo provides separate signature fields:
   * te = test
   * li = live
   *
   * Verify each against its corresponding webhook secret.
   */ if (parsed.testSignature && PAYMONGO_WEBHOOK_SECRET) {
    const expectedTestSignature = await generateHmac(PAYMONGO_WEBHOOK_SECRET, signedPayload);
    if (safeEqual(expectedTestSignature, parsed.testSignature)) {
      return "TEST";
    }
  }
  if (parsed.liveSignature && PROD_PAYMONGO_WEBHOOK_SECRET) {
    const expectedLiveSignature = await generateHmac(PROD_PAYMONGO_WEBHOOK_SECRET, signedPayload);
    if (safeEqual(expectedLiveSignature, parsed.liveSignature)) {
      return "PROD";
    }
  }
  return null;
}
/* =========================================================
   EVENT TYPE
   ========================================================= */ function getEventType(payload) {
  return getString(payload?.data?.attributes?.type) || getString(payload?.event_type) || (getString(payload?.data?.type) !== "event" ? getString(payload?.data?.type) : null);
}
/* =========================================================
   EVENT RESOURCE
   ========================================================= */ function getEventResource(payload) {
  if (payload?.data?.attributes?.data) {
    return payload.data.attributes.data;
  }
  if (payload?.data?.data) {
    return payload.data.data;
  }
  return null;
}
/* =========================================================
   ATTRIBUTES
   ========================================================= */ function getResourceAttributes(resource) {
  return resource?.attributes || {};
}
/* =========================================================
   PAYMONGO PAYMENT OBJECT
   ========================================================= */ function getPaymongoPayment(resource) {
  const attributes = getResourceAttributes(resource);
  const payments = Array.isArray(attributes?.payments) ? attributes.payments : [];
  for (const payment of payments){
    const status = getString(payment?.attributes?.status);
    if (status?.toLowerCase() === "paid") {
      return payment;
    }
  }
  if (payments.length > 0) {
    return payments[payments.length - 1];
  }
  if (resource?.type === "payment") {
    return resource;
  }
  return null;
}
/* =========================================================
   METADATA
   ========================================================= */ function getMetadata(resource) {
  const attributes = getResourceAttributes(resource);
  const directMetadata = attributes?.metadata || resource?.metadata;
  if (directMetadata && typeof directMetadata === "object") {
    return directMetadata;
  }
  const payment = getPaymongoPayment(resource);
  const paymentMetadata = payment?.attributes?.metadata;
  if (paymentMetadata && typeof paymentMetadata === "object") {
    return paymentMetadata;
  }
  return {};
}
/* =========================================================
   PAYMENT TYPE
   ========================================================= */ function getPaymentType(resource) {
  const metadata = getMetadata(resource);
  const explicitType = getString(metadata?.payment_type);
  if (explicitType) {
    return explicitType.toUpperCase();
  }
  if (getString(metadata?.order_group_id)) {
    return "ORDER_GROUP";
  }
  return "AUCTION_WINNER";
}
/* =========================================================
   RESOURCE ENVIRONMENT
   ========================================================= */ function getResourceEnvironment(resource) {
  const metadata = getMetadata(resource);
  const value = getString(metadata?.environment)?.toUpperCase();
  if (value === "TEST") {
    return "TEST";
  }
  if (value === "PROD") {
    return "PROD";
  }
  return null;
}
/* =========================================================
   BID WINNER ID
   ========================================================= */ function getBidWinnerId(resource) {
  const metadata = getMetadata(resource);
  const metadataWinnerId = getString(metadata?.bid_winner_id);
  if (metadataWinnerId) {
    return metadataWinnerId;
  }
  const attributes = getResourceAttributes(resource);
  const referenceNumber = getString(attributes?.reference_number);
  if (referenceNumber && isUuid(referenceNumber)) {
    return referenceNumber;
  }
  return null;
}
/* =========================================================
   ORDER GROUP ID
   ========================================================= */ function getOrderGroupId(resource) {
  const metadata = getMetadata(resource);
  return getString(metadata?.order_group_id);
}
/* =========================================================
   CHECKOUT SESSION ID
   ========================================================= */ function getCheckoutSessionId(resource) {
  if (resource?.type === "checkout_session") {
    return getString(resource?.id);
  }
  return null;
}
/* =========================================================
   PAYMONGO PAYMENT ID
   ========================================================= */ function getPaymongoPaymentId(resource) {
  const payment = getPaymongoPayment(resource);
  return getString(payment?.id);
}
/* =========================================================
   PAYMONGO STATUS
   ========================================================= */ function getPaymongoPaymentStatus(resource) {
  const payment = getPaymongoPayment(resource);
  return getString(payment?.attributes?.status);
}
/* =========================================================
   PAYMENT REFERENCE
   ========================================================= */ function getPaymentReference(resource) {
  return getPaymongoPaymentId(resource) || getCheckoutSessionId(resource);
}
/* =========================================================
   FIND LOCAL WINNER PAYMENT
   ========================================================= */ async function findWinnerPayment(bidWinnerId, environment) {
  const { data, error } = await supabase.from("payments").select("*").eq("bid_winner_id", bidWinnerId).eq("environment", environment).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`Winner payment lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   FIND LOCAL GROUP PAYMENT
   ========================================================= */ async function findGroupPayment(orderGroupId, environment) {
  const { data, error } = await supabase.from("payments").select("*").eq("order_group_id", orderGroupId).eq("environment", environment).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`Group payment lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   MARK LOCAL PAYMENT PAID
   ========================================================= */ async function markLocalPaymentPaid(payment, resource) {
  const now = new Date().toISOString();
  const paymentReference = getPaymentReference(resource);
  const updateData = {
    status: "paid",
    paid_at: payment.paid_at || now,
    updated_at: now
  };
  if (paymentReference && !payment.payment_reference) {
    updateData.payment_reference = paymentReference;
  }
  const { data, error } = await supabase.from("payments").update(updateData).eq("payment_id", payment.payment_id).select("*").single();
  if (error) {
    throw new Error(`Payment update failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   CONFIRM WINNER
   ========================================================= */ async function confirmWinner(bidWinnerId) {
  const { data: winner, error: lookupError } = await supabase.from("auction_winners").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (lookupError) {
    throw new Error(`auction_winners lookup failed: ${lookupError.message}`);
  }
  if (!winner) {
    throw new Error(`Auction winner ${bidWinnerId} does not exist.`);
  }
  if (String(winner.status).toUpperCase() === "CANCELLED") {
    throw new Error(`Auction winner ${bidWinnerId} is CANCELLED.`);
  }
  if (String(winner.status).toUpperCase() === "CONFIRMED") {
    return winner;
  }
  const { data, error } = await supabase.from("auction_winners").update({
    status: "CONFIRMED"
  }).eq("bid_winner_id", bidWinnerId).select("*").single();
  if (error) {
    throw new Error(`auction_winners update failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   UPDATE SINGLE ORDER
   ========================================================= */ async function markSingleOrderReady(bidWinnerId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("orders").update({
    payment_status: "PAID",
    order_status: "READY_FOR_DELIVERY",
    paid_at: now,
    ready_for_delivery_at: now,
    updated_at: now
  }).eq("bid_winner_id", bidWinnerId).select("*").maybeSingle();
  if (error) {
    throw new Error(`Single order update failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   ENSURE SINGLE DELIVERY
   ========================================================= */ async function ensureSingleDelivery(order) {
  if (!order) {
    return null;
  }
  const { data: existing, error: lookupError } = await supabase.from("deliveries").select("*").eq("order_id", order.order_id).maybeSingle();
  if (lookupError) {
    throw new Error(`Single delivery lookup failed: ${lookupError.message}`);
  }
  if (existing) {
    return existing;
  }
  const courierCode = getString(order.preferred_courier_code);
  let courierName = null;
  if (courierCode) {
    const { data: courier } = await supabase.from("couriers").select("courier_name").eq("courier_code", courierCode).maybeSingle();
    courierName = getString(courier?.courier_name);
  }
  const { data, error } = await supabase.from("deliveries").insert({
    order_id: order.order_id,
    order_group_id: null,
    client_id: order.client_id,
    courier_code: courierCode,
    courier_name: courierName,
    delivery_status: "READY_FOR_BOOKING",
    shipping_fee: Number(order.shipping_fee || 0),
    recipient_name: order.shipping_name || order.buyer_name,
    recipient_phone: order.shipping_phone || order.buyer_phone,
    address_line1: order.shipping_address_line1,
    address_line2: order.shipping_address_line2,
    city: order.shipping_city,
    province: order.shipping_province,
    postal_code: order.shipping_postal_code,
    country: order.shipping_country || "PH"
  }).select("*").single();
  if (error) {
    throw new Error(`Single delivery insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   FIND ORDER GROUP
   ========================================================= */ async function findOrderGroup(orderGroupId) {
  const { data, error } = await supabase.from("order_groups").select("*").eq("order_group_id", orderGroupId).maybeSingle();
  if (error) {
    throw new Error(`order_groups lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Order group ${orderGroupId} does not exist.`);
  }
  return data;
}
/* =========================================================
   FIND GROUP ORDERS
   ========================================================= */ async function findGroupOrders(orderGroupId) {
  const { data, error } = await supabase.from("orders").select("*").eq("order_group_id", orderGroupId).neq("order_status", "CANCELLED");
  if (error) {
    throw new Error(`Group orders lookup failed: ${error.message}`);
  }
  return data || [];
}
/* =========================================================
   CONFIRM GROUP WINNERS
   ========================================================= */ async function confirmGroupWinners(orders) {
  const winnerIds = Array.from(new Set(orders.map((order)=>getString(order.bid_winner_id)).filter((value)=>Boolean(value))));
  if (winnerIds.length === 0) {
    return;
  }
  const { error } = await supabase.from("auction_winners").update({
    status: "CONFIRMED"
  }).in("bid_winner_id", winnerIds).neq("status", "CANCELLED");
  if (error) {
    throw new Error(`Group winners update failed: ${error.message}`);
  }
}
/* =========================================================
   MARK GROUP ORDERS READY
   ========================================================= */ async function markGroupOrdersReady(orderGroupId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("orders").update({
    payment_status: "PAID",
    order_status: "READY_FOR_DELIVERY",
    paid_at: now,
    ready_for_delivery_at: now,
    updated_at: now
  }).eq("order_group_id", orderGroupId).neq("order_status", "CANCELLED").select("*");
  if (error) {
    throw new Error(`Group orders update failed: ${error.message}`);
  }
  return data || [];
}
/* =========================================================
   MARK GROUP READY FOR DELIVERY
   ========================================================= */ async function markGroupReadyForDelivery(orderGroupId) {
  const { data, error } = await supabase.from("order_groups").update({
    group_status: "READY_FOR_DELIVERY",
    updated_at: new Date().toISOString()
  }).eq("order_group_id", orderGroupId).select("*").single();
  if (error) {
    throw new Error(`Order group update failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   ENSURE GROUP DELIVERY
   ========================================================= */ async function ensureGroupDelivery(group) {
  const { data: existing, error: lookupError } = await supabase.from("deliveries").select("*").eq("order_group_id", group.order_group_id).maybeSingle();
  if (lookupError) {
    throw new Error(`Group delivery lookup failed: ${lookupError.message}`);
  }
  if (existing) {
    return existing;
  }
  const courierCode = getString(group.preferred_courier_code);
  let courierName = null;
  if (courierCode) {
    const { data: courier, error: courierError } = await supabase.from("couriers").select("courier_name").eq("courier_code", courierCode).maybeSingle();
    if (courierError) {
      errorLog("Courier lookup failed", {
        courierCode,
        error: courierError.message
      });
    }
    courierName = getString(courier?.courier_name);
  }
  const { data, error } = await supabase.from("deliveries").insert({
    order_id: null,
    order_group_id: group.order_group_id,
    client_id: group.client_id,
    courier_code: courierCode,
    courier_name: courierName,
    delivery_status: "READY_FOR_BOOKING",
    shipping_fee: Number(group.shipping_fee || 0),
    recipient_name: group.shipping_name,
    recipient_phone: group.shipping_phone,
    address_line1: group.shipping_address_line1,
    address_line2: group.shipping_address_line2,
    city: group.shipping_city,
    province: group.shipping_province,
    postal_code: group.shipping_postal_code,
    country: group.shipping_country || "PH"
  }).select("*").single();
  if (error) {
    throw new Error(`Group delivery insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   MESSENGER CLAIM
   ========================================================= */ async function findMessengerClaim(bidWinnerId) {
  const { data, error } = await supabase.from("messenger_payment_claims").select("*").eq("bid_winner_id", bidWinnerId).not("claimed_psid", "is", null).order("claimed_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`messenger_payment_claims lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   GROUP MESSENGER CLAIM
   ========================================================= */ async function findGroupMessengerClaim(orderGroupId) {
  const { data, error } = await supabase.from("messenger_payment_claims").select("*").eq("order_group_id", orderGroupId).not("claimed_psid", "is", null).order("claimed_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`Group messenger_payment_claims lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   PAGE TOKEN
   ========================================================= */ async function getPageAccessToken(fbPageId) {
  const { data, error } = await supabase.from("fb_pages").select("access_token").eq("fb_page_id", fbPageId).maybeSingle();
  if (error) {
    throw new Error(`fb_pages token lookup failed: ${error.message}`);
  }
  if (!data?.access_token) {
    throw new Error(`Facebook Page ${fbPageId} has no access token.`);
  }
  return String(data.access_token);
}
/* =========================================================
   META POST
   ========================================================= */ async function metaJsonPost(endpoint, accessToken, body) {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
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
  if (!response.ok || json?.error) {
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}
/* =========================================================
   SEND MESSENGER
   ========================================================= */ async function sendMessengerMessage(fbPageId, psid, messageText) {
  try {
    const accessToken = await getPageAccessToken(fbPageId);
    await metaJsonPost(`${fbPageId}/messages`, accessToken, {
      recipient: {
        id: psid
      },
      messaging_type: "RESPONSE",
      message: {
        text: messageText
      }
    });
    return true;
  } catch (error) {
    errorLog("Messenger send failed", {
      fbPageId,
      psid,
      error: getErrorMessage(error)
    });
    return false;
  }
}
/* =========================================================
   CLAIM PAYMENT CONFIRMATION MESSAGE
   ========================================================= */ /*
 * Atomically claims the right to send the payment-confirmed
 * Messenger message.
 *
 * Only one webhook execution can change:
 *
 * confirmation_sent_at: NULL -> timestamp
 *
 * Duplicate PayMongo paid events will receive no row and
 * therefore will NOT send the message again.
 */ async function claimPaymentConfirmation(paymentId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("payments").update({
    confirmation_sent_at: now
  }).eq("payment_id", paymentId).is("confirmation_sent_at", null).select("payment_id, confirmation_sent_at").maybeSingle();
  if (error) {
    throw new Error(`Payment confirmation claim failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   RELEASE PAYMENT CONFIRMATION CLAIM
   ========================================================= */ /*
 * If Messenger delivery itself fails after we claimed the
 * confirmation, clear the claim so a later webhook retry can
 * attempt the message again.
 */ async function releasePaymentConfirmationClaim(paymentId, claimedAt) {
  const { error } = await supabase.from("payments").update({
    confirmation_sent_at: null
  }).eq("payment_id", paymentId).eq("confirmation_sent_at", claimedAt);
  if (error) {
    errorLog("Unable to release payment confirmation claim", {
      paymentId,
      error: error.message
    });
  }
}
/* =========================================================
   SINGLE PAYMENT CONFIRMATION
   ========================================================= */ async function sendSinglePaymentConfirmation(bidWinnerId, payment) {
  const paymentId = getString(payment?.payment_id);
  if (!paymentId) {
    errorLog("Cannot send payment confirmation: payment_id missing", {
      bidWinnerId
    });
    return false;
  }
  const confirmationClaim = await claimPaymentConfirmation(paymentId);
  if (!confirmationClaim) {
    log("Payment confirmation already sent or claimed - skipping duplicate", {
      paymentId,
      bidWinnerId
    });
    return false;
  }
  const claimedAt = String(confirmationClaim.confirmation_sent_at);
  try {
    const claim = await findMessengerClaim(bidWinnerId);
    if (!claim) {
      await releasePaymentConfirmationClaim(paymentId, claimedAt);
      return false;
    }
    const fbPageId = getString(claim.fb_page_id);
    const psid = getString(claim.claimed_psid);
    if (!fbPageId || !psid) {
      await releasePaymentConfirmationClaim(paymentId, claimedAt);
      return false;
    }
    const amount = Number(payment.amount);
    const amountText = Number.isFinite(amount) ? amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) : String(payment.amount);
    const message = [
      "Payment confirmed â",
      "",
      `We received your PHP ${amountText} payment.`,
      "",
      "Payment verification is complete.",
      "",
      "Thank you!"
    ].join("\n");
    const sent = await sendMessengerMessage(fbPageId, psid, message);
    if (!sent) {
      await releasePaymentConfirmationClaim(paymentId, claimedAt);
    }
    return sent;
  } catch (error) {
    await releasePaymentConfirmationClaim(paymentId, claimedAt);
    errorLog("Single Messenger confirmation failed", {
      bidWinnerId,
      error: getErrorMessage(error)
    });
    return false;
  }
}
/* =========================================================
   GROUP PAYMENT CONFIRMATION
   ========================================================= */ async function sendGroupPaymentConfirmation(group, orders, payment) {
  const paymentId = getString(payment?.payment_id);
  const orderGroupId = getString(group?.order_group_id);
  if (!paymentId || !orderGroupId) {
    errorLog("Cannot send group payment confirmation: payment_id/order_group_id missing", {
      paymentId,
      orderGroupId
    });
    return false;
  }
  const confirmationClaim = await claimPaymentConfirmation(paymentId);
  if (!confirmationClaim) {
    log("Group payment confirmation already sent or claimed - skipping duplicate", {
      paymentId,
      orderGroupId
    });
    return false;
  }
  const claimedAt = String(confirmationClaim.confirmation_sent_at);
  try {
    /*
     * IMPORTANT:
     * Consolidated/group claims are stored against order_group_id.
     * Their bid_winner_id can legitimately be NULL, so looking up
     * claims through each child order's bid_winner_id misses the
     * actual Messenger recipient. Resolve the claimed PSID directly
     * from the group claim first.
     */ const groupClaim = await findGroupMessengerClaim(orderGroupId);
    let fbPageId = getString(groupClaim?.fb_page_id);
    let psid = getString(groupClaim?.claimed_psid);
    /*
     * Backward-compatible fallback for old records that were created
     * before group claims were stored with order_group_id.
     */ if (!fbPageId || !psid) {
      for (const order of orders){
        const bidWinnerId = getString(order.bid_winner_id);
        if (!bidWinnerId) {
          continue;
        }
        const oldClaim = await findMessengerClaim(bidWinnerId);
        fbPageId = getString(oldClaim?.fb_page_id);
        psid = getString(oldClaim?.claimed_psid);
        if (fbPageId && psid) {
          break;
        }
      }
    }
    if (!fbPageId || !psid) {
      log("No Messenger recipient for consolidated payment", {
        orderGroupId
      });
      await releasePaymentConfirmationClaim(paymentId, claimedAt);
      return false;
    }
    const amount = Number(payment.amount);
    const amountText = Number.isFinite(amount) ? amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) : String(payment.amount);
    /* ASCII-safe text avoids mojibake/garbage characters in Messenger. */ const message = [
      "Payment confirmed",
      "",
      `We received your PHP ${amountText} payment.`,
      "",
      "Payment verification is complete.",
      "",
      "Thank you!"
    ].join("\n");
    const sent = await sendMessengerMessage(fbPageId, psid, message);
    if (!sent) {
      await releasePaymentConfirmationClaim(paymentId, claimedAt);
    }
    log("Group payment confirmation Messenger result", {
      orderGroupId,
      paymentId,
      fbPageId,
      psid,
      sent
    });
    return sent;
  } catch (error) {
    await releasePaymentConfirmationClaim(paymentId, claimedAt);
    errorLog("Group Messenger confirmation failed", {
      orderGroupId,
      error: getErrorMessage(error)
    });
    return false;
  }
}
/* =========================================================
   PROCESS SINGLE PAYMENT
   ========================================================= */ async function processSingleWinnerPayment(resource, environment) {
  const bidWinnerId = getBidWinnerId(resource);
  if (!bidWinnerId) {
    throw new Error("Single-winner payment has no bid_winner_id.");
  }
  if (!isUuid(bidWinnerId)) {
    throw new Error(`Invalid bid_winner_id: ${bidWinnerId}`);
  }
  const existingPayment = await findWinnerPayment(bidWinnerId, environment);
  if (!existingPayment) {
    throw new Error(`No local payment found for winner ${bidWinnerId}.`);
  }
  const payment = await markLocalPaymentPaid(existingPayment, resource);
  const winner = await confirmWinner(bidWinnerId);
  /*
   * EO2MATE current production scope stops at
   * successful payment verification.
   *
   * Do NOT move the order to READY_FOR_DELIVERY and
   * do NOT create a delivery record here.
   */ const messengerSent = await sendSinglePaymentConfirmation(bidWinnerId, payment);
  log("SINGLE PAYMENT COMPLETE", {
    bidWinnerId,
    paymentId: payment.payment_id,
    winnerStatus: winner.status,
    environment,
    stoppedAt: "PAYMENT_CONFIRMED",
    messengerSent
  });
  return {
    payment_type: "AUCTION_WINNER",
    bid_winner_id: bidWinnerId,
    payment_id: payment.payment_id,
    environment,
    stopped_at: "PAYMENT_CONFIRMED",
    messenger_sent: messengerSent
  };
}
/* =========================================================
   PROCESS GROUP PAYMENT
   ========================================================= */ async function processGroupPayment(resource, environment) {
  const orderGroupId = getOrderGroupId(resource);
  if (!orderGroupId) {
    throw new Error("Consolidated payment has no order_group_id.");
  }
  if (!isUuid(orderGroupId)) {
    throw new Error(`Invalid order_group_id: ${orderGroupId}`);
  }
  const existingPayment = await findGroupPayment(orderGroupId, environment);
  if (!existingPayment) {
    throw new Error(`No local payment found for order group ${orderGroupId}.`);
  }
  const payment = await markLocalPaymentPaid(existingPayment, resource);
  const originalOrders = await findGroupOrders(orderGroupId);
  if (originalOrders.length === 0) {
    throw new Error(`Order group ${orderGroupId} has no active child orders.`);
  }
  await confirmGroupWinners(originalOrders);
  /*
   * EO2MATE current scope stops at payment verification.
   * Keep order/delivery state untouched after payment.
   */ const group = await findOrderGroup(orderGroupId);
  const messengerSent = await sendGroupPaymentConfirmation(group, originalOrders, payment);
  log("CONSOLIDATED PAYMENT COMPLETE", {
    orderGroupId,
    groupNumber: group.group_number,
    paymentId: payment.payment_id,
    childOrders: originalOrders.length,
    environment,
    stoppedAt: "PAYMENT_CONFIRMED",
    messengerSent
  });
  return {
    payment_type: "ORDER_GROUP",
    order_group_id: orderGroupId,
    group_number: group.group_number,
    payment_id: payment.payment_id,
    child_orders: originalOrders.length,
    environment,
    stopped_at: "PAYMENT_CONFIRMED",
    messenger_sent: messengerSent
  };
}
/* =========================================================
   SUCCESSFUL PAYMENT
   ========================================================= */ async function processSuccessfulPayment(eventType, resource, environment) {
  const paymentType = getPaymentType(resource);
  const resourceEnvironment = getResourceEnvironment(resource);
  if (resourceEnvironment && resourceEnvironment !== environment) {
    throw new Error(`PayMongo environment mismatch. Signature=${environment}, metadata=${resourceEnvironment}.`);
  }
  const checkoutSessionId = getCheckoutSessionId(resource);
  const paymongoPaymentId = getPaymongoPaymentId(resource);
  const paymongoStatus = getPaymongoPaymentStatus(resource);
  log("Successful PayMongo event", {
    eventType,
    paymentType,
    checkoutSessionId,
    paymongoPaymentId,
    paymongoStatus,
    environment,
    resourceEnvironment,
    bidWinnerId: getBidWinnerId(resource),
    orderGroupId: getOrderGroupId(resource)
  });
  if (paymentType === "ORDER_GROUP") {
    return await processGroupPayment(resource, environment);
  }
  return await processSingleWinnerPayment(resource, environment);
}
/* =========================================================
   WEBHOOK
   ========================================================= */ Deno.serve(async (req)=>{
  if (req.method !== "POST") {
    return jsonResponse({
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "Use POST."
    }, 405);
  }
  /*
     * Signature validation requires
     * the raw untouched body.
     */ const rawBody = await req.text();
  if (!rawBody) {
    return jsonResponse({
      success: false,
      error: "EMPTY_BODY"
    }, 400);
  }
  /* =====================================================
       SIGNATURE
       ===================================================== */ const signatureHeader = req.headers.get("paymongo-signature");
  if (!signatureHeader) {
    errorLog("Missing Paymongo-Signature header");
    return jsonResponse({
      success: false,
      error: "MISSING_SIGNATURE"
    }, 401);
  }
  let environment = null;
  try {
    environment = await verifyPaymongoSignature(signatureHeader, rawBody);
  } catch (error) {
    errorLog("PayMongo signature verification error", {
      error: getErrorMessage(error)
    });
    return jsonResponse({
      success: false,
      error: "SIGNATURE_VERIFICATION_FAILED"
    }, 401);
  }
  if (!environment) {
    errorLog("Invalid PayMongo webhook signature");
    return jsonResponse({
      success: false,
      error: "INVALID_SIGNATURE"
    }, 401);
  }
  /* =====================================================
       JSON
       ===================================================== */ let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch  {
    return jsonResponse({
      success: false,
      error: "INVALID_JSON"
    }, 400);
  }
  try {
    const eventType = getEventType(payload);
    const resource = getEventResource(payload);
    log("PayMongo webhook received", {
      eventType,
      eventId: payload?.data?.id || null
    });
    if (!eventType) {
      throw new Error("Unable to determine PayMongo event type.");
    }
    const supportedEvents = [
      "checkout_session.payment.paid",
      "payment.paid",
      "link.payment.paid"
    ];
    if (supportedEvents.includes(eventType)) {
      if (!resource) {
        throw new Error(`${eventType} has no resource.`);
      }
      const result = await processSuccessfulPayment(eventType, resource, environment);
      return jsonResponse({
        success: true,
        processed: true,
        event_type: eventType,
        environment,
        result
      }, 200);
    }
    /* =====================================================
         IGNORE OTHER EVENTS
         ===================================================== */ log("Ignoring PayMongo event", {
      eventType
    });
    return jsonResponse({
      success: true,
      processed: false,
      event_type: eventType
    }, 200);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    errorLog("PAYMONGO WEBHOOK PROCESSING ERROR", {
      error: errorMessage
    });
    return jsonResponse({
      success: false,
      error: "WEBHOOK_PROCESSING_FAILED",
      message: errorMessage
    }, 500);
  }
});
