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
console.info("buyer-shipping-details started");
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
   COURIER
   ========================================================= */ async function findCourier(courierCode) {
  const { data, error } = await supabase.from("couriers").select(`
          courier_code,
          courier_name,
          status,
          supports_api
        `).eq("courier_code", courierCode).maybeSingle();
  if (error) {
    throw new Error(`couriers lookup failed: ${error.message}`);
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
    const shippingName = getString(body.shipping_name);
    const shippingPhone = getString(body.shipping_phone);
    const addressLine1 = getString(body.shipping_address_line1);
    const addressLine2 = getString(body.shipping_address_line2);
    const city = getString(body.shipping_city);
    const province = getString(body.shipping_province);
    const postalCode = getString(body.shipping_postal_code);
    const country = getString(body.shipping_country) || "PH";
    const courierCode = getString(body.preferred_courier_code)?.toUpperCase() || null;
    /* -----------------------------------------------------
         REQUIRED FIELDS
         ----------------------------------------------------- */ if (!checkoutToken) {
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
    if (!shippingName) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_NAME_REQUIRED"
      }, 400);
    }
    if (!shippingPhone) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_PHONE_REQUIRED"
      }, 400);
    }
    if (!addressLine1) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_ADDRESS_REQUIRED"
      }, 400);
    }
    if (!city) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_CITY_REQUIRED"
      }, 400);
    }
    if (!province) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_PROVINCE_REQUIRED"
      }, 400);
    }
    if (!postalCode) {
      return jsonResponse(req, {
        success: false,
        error: "SHIPPING_POSTAL_CODE_REQUIRED"
      }, 400);
    }
    if (!courierCode) {
      return jsonResponse(req, {
        success: false,
        error: "COURIER_REQUIRED"
      }, 400);
    }
    /* -----------------------------------------------------
         CHECKOUT SESSION
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
        message: "Shipping submission currently requires an order group."
      }, 409);
    }
    /* -----------------------------------------------------
         ORDER GROUP
         ----------------------------------------------------- */ const group = await findOrderGroup(session.order_group_id);
    /*
       * Token must belong to the same client and group.
       */ if (String(group.client_id) !== String(session.client_id)) {
      return jsonResponse(req, {
        success: false,
        error: "CHECKOUT_OWNERSHIP_MISMATCH"
      }, 403);
    }
    if (String(group.order_group_id) !== String(session.order_group_id)) {
      return jsonResponse(req, {
        success: false,
        error: "CHECKOUT_GROUP_MISMATCH"
      }, 403);
    }
    const groupStatus = String(group.group_status || "").trim().toUpperCase();
    const checkoutChoice = String(group.buyer_checkout_choice || "").trim().toUpperCase();
    /*
       * Buyer must have selected PAY_NOW first.
       */ if (checkoutChoice !== "PAY_NOW" || !group.locked_at) {
      return jsonResponse(req, {
        success: false,
        error: "CHECKOUT_NOT_LOCKED",
        message: "Choose Pay Now before submitting shipping details."
      }, 409);
    }
    /*
       * Idempotency:
       * if already READY_FOR_PAYMENT,
       * don't submit again.
       */ if (groupStatus === "READY_FOR_PAYMENT") {
      return jsonResponse(req, {
        success: true,
        already_submitted: true,
        order_group: group
      }, 200);
    }
    if (groupStatus !== "AWAITING_SHIPPING_DETAILS") {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_GROUP_STATUS",
        message: `Shipping details cannot be submitted while group status is ${groupStatus}.`,
        current_status: groupStatus,
        expected_status: "AWAITING_SHIPPING_DETAILS"
      }, 409);
    }
    /* -----------------------------------------------------
         COURIER
         ----------------------------------------------------- */ const courier = await findCourier(courierCode);
    if (!courier) {
      return jsonResponse(req, {
        success: false,
        error: "COURIER_NOT_FOUND"
      }, 400);
    }
    if (String(courier.status).trim().toUpperCase() !== "ACTIVE") {
      return jsonResponse(req, {
        success: false,
        error: "COURIER_NOT_ACTIVE"
      }, 409);
    }
    /* -----------------------------------------------------
         TOTAL
         ----------------------------------------------------- */ /*
       * For now we retain the shipping_fee already
       * calculated/stored on the order group.
       *
       * Automatic courier quotation comes later.
       */ const subtotal = Number(group.subtotal || 0);
    const shippingFee = Number(group.shipping_fee || 0);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_SUBTOTAL"
      }, 409);
    }
    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_SHIPPING_FEE"
      }, 409);
    }
    const totalAmount = Math.round((subtotal + shippingFee) * 100) / 100;
    /* -----------------------------------------------------
         SAVE GROUP SHIPPING
         ----------------------------------------------------- */ const now = new Date().toISOString();
    const { data: updatedGroup, error: updateError } = await supabase.from("order_groups").update({
      preferred_courier_code: courierCode,
      shipping_name: shippingName,
      shipping_phone: shippingPhone,
      shipping_address_line1: addressLine1,
      shipping_address_line2: addressLine2,
      shipping_city: city,
      shipping_province: province,
      shipping_postal_code: postalCode,
      shipping_country: country,
      total_amount: totalAmount,
      group_status: "READY_FOR_PAYMENT",
      updated_at: now
    }).eq("order_group_id", group.order_group_id).eq("group_status", "AWAITING_SHIPPING_DETAILS").select("*").maybeSingle();
    if (updateError) {
      throw new Error(`shipping update failed: ${updateError.message}`);
    }
    if (!updatedGroup) {
      return jsonResponse(req, {
        success: false,
        error: "ORDER_GROUP_CHANGED",
        message: "The order changed before shipping details could be saved. Reload and try again."
      }, 409);
    }
    /* -----------------------------------------------------
         COPY SHIPPING TO CHILD ORDERS
         ----------------------------------------------------- */ const { error: childOrderError } = await supabase.from("orders").update({
      preferred_courier_code: courierCode,
      shipping_name: shippingName,
      shipping_phone: shippingPhone,
      shipping_address_line1: addressLine1,
      shipping_address_line2: addressLine2,
      shipping_city: city,
      shipping_province: province,
      shipping_postal_code: postalCode,
      shipping_country: country,
      updated_at: now
    }).eq("order_group_id", group.order_group_id).neq("order_status", "CANCELLED");
    if (childOrderError) {
      throw new Error(`child order shipping update failed: ${childOrderError.message}`);
    }
    /* -----------------------------------------------------
         SUCCESS
         ----------------------------------------------------- */ return jsonResponse(req, {
      success: true,
      already_submitted: false,
      courier: {
        courier_code: courier.courier_code,
        courier_name: courier.courier_name,
        supports_api: courier.supports_api === true
      },
      order_group: {
        order_group_id: updatedGroup.order_group_id,
        group_number: updatedGroup.group_number,
        group_status: updatedGroup.group_status,
        subtotal: Number(updatedGroup.subtotal || 0),
        shipping_fee: Number(updatedGroup.shipping_fee || 0),
        total_amount: Number(updatedGroup.total_amount || 0),
        preferred_courier_code: updatedGroup.preferred_courier_code,
        shipping_name: updatedGroup.shipping_name,
        shipping_phone: updatedGroup.shipping_phone,
        shipping_address_line1: updatedGroup.shipping_address_line1,
        shipping_address_line2: updatedGroup.shipping_address_line2,
        shipping_city: updatedGroup.shipping_city,
        shipping_province: updatedGroup.shipping_province,
        shipping_postal_code: updatedGroup.shipping_postal_code,
        shipping_country: updatedGroup.shipping_country
      }
    }, 200);
  } catch (error) {
    return jsonResponse(req, {
      success: false,
      error: "BUYER_SHIPPING_DETAILS_FAILED",
      message: getErrorMessage(error)
    }, 500);
  }
});
