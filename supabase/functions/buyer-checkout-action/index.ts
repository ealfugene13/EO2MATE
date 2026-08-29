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
console.info("buyer-checkout-action started");
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
   VALIDATE CHECKOUT SESSION
   ========================================================= */ function validateCheckoutSession(session) {
  if (!session) {
    return {
      valid: false,
      error: "CHECKOUT_NOT_FOUND",
      status: 404
    };
  }
  const status = String(session.status || "").trim().toUpperCase();
  if (status !== "ACTIVE") {
    return {
      valid: false,
      error: "CHECKOUT_NOT_ACTIVE",
      status: 409,
      checkoutStatus: status
    };
  }
  if (session.expires_at) {
    const expiresAt = new Date(session.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      return {
        valid: false,
        error: "CHECKOUT_EXPIRED",
        status: 410
      };
    }
  }
  return {
    valid: true
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
    throw new Error("Order group was not found.");
  }
  return data;
}
/* =========================================================
   VERIFY SESSION OWNERSHIP
   ========================================================= */ function verifySessionOwnership(session, group) {
  if (String(session.client_id) !== String(group.client_id)) {
    throw new Error("Checkout session/client ownership mismatch.");
  }
  if (String(session.order_group_id) !== String(group.order_group_id)) {
    throw new Error("Checkout session/order-group ownership mismatch.");
  }
}
/* =========================================================
   WAIT FOR MORE
   ========================================================= */ async function processWaitForMore(group) {
  const groupStatus = String(group.group_status || "").trim().toUpperCase();
  const currentChoice = getString(group.buyer_checkout_choice)?.toUpperCase() || null;
  /*
   * Once PAY_NOW has locked the group,
   * it cannot be reopened through buyer checkout.
   */ if (group.locked_at || currentChoice === "PAY_NOW" || groupStatus !== "OPEN") {
    return {
      success: false,
      error: "ORDER_GROUP_ALREADY_LOCKED",
      message: "This checkout has already been locked and can no longer wait for more items.",
      current_status: groupStatus,
      buyer_checkout_choice: currentChoice,
      status: 409
    };
  }
  /*
   * Idempotency.
   */ if (currentChoice === "WAIT_FOR_MORE") {
    return {
      success: true,
      already_selected: true,
      action: "WAIT_FOR_MORE",
      group
    };
  }
  const now = new Date().toISOString();
  const { data: updatedGroup, error: updateError } = await supabase.from("order_groups").update({
    buyer_checkout_choice: "WAIT_FOR_MORE",
    buyer_choice_at: now,
    updated_at: now
  }).eq("order_group_id", group.order_group_id).eq("group_status", "OPEN").is("locked_at", null).select("*").maybeSingle();
  if (updateError) {
    throw new Error(`WAIT_FOR_MORE update failed: ${updateError.message}`);
  }
  if (!updatedGroup) {
    return {
      success: false,
      error: "ORDER_GROUP_CHANGED",
      message: "The order group changed before this request completed. Please reload the checkout.",
      status: 409
    };
  }
  return {
    success: true,
    already_selected: false,
    action: "WAIT_FOR_MORE",
    group: updatedGroup
  };
}
/* =========================================================
   PAY NOW
   ========================================================= */ async function processPayNow(group) {
  const groupStatus = String(group.group_status || "").trim().toUpperCase();
  const currentChoice = getString(group.buyer_checkout_choice)?.toUpperCase() || null;
  /*
   * Already PAY_NOW.
   *
   * This is considered successful/idempotent.
   */ if (currentChoice === "PAY_NOW" && group.locked_at) {
    return {
      success: true,
      already_selected: true,
      action: "PAY_NOW",
      group
    };
  }
  /*
   * PAY_NOW must start from an OPEN group.
   */ if (groupStatus !== "OPEN") {
    return {
      success: false,
      error: "ORDER_GROUP_NOT_OPEN",
      message: `This checkout cannot be locked because its current status is ${groupStatus}.`,
      current_status: groupStatus,
      status: 409
    };
  }
  const now = new Date().toISOString();
  /*
   * Locking the group is important:
   *
   * additional auction wins should no longer
   * be consolidated into this checkout after
   * the buyer chooses PAY_NOW.
   */ const { data: updatedGroup, error: updateError } = await supabase.from("order_groups").update({
    buyer_checkout_choice: "PAY_NOW",
    buyer_choice_at: now,
    locked_at: now,
    group_status: "AWAITING_SHIPPING_DETAILS",
    updated_at: now
  }).eq("order_group_id", group.order_group_id).eq("group_status", "OPEN").is("locked_at", null).select("*").maybeSingle();
  if (updateError) {
    throw new Error(`PAY_NOW update failed: ${updateError.message}`);
  }
  if (!updatedGroup) {
    return {
      success: false,
      error: "ORDER_GROUP_CHANGED",
      message: "The order group changed before this request completed. Please reload the checkout.",
      status: 409
    };
  }
  return {
    success: true,
    already_selected: false,
    action: "PAY_NOW",
    group: updatedGroup
  };
}
/* =========================================================
   HTTP
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
    const action = getString(body.action)?.toUpperCase() || null;
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
    if (!action) {
      return jsonResponse(req, {
        success: false,
        error: "MISSING_ACTION"
      }, 400);
    }
    if (action !== "PAY_NOW" && action !== "WAIT_FOR_MORE") {
      return jsonResponse(req, {
        success: false,
        error: "INVALID_ACTION",
        message: "action must be PAY_NOW or WAIT_FOR_MORE."
      }, 400);
    }
    /* -----------------------------------------------------
         SESSION
         ----------------------------------------------------- */ const session = await findCheckoutSession(checkoutToken);
    const validation = validateCheckoutSession(session);
    if (validation.valid !== true) {
      return jsonResponse(req, {
        success: false,
        error: validation.error,
        checkout_status: validation.checkoutStatus || null
      }, validation.status || 409);
    }
    /*
       * First implementation supports consolidated
       * ORDER_GROUP checkout actions.
       */ if (!session.order_group_id) {
      return jsonResponse(req, {
        success: false,
        error: "UNSUPPORTED_CHECKOUT_TYPE",
        message: "Buyer checkout actions currently require an order group."
      }, 409);
    }
    /* -----------------------------------------------------
         GROUP
         ----------------------------------------------------- */ const group = await findOrderGroup(session.order_group_id);
    verifySessionOwnership(session, group);
    /* -----------------------------------------------------
         ACTION
         ----------------------------------------------------- */ const result = action === "PAY_NOW" ? await processPayNow(group) : await processWaitForMore(group);
    if (result.success !== true) {
      return jsonResponse(req, result, result.status || 409);
    }
    /* -----------------------------------------------------
         SUCCESS
         ----------------------------------------------------- */ return jsonResponse(req, {
      success: true,
      action: result.action,
      already_selected: result.already_selected,
      order_group: {
        order_group_id: result.group.order_group_id,
        group_number: result.group.group_number,
        group_status: result.group.group_status,
        buyer_checkout_choice: result.group.buyer_checkout_choice,
        buyer_choice_at: result.group.buyer_choice_at,
        locked_at: result.group.locked_at,
        subtotal: Number(result.group.subtotal || 0),
        shipping_fee: Number(result.group.shipping_fee || 0),
        total_amount: Number(result.group.total_amount || 0)
      }
    }, 200);
  } catch (error) {
    return jsonResponse(req, {
      success: false,
      error: "BUYER_CHECKOUT_ACTION_FAILED",
      message: getErrorMessage(error)
    }, 500);
  }
});
