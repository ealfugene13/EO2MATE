import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
console.info("update-delivery-status started");
/* =========================================================
   HELPERS
   ========================================================= */ function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
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
   FIND DELIVERY
   ========================================================= */ async function findDelivery(deliveryId) {
  const { data, error } = await supabase.from("deliveries").select("*").eq("delivery_id", deliveryId).maybeSingle();
  if (error) {
    throw new Error(`deliveries lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Delivery ${deliveryId} was not found.`);
  }
  return data;
}
/* =========================================================
   ALLOWED TRANSITIONS
   ========================================================= */ function getAllowedNextStatuses(delivery) {
  const currentStatus = String(delivery.delivery_status || "").trim().toUpperCase();
  const fulfillmentMethod = String(delivery.fulfillment_method || "PICKUP_BY_COURIER").trim().toUpperCase();
  /* ---------------------------------------------------------
     CLIENT DROP-OFF

     BOOKED
       ↓
     DROPPED_OFF
       ↓
     IN_TRANSIT
       ↓
     DELIVERED
     --------------------------------------------------------- */ if (fulfillmentMethod === "CLIENT_DROP_OFF") {
    const transitions = {
      BOOKED: [
        "DROPPED_OFF"
      ],
      DROPPED_OFF: [
        "IN_TRANSIT"
      ],
      IN_TRANSIT: [
        "DELIVERED"
      ]
    };
    return transitions[currentStatus] || [];
  }
  /* ---------------------------------------------------------
     COURIER PICKUP

     BOOKED
       ↓
     PICKED_UP
       ↓
     IN_TRANSIT
       ↓
     DELIVERED
     --------------------------------------------------------- */ const transitions = {
    BOOKED: [
      "PICKED_UP"
    ],
    PICKED_UP: [
      "IN_TRANSIT"
    ],
    IN_TRANSIT: [
      "DELIVERED"
    ]
  };
  return transitions[currentStatus] || [];
}
/* =========================================================
   UPDATE RELATED RECORDS
   ========================================================= */ async function updateRelatedRecords(delivery, nextStatus, now) {
  /*
   * Parent sale is completed only
   * after the parcel is delivered.
   */ if (nextStatus !== "DELIVERED") {
    return;
  }
  /* ---------------------------------------------------------
     CONSOLIDATED ORDER GROUP
     --------------------------------------------------------- */ if (delivery.order_group_id) {
    const { error: groupError } = await supabase.from("order_groups").update({
      group_status: "COMPLETED",
      updated_at: now
    }).eq("order_group_id", delivery.order_group_id);
    if (groupError) {
      throw new Error(`order_groups update failed: ${groupError.message}`);
    }
    const { error: orderError } = await supabase.from("orders").update({
      order_status: "COMPLETED",
      completed_at: now,
      updated_at: now
    }).eq("order_group_id", delivery.order_group_id).neq("order_status", "CANCELLED");
    if (orderError) {
      throw new Error(`group orders update failed: ${orderError.message}`);
    }
  }
  /* ---------------------------------------------------------
     SINGLE ORDER
     --------------------------------------------------------- */ if (delivery.order_id) {
    const { error: orderError } = await supabase.from("orders").update({
      order_status: "COMPLETED",
      completed_at: now,
      updated_at: now
    }).eq("order_id", delivery.order_id);
    if (orderError) {
      throw new Error(`order update failed: ${orderError.message}`);
    }
  }
}
/* =========================================================
   HTTP
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    /* -----------------------------------------------------
         METHOD
         ----------------------------------------------------- */ if (req.method !== "POST") {
      return jsonResponse({
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
      return jsonResponse({
        success: false,
        error: "INVALID_JSON"
      }, 400);
    }
    const deliveryId = getString(body.delivery_id);
    const nextStatus = getString(body.delivery_status)?.toUpperCase() || null;
    if (!deliveryId) {
      return jsonResponse({
        success: false,
        error: "MISSING_DELIVERY_ID"
      }, 400);
    }
    if (!isUuid(deliveryId)) {
      return jsonResponse({
        success: false,
        error: "INVALID_DELIVERY_ID"
      }, 400);
    }
    if (!nextStatus) {
      return jsonResponse({
        success: false,
        error: "MISSING_DELIVERY_STATUS"
      }, 400);
    }
    /* -----------------------------------------------------
         DELIVERY
         ----------------------------------------------------- */ const delivery = await findDelivery(deliveryId);
    const currentStatus = String(delivery.delivery_status || "").trim().toUpperCase();
    const fulfillmentMethod = String(delivery.fulfillment_method || "PICKUP_BY_COURIER").trim().toUpperCase();
    /* -----------------------------------------------------
         IDEMPOTENCY
         ----------------------------------------------------- */ if (currentStatus === nextStatus) {
      return jsonResponse({
        success: true,
        already_updated: true,
        previous_status: currentStatus,
        delivery_status: currentStatus,
        fulfillment_method: fulfillmentMethod,
        delivery
      }, 200);
    }
    /* -----------------------------------------------------
         VALIDATE TRANSITION
         ----------------------------------------------------- */ const allowed = getAllowedNextStatuses(delivery);
    if (!allowed.includes(nextStatus)) {
      return jsonResponse({
        success: false,
        error: "INVALID_DELIVERY_TRANSITION",
        message: `Cannot move delivery from ${currentStatus} to ${nextStatus}.`,
        current_status: currentStatus,
        fulfillment_method: fulfillmentMethod,
        allowed_next_statuses: allowed
      }, 409);
    }
    /* -----------------------------------------------------
         BUILD UPDATE
         ----------------------------------------------------- */ const now = new Date().toISOString();
    const updateData = {
      delivery_status: nextStatus,
      courier_status: nextStatus,
      updated_at: now
    };
    if (nextStatus === "PICKED_UP") {
      updateData.picked_up_at = now;
    }
    if (nextStatus === "DROPPED_OFF") {
      updateData.dropped_off_at = now;
    }
    if (nextStatus === "IN_TRANSIT") {
      updateData.shipped_at = now;
    }
    if (nextStatus === "DELIVERED") {
      updateData.delivered_at = now;
    }
    /* -----------------------------------------------------
         UPDATE DELIVERY
         ----------------------------------------------------- */ const { data: updatedDelivery, error: updateError } = await supabase.from("deliveries").update(updateData).eq("delivery_id", deliveryId).eq("delivery_status", currentStatus).select("*").maybeSingle();
    if (updateError) {
      throw new Error(`delivery update failed: ${updateError.message}`);
    }
    if (!updatedDelivery) {
      throw new Error("Delivery status changed before this request could complete. Refresh and retry.");
    }
    /* -----------------------------------------------------
         COMPLETE RELATED SALE
         ----------------------------------------------------- */ await updateRelatedRecords(updatedDelivery, nextStatus, now);
    /* -----------------------------------------------------
         SUCCESS
         ----------------------------------------------------- */ return jsonResponse({
      success: true,
      already_updated: false,
      previous_status: currentStatus,
      delivery_status: nextStatus,
      fulfillment_method: fulfillmentMethod,
      delivery: updatedDelivery
    }, 200);
  } catch (error) {
    return jsonResponse({
      success: false,
      error: "UPDATE_DELIVERY_STATUS_FAILED",
      message: getErrorMessage(error)
    }, 500);
  }
});
