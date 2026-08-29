import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const JNT_BOOKING_MODE = (Deno.env.get("JNT_BOOKING_MODE") || "MANUAL").trim().toUpperCase();
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
console.info("create-delivery-booking started");
/* =========================================================
   HELPERS
   ========================================================= */ function getString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const result = String(value).trim();
  return result || null;
}
function getNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const result = Number(value);
  if (!Number.isFinite(result)) {
    return null;
  }
  return result;
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
   FIND COURIER
   ========================================================= */ async function findCourier(courierCode) {
  const { data, error } = await supabase.from("couriers").select("*").eq("courier_code", courierCode).maybeSingle();
  if (error) {
    throw new Error(`couriers lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Courier ${courierCode} was not found.`);
  }
  return data;
}
/* =========================================================
   VALIDATE COMMON DELIVERY FIELDS
   ========================================================= */ function validateCommonDelivery(delivery) {
  const status = String(delivery.delivery_status || "").trim().toUpperCase();
  if (status === "BOOKED") {
    return {
      alreadyBooked: true
    };
  }
  if (status !== "READY_FOR_BOOKING") {
    throw new Error(`DELIVERY_NOT_READY_FOR_BOOKING: current status is ${status}`);
  }
  if (!getString(delivery.courier_code)) {
    throw new Error("COURIER_REQUIRED");
  }
  if (!getString(delivery.recipient_name)) {
    throw new Error("RECIPIENT_NAME_REQUIRED");
  }
  if (!getString(delivery.recipient_phone)) {
    throw new Error("RECIPIENT_PHONE_REQUIRED");
  }
  if (!getString(delivery.address_line1)) {
    throw new Error("RECIPIENT_ADDRESS_REQUIRED");
  }
  if (!getString(delivery.city)) {
    throw new Error("RECIPIENT_CITY_REQUIRED");
  }
  if (!getString(delivery.province)) {
    throw new Error("RECIPIENT_PROVINCE_REQUIRED");
  }
  return {
    alreadyBooked: false
  };
}
/* =========================================================
   VALIDATE FULFILLMENT METHOD
   ========================================================= */ function validateFulfillmentMethod(delivery) {
  const fulfillmentMethod = String(delivery.fulfillment_method || "PICKUP_BY_COURIER").trim().toUpperCase();
  if (fulfillmentMethod !== "PICKUP_BY_COURIER" && fulfillmentMethod !== "CLIENT_DROP_OFF") {
    throw new Error(`INVALID_FULFILLMENT_METHOD: ${fulfillmentMethod}`);
  }
  if (fulfillmentMethod === "CLIENT_DROP_OFF") {
    if (!getString(delivery.dropoff_location_name)) {
      throw new Error("DROPOFF_LOCATION_NAME_REQUIRED");
    }
    if (!getString(delivery.dropoff_address)) {
      throw new Error("DROPOFF_ADDRESS_REQUIRED");
    }
    const dropoffLat = getNumber(delivery.dropoff_lat);
    const dropoffLng = getNumber(delivery.dropoff_lng);
    if (dropoffLat === null || dropoffLng === null || dropoffLat === 0 || dropoffLng === 0) {
      throw new Error("VALID_DROPOFF_COORDINATES_REQUIRED");
    }
  }
  return fulfillmentMethod;
}
/* =========================================================
   BUILD GENERIC COURIER PAYLOAD
   ========================================================= */ function buildCourierPayload(delivery, fulfillmentMethod) {
  const payload = {
    internal_delivery_id: delivery.delivery_id,
    internal_order_id: delivery.order_id,
    internal_order_group_id: delivery.order_group_id,
    courier_code: delivery.courier_code,
    fulfillment_method: fulfillmentMethod,
    recipient: {
      name: delivery.recipient_name,
      phone: delivery.recipient_phone,
      address_line1: delivery.address_line1,
      address_line2: delivery.address_line2,
      city: delivery.city,
      province: delivery.province,
      postal_code: delivery.postal_code,
      country: delivery.country || "PH",
      latitude: getNumber(delivery.recipient_lat),
      longitude: getNumber(delivery.recipient_lng)
    },
    shipping_fee: Number(delivery.shipping_fee || 0)
  };
  if (fulfillmentMethod === "CLIENT_DROP_OFF") {
    payload.dropoff = {
      location_name: delivery.dropoff_location_name,
      address: delivery.dropoff_address,
      latitude: getNumber(delivery.dropoff_lat),
      longitude: getNumber(delivery.dropoff_lng)
    };
  }
  if (fulfillmentMethod === "PICKUP_BY_COURIER") {
    payload.pickup_location_id = delivery.pickup_location_id || null;
  }
  return payload;
}
/* =========================================================
   SAVE BOOKING ATTEMPT
   ========================================================= */ async function saveBookingAttempt(deliveryId, payload) {
  const { error } = await supabase.from("deliveries").update({
    courier_payload: payload,
    booking_error: null,
    updated_at: new Date().toISOString()
  }).eq("delivery_id", deliveryId);
  if (error) {
    throw new Error(`Failed to save courier payload: ${error.message}`);
  }
}
/* =========================================================
   SAVE BOOKING ERROR
   ========================================================= */ async function saveBookingError(deliveryId, message, response) {
  const updateData = {
    booking_error: message,
    updated_at: new Date().toISOString()
  };
  if (response !== undefined) {
    updateData.courier_response = response;
  }
  const { error } = await supabase.from("deliveries").update(updateData).eq("delivery_id", deliveryId);
  if (error) {
    errorLog("Could not save booking error", {
      deliveryId,
      error: error.message
    });
  }
}
/* =========================================================
   SAVE MANUAL BOOKING REQUIRED
   ========================================================= */ async function saveManualBookingRequired(deliveryId, result) {
  const { data, error } = await supabase.from("deliveries").update({
    courier_status: result.courierStatus || "MANUAL_BOOKING_REQUIRED",
    courier_response: result.rawResponse || null,
    booking_error: null,
    updated_at: new Date().toISOString()
  }).eq("delivery_id", deliveryId).select("*").single();
  if (error) {
    throw new Error(`Manual booking status update failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   SAVE SUCCESSFUL BOOKING
   ========================================================= */ async function saveSuccessfulBooking(deliveryId, result) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("deliveries").update({
    delivery_status: "BOOKED",
    courier_status: result.courierStatus || "BOOKED",
    booking_reference: result.bookingReference || null,
    tracking_number: result.trackingNumber || null,
    tracking_url: result.trackingUrl || null,
    courier_response: result.rawResponse || null,
    booking_error: null,
    booked_at: now,
    updated_at: now
  }).eq("delivery_id", deliveryId).eq("delivery_status", "READY_FOR_BOOKING").select("*").maybeSingle();
  if (error) {
    throw new Error(`Delivery booking update failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Delivery could not transition to BOOKED.");
  }
  return data;
}
/* =========================================================
   J&T MANUAL ADAPTER
   ========================================================= */ async function createJntManualBooking(delivery, payload, fulfillmentMethod) {
  if (fulfillmentMethod === "CLIENT_DROP_OFF") {
    return {
      success: false,
      manualRequired: true,
      courierStatus: "MANUAL_DROPOFF_BOOKING_REQUIRED",
      rawResponse: {
        booking_mode: "MANUAL",
        courier: "JNT",
        fulfillment_method: "CLIENT_DROP_OFF",
        dropoff_location_name: delivery.dropoff_location_name,
        dropoff_address: delivery.dropoff_address,
        message: "Create the J&T shipment/waybill, then bring the parcel to the selected drop-off branch and confirm the real tracking number.",
        payload
      },
      message: "J&T client drop-off requires manual booking confirmation."
    };
  }
  return {
    success: false,
    manualRequired: true,
    courierStatus: "MANUAL_PICKUP_BOOKING_REQUIRED",
    rawResponse: {
      booking_mode: "MANUAL",
      courier: "JNT",
      fulfillment_method: "PICKUP_BY_COURIER",
      message: "Book courier pickup through the approved J&T merchant/VIP channel, then record the resulting tracking number.",
      payload
    },
    message: "J&T courier pickup currently requires manual processing."
  };
}
/* =========================================================
   J&T API ADAPTER
   ========================================================= */ async function createJntApiBooking(_delivery, _payload, _fulfillmentMethod) {
  throw new Error("JNT_API_NOT_CONFIGURED: Official J&T API credentials and endpoint specification are required.");
}
/* =========================================================
   J&T ROUTER
   ========================================================= */ async function createJntBooking(delivery, payload, fulfillmentMethod) {
  if (JNT_BOOKING_MODE === "API") {
    return await createJntApiBooking(delivery, payload, fulfillmentMethod);
  }
  return await createJntManualBooking(delivery, payload, fulfillmentMethod);
}
/* =========================================================
   COURIER ROUTER
   ========================================================= */ async function createCourierBooking(delivery, payload, fulfillmentMethod) {
  const courierCode = String(delivery.courier_code).trim().toUpperCase();
  switch(courierCode){
    case "JNT":
      return await createJntBooking(delivery, payload, fulfillmentMethod);
    default:
      throw new Error(`UNSUPPORTED_COURIER: ${courierCode}`);
  }
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
    const delivery = await findDelivery(deliveryId);
    const validation = validateCommonDelivery(delivery);
    if (validation.alreadyBooked) {
      return jsonResponse({
        success: true,
        already_booked: true,
        delivery
      }, 200);
    }
    const fulfillmentMethod = validateFulfillmentMethod(delivery);
    const courierCode = getString(delivery.courier_code);
    const courier = await findCourier(courierCode);
    if (String(courier.status).toUpperCase() !== "ACTIVE") {
      return jsonResponse({
        success: false,
        error: "COURIER_INACTIVE",
        courier_code: courierCode
      }, 409);
    }
    const courierPayload = buildCourierPayload(delivery, fulfillmentMethod);
    await saveBookingAttempt(deliveryId, courierPayload);
    let result;
    try {
      result = await createCourierBooking(delivery, courierPayload, fulfillmentMethod);
    } catch (error) {
      const message = getErrorMessage(error);
      await saveBookingError(deliveryId, message);
      throw error;
    }
    if (result.manualRequired) {
      const updatedDelivery = await saveManualBookingRequired(deliveryId, result);
      return jsonResponse({
        success: true,
        booking_mode: "MANUAL",
        fulfillment_method: fulfillmentMethod,
        manual_booking_required: true,
        message: result.message,
        courier: {
          courier_code: courier.courier_code,
          courier_name: courier.courier_name
        },
        delivery: updatedDelivery
      }, 200);
    }
    if (!result.success) {
      const message = result.message || "Courier booking failed.";
      await saveBookingError(deliveryId, message, result.rawResponse);
      return jsonResponse({
        success: false,
        error: "COURIER_BOOKING_FAILED",
        message
      }, 502);
    }
    const updatedDelivery = await saveSuccessfulBooking(deliveryId, result);
    return jsonResponse({
      success: true,
      booking_mode: JNT_BOOKING_MODE,
      fulfillment_method: fulfillmentMethod,
      already_booked: false,
      courier: {
        courier_code: courier.courier_code,
        courier_name: courier.courier_name
      },
      delivery: updatedDelivery
    }, 200);
  } catch (error) {
    const message = getErrorMessage(error);
    errorLog("CREATE DELIVERY BOOKING ERROR", {
      error: message
    });
    return jsonResponse({
      success: false,
      error: "CREATE_DELIVERY_BOOKING_FAILED",
      message
    }, 500);
  }
});
