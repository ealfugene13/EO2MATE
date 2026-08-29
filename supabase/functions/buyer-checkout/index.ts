import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is not configured.");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
}
/* =========================================================
   SUPABASE
   ========================================================= */ const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
/* =========================================================
   CORS
   ========================================================= */ const ALLOWED_ORIGINS = [
  "https://ealfugene13.github.io"
];
function getCorsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
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
   HELPERS
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
function getString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const result = String(value).trim();
  return result || null;
}
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function getErrorMessage(error) {
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
   CHECKOUT SESSION
   ========================================================= */ async function findCheckoutSession(checkoutToken) {
  const { data, error } = await supabase.from("buyer_checkout_sessions").select("*").eq("checkout_token", checkoutToken).maybeSingle();
  if (error) {
    throw new Error(`buyer_checkout_sessions lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   CLIENT
   ========================================================= */ async function findClient(clientId) {
  const { data, error } = await supabase.from("master_clients").select("client_id, name, status").eq("client_id", clientId).maybeSingle();
  if (error) {
    throw new Error(`master_clients lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Client was not found.");
  }
  return data;
}
/* =========================================================
   PAYMENT CAPABILITY
   ========================================================= */ async function findPaymentCapability(clientId) {
  const { data, error } = await supabase.from("client_payment_accounts").select("*").eq("client_id", clientId).eq("provider", "PAYMONGO").maybeSingle();
  if (error) {
    throw new Error(`client_payment_accounts lookup failed: ${error.message}`);
  }
  if (!data) {
    return {
      provider: "PAYMONGO",
      account_status: "NOT_CONFIGURED",
      payment_enabled: false
    };
  }
  return {
    provider: "PAYMONGO",
    account_status: String(data.account_status || data.onboarding_status || "NOT_CONFIGURED").trim().toUpperCase(),
    payment_enabled: data.payment_enabled === true
  };
}
/* =========================================================
   SINGLE WINNER
   ========================================================= */ async function buildWinnerCheckout(bidWinnerId) {
  const { data: winner, error: winnerError } = await supabase.from("auction_winners").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (winnerError) {
    throw new Error(`auction_winners lookup failed: ${winnerError.message}`);
  }
  if (!winner) {
    throw new Error("Winner was not found.");
  }
  const { data: item, error: itemError } = await supabase.from("auction_items").select("auction_item_id, auction_post_id, item_label").eq("auction_item_id", winner.auction_item_id).maybeSingle();
  if (itemError) {
    throw new Error(`auction_items lookup failed: ${itemError.message}`);
  }
  if (!item) {
    throw new Error("Auction item was not found.");
  }
  const { data: order, error: orderError } = await supabase.from("orders").select(`
          order_id,
          order_number,
          order_group_id,
          order_status,
          payment_status,
          subtotal,
          shipping_fee,
          total_amount,
          buyer_name,
          buyer_phone,
          buyer_email,
          preferred_courier_code,
          shipping_name,
          shipping_phone,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_province,
          shipping_postal_code,
          shipping_country
        `).eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (orderError) {
    throw new Error(`orders lookup failed: ${orderError.message}`);
  }
  return {
    checkout_type: "AUCTION_WINNER",
    bid_winner_id: winner.bid_winner_id,
    winner_status: winner.status,
    item: {
      auction_item_id: item.auction_item_id,
      item_label: item.item_label,
      amount: Number(winner.winning_amt || 0)
    },
    order: order ? {
      order_id: order.order_id,
      order_number: order.order_number,
      order_group_id: order.order_group_id,
      order_status: order.order_status,
      payment_status: order.payment_status,
      subtotal: Number(order.subtotal || 0),
      shipping_fee: Number(order.shipping_fee || 0),
      total_amount: Number(order.total_amount || 0),
      buyer_name: order.buyer_name,
      preferred_courier_code: order.preferred_courier_code,
      shipping_name: order.shipping_name,
      shipping_phone: order.shipping_phone,
      shipping_address_line1: order.shipping_address_line1,
      shipping_address_line2: order.shipping_address_line2,
      shipping_city: order.shipping_city,
      shipping_province: order.shipping_province,
      shipping_postal_code: order.shipping_postal_code,
      shipping_country: order.shipping_country
    } : null
  };
}
/* =========================================================
   ORDER GROUP
   ========================================================= */ async function buildGroupCheckout(orderGroupId) {
  const { data: group, error: groupError } = await supabase.from("order_groups").select("*").eq("order_group_id", orderGroupId).maybeSingle();
  if (groupError) {
    throw new Error(`order_groups lookup failed: ${groupError.message}`);
  }
  if (!group) {
    throw new Error("Order group was not found.");
  }
  const { data: orders, error: ordersError } = await supabase.from("orders").select(`
          order_id,
          order_number,
          auction_item_id,
          bid_winner_id,
          subtotal,
          total_amount,
          order_status,
          payment_status,
          auction_items (
            item_label
          )
        `).eq("order_group_id", orderGroupId).neq("order_status", "CANCELLED").order("created_at", {
    ascending: true
  });
  if (ordersError) {
    throw new Error(`orders lookup failed: ${ordersError.message}`);
  }
  const safeOrders = (orders || []).map((order)=>({
      order_id: order.order_id,
      order_number: order.order_number,
      auction_item_id: order.auction_item_id,
      bid_winner_id: order.bid_winner_id,
      item_label: order?.auction_items?.item_label || "Auction Item",
      subtotal: Number(order.subtotal || 0),
      total_amount: Number(order.total_amount || 0),
      order_status: order.order_status,
      payment_status: order.payment_status
    }));
  return {
    checkout_type: "ORDER_GROUP",
    order_group: {
      order_group_id: group.order_group_id,
      group_number: group.group_number,
      group_status: group.group_status,
      buyer_name: group.buyer_name,
      buyer_checkout_choice: group.buyer_checkout_choice,
      subtotal: Number(group.subtotal || 0),
      shipping_fee: Number(group.shipping_fee || 0),
      total_amount: Number(group.total_amount || 0),
      preferred_courier_code: group.preferred_courier_code,
      shipping_name: group.shipping_name,
      shipping_phone: group.shipping_phone,
      shipping_address_line1: group.shipping_address_line1,
      shipping_address_line2: group.shipping_address_line2,
      shipping_city: group.shipping_city,
      shipping_province: group.shipping_province,
      shipping_postal_code: group.shipping_postal_code,
      shipping_country: group.shipping_country
    },
    items: safeOrders
  };
}
/* =========================================================
   HTTP
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -----------------------------------------------------
         CORS
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
         BODY
         ----------------------------------------------------- */ let body;
    try {
      body = await req.json();
    } catch  {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_JSON"
      }, 400);
    }
    const checkoutToken = getString(body?.checkout_token);
    if (!checkoutToken) {
      return jsonResponse(req, {
        success: false,
        error: "MISSING_CHECKOUT_TOKEN"
      }, 400);
    }
    if (!isUuid(checkoutToken)) {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_CHECKOUT_TOKEN"
      }, 400);
    }
    /* -----------------------------------------------------
         SESSION
         ----------------------------------------------------- */ const session = await findCheckoutSession(checkoutToken);
    if (!session) {
      return jsonResponse(req, {
        success: false,
        error: "CHECKOUT_NOT_FOUND"
      }, 404);
    }
    const sessionStatus = String(session.status || "").trim().toUpperCase();
    if (sessionStatus !== "ACTIVE") {
      return jsonResponse(req, {
        success: false,
        error: "CHECKOUT_NOT_ACTIVE",
        status: sessionStatus
      }, 409);
    }
    if (session.expires_at) {
      const expiresAt = new Date(session.expires_at);
      if (expiresAt.getTime() < Date.now()) {
        return jsonResponse(req, {
          success: false,
          error: "CHECKOUT_EXPIRED"
        }, 410);
      }
    }
    const clientId = getString(session.client_id);
    if (!clientId) {
      throw new Error("Checkout session has no client_id.");
    }
    /* -----------------------------------------------------
         CLIENT
         ----------------------------------------------------- */ const client = await findClient(clientId);
    if (String(client.status).trim().toUpperCase() !== "ACTIVE") {
      return jsonResponse(req, {
        success: false,
        error: "CLIENT_NOT_ACTIVE"
      }, 409);
    }
    /* -----------------------------------------------------
         PAYMENT AVAILABILITY
         ----------------------------------------------------- */ const paymentCapability = await findPaymentCapability(clientId);
    /* -----------------------------------------------------
         CHECKOUT TARGET
         ----------------------------------------------------- */ let checkoutData;
    if (session.order_group_id) {
      checkoutData = await buildGroupCheckout(session.order_group_id);
    } else if (session.bid_winner_id) {
      checkoutData = await buildWinnerCheckout(session.bid_winner_id);
    } else {
      throw new Error("Checkout session has no valid payment target.");
    }
    /* -----------------------------------------------------
         SUCCESS
         ----------------------------------------------------- */ return jsonResponse(req, {
      success: true,
      checkout_session: {
        checkout_session_id: session.checkout_session_id,
        checkout_token: session.checkout_token,
        status: session.status,
        expires_at: session.expires_at
      },
      seller: {
        client_id: client.client_id,
        name: client.name
      },
      payment: {
        provider: paymentCapability.provider,
        account_status: paymentCapability.account_status,
        payment_enabled: paymentCapability.payment_enabled
      },
      ...checkoutData
    }, 200);
  } catch (error) {
    return jsonResponse(req, {
      success: false,
      error: "BUYER_CHECKOUT_FAILED",
      message: getErrorMessage(error)
    }, 500);
  }
});
