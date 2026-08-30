import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import SetupPage from "./SetupPage";
import OnboardingPage from "./OnboardingPage";
import AdminClientsPage from "./AdminClientsPage";
import FacebookPostPage from "./FacebookPostPage";
import EO2MateLogo from "../components/EO2MateLogo";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimeRemaining(value) {
  if (!value) return "-";

  const deadline = new Date(value).getTime();
  if (Number.isNaN(deadline)) return "-";

  const diff = deadline - Date.now();
  if (diff <= 0) return "Expired";

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function paymentGroupStatus(group) {
  if (group?.payment_expired_at) return "PAYMENT_EXPIRED";
  if (group?.payment_reopened_at && !group?.payment_expired_at) return "PAYMENT_REOPENED";
  return group?.group_status || "-";
}

function statusLabel(value) {
  return String(value || "-").replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  let className = "status-badge";

  if (
    ["ACTIVE", "PAID", "READY_FOR_DELIVERY", "READY_FOR_BOOKING", "DELIVERED", "COMPLETED", "VALID"].includes(normalized)
  ) {
    className += " status-active";
  } else if (normalized === "COMPLETED_WITH_WINNER") {
    className += " status-success";
  } else if (
    ["PAYMENT_PENDING", "PAYMENT_REOPENED", "PENDING", "AWAITING_FINALIZER", "BOOKED", "PICKED_UP", "DROPPED_OFF", "IN_TRANSIT", "SHIPPED"].includes(normalized)
  ) {
    className += " status-warning";
  } else if (
    ["CANCELLED", "PAYMENT_EXPIRED", "FAILED", "EXPIRED", "REFUNDED", "INVALID"].includes(normalized)
  ) {
    className += " status-danger";
  } else {
    className += " status-muted";
  }

  return <span className={className}>{statusLabel(normalized)}</span>;
}

function MetricCard({ title, value, subtitle, onClick }) {
  return (
    <button type="button" className="metric-card metric-button" onClick={onClick}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function PortalPage({ session }) {
  const [client, setClient] = useState(null);
  const [platformAdmin, setPlatformAdmin] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  const [auctions, setAuctions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentGroups, setPaymentGroups] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [auctionSearch, setAuctionSearch] = useState("");
  const [auctionStatusFilter, setAuctionStatusFilter] = useState("ALL");
  const [auctionDetail, setAuctionDetail] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);

  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [orderDetail, setOrderDetail] = useState(null);

  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentGroupSearch, setPaymentGroupSearch] = useState("");
  const [paymentGroupStatusFilter, setPaymentGroupStatusFilter] = useState("ALL");
  const [reopenGroup, setReopenGroup] = useState(null);
  const [reopenHours, setReopenHours] = useState("24");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenLoading, setReopenLoading] = useState(false);
  const [reopenMessage, setReopenMessage] = useState("");

  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("ALL");
  const [deliveryDetail, setDeliveryDetail] = useState(null);
  const [bookingReference, setBookingReference] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [deliveryActionLoading, setDeliveryActionLoading] = useState(false);
  const [deliveryActionMessage, setDeliveryActionMessage] = useState("");

  const [facebookStatus, setFacebookStatus] = useState(null);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookMessage, setFacebookMessage] = useState("");
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const [paymentAccountStatus, setPaymentAccountStatus] = useState(null);
  const [paymentAccountLoading, setPaymentAccountLoading] = useState(false);
  const [paymentAccountMessage, setPaymentAccountMessage] = useState("");


  const [automationControls, setAutomationControls] = useState([]);
  const [automationPages, setAutomationPages] = useState([]);
  const [automationControlLoading, setAutomationControlLoading] = useState(false);
  const [automationControlMessage, setAutomationControlMessage] = useState("");
  const [automationModal, setAutomationModal] = useState(null);
  const [automationReason, setAutomationReason] = useState("");

  useEffect(() => {
    loadPortal();

    const params = new URLSearchParams(window.location.search);
    const facebookResult = params.get("facebook");
    if (facebookResult) {
      setPage("facebook");
      setFacebookMessage(
        facebookResult === "connected"
          ? "Facebook authorization completed. Refreshing connection status..."
          : `Facebook returned: ${facebookResult}`
      );
    }
  }, []);

  async function loadFacebookStatus(options = {}) {
    const {
      applyOnboardingGate = false,
      preserveCurrentPage = false,
    } = options;

    setFacebookLoading(true);
    setFacebookMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "facebook-connection-status",
        { method: "POST", body: {} },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(
          data?.message ||
          "Unable to load Facebook connection status."
        );
      }

      setFacebookStatus(data);

      if (applyOnboardingGate) {
        const params = new URLSearchParams(window.location.search);
        const facebookResult = params.get("facebook");

        if (facebookResult) {
          setPage("facebook");
          setFacebookMessage(
            facebookResult === "connected"
              ? "Facebook authorization completed. Connection status refreshed."
              : `Facebook returned: ${facebookResult}`
          );
        }
      }

      return data;
    } catch (error) {
      const message =
        error.message ||
        "Unable to load Facebook connection status.";

      setFacebookMessage(message);

      // Facebook is optional for portal access.
      // Keep the client on the dashboard even when status cannot be loaded.

      return null;
    } finally {
      setFacebookLoading(false);
      if (applyOnboardingGate) {
        setOnboardingChecked(true);
      }
    }
  }

  async function loadPaymentAccountStatus() {
    setPaymentAccountLoading(true);
    setPaymentAccountMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "client-payment-status",
        { method: "POST", body: {} },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to load payment setup status.");
      }

      setPaymentAccountStatus(data);
      return data;
    } catch (error) {
      setPaymentAccountMessage(error.message || "Unable to load payment setup status.");
      return null;
    } finally {
      setPaymentAccountLoading(false);
    }
  }

  async function markPayMongoAccountCreated() {
    setPaymentAccountLoading(true);
    setPaymentAccountMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "mark-paymongo-account-created",
        { method: "POST", body: {} },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to update PayMongo setup status.");
      }

      setPaymentAccountStatus(data);
      setPaymentAccountMessage(
        "PayMongo account recorded. Online checkout remains disabled until the account is linked and activated for this client."
      );
    } catch (error) {
      setPaymentAccountMessage(error.message || "Unable to update PayMongo setup status.");
    } finally {
      setPaymentAccountLoading(false);
    }
  }

  function openPayMongo() {
    const status = String(paymentAccountStatus?.account_status || "NOT_CONFIGURED").toUpperCase();
    const url = status === "NOT_CONFIGURED"
      ? (paymentAccountStatus?.setup_url || "https://dashboard.paymongo.com/signup")
      : (paymentAccountStatus?.dashboard_url || "https://dashboard.paymongo.com/login");

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function connectFacebook() {
    if (!client?.client_id) {
      setFacebookMessage("Client account is not ready yet. Refresh and try again.");
      return;
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const connectUrl = `${baseUrl}/functions/v1/facebook-oauth-start?client_id=${encodeURIComponent(client.client_id)}`;
    window.location.assign(connectUrl);
  }


  function findAutomationControl(scopeType, scopeId) {
    return automationControls.find(
      (row) =>
        String(row.scope_type || "").toUpperCase() === String(scopeType).toUpperCase() &&
        String(row.scope_id || "") === String(scopeId || "")
    ) || null;
  }

  function automationScopeEnabled(scopeType, scopeId) {
    const control = findAutomationControl(scopeType, scopeId);
    return control ? control.is_enabled !== false : true;
  }

  function automationScopeReason(scopeType, scopeId) {
    return findAutomationControl(scopeType, scopeId)?.reason || "";
  }

  async function loadAutomationControls() {
    if (!client?.client_id) return;

    setAutomationControlLoading(true);
    setAutomationControlMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "automation-admin",
        {
          method: "POST",
          body: {
            action: "LIST",
            client_id: client.client_id,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to load automation controls.");
      }

      setAutomationControls(data.controls || []);
      setAutomationPages(data.pages || []);
      return data;
    } catch (error) {
      setAutomationControlMessage(
        error.message || "Unable to load automation controls."
      );
      return null;
    } finally {
      setAutomationControlLoading(false);
    }
  }

  async function openAutomationControl() {
    setPage("automation-control");
    await loadAutomationControls();
  }

  function requestAutomationChange({
    scopeType,
    scopeId,
    label,
    enabled,
  }) {
    setAutomationReason("");
    setAutomationModal({
      scopeType,
      scopeId,
      label,
      enabled,
    });
  }

  async function confirmAutomationChange() {
    if (!automationModal || !client?.client_id) return;

    if (!automationModal.enabled && !automationReason.trim()) {
      setAutomationControlMessage("Please enter a reason before disabling automation.");
      return;
    }

    setAutomationControlLoading(true);
    setAutomationControlMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "automation-admin",
        {
          method: "POST",
          body: {
            action: "SET",
            client_id: client.client_id,
            scope_type: automationModal.scopeType,
            scope_id: automationModal.scopeId,
            is_enabled: automationModal.enabled,
            reason: automationReason.trim() || null,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to update automation control.");
      }

      setAutomationControlMessage(
        `${automationModal.label} automation ${automationModal.enabled ? "enabled" : "disabled"}.`
      );
      setAutomationModal(null);
      setAutomationReason("");
      await loadAutomationControls();
    } catch (error) {
      setAutomationControlMessage(
        error.message || "Unable to update automation control."
      );
    } finally {
      setAutomationControlLoading(false);
    }
  }

  async function openFacebookSetup() {
    setPage("facebook");
    await loadFacebookStatus({
      preserveCurrentPage: true,
    });
  }

  async function loadPortal() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [adminResult, membershipResult] = await Promise.all([
        supabase
          .from("platform_admins")
          .select("user_id, role, status")
          .eq("user_id", session.user.id)
          .eq("status", "ACTIVE")
          .maybeSingle(),
        supabase
          .from("client_users")
          .select("client_id, role, status, created_at")
          .eq("user_id", session.user.id)
          .eq("status", "ACTIVE")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (adminResult.error) throw adminResult.error;
      if (membershipResult.error) throw membershipResult.error;

      const admin = adminResult.data || null;
      const clientUser = membershipResult.data || null;

      setPlatformAdmin(admin);

      if (!clientUser) {
        setClient(null);

        if (admin) {
          setNeedsOnboarding(false);
          setPage("admin-clients");
          return;
        }

        const { data: onboardingData, error: onboardingError } =
          await supabase.functions.invoke("client-onboarding", {
            method: "POST",
            body: { action: "STATUS" },
          });

        if (onboardingError) throw onboardingError;

        setOnboardingStatus(onboardingData || null);
        setNeedsOnboarding(true);
        return;
      }

      const { data: clientData, error: clientError } = await supabase
        .from("master_clients")
        .select("*")
        .eq("client_id", clientUser.client_id)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!clientData) throw new Error("Your client account could not be found.");

      setClient({
        ...clientData,
        role: clientUser.role,
      });

      const { data: onboardingData, error: onboardingError } =
        await supabase.functions.invoke("client-onboarding", {
          method: "POST",
          body: { action: "STATUS" },
        });

      if (onboardingError) throw onboardingError;

      setOnboardingStatus(onboardingData || null);

      if (onboardingData?.onboarding_complete !== true && !admin) {
        setNeedsOnboarding(true);
        return;
      }

      setNeedsOnboarding(false);

      const [
        auctionResult,
        orderResult,
        paymentResult,
        paymentGroupResult,
        deliveryResult,
      ] = await Promise.all([
        supabase
          .from("client_auction_list")
          .select("*")
          .order("post_created_at", { ascending: false }),

        supabase
          .from("client_order_list")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("client_payment_list")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("order_groups")
          .select("*")
          .eq("client_id", clientUser.client_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("client_delivery_list")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (auctionResult.error) throw auctionResult.error;
      if (orderResult.error) throw orderResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (paymentGroupResult.error) throw paymentGroupResult.error;
      if (deliveryResult.error) throw deliveryResult.error;

      setAuctions(auctionResult.data || []);
      setOrders(orderResult.data || []);
      setPayments(paymentResult.data || []);
      setPaymentGroups(paymentGroupResult.data || []);
      setDeliveries(deliveryResult.data || []);

      /*
       * First-time onboarding gate.
       *
       * A client with no ACTIVE Facebook Page is sent to
       * Facebook Setup automatically. Connected returning
       * clients continue to the Dashboard.
       */
      await Promise.all([
        loadFacebookStatus({
          applyOnboardingGate: true,
        }),
        loadPaymentAccountStatus(),
      ]);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load portal.");
    } finally {
      setLoading(false);
    }
  }

  async function openAuction(auctionItemId) {
    setPage("auction-detail");
    setDetailLoading(true);
    setAuctionDetail(null);
    setBidHistory([]);
    setErrorMessage("");

    try {
      const [
        detailResult,
        bidsResult,
      ] = await Promise.all([
        supabase
          .from("client_auction_detail")
          .select("*")
          .eq("auction_item_id", auctionItemId)
          .maybeSingle(),

        supabase
          .from("client_auction_bid_history")
          .select("*")
          .eq("auction_item_id", auctionItemId)
          .order("commented_at", { ascending: false }),
      ]);

      if (detailResult.error) throw detailResult.error;
      if (bidsResult.error) throw bidsResult.error;

      setAuctionDetail(detailResult.data);
      setBidHistory(bidsResult.data || []);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load auction detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function openOrder(orderId) {
    setPage("order-detail");
    setDetailLoading(true);
    setOrderDetail(null);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("client_order_detail")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (error) throw error;

      setOrderDetail(data);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load order detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function openPayment(paymentId) {
    setPage("payment-detail");
    setDetailLoading(true);
    setPaymentDetail(null);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("client_payment_detail")
        .select("*")
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (error) throw error;

      setPaymentDetail(data);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load payment detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadDeliveryDetail(deliveryId) {
    const { data, error } = await supabase
      .from("client_delivery_detail")
      .select("*")
      .eq("delivery_id", deliveryId)
      .maybeSingle();

    if (error) throw error;

    setDeliveryDetail(data);
    setBookingReference(data?.booking_reference || "");
    setTrackingNumber(data?.tracking_number || "");
    setTrackingUrl(data?.tracking_url || "");

    return data;
  }

  async function openDelivery(deliveryId) {
    setPage("delivery-detail");
    setDetailLoading(true);
    setDeliveryDetail(null);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      await loadDeliveryDetail(deliveryId);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load delivery detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function prepareDeliveryBooking() {
    if (!deliveryDetail?.delivery_id) return;

    setDeliveryActionLoading(true);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-delivery-booking",
        {
          body: {
            delivery_id: deliveryDetail.delivery_id,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to prepare courier booking.");

      await loadDeliveryDetail(deliveryDetail.delivery_id);

      if (data?.manual_booking_required) {
        setDeliveryActionMessage(
          data?.message || "Manual courier booking is ready for confirmation.",
        );
      } else {
        setDeliveryActionMessage("Courier booking prepared successfully.");
      }
    } catch (error) {
      setErrorMessage(error.message || "Unable to prepare courier booking.");
    } finally {
      setDeliveryActionLoading(false);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('\"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function printParcelLabel() {
    if (!deliveryDetail?.tracking_number) {
      setErrorMessage("A tracking number is required before printing a parcel label.");
      return;
    }

    const popup = window.open("", "_blank", "width=650,height=900");

    if (!popup) {
      setErrorMessage("The print window was blocked by the browser. Allow pop-ups and try again.");
      return;
    }

    const reference =
      deliveryDetail.group_number ||
      deliveryDetail.order_number ||
      deliveryDetail.delivery_id;

    const shipmentType =
      deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF"
        ? "CLIENT DROP-OFF"
        : "COURIER PICKUP";

    const recipientAddress = [
      deliveryDetail.address_line1,
      deliveryDetail.address_line2,
      [deliveryDetail.city, deliveryDetail.province, deliveryDetail.postal_code]
        .filter(Boolean)
        .join(", "),
      deliveryDetail.country,
    ]
      .filter(Boolean)
      .join("<br>");

    const dropoffBlock =
      deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF"
        ? `
          <div class="section">
            <div class="label">DROP-OFF LOCATION</div>
            <div class="strong">${escapeHtml(deliveryDetail.dropoff_location_name || "-")}</div>
            <div>${escapeHtml(deliveryDetail.dropoff_address || "-")}</div>
          </div>
        `
        : "";

    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Parcel Label - ${escapeHtml(reference)}</title>
  <style>
    @page { size: 4in 6in; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .label-sheet { width: 4in; min-height: 6in; padding: 0.18in; border: 2px solid #000; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .courier { font-size: 22px; font-weight: 900; }
    .mode { font-size: 11px; font-weight: 700; border: 1px solid #000; padding: 4px 6px; }
    .tracking-label { font-size: 10px; font-weight: 700; margin-top: 12px; letter-spacing: .08em; }
    .tracking { font-size: 22px; font-weight: 900; letter-spacing: .04em; padding: 8px 0 12px; border-bottom: 2px solid #000; word-break: break-all; }
    .section { padding: 10px 0; border-bottom: 1px solid #000; font-size: 12px; line-height: 1.4; }
    .label { font-size: 9px; font-weight: 800; letter-spacing: .08em; margin-bottom: 4px; }
    .strong { font-size: 15px; font-weight: 800; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; padding-top: 10px; font-size: 10px; }
    .meta b { display: block; font-size: 8px; letter-spacing: .06em; margin-bottom: 2px; }
    .notice { margin-top: 12px; padding-top: 8px; border-top: 1px dashed #000; font-size: 8px; line-height: 1.35; }
    @media print { body { width: 4in; height: 6in; } .label-sheet { border: 0; } }
  </style>
</head>
<body>
  <div class="label-sheet">
    <div class="top">
      <div>
        <div class="courier">${escapeHtml(deliveryDetail.courier_name || deliveryDetail.courier_code || "COURIER")}</div>
        <div style="font-size:10px">INTERNAL PARCEL LABEL</div>
      </div>
      <div class="mode">${escapeHtml(shipmentType)}</div>
    </div>

    <div class="tracking-label">TRACKING NUMBER</div>
    <div class="tracking">${escapeHtml(deliveryDetail.tracking_number)}</div>

    <div class="section">
      <div class="label">SHIP TO</div>
      <div class="strong">${escapeHtml(deliveryDetail.recipient_name || "-")}</div>
      <div>${escapeHtml(deliveryDetail.recipient_phone || "-")}</div>
      <div>${recipientAddress}</div>
    </div>

    ${dropoffBlock}

    <div class="section">
      <div class="label">SHIPMENT REFERENCE</div>
      <div class="strong">${escapeHtml(reference)}</div>
      <div>${escapeHtml(deliveryDetail.item_label || (deliveryDetail.order_group_id ? "Consolidated shipment" : "Shipment"))}</div>
    </div>

    <div class="meta">
      <div><b>BOOKING REFERENCE</b>${escapeHtml(deliveryDetail.booking_reference || "-")}</div>
      <div><b>DELIVERY STATUS</b>${escapeHtml(statusLabel(deliveryDetail.delivery_status))}</div>
      <div><b>COURIER CODE</b>${escapeHtml(deliveryDetail.courier_code || "-")}</div>
      <div><b>SHIPPING FEE</b>${escapeHtml(formatCurrency(deliveryDetail.shipping_fee))}</div>
    </div>

    <div class="notice">
      Internal system-generated parcel label. If the courier supplies an official waybill/label, use the official courier document for carrier acceptance and scanning.
    </div>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 150);
    };
  <\/script>
</body>
</html>`);

    popup.document.close();
    popup.focus();
  }

  async function confirmManualBooking(event) {
    event.preventDefault();
    if (!deliveryDetail?.delivery_id) return;

    setDeliveryActionLoading(true);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "confirm-manual-delivery-booking",
        {
          body: {
            delivery_id: deliveryDetail.delivery_id,
            booking_reference: bookingReference.trim() || null,
            tracking_number: trackingNumber.trim(),
            tracking_url: trackingUrl.trim() || null,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to confirm booking.");

      await loadDeliveryDetail(deliveryDetail.delivery_id);
      setDeliveryActionMessage("Booking confirmed successfully.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to confirm booking.");
    } finally {
      setDeliveryActionLoading(false);
    }
  }

  async function updateDeliveryStatus(nextStatus) {
    if (!deliveryDetail?.delivery_id) return;

    setDeliveryActionLoading(true);
    setDeliveryActionMessage("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "update-delivery-status",
        {
          body: {
            delivery_id: deliveryDetail.delivery_id,
            delivery_status: nextStatus,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to update delivery status.");

      await loadDeliveryDetail(deliveryDetail.delivery_id);
      setDeliveryActionMessage(`Delivery moved to ${statusLabel(nextStatus)}.`);
    } catch (error) {
      setErrorMessage(error.message || "Unable to update delivery status.");
    } finally {
      setDeliveryActionLoading(false);
    }
  }

  const auctionMetrics = useMemo(() => ({
    active: auctions.filter((a) => a.ui_status === "ACTIVE").length,
  }), [auctions]);

  const orderMetrics = useMemo(() => ({
    pending: orders.filter((o) => o.order_status === "PAYMENT_PENDING").length,
  }), [orders]);

  const paymentMetrics = useMemo(() => ({
    pending: payments.filter(
      (p) => String(p.payment_status || "").toLowerCase() === "pending"
    ).length,

    paid: payments.filter(
      (p) => String(p.payment_status || "").toLowerCase() === "paid"
    ).length,
  }), [payments]);

  const deliveryMetrics = useMemo(() => ({
    ready: deliveries.filter((d) => d.delivery_status === "READY_FOR_BOOKING").length,
    inTransit: deliveries.filter((d) => d.delivery_status === "IN_TRANSIT").length,
    delivered: deliveries.filter((d) => d.delivery_status === "DELIVERED").length,
  }), [deliveries]);

  const filteredAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      const matchesStatus =
        auctionStatusFilter === "ALL" ||
        auction.ui_status === auctionStatusFilter;

      const haystack = [
        auction.item_label,
        auction.highest_bidder_name,
        auction.fb_post_id,
        auction.payment_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !auctionSearch.trim() ||
        haystack.includes(auctionSearch.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [auctions, auctionStatusFilter, auctionSearch]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        orderStatusFilter === "ALL" ||
        order.order_status === orderStatusFilter;

      const haystack = [
        order.order_number,
        order.item_label,
        order.buyer_name,
        order.payment_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !orderSearch.trim() ||
        haystack.includes(orderSearch.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const normalizedStatus =
        String(payment.payment_status || "").toLowerCase();

      const matchesStatus =
        paymentStatusFilter === "ALL" ||
        normalizedStatus === paymentStatusFilter.toLowerCase();

      const haystack = [
        payment.order_number,
        payment.item_label,
        payment.buyer_name,
        payment.provider,
        payment.payment_reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !paymentSearch.trim() ||
        haystack.includes(paymentSearch.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [payments, paymentStatusFilter, paymentSearch]);

  const filteredPaymentGroups = useMemo(() => {
    return paymentGroups.filter((group) => {
      const status = paymentGroupStatus(group);
      const matchesStatus =
        paymentGroupStatusFilter === "ALL" ||
        status === paymentGroupStatusFilter;

      const haystack = [
        group.group_number,
        group.buyer_name,
        group.buyer_fb_user_id,
        group.environment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !paymentGroupSearch.trim() ||
        haystack.includes(paymentGroupSearch.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [paymentGroups, paymentGroupStatusFilter, paymentGroupSearch]);

  const isPaymentAdmin = ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(
    String(client?.role || "").toUpperCase(),
  );

  async function reopenExpiredPayment() {
    if (!reopenGroup?.order_group_id) return;

    const hours = Number(reopenHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      setErrorMessage("Payment extension must be between 1 and 168 hours.");
      return;
    }

    setReopenLoading(true);
    setErrorMessage("");
    setReopenMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "payment-admin",
        {
          body: {
            order_group_id: reopenGroup.order_group_id,
            hours,
            reason: reopenReason.trim() || null,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Unable to reopen payment.");

      setReopenMessage(
        `Payment reopened until ${formatDateTime(data.new_deadline_at)}. The buyer can request a new QR in Messenger.`,
      );
      setReopenGroup(null);
      setReopenReason("");
      setReopenHours("24");
      await loadPortal();
    } catch (error) {
      setErrorMessage(error.message || "Unable to reopen payment.");
    } finally {
      setReopenLoading(false);
    }
  }

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      const matchesStatus =
        deliveryStatusFilter === "ALL" ||
        delivery.delivery_status === deliveryStatusFilter;

      const haystack = [
        delivery.order_number,
        delivery.item_label,
        delivery.buyer_name,
        delivery.recipient_name,
        delivery.courier_name,
        delivery.tracking_number,
        delivery.booking_reference,
        delivery.city,
        delivery.province,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !deliverySearch.trim() ||
        haystack.includes(deliverySearch.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [deliveries, deliveryStatusFilter, deliverySearch]);

  function goToAuctions(filter = "ALL") {
    setAuctionStatusFilter(filter);
    setAuctionSearch("");
    setPage("auctions");
  }

  function goToOrders(filter = "ALL") {
    setOrderStatusFilter(filter);
    setOrderSearch("");
    setPage("orders");
  }

  function goToPayments(filter = "ALL") {
    setPaymentStatusFilter(filter);
    setPaymentSearch("");
    setPage("payments");
  }

  function goToDeliveries(filter = "ALL") {
    setDeliveryStatusFilter(filter);
    setDeliverySearch("");
    setPage("deliveries");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <h2>Loading client portal</h2>
          <p>Checking your account, Facebook connection and dashboard data...</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <OnboardingPage
        session={session}
        initialStatus={onboardingStatus}
        onComplete={loadPortal}
      />
    );
  }

  if (platformAdmin && !client) {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand eo2-sidebar-brand">
            <EO2MateLogo />
            <span className="eo2-admin-label">Platform Admin</span>
          </div>
          <nav className="sidebar-nav">
            <button className="nav-item active">Clients</button>
          </nav>
          <div className="sidebar-footer">
            <div className="user-mini-card"><strong>{session.user.email}</strong><span>{platformAdmin.role}</span></div>
            <button className="logout-button" onClick={handleLogout}>Sign out</button>
          </div>
        </aside>
        <main className="dashboard-content"><AdminClientsPage /></main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand eo2-sidebar-brand">
          <EO2MateLogo />
        </div>

        <nav className="sidebar-nav">
          {platformAdmin && (
            <button
              className={`nav-item ${page === "admin-clients" ? "active" : ""}`}
              onClick={() => setPage("admin-clients")}
            >
              Admin · Clients
            </button>
          )}
          <button className={`nav-item ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}>
            Dashboard
          </button>

          <button className={`nav-item ${page === "facebook" ? "active" : ""}`} onClick={openFacebookSetup}>
            Facebook Setup
          </button>

          <button
            className={`nav-item ${page === "facebook-post" ? "active" : ""}`}
            onClick={() => setPage("facebook-post")}
          >
            Create Auction Post
          </button>

          <button className={`nav-item ${page.includes("auction") ? "active" : ""}`} onClick={() => goToAuctions("ALL")}>
            Auctions
          </button>

          <button className={`nav-item ${page.includes("order") ? "active" : ""}`} onClick={() => goToOrders("ALL")}>
            Orders
          </button>

          <button
            className={`nav-item ${page.includes("payment") ? "active" : ""}`}
            onClick={() => paymentAccountStatus?.payment_enabled && goToPayments("ALL")}
            disabled={!paymentAccountStatus?.payment_enabled}
            title={paymentAccountStatus?.payment_enabled ? "Payments" : "Set up and activate PayMongo to enable online payments"}
          >
            Payments
          </button>

          <button className={`nav-item ${page.includes("deliver") ? "active" : ""}`} onClick={() => goToDeliveries("ALL")}>
            Delivery
          </button>

          <button
            className={`nav-item ${page === "automation-control" ? "active" : ""}`}
            onClick={openAutomationControl}
          >
            Automation Control
          </button>

          <button className={`nav-item ${page === "setup" ? "active" : ""}`} onClick={() => setPage("setup")}>
            Setup
          </button>

          <button className="nav-item" disabled>
            Reports
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini-card">
            <strong>{client?.name || session.user.email}</strong>
            <span>{client?.role || "CLIENT"}</span>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="dashboard-content">
        {errorMessage && (
          <div className="dashboard-error global-error">
            {errorMessage}
          </div>
        )}

        {page === "admin-clients" && platformAdmin && (
          <AdminClientsPage />
        )}

        {page === "facebook-post" && (
          <FacebookPostPage client={client} />
        )}

        {page === "facebook" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">ONBOARDING · FACEBOOK</p>
                <h1>Connect Facebook Page</h1>
                <p>Authorize your Facebook account and connect the Page that will run auctions.</p>
              </div>

              <button className="secondary-button" onClick={loadFacebookStatus} disabled={facebookLoading}>
                {facebookLoading ? "Checking..." : "Refresh Status"}
              </button>
            </header>

            {facebookMessage && (
              <div className="success-message global-error">{facebookMessage}</div>
            )}

            <section className="onboarding-steps">
              <div className="onboarding-step done">
                <span>1</span>
                <div><strong>Client Account</strong><small>{client?.name || "Account ready"}</small></div>
              </div>
              <div className={`onboarding-step ${facebookStatus?.connected ? "done" : "current"}`}>
                <span>2</span>
                <div><strong>Connect Facebook</strong><small>{facebookStatus?.connected ? "Connected" : "Authorization required"}</small></div>
              </div>
              <div className={`onboarding-step ${facebookStatus?.connected ? "done" : ""}`}>
                <span>3</span>
                <div><strong>Page Registration</strong><small>{facebookStatus?.connected ? `${facebookStatus.active_page_count || 0} active page(s)` : "Waiting for Facebook"}</small></div>
              </div>
              <div className="onboarding-step">
                <span>4</span>
                <div><strong>Optional Services</strong><small>Facebook and PayMongo can be configured anytime</small></div>
              </div>
            </section>

            <section className="facebook-connect-card">
              <div className="facebook-connect-copy">
                <div className="facebook-icon">f</div>
                <div>
                  <h2>{facebookStatus?.connected ? "Facebook is connected" : "Connect your Facebook Page"}</h2>
                  <p>Use the Facebook account that has management access to the Page you want to automate. You do not need your own Meta Developer app.</p>
                </div>
              </div>

              <div className="facebook-connect-actions">
                <button className="primary-button" onClick={connectFacebook}>
                  {facebookStatus?.connected ? "Reconnect Facebook" : "Connect Facebook"}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setPage("dashboard")}
                >
                  {facebookStatus?.connected ? "Continue to Dashboard" : "Skip for Now"}
                </button>
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Connected Pages</h2>
                  <p>Pages registered to this client. Access tokens are never shown in the browser.</p>
                </div>
                <StatusBadge status={facebookStatus?.connected ? "CONNECTED" : "NOT_CONNECTED"} />
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Facebook Page ID</th>
                      <th>Status</th>
                      <th>Authorization</th>
                      <th>Connected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(facebookStatus?.pages || []).map((fbPage) => (
                      <tr key={fbPage.fb_page_id}>
                        <td>{fbPage.page_name || "Facebook Page"}</td>
                        <td>{fbPage.fb_page_id || "-"}</td>
                        <td><StatusBadge status={fbPage.status || "ACTIVE"} /></td>
                        <td><StatusBadge status={fbPage.token_present ? "AUTHORIZED" : "RECONNECT"} /></td>
                        <td>{formatDateTime(fbPage.connected_at)}</td>
                      </tr>
                    ))}

                    {!facebookLoading && !(facebookStatus?.pages || []).length && (
                      <tr>
                        <td colSpan="5" className="empty-table-cell">No Facebook Page connected yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="setup-requirements-card">
              <h2>What the client needs</h2>
              <div className="requirements-grid">
                <div><strong>Facebook account</strong><span>Use the account that manages the business Page.</span></div>
                <div><strong>Page access</strong><span>The account must have enough Page permissions to authorize your automation.</span></div>
                <div><strong>No developer setup</strong><span>Your platform's Meta app handles OAuth, webhook and API integration.</span></div>
              </div>
            </section>
          </>
        )}

        {page === "automation-control" && (
          <>
            {automationModal && (
              <div
                className="control-modal-backdrop"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 99999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                  background: "rgba(15, 23, 42, 0.48)",
                }}
              >
                <div
                  className="control-modal"
                  role="dialog"
                  aria-modal="true"
                  style={{
                    width: "min(520px, 100%)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    background: "#fff",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
                  }}
                >
                  <div className={`control-modal-icon ${automationModal.enabled ? "on" : "off"}`}>
                    {automationModal.enabled ? "✓" : "!"}
                  </div>

                  <div className="control-modal-copy">
                    <h3>
                      {automationModal.enabled ? "Enable automation?" : "Disable automation?"}
                    </h3>
                    <p>
                      {automationModal.label}
                    </p>
                    <small>
                      {automationModal.enabled
                        ? "Processing can resume immediately, subject to any higher-level suspension."
                        : "New automated activity will stop at this scope. Existing records are preserved."}
                    </small>
                  </div>

                  <label className="control-modal-reason">
                    Reason {automationModal.enabled ? "(optional)" : "(required)"}
                    <textarea
                      rows="3"
                      value={automationReason}
                      onChange={(e) => setAutomationReason(e.target.value)}
                      placeholder={
                        automationModal.enabled
                          ? "Example: Subscription renewed"
                          : "Example: Subscription overdue"
                      }
                    />
                  </label>

                  <div className="control-modal-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setAutomationModal(null);
                        setAutomationReason("");
                      }}
                      disabled={automationControlLoading}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className={automationModal.enabled ? "primary-button" : "danger-confirm-button"}
                      onClick={confirmAutomationChange}
                      disabled={automationControlLoading}
                    >
                      {automationModal.enabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <header className="dashboard-header">
              <div>
                <p className="eyebrow">AUTOMATION GOVERNANCE</p>
                <h1>Automation Control</h1>
                <p>Pause or resume EO2MATE without deleting client, Page, auction, or transaction data.</p>
              </div>

              <button
                className="icon-button refresh-icon-button"
                type="button"
                onClick={loadAutomationControls}
                disabled={automationControlLoading}
                title="Refresh automation controls"
                aria-label="Refresh automation controls"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 6v5h-5" />
                  <path d="M4 18v-5h5" />
                  <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
                  <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
                </svg>
              </button>
            </header>

            {automationControlMessage && (
              <div className="success-message global-error">
                {automationControlMessage}
              </div>
            )}

            <section className="automation-hierarchy-note">
              <div className="automation-hierarchy-icon">i</div>
              <div>
                <strong>Control priority</strong>
                <span>Client OFF overrides Page ON and Post ON. Page OFF overrides Post ON. A post runs only when all three levels are enabled.</span>
              </div>
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Client automation</h2>
                  <p>Use this for account-wide suspension such as an overdue EO2MATE subscription.</p>
                </div>
              </div>

              <div className="automation-control-row client-scope">
                <div className={`automation-switch-orb ${automationScopeEnabled("CLIENT", client?.client_id) ? "enabled" : "disabled"}`}>
                  <span />
                </div>

                <div className="automation-control-copy">
                  <strong>{client?.name || "Current client"}</strong>
                  <span>
                    Client-wide auction, Messenger and payment automation
                  </span>
                  {!automationScopeEnabled("CLIENT", client?.client_id) && (
                    <small>
                      Reason: {automationScopeReason("CLIENT", client?.client_id) || "No reason recorded"}
                    </small>
                  )}
                </div>

                <StatusBadge
                  status={
                    automationScopeEnabled("CLIENT", client?.client_id)
                      ? "ACTIVE"
                      : "SUSPENDED"
                  }
                />

                <button
                  type="button"
                  className={
                    automationScopeEnabled("CLIENT", client?.client_id)
                      ? "control-off-button"
                      : "control-on-button"
                  }
                  disabled={
                    automationControlLoading ||
                    String(client?.role || "").toUpperCase() !== "SUPER_ADMIN"
                  }
                  title={
                    String(client?.role || "").toUpperCase() === "SUPER_ADMIN"
                      ? "Change client automation"
                      : "Client-level suspension requires SUPER_ADMIN"
                  }
                  onClick={() =>
                    requestAutomationChange({
                      scopeType: "CLIENT",
                      scopeId: client?.client_id,
                      label: client?.name || "Current client",
                      enabled: !automationScopeEnabled("CLIENT", client?.client_id),
                    })
                  }
                >
                  {automationScopeEnabled("CLIENT", client?.client_id) ? "Turn Off" : "Turn On"}
                </button>
              </div>

              {String(client?.role || "").toUpperCase() !== "SUPER_ADMIN" && (
                <div className="automation-permission-note">
                  Client-level ON/OFF is locked to SUPER_ADMIN so a subscription-suspended client cannot reactivate itself.
                </div>
              )}
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Facebook Page automation</h2>
                  <p>Pause one Page while leaving the client's other connected Pages running.</p>
                </div>
              </div>

              <div className="automation-page-list">
                {(automationPages || []).map((fbPage) => {
                  const pageEnabled = automationScopeEnabled("PAGE", fbPage.fb_page_id);
                  const clientEnabled = automationScopeEnabled("CLIENT", client?.client_id);
                  const effectiveEnabled = clientEnabled && pageEnabled;

                  return (
                    <div className="automation-control-row" key={fbPage.fb_page_id}>
                      <div className={`automation-switch-orb ${effectiveEnabled ? "enabled" : "disabled"}`}>
                        <span />
                      </div>

                      <div className="automation-control-copy">
                        <strong>{fbPage.page_name || "Facebook Page"}</strong>
                        <span>{fbPage.fb_page_id}</span>
                        {!pageEnabled && (
                          <small>
                            Reason: {automationScopeReason("PAGE", fbPage.fb_page_id) || "No reason recorded"}
                          </small>
                        )}
                        {pageEnabled && !clientEnabled && (
                          <small>Blocked by client-level suspension.</small>
                        )}
                      </div>

                      <StatusBadge status={effectiveEnabled ? "ACTIVE" : "SUSPENDED"} />

                      <button
                        type="button"
                        className={pageEnabled ? "control-off-button" : "control-on-button"}
                        disabled={
                          automationControlLoading ||
                          !["ADMIN", "OWNER", "SUPER_ADMIN"].includes(
                            String(client?.role || "").toUpperCase()
                          )
                        }
                        onClick={() =>
                          requestAutomationChange({
                            scopeType: "PAGE",
                            scopeId: fbPage.fb_page_id,
                            label: fbPage.page_name || fbPage.fb_page_id,
                            enabled: !pageEnabled,
                          })
                        }
                      >
                        {pageEnabled ? "Turn Off" : "Turn On"}
                      </button>
                    </div>
                  );
                })}

                {!automationControlLoading && !(automationPages || []).length && (
                  <div className="empty-control-state">
                    No connected Facebook Pages found for this client.
                  </div>
                )}
              </div>
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Post-level control</h2>
                  <p>The Facebook Page owner controls individual auction posts directly from the main comment section.</p>
                </div>
              </div>

              <div className="post-command-guide">
                <div>
                  <code>EO2MATE OFF</code>
                  <span>Pause bids, announcements and automatic winner/closing processing for that specific post.</span>
                </div>
                <div>
                  <code>EO2MATE ON</code>
                  <span>Resume the post. Higher-level Client/Page suspension still takes priority.</span>
                </div>
              </div>

              <div className="automation-permission-note">
                These commands are accepted only when posted by the Facebook Page itself on the main auction post, for both Single and Multiple Auction.
              </div>
            </section>
          </>
        )}

        {page === "dashboard" && (
          <>
            <section className="eo2-dashboard-hero">
              <div>
                <p className="eyebrow">CLIENT DASHBOARD</p>
                <h1>
                  Welcome back,
                  <span> {client?.name || "EO2MATE Client"}</span>
                </h1>
                <p>
                  Manage your auctions, orders, payments and deliveries — all in one place.
                </p>
              </div>

              <div className="eo2-dashboard-code-badge" aria-hidden="true">
                &lt;/&gt;
              </div>
            </section>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">CLIENT DASHBOARD</p>
                <h1>{client?.name ? `Welcome, ${client.name}` : "Dashboard"}</h1>
                <p>Monitor auctions, orders, payments and deliveries.</p>
              </div>

              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
            </header>

            {onboardingChecked && facebookStatus && !facebookStatus.connected && (
              <section className="connection-warning-card">
                <div>
                  <strong>Facebook auction automation is not configured</strong>
                  <span>
                    You can use the portal now and connect a Facebook Page whenever you are ready to automate auctions.
                  </span>
                </div>

                <button
                  className="primary-button"
                  type="button"
                  onClick={openFacebookSetup}
                >
                  Connect Facebook
                </button>
              </section>
            )}

            <section className={`payment-setup-card ${paymentAccountStatus?.payment_enabled ? "active" : ""}`}>
              <div className="payment-setup-copy">
                <div className="payment-logo">P</div>
                <div>
                  <strong>PayMongo</strong>
                  <span>
                    {paymentAccountStatus?.payment_enabled
                      ? "Online checkout is active for this client."
                      : String(paymentAccountStatus?.account_status || "NOT_CONFIGURED").toUpperCase() === "NOT_CONFIGURED"
                        ? "Optional: create a PayMongo account to enable automated online payments later."
                        : "PayMongo account exists, but automated checkout is not active yet."}
                  </span>
                  <small>Status: {statusLabel(paymentAccountStatus?.account_status || "NOT_CONFIGURED")}</small>
                </div>
              </div>

              <div className="payment-setup-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={openPayMongo}
                  disabled={paymentAccountLoading}
                >
                  {String(paymentAccountStatus?.account_status || "NOT_CONFIGURED").toUpperCase() === "NOT_CONFIGURED"
                    ? "Set Up PayMongo"
                    : "Open PayMongo Dashboard"}
                </button>

                {String(paymentAccountStatus?.account_status || "NOT_CONFIGURED").toUpperCase() === "NOT_CONFIGURED" && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={markPayMongoAccountCreated}
                    disabled={paymentAccountLoading}
                  >
                    I Already Have PayMongo
                  </button>
                )}

                <button
                  className="icon-button refresh-icon-button"
                  type="button"
                  onClick={loadPaymentAccountStatus}
                  disabled={paymentAccountLoading}
                 title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
              </div>
            </section>

            {paymentAccountMessage && (
              <div className="success-message global-error">{paymentAccountMessage}</div>
            )}

            <section className="metrics-grid">
              <MetricCard title="Active auctions" value={auctionMetrics.active} subtitle="Currently open" onClick={() => goToAuctions("ACTIVE")} />
              <MetricCard title="Pending orders" value={orderMetrics.pending} subtitle="Awaiting payment" onClick={() => goToOrders("PAYMENT_PENDING")} />
              {paymentAccountStatus?.payment_enabled ? (
                <MetricCard title="Pending payments" value={paymentMetrics.pending} subtitle="Awaiting settlement" onClick={() => goToPayments("pending")} />
              ) : (
                <MetricCard title="Online payments" value="Off" subtitle="PayMongo not active" onClick={openPayMongo} />
              )}
              <MetricCard title="Ready for booking" value={deliveryMetrics.ready} subtitle="Paid and ready" onClick={() => goToDeliveries("READY_FOR_BOOKING")} />
              <MetricCard title="Delivered" value={deliveryMetrics.delivered} subtitle="Completed deliveries" onClick={() => goToDeliveries("DELIVERED")} />
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Recent deliveries</h2>
                  <p>Latest paid-order delivery activity.</p>
                </div>

                <button className="secondary-button" onClick={() => goToDeliveries("ALL")}>
                  View all
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Item</th>
                      <th>Recipient</th>
                      <th>Courier</th>
                      <th>Tracking</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {deliveries.slice(0, 10).map((delivery) => (
                      <tr
                        key={delivery.delivery_id}
                        className="clickable-row"
                        onClick={() => openDelivery(delivery.delivery_id)}
                      >
                        <td>{delivery.order_number}</td>
                        <td>{delivery.item_label}</td>
                        <td>{delivery.recipient_name || delivery.buyer_name || "-"}</td>
                        <td>{delivery.courier_name || "-"}</td>
                        <td>{delivery.tracking_number || "-"}</td>
                        <td><StatusBadge status={delivery.delivery_status} /></td>
                        <td>{formatDateTime(delivery.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "auctions" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">AUCTION MANAGEMENT</p>
                <h1>Auctions</h1>
                <p>Search, filter and inspect auction activity.</p>
              </div>
              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
            </header>

            <section className="toolbar-card">
              <input className="search-input" value={auctionSearch} onChange={(e) => setAuctionSearch(e.target.value)} placeholder="Search auctions..." />
              <select className="filter-select" value={auctionStatusFilter} onChange={(e) => setAuctionStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED_WITH_WINNER">Completed with winner</option>
                <option value="CLOSED_NO_WINNER">Closed no winner</option>
                <option value="AWAITING_FINALIZER">Awaiting finalizer</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Auction list</h2><p>{filteredAuctions.length} record(s)</p></div></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Item</th><th>Status</th><th>Highest bid</th><th>Bidder</th><th>Valid bidders</th><th>Ends</th><th>Payment</th></tr>
                  </thead>
                  <tbody>
                    {filteredAuctions.map((auction) => (
                      <tr key={auction.auction_item_id} className="clickable-row" onClick={() => openAuction(auction.auction_item_id)}>
                        <td>{auction.item_label}</td>
                        <td><StatusBadge status={auction.ui_status} /></td>
                        <td>{formatCurrency(auction.highest_bid)}</td>
                        <td>{auction.highest_bidder_name || "-"}</td>
                        <td>{auction.valid_bidder_count}/{auction.min_bidder_count}</td>
                        <td>{formatDateTime(auction.auction_end_dt)}</td>
                        <td>{auction.payment_status || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "orders" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">ORDER MANAGEMENT</p>
                <h1>Orders</h1>
                <p>Track winner orders from payment pending to completion.</p>
              </div>
              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
            </header>

            <section className="toolbar-card">
              <input className="search-input" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search order, item or buyer..." />
              <select className="filter-select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="PAYMENT_PENDING">Payment pending</option>
                <option value="PAID">Paid</option>
                <option value="READY_FOR_DELIVERY">Ready for delivery</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Order list</h2><p>{filteredOrders.length} record(s)</p></div></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Order</th><th>Item</th><th>Buyer</th><th>Total</th><th>Order status</th><th>Payment</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.order_id} className="clickable-row" onClick={() => openOrder(order.order_id)}>
                        <td>{order.order_number}</td>
                        <td>{order.item_label}</td>
                        <td>{order.buyer_name || "-"}</td>
                        <td>{formatCurrency(order.total_amount)}</td>
                        <td><StatusBadge status={order.order_status} /></td>
                        <td><StatusBadge status={order.latest_payment_status || order.payment_status} /></td>
                        <td>{formatDateTime(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "payments" && paymentAccountStatus?.payment_enabled && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">PAYMENT MANAGEMENT</p>
                <h1>Payments</h1>
                <p>Monitor PayMongo transactions, payment deadlines and manual payment extensions.</p>
              </div>
              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
            </header>

            {reopenMessage && <div className="success-message global-error">{reopenMessage}</div>}

            <section className="dashboard-panel payment-groups-panel">
              <div className="panel-header">
                <div>
                  <h2>Order groups & payment windows</h2>
                  <p>Expired groups can be manually reopened by an authorized admin.</p>
                </div>
              </div>

              <div className="payment-group-toolbar">
                <input
                  className="search-input"
                  value={paymentGroupSearch}
                  onChange={(e) => setPaymentGroupSearch(e.target.value)}
                  placeholder="Search group or buyer..."
                />
                <select
                  className="filter-select"
                  value={paymentGroupStatusFilter}
                  onChange={(e) => setPaymentGroupStatusFilter(e.target.value)}
                >
                  <option value="ALL">All group statuses</option>
                  <option value="PAYMENT_PENDING">Payment pending</option>
                  <option value="PAYMENT_EXPIRED">Payment expired</option>
                  <option value="PAYMENT_REOPENED">Payment reopened</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Group</th><th>Buyer</th><th>Total</th><th>Status</th><th>Deadline</th><th>Time remaining</th><th>Reopens</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaymentGroups.length === 0 ? (
                      <tr><td colSpan="8" className="empty-table-cell">No payment groups found.</td></tr>
                    ) : filteredPaymentGroups.map((group) => {
                      const effectiveDeadline = group.payment_reopen_deadline_at || group.payment_deadline_at;
                      const expired = Boolean(group.payment_expired_at);

                      return (
                        <tr key={group.order_group_id}>
                          <td>{group.group_number || group.order_group_id}</td>
                          <td>{group.buyer_name || "-"}</td>
                          <td>{formatCurrency(group.total_amount)}</td>
                          <td><StatusBadge status={paymentGroupStatus(group)} /></td>
                          <td>{formatDateTime(effectiveDeadline)}</td>
                          <td>{expired ? "Expired" : formatTimeRemaining(effectiveDeadline)}</td>
                          <td>{group.payment_reopen_count || 0}</td>
                          <td>
                            {expired && isPaymentAdmin ? (
                              <button
                                type="button"
                                className="table-action-button"
                                onClick={() => {
                                  setReopenGroup(group);
                                  setReopenMessage("");
                                }}
                              >
                                Allow Payment Again
                              </button>
                            ) : expired ? (
                              <span className="table-muted">Admin required</span>
                            ) : (
                              <span className="table-muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {reopenGroup && (
              <section className="reopen-payment-card">
                <div>
                  <p className="eyebrow">ADMIN OVERRIDE</p>
                  <h2>Allow Payment Again</h2>
                  <p>Group <strong>{reopenGroup.group_number || reopenGroup.order_group_id}</strong> will receive a new payment window. The auction itself will remain closed.</p>
                </div>

                <div className="reopen-payment-form">
                  <label>
                    New payment window (hours)
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={reopenHours}
                      onChange={(e) => setReopenHours(e.target.value)}
                    />
                  </label>

                  <label>
                    Reason / remarks
                    <input
                      type="text"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      placeholder="Example: Buyer contacted admin and requested late payment"
                    />
                  </label>
                </div>

                <div className="reopen-payment-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setReopenGroup(null)}
                    disabled={reopenLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={reopenExpiredPayment}
                    disabled={reopenLoading}
                  >
                    {reopenLoading ? "Reopening..." : "Confirm Reopen"}
                  </button>
                </div>
              </section>
            )}

            <section className="toolbar-card payments-toolbar">
              <input className="search-input" value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} placeholder="Search payment..." />
              <select className="filter-select" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="refunded">Refunded</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Payment transactions</h2><p>{filteredPayments.length} record(s)</p></div></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Order</th><th>Item</th><th>Buyer</th><th>Amount</th><th>Provider</th><th>Status</th><th>Paid at</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.payment_id} className="clickable-row" onClick={() => openPayment(payment.payment_id)}>
                        <td>{payment.order_number}</td>
                        <td>{payment.item_label}</td>
                        <td>{payment.buyer_name || "-"}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.provider || "-"}</td>
                        <td><StatusBadge status={payment.payment_status} /></td>
                        <td>{formatDateTime(payment.paid_at)}</td>
                        <td>{formatDateTime(payment.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "setup" && (
          <SetupPage client={client} />
        )}

        {page === "deliveries" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">DELIVERY MANAGEMENT</p>
                <h1>Delivery</h1>
                <p>Track paid orders from booking to successful delivery.</p>
              </div>
              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
            </header>

            <section className="metrics-grid compact-metrics">
              <MetricCard title="Ready for booking" value={deliveryMetrics.ready} subtitle="Paid orders" onClick={() => goToDeliveries("READY_FOR_BOOKING")} />
              <MetricCard title="In transit" value={deliveryMetrics.inTransit} subtitle="On the way" onClick={() => goToDeliveries("IN_TRANSIT")} />
              <MetricCard title="Delivered" value={deliveryMetrics.delivered} subtitle="Completed" onClick={() => goToDeliveries("DELIVERED")} />
            </section>

            <section className="toolbar-card">
              <input className="search-input" value={deliverySearch} onChange={(e) => setDeliverySearch(e.target.value)} placeholder="Search order, recipient, courier or tracking..." />
              <select className="filter-select" value={deliveryStatusFilter} onChange={(e) => setDeliveryStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="READY_FOR_BOOKING">Ready for booking</option>
                <option value="BOOKED">Booked</option>
                <option value="PICKED_UP">Picked up</option>
                <option value="DROPPED_OFF">Dropped off</option>
                <option value="IN_TRANSIT">In transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Delivery list</h2><p>{filteredDeliveries.length} record(s)</p></div></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Order</th><th>Item</th><th>Recipient</th><th>Courier</th><th>Tracking</th><th>Status</th><th>Shipping fee</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.map((delivery) => (
                      <tr key={delivery.delivery_id} className="clickable-row" onClick={() => openDelivery(delivery.delivery_id)}>
                        <td>{delivery.order_number}</td>
                        <td>{delivery.item_label}</td>
                        <td>{delivery.recipient_name || delivery.buyer_name || "-"}</td>
                        <td>{delivery.courier_name || "-"}</td>
                        <td>{delivery.tracking_number || "-"}</td>
                        <td><StatusBadge status={delivery.delivery_status} /></td>
                        <td>{formatCurrency(delivery.shipping_fee)}</td>
                        <td>{formatDateTime(delivery.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "auction-detail" && (
          <>
            <button className="back-button" onClick={() => setPage("auctions")}>← Back to auctions</button>

            {detailLoading ? (
              <div className="loading-card detail-loading"><h2>Loading auction</h2></div>
            ) : auctionDetail ? (
              <>
                <header className="dashboard-header">
                  <div>
                    <p className="eyebrow">AUCTION DETAIL</p>
                    <h1>{auctionDetail.item_label}</h1>
                    <p>Facebook post: {auctionDetail.fb_post_id}</p>
                  </div>
                  <StatusBadge status={auctionDetail.ui_status} />
                </header>

                <section className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Rules</h2></div>
                    <DetailRow label="Minimum bid" value={formatCurrency(auctionDetail.min_bid)} />
                    <DetailRow label="Increment" value={formatCurrency(auctionDetail.bid_increment)} />
                    <DetailRow label="Minimum bidders" value={auctionDetail.min_bidder_count} />
                    <DetailRow label="Buyout" value={formatCurrency(auctionDetail.bid_buyout_amt)} />
                    <DetailRow label="Auction ends" value={formatDateTime(auctionDetail.auction_end_dt)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Result</h2></div>
                    <DetailRow label="Highest bid" value={formatCurrency(auctionDetail.highest_bid)} />
                    <DetailRow label="Highest bidder" value={auctionDetail.highest_bidder_name || "-"} />
                    <DetailRow label="Valid bidders" value={auctionDetail.valid_bidder_count} />
                    <DetailRow label="Winner amount" value={formatCurrency(auctionDetail.winning_amt)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Payment</h2></div>
                    <DetailRow label="Payment status" value={auctionDetail.payment_status || "-"} />
                    <DetailRow label="Payment amount" value={formatCurrency(auctionDetail.payment_amount)} />
                  </div>
                </section>

                <section className="dashboard-panel">
                  <div className="panel-header"><div><h2>Bid history</h2><p>Captured comments and validation remarks.</p></div></div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Bidder</th><th>Comment</th><th>Bid</th><th>Valid</th><th>Reason</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {bidHistory.map((bid) => (
                          <tr key={bid.bid_id}>
                            <td>{bid.fb_user_name || "-"}</td>
                            <td>{bid.comment_text || "-"}</td>
                            <td>{formatCurrency(bid.bid_amt)}</td>
                            <td><StatusBadge status={bid.is_valid ? "VALID" : "INVALID"} /></td>
                            <td>{bid.invalid_reason || "-"}</td>
                            <td>{formatDateTime(bid.commented_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}

        {page === "order-detail" && (
          <>
            <button className="back-button" onClick={() => setPage("orders")}>← Back to orders</button>

            {detailLoading ? (
              <div className="loading-card detail-loading"><h2>Loading order</h2></div>
            ) : orderDetail ? (
              <>
                <header className="dashboard-header">
                  <div>
                    <p className="eyebrow">ORDER DETAIL</p>
                    <h1>{orderDetail.order_number}</h1>
                    <p>{orderDetail.item_label}</p>
                  </div>
                  <StatusBadge status={orderDetail.order_status} />
                </header>

                <section className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Order</h2></div>
                    <DetailRow label="Subtotal" value={formatCurrency(orderDetail.subtotal)} />
                    <DetailRow label="Shipping fee" value={formatCurrency(orderDetail.shipping_fee)} />
                    <DetailRow label="Total" value={formatCurrency(orderDetail.total_amount)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Buyer</h2></div>
                    <DetailRow label="Name" value={orderDetail.buyer_name || "-"} />
                    <DetailRow label="Phone" value={orderDetail.buyer_phone || "-"} />
                    <DetailRow label="Email" value={orderDetail.buyer_email || "-"} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Payment</h2></div>
                    <DetailRow label="Status" value={orderDetail.latest_payment_status || orderDetail.payment_status || "-"} />
                    <DetailRow label="Provider" value={orderDetail.provider || "-"} />
                    <DetailRow label="Amount" value={formatCurrency(orderDetail.payment_amount)} />
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}

        {page === "payment-detail" && (
          <>
            <button className="back-button" onClick={() => setPage("payments")}>← Back to payments</button>

            {detailLoading ? (
              <div className="loading-card detail-loading"><h2>Loading payment</h2></div>
            ) : paymentDetail ? (
              <>
                <header className="dashboard-header">
                  <div>
                    <p className="eyebrow">PAYMENT DETAIL</p>
                    <h1>{paymentDetail.order_number}</h1>
                    <p>{paymentDetail.item_label}</p>
                  </div>
                  <StatusBadge status={paymentDetail.payment_status} />
                </header>

                <section className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Payment</h2></div>
                    <DetailRow label="Payment ID" value={paymentDetail.payment_id} />
                    <DetailRow label="Provider" value={paymentDetail.provider || "-"} />
                    <DetailRow label="Amount" value={formatCurrency(paymentDetail.amount)} />
                    <DetailRow label="Status" value={paymentDetail.payment_status || "-"} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>PayMongo</h2></div>
                    <DetailRow label="Checkout session" value={paymentDetail.checkout_session_id || "-"} />
                    <DetailRow label="Reference" value={paymentDetail.payment_reference || "-"} />
                    <DetailRow label="Paid at" value={formatDateTime(paymentDetail.paid_at)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Related order</h2></div>
                    <DetailRow label="Order status" value={paymentDetail.order_status} />
                    <DetailRow label="Buyer" value={paymentDetail.buyer_name || "-"} />
                    <DetailRow label="Winning amount" value={formatCurrency(paymentDetail.winning_amt)} />
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}

        {page === "delivery-detail" && (
          <>
            <button className="back-button" onClick={() => setPage("deliveries")}>← Back to delivery</button>

            {detailLoading ? (
              <div className="loading-card detail-loading"><h2>Loading delivery</h2></div>
            ) : deliveryDetail ? (
              <>
                <header className="dashboard-header">
                  <div>
                    <p className="eyebrow">DELIVERY DETAIL</p>
                    <h1>{deliveryDetail.group_number || deliveryDetail.order_number || deliveryDetail.delivery_id}</h1>
                    <p>{deliveryDetail.item_label || (deliveryDetail.order_group_id ? "Consolidated shipment" : "Shipment")}</p>
                  </div>
                  <div className="header-actions">
                    {deliveryDetail.tracking_number && (
                      <button className="secondary-button" type="button" onClick={printParcelLabel}>
                        Print Parcel Label
                      </button>
                    )}
                    <StatusBadge status={deliveryDetail.delivery_status} />
                  </div>
                </header>

                <section className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Courier & Fulfillment</h2></div>
                    <DetailRow label="Courier code" value={deliveryDetail.courier_code || "-"} />
                    <DetailRow label="Courier name" value={deliveryDetail.courier_name || "-"} />
                    <DetailRow label="Fulfillment method" value={statusLabel(deliveryDetail.fulfillment_method || "PICKUP_BY_COURIER")} />
                    <DetailRow label="Courier status" value={deliveryDetail.courier_status || "-"} />
                    <DetailRow label="Booking reference" value={deliveryDetail.booking_reference || "-"} />
                    <DetailRow label="Tracking number" value={deliveryDetail.tracking_number || "-"} />
                    <DetailRow label="Tracking URL" value={deliveryDetail.tracking_url || "-"} />
                    <DetailRow label="Shipping fee" value={formatCurrency(deliveryDetail.shipping_fee)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Recipient</h2></div>
                    <DetailRow label="Name" value={deliveryDetail.recipient_name || "-"} />
                    <DetailRow label="Phone" value={deliveryDetail.recipient_phone || "-"} />
                    <DetailRow label="Address 1" value={deliveryDetail.address_line1 || "-"} />
                    <DetailRow label="Address 2" value={deliveryDetail.address_line2 || "-"} />
                    <DetailRow label="City" value={deliveryDetail.city || "-"} />
                    <DetailRow label="Province" value={deliveryDetail.province || "-"} />
                    <DetailRow label="Postal code" value={deliveryDetail.postal_code || "-"} />
                    <DetailRow label="Country" value={deliveryDetail.country || "-"} />
                  </div>

                  {deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF" && (
                    <div className="detail-card">
                      <div className="detail-card-header"><h2>Drop-off Location</h2></div>
                      <DetailRow label="Branch" value={deliveryDetail.dropoff_location_name || "-"} />
                      <DetailRow label="Address" value={deliveryDetail.dropoff_address || "-"} />
                      <DetailRow label="Latitude" value={deliveryDetail.dropoff_lat ?? "-"} />
                      <DetailRow label="Longitude" value={deliveryDetail.dropoff_lng ?? "-"} />
                    </div>
                  )}

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Timeline</h2></div>
                    <DetailRow label="Booked at" value={formatDateTime(deliveryDetail.booked_at)} />
                    <DetailRow label="Picked up at" value={formatDateTime(deliveryDetail.picked_up_at)} />
                    <DetailRow label="Dropped off at" value={formatDateTime(deliveryDetail.dropped_off_at)} />
                    <DetailRow label="In transit at" value={formatDateTime(deliveryDetail.shipped_at)} />
                    <DetailRow label="Delivered at" value={formatDateTime(deliveryDetail.delivered_at)} />
                    <DetailRow label="Failed at" value={formatDateTime(deliveryDetail.failed_at)} />
                    <DetailRow label="Cancelled at" value={formatDateTime(deliveryDetail.cancelled_at)} />
                  </div>
                </section>

                {deliveryDetail.delivery_status === "READY_FOR_BOOKING" && (
                  <section className="form-card">
                    <div className="form-card-header">
                      <div>
                        <h2>Confirm Manual Courier Booking</h2>
                        <p>Prepare the shipment first, then enter the real booking and tracking details from the courier.</p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={deliveryActionLoading}
                        onClick={prepareDeliveryBooking}
                      >
                        Prepare Booking
                      </button>
                    </div>

                    <form className="inline-form-grid" onSubmit={confirmManualBooking}>
                      <label>
                        Booking Reference
                        <input type="text" value={bookingReference} onChange={(e) => setBookingReference(e.target.value)} placeholder="Optional" />
                      </label>

                      <label>
                        Tracking Number
                        <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Required" required />
                      </label>

                      <label className="wide-field">
                        Tracking URL
                        <input type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="Optional" />
                      </label>

                      <div className="wide-field form-actions">
                        <button className="primary-button" type="submit" disabled={deliveryActionLoading}>
                          {deliveryActionLoading ? "Saving..." : "Confirm Booking"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                {deliveryDetail.delivery_status === "BOOKED" && deliveryDetail.fulfillment_method === "CLIENT_DROP_OFF" && (
                  <section className="action-card">
                    <div>
                      <h2>Confirm Parcel Drop-off</h2>
                      <p>Use this after the client has handed the parcel to the selected courier branch.</p>
                    </div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("DROPPED_OFF")}>
                      Mark Dropped Off
                    </button>
                  </section>
                )}

                {deliveryDetail.delivery_status === "BOOKED" && deliveryDetail.fulfillment_method !== "CLIENT_DROP_OFF" && (
                  <section className="action-card">
                    <div>
                      <h2>Parcel Pickup</h2>
                      <p>Use this when the courier has physically received the parcel from the pickup location.</p>
                    </div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("PICKED_UP")}>
                      Mark Picked Up
                    </button>
                  </section>
                )}

                {["PICKED_UP", "DROPPED_OFF"].includes(deliveryDetail.delivery_status) && (
                  <section className="action-card">
                    <div><h2>Shipment In Transit</h2><p>Use this when the parcel is moving through the courier network.</p></div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("IN_TRANSIT")}>Mark In Transit</button>
                  </section>
                )}

                {deliveryDetail.delivery_status === "IN_TRANSIT" && (
                  <section className="action-card">
                    <div><h2>Delivery Completion</h2><p>Use this only after the parcel reaches the recipient.</p></div>
                    <button className="primary-button" disabled={deliveryActionLoading} onClick={() => updateDeliveryStatus("DELIVERED")}>Mark Delivered</button>
                  </section>
                )}

                {deliveryDetail.delivery_status === "DELIVERED" && (
                  <section className="completion-card">
                    <strong>Delivery completed</strong>
                    <span>{formatDateTime(deliveryDetail.delivered_at)}</span>
                  </section>
                )}
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
