import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PAYMONGO_SECRET_KEY = Deno.env.get("PAYMONGO_SECRET_KEY");
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
console.info("buyer-create-payment started");
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
   ORDER GROUP
   ========================================================= */ async function findOrderGroup(orderGroupId) {
  const { data, error } = await supabase.from("order_groups").select("*").eq("order_group_id", orderGroupId).maybeSingle();
  if (error) {
    throw new Error(`order_groups lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Order group was not found.");
  }
  return data;
}
/* =========================================================
   GROUP ORDERS
   ========================================================= */ async function findGroupOrders(orderGroupId) {
  const { data, error } = await supabase.from("orders").select(`
          order_id,
          order_number,
          client_id,
          auction_item_id,
          bid_winner_id,
          buyer_name,
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
  if (error) {
    throw new Error(`group orders lookup failed: ${error.message}`);
  }
  return data || [];
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
      payment_enabled: false,
      paymongo_account_id: null
    };
  }
  return {
    provider: "PAYMONGO",
    account_status: String(data.account_status || data.onboarding_status || "NOT_CONFIGURED").trim().toUpperCase(),
    payment_enabled: data.payment_enabled === true,
    paymongo_account_id: getString(data.paymongo_account_id)
  };
}
/* =========================================================
   EXISTING PAYMENT
   ========================================================= */ async function findExistingPayment(orderGroupId) {
  const { data, error } = await supabase.from("payments").select("*").eq("order_group_id", orderGroupId).in("status", [
    "pending",
    "paid"
  ]).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`payment lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   EXISTING PAYMENT RESPONSE
   ========================================================= */ function existingPaymentResponse(req, payment) {
  const status = String(payment.status || "").trim().toLowerCase();
  if (status === "paid") {
    return jsonResponse(req, {
      success: true,
      already_paid: true,
      existing_payment: true,
      payment: {
        payment_id: payment.payment_id,
        order_group_id: payment.order_group_id,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        payment_reference: payment.payment_reference,
        paid_at: payment.paid_at
      },
      checkout_url: null
    }, 200);
  }
  if (status === "pending" && payment.checkout_url) {
    return jsonResponse(req, {
      success: true,
      already_paid: false,
      existing_payment: true,
      payment: {
        payment_id: payment.payment_id,
        order_group_id: payment.order_group_id,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        checkout_session_id: payment.checkout_session_id,
        checkout_url: payment.checkout_url
      },
      checkout_url: payment.checkout_url
    }, 200);
  }
  return null;
}
/* =========================================================
   PAYMONGO REQUEST
   ========================================================= */ async function paymongoRequest(endpoint, method = "GET", body) {
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error("PAYMONGO_SECRET_KEY is not configured.");
  }
  const auth = btoa(`${PAYMONGO_SECRET_KEY}:`);
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
   CREATE PAYMONGO CHECKOUT
   ========================================================= */ async function createPayMongoCheckout(orderGroup, groupOrders) {
  const totalAmount = Number(orderGroup.total_amount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Invalid order group total amount.");
  }
  const amountInCentavos = Math.round(totalAmount * 100);
  if (amountInCentavos <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  const itemCount = groupOrders.length;
  if (itemCount === 0) {
    throw new Error("Order group has no active items.");
  }
  const buyerName = getString(orderGroup.shipping_name) || getString(orderGroup.buyer_name) || "Customer";
  const lineItemName = itemCount === 1 ? "Consolidated Order - 1 Item" : `Consolidated Order - ${itemCount} Items`;
  /*
   * IMPORTANT:
   *
   * CARD is included so test-mode payment can be
   * completed using PayMongo test card credentials.
   *
   * QRPH remains available for production/customer use.
   *
   * Never scan a test-mode QR Ph code with a real
   * wallet just to simulate payment.
   */ const paymentMethodTypes = [
    "card",
    "qrph"
  ];
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
        payment_method_types: paymentMethodTypes,
        metadata: {
          payment_type: "ORDER_GROUP",
          buyer_checkout: "true",
          order_group_id: orderGroup.order_group_id,
          client_id: orderGroup.client_id,
          group_number: orderGroup.group_number,
          item_count: String(itemCount)
        }
      }
    }
  };
  console.log("Creating buyer PayMongo checkout", {
    orderGroupId: orderGroup.order_group_id,
    groupNumber: orderGroup.group_number,
    totalAmount,
    amountInCentavos,
    itemCount,
    paymentMethodTypes
  });
  const result = await paymongoRequest("checkout_sessions", "POST", checkoutBody);
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
  console.log("Buyer PayMongo checkout created", {
    checkoutSessionId,
    checkoutUrl,
    paymentMethodTypes
  });
  return {
    checkoutSessionId,
    checkoutUrl,
    paymentMethodTypes
  };
}
/* =========================================================
   CREATE LOCAL PAYMENT
   ========================================================= */ async function createPaymentRecord(params) {
  const { data, error } = await supabase.from("payments").insert({
    order_id: null,
    order_group_id: params.orderGroupId,
    auction_item_id: null,
    bid_winner_id: null,
    winning_bid_id: null,
    amount: params.amount,
    currency: "PHP",
    provider: "PAYMONGO",
    status: "pending",
    checkout_session_id: params.checkoutSessionId,
    checkout_url: params.checkoutUrl
  }).select("*").single();
  if (error) {
    throw new Error(`payment insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   MARK GROUP PAYMENT PENDING
   ========================================================= */ async function markGroupPaymentPending(orderGroupId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("order_groups").update({
    group_status: "PAYMENT_PENDING",
    updated_at: now
  }).eq("order_group_id", orderGroupId).eq("group_status", "READY_FOR_PAYMENT").select("*").maybeSingle();
  if (error) {
    throw new Error(`order group PAYMENT_PENDING update failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Order group could not transition from READY_FOR_PAYMENT to PAYMENT_PENDING.");
  }
  return data;
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
         ENV
         ----------------------------------------------------- */ if (!PAYMONGO_SECRET_KEY) {
      return jsonResponse(req, {
        success: false,
        error: "PAYMONGO_SECRET_KEY_NOT_CONFIGURED",
        message: "PAYMONGO_SECRET_KEY is not configured."
      }, 500);
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
    const checkoutToken = getString(body.checkout_token);
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
        checkout_status: sessionStatus
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
    if (!session.order_group_id) {
      return jsonResponse(req, {
        success: false,
        error: "UNSUPPORTED_CHECKOUT_TYPE",
        message: "Buyer payment currently requires an order group."
      }, 409);
    }
    /* -----------------------------------------------------
         GROUP
         ----------------------------------------------------- */ const orderGroup = await findOrderGroup(session.order_group_id);
    if (String(orderGroup.client_id) !== String(session.client_id)) {
      return jsonResponse(req, {
        success: false,
        error: "CHECKOUT_OWNERSHIP_MISMATCH"
      }, 403);
    }
    const clientId = getString(orderGroup.client_id);
    if (!clientId) {
      throw new Error("Order group has no client_id.");
    }
    /* -----------------------------------------------------
         EXISTING PAYMENT
         ----------------------------------------------------- */ const existingPayment = await findExistingPayment(orderGroup.order_group_id);
    if (existingPayment) {
      const response = existingPaymentResponse(req, existingPayment);
      if (response) {
        return response;
      }
    }
    /* -----------------------------------------------------
         GROUP STATUS
         ----------------------------------------------------- */ const groupStatus = String(orderGroup.group_status || "").trim().toUpperCase();
    if (groupStatus === "PAID") {
      return jsonResponse(req, {
        success: true,
        already_paid: true,
        existing_payment: false,
        order_group: {
          order_group_id: orderGroup.order_group_id,
          group_number: orderGroup.group_number,
          group_status: orderGroup.group_status
        },
        checkout_url: null
      }, 200);
    }
    if (groupStatus !== "READY_FOR_PAYMENT") {
      return jsonResponse(req, {
        success: false,
        error: "ORDER_GROUP_NOT_READY_FOR_PAYMENT",
        message: `Order group cannot create a checkout because its status is ${groupStatus}.`,
        expected_status: "READY_FOR_PAYMENT",
        current_status: groupStatus
      }, 409);
    }
    /* -----------------------------------------------------
         PAYMENT CAPABILITY
         ----------------------------------------------------- */ const capability = await findPaymentCapability(clientId);
    if (capability.account_status !== "ACTIVE" || capability.payment_enabled !== true) {
      return jsonResponse(req, {
        success: false,
        error: "PAYMENT_GATEWAY_NOT_ACTIVE",
        message: "Online payment is not active for this seller.",
        provider: "PAYMONGO",
        account_status: capability.account_status,
        payment_enabled: capability.payment_enabled
      }, 409);
    }
    /* -----------------------------------------------------
         SHIPPING VALIDATION
         ----------------------------------------------------- */ if (!getString(orderGroup.shipping_name) || !getString(orderGroup.shipping_phone) || !getString(orderGroup.shipping_address_line1) || !getString(orderGroup.shipping_city) || !getString(orderGroup.shipping_province) || !getString(orderGroup.shipping_postal_code) || !getString(orderGroup.preferred_courier_code)) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_DETAILS_INCOMPLETE",
        message: "Complete shipping details before payment."
      }, 409);
    }
    /* -----------------------------------------------------
         TOTAL VALIDATION
         ----------------------------------------------------- */ const subtotal = Number(orderGroup.subtotal);
    const shippingFee = Number(orderGroup.shipping_fee || 0);
    const totalAmount = Number(orderGroup.total_amount);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_GROUP_SUBTOTAL"
      }, 409);
    }
    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_GROUP_SHIPPING_FEE"
      }, 409);
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_GROUP_TOTAL_AMOUNT"
      }, 409);
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
    /* -----------------------------------------------------
         CHILD ORDERS
         ----------------------------------------------------- */ const groupOrders = await findGroupOrders(orderGroup.order_group_id);
    if (groupOrders.length === 0) {
      return jsonResponse(req, {
        success: false,
        error: "ORDER_GROUP_HAS_NO_ITEMS",
        message: "The consolidated order has no active items."
      }, 400);
    }
    /*
       * Service role bypasses RLS, so explicitly verify
       * every child order belongs to the same client.
       */ for (const order of groupOrders){
      if (String(order.client_id) !== clientId) {
        throw new Error(`Order ${order.order_id} has a client ownership mismatch.`);
      }
    }
    /* -----------------------------------------------------
         CREATE PAYMONGO CHECKOUT
         ----------------------------------------------------- */ const checkout = await createPayMongoCheckout(orderGroup, groupOrders);
    /* -----------------------------------------------------
         LOCAL PAYMENT
         ----------------------------------------------------- */ const payment = await createPaymentRecord({
      orderGroupId: orderGroup.order_group_id,
      amount: totalAmount,
      checkoutSessionId: checkout.checkoutSessionId,
      checkoutUrl: checkout.checkoutUrl
    });
    /* -----------------------------------------------------
         GROUP -> PAYMENT_PENDING
         ----------------------------------------------------- */ const updatedGroup = await markGroupPaymentPending(orderGroup.order_group_id);
    /* -----------------------------------------------------
         SUCCESS
         ----------------------------------------------------- */ return jsonResponse(req, {
      success: true,
      payment_type: "ORDER_GROUP",
      already_paid: false,
      existing_payment: false,
      payment_methods: checkout.paymentMethodTypes,
      order_group: {
        order_group_id: updatedGroup.order_group_id,
        group_number: updatedGroup.group_number,
        group_status: updatedGroup.group_status,
        subtotal: Number(updatedGroup.subtotal || 0),
        shipping_fee: Number(updatedGroup.shipping_fee || 0),
        total_amount: Number(updatedGroup.total_amount || 0)
      },
      payment: {
        payment_id: payment.payment_id,
        order_group_id: payment.order_group_id,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        checkout_session_id: payment.checkout_session_id,
        checkout_url: payment.checkout_url
      },
      checkout_url: checkout.checkoutUrl
    }, 200);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("BUYER CREATE PAYMENT ERROR", {
      error: message
    });
    return jsonResponse(req, {
      success: false,
      error: "BUYER_CREATE_PAYMENT_FAILED",
      message
    }, 500);
  }
});
