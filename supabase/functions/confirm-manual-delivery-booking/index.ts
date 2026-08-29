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
console.info("confirm-manual-delivery-booking started");
/* =========================================================
   HELPERS
   ========================================================= */ function getString(value) {
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
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
function log(message, data) {
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
   CONFIRM BOOKING
   ========================================================= */ async function confirmManualBooking(params) {
  const delivery = await findDelivery(params.deliveryId);
  const currentStatus = String(delivery.delivery_status || "").trim().toUpperCase();
  /*
   * Idempotency:
   * if already BOOKED and the same tracking
   * number is stored, simply return it.
   */ if (currentStatus === "BOOKED" && getString(delivery.tracking_number) === params.trackingNumber) {
    return {
      alreadyBooked: true,
      delivery
    };
  }
  if (currentStatus !== "READY_FOR_BOOKING") {
    throw new Error(`DELIVERY_NOT_READY_FOR_MANUAL_CONFIRMATION: current status is ${currentStatus}`);
  }
  const courierCode = String(delivery.courier_code || "").trim().toUpperCase();
  if (!courierCode) {
    throw new Error("COURIER_REQUIRED");
  }
  /*
   * We currently expect manual confirmation
   * specifically for couriers operating in
   * MANUAL booking mode such as J&T.
   */ if (courierCode !== "JNT") {
    throw new Error(`MANUAL_CONFIRMATION_NOT_SUPPORTED_FOR_COURIER: ${courierCode}`);
  }
  const now = new Date().toISOString();
  const courierResponse = {
    booking_mode: "MANUAL",
    manually_confirmed: true,
    confirmed_at: now,
    courier_code: courierCode,
    booking_reference: params.bookingReference,
    tracking_number: params.trackingNumber,
    tracking_url: params.trackingUrl
  };
  const { data: updatedDelivery, error: updateError } = await supabase.from("deliveries").update({
    delivery_status: "BOOKED",
    courier_status: "BOOKED",
    booking_reference: params.bookingReference,
    tracking_number: params.trackingNumber,
    tracking_url: params.trackingUrl,
    booked_at: now,
    courier_response: courierResponse,
    booking_error: null,
    updated_at: now
  }).eq("delivery_id", params.deliveryId).eq("delivery_status", "READY_FOR_BOOKING").select("*").maybeSingle();
  if (updateError) {
    throw new Error(`Delivery update failed: ${updateError.message}`);
  }
  if (!updatedDelivery) {
    throw new Error("Delivery could not transition from READY_FOR_BOOKING to BOOKED.");
  }
  log("MANUAL DELIVERY BOOKING CONFIRMED", {
    deliveryId: params.deliveryId,
    courierCode,
    bookingReference: params.bookingReference,
    trackingNumber: params.trackingNumber
  });
  return {
    alreadyBooked: false,
    delivery: updatedDelivery
  };
}
/* =========================================================
   HTTP
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return jsonResponse({
        success: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST."
      }, 405);
    }
    let body;
    try {
      body = await req.json();
    } catch  {
      return jsonResponse({
        success: false,
        error: "INVALID_JSON"
      }, 400);
    }
    const deliveryId = getString(body?.delivery_id);
    const bookingReference = getString(body?.booking_reference);
    const trackingNumber = getString(body?.tracking_number);
    const trackingUrl = getString(body?.tracking_url);
    if (!deliveryId) {
      return jsonResponse({
        success: false,
        error: "MISSING_DELIVERY_ID",
        message: "delivery_id is required."
      }, 400);
    }
    if (!isUuid(deliveryId)) {
      return jsonResponse({
        success: false,
        error: "INVALID_DELIVERY_ID"
      }, 400);
    }
    if (!trackingNumber) {
      return jsonResponse({
        success: false,
        error: "TRACKING_NUMBER_REQUIRED",
        message: "tracking_number is required."
      }, 400);
    }
    /*
       * Booking reference is allowed to be null
       * because some manual courier flows may
       * effectively use the tracking number as
       * the primary reference.
       */ const result = await confirmManualBooking({
      deliveryId,
      bookingReference,
      trackingNumber,
      trackingUrl
    });
    return jsonResponse({
      success: true,
      already_booked: result.alreadyBooked,
      delivery: result.delivery
    }, 200);
  } catch (error) {
    const message = getErrorMessage(error);
    errorLog("CONFIRM MANUAL DELIVERY BOOKING ERROR", {
      error: message
    });
    return jsonResponse({
      success: false,
      error: "CONFIRM_MANUAL_DELIVERY_BOOKING_FAILED",
      message
    }, 500);
  }
});
