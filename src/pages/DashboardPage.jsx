import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";


function NavIcon({ type }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    clients: (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M17 8h4" />
        <path d="M19 6v4" />
      </svg>
    ),
    back: (
      <svg {...common}>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    ),
    dashboard: (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    facebook: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M13.5 8H12a2 2 0 0 0-2 2v2h3" />
        <path d="M10 21v-9" />
        <path d="M8 12h5" />
      </svg>
    ),
    create: (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    ),
    mining: (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M6 10h12" />
        <path d="M8 14h8" />
        <path d="M10 18h4" />
        <circle cx="12" cy="6" r="1" />
      </svg>
    ),
    auction: (
      <svg {...common}>
        <path d="m14 5 5 5" />
        <path d="m11 8 5 5" />
        <path d="M4 20 14.5 9.5" />
        <path d="M3 21h7" />
      </svg>
    ),
    orders: (
      <svg {...common}>
        <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M9 11h6" />
      </svg>
    ),
    payments: (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h3" />
      </svg>
    ),
    delivery: (
      <svg {...common}>
        <path d="M3 6h11v11H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    ),
    chat: (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    ),
    bell: (
      <svg {...common}>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    ),
    users: (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2" />
        <path d="M16 14a5 5 0 0 1 5 5" />
      </svg>
    ),
    inventory: (
      <svg {...common}>
        <path d="M4 7 12 3l8 4-8 4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
    sales: (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M3 19h18" />
        <path d="m15 7 3-3 3 3" />
      </svg>
    ),
    purchases: (
      <svg {...common}>
        <path d="M3 4h2l2 11h10l2-7H7" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
        <path d="M12 6v5" />
        <path d="m10 9 2 2 2-2" />
      </svg>
    ),
    automation: (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    ),
    setup: (
      <svg {...common}>
        <path d="M4 21v-7" />
        <path d="M4 10V3" />
        <path d="M12 21v-9" />
        <path d="M12 8V3" />
        <path d="M20 21v-5" />
        <path d="M20 12V3" />
        <path d="M1 14h6" />
        <path d="M9 8h6" />
        <path d="M17 16h6" />
      </svg>
    ),
    reports: (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19V3" />
      </svg>
    ),
  };

  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        minWidth: 20,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icons[type] || icons.dashboard}
    </span>
  );
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


// Defense-in-depth only: SQL views and server actions must also enforce Page ownership.
// Rows with missing or ambiguous Page attribution are never displayed.
function onlySelectedPage(rows, pageId) {
  if (!pageId) return [];
  return (rows || []).filter((row) =>
    String(row.fb_page_id || row.page_fb_id || "") === String(pageId)
  );
}

function OrderActivityChart({ orders }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const points = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - index));
      return day;
    });

    return days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const dayOrders = (orders || []).filter((order) => {
        const createdAt = new Date(order.created_at || order.order_created_at || 0);
        return createdAt >= day && createdAt < next;
      });
      return {
        day,
        label: day.toLocaleDateString("en-PH", { weekday: "short" }),
        orders: dayOrders,
        count: dayOrders.length,
        total: dayOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0),
      };
    });
  }, [orders]);

  const max = Math.max(1, ...points.map((point) => point.count));
  const pointY = (point) => 82 - (point.count / max) * 64;
  const poly = points.map((point, index) => `${8 + index * (84 / 6)},${pointY(point)}`).join(" ");
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const formatCurrency = (amount) => new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", maximumFractionDigits: 2,
  }).format(amount);

  return <div style={{ padding: "4px 4px 0" }}>
    <div role="status" aria-live="polite" style={{ minHeight: 50, margin: "0 10px 4px", padding: "9px 12px", borderRadius: 12, background: activePoint ? "#f0f8f2" : "#f8fafb", border: `1px solid ${activePoint ? "#d8ecdd" : "#edf1f5"}`, color: "#385166", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px 14px", fontSize: 12 }}>
      {activePoint ? <>
        <strong style={{ color: "#1f3448" }}>{activePoint.day.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
        <span><strong>{activePoint.count}</strong> {activePoint.count === 1 ? "order" : "orders"}</span>
        <span>Order total: <strong>{formatCurrency(activePoint.total)}</strong></span>
        {activePoint.orders.length > 0 && <span style={{ flexBasis: "100%", color: "#708296" }}>
          {activePoint.orders.slice(0, 4).map((order) => order.order_number || order.buyer_name || "Order").join(" · ")}
          {activePoint.orders.length > 4 ? ` · +${activePoint.orders.length - 4} more` : ""}
        </span>}
      </> : <span style={{ color: "#7b8b9b" }}>Hover or focus a chart point to see its date, order count, and total.</span>}
    </div>
    <svg viewBox="0 0 100 92" preserveAspectRatio="none" style={{ width: "100%", height: 230, display: "block" }} role="img" aria-label="Seven day order activity chart. Focus a point for its details.">
      {[18, 34, 50, 66, 82].map((y) => <line key={y} x1="7" y1={y} x2="94" y2={y} stroke="#edf1f5" strokeWidth=".6" />)}
      <polyline points={poly} fill="none" stroke="#2b9a4b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => {
        const x = 8 + index * (84 / 6);
        const y = pointY(point);
        const dayLabel = point.day.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const details = `${dayLabel}: ${point.count} ${point.count === 1 ? "order" : "orders"}; total ${formatCurrency(point.total)}`;
        return <g key={point.day.toISOString()}>
          <circle cx={x} cy={y} r="4.5" fill="transparent" style={{ cursor: "pointer" }} tabIndex="0" role="button" aria-label={details} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
            <title>{details}</title>
          </circle>
          <circle cx={x} cy={y} r={activeIndex === index ? "2.5" : "1.7"} fill="#2b9a4b" pointerEvents="none" />
        </g>;
      })}
    </svg>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "0 3% 8px", color: "#7b8b9b", fontSize: 11, textAlign: "center" }}>
      {points.map((point) => <span key={point.day.toISOString()}>{point.label}</span>)}
    </div>
  </div>;
}

function DashboardCommunicationPanel({ client, selectedFbPageId, selectedFbPageName, facebookStatus, openFacebookSetup, navigateTo, floatingWidgetSettings, onFloatingWidgetSettingChange }) {
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState("");
  const [messengerUnread, setMessengerUnread] = useState(0);
  const [messengerBusy, setMessengerBusy] = useState(false);
  const clientId = client?.client_id;
  const unreadCount = notifications.filter((entry) => !entry.read_at).length;
  const hasConnectedPage = Boolean(facebookStatus?.connected && selectedFbPageId);

  async function loadNotifications() {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "live-admin" },
        body: { action: "notifications", client_id: clientId, ...(selectedFbPageId ? { fb_page_id: selectedFbPageId } : {}) },
      });
      if (error || data?.error) throw new Error(data?.detail || data?.message || data?.error || error?.message || "Unable to load notifications.");
      setNotifications(data?.notifications || []);
      setNotificationsError("");
    } catch (error) {
      setNotificationsError(error.message || "Unable to load notifications.");
    }
  }

  async function loadMessengerUnread() {
    if (!clientId || !hasConnectedPage) return;
    try {
      const { data, error } = await supabase.functions.invoke("meta", {
        method: "POST",
        headers: { "x-eo2mate-meta-route": "messenger-notifications" },
        body: { client_id: clientId },
      });
      if (!error && data?.success) {
        const page = (data.pages || []).find((entry) => String(entry.fb_page_id) === String(selectedFbPageId));
        setMessengerUnread(Number(page?.unread_count || 0));
      }
    } catch { /* Messenger status must not block the dashboard */ }
  }

  useEffect(() => {
    setNotifications([]);
    setMessengerUnread(0);
    if (!clientId) return undefined;
    loadNotifications();
    loadMessengerUnread();
    const timer = window.setInterval(() => {
      loadNotifications();
      loadMessengerUnread();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
        loadMessengerUnread();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clientId, selectedFbPageId, hasConnectedPage]);

  async function markRead(notificationId) {
    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((entry) => entry.id === notificationId ? { ...entry, read_at: readAt } : entry));
    try {
      const { data, error } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "live-admin" },
        body: { action: "mark-notification-read", client_id: clientId, notification_id: notificationId, ...(selectedFbPageId ? { fb_page_id: selectedFbPageId } : {}) },
      });
      if (error || data?.error) throw new Error(data?.detail || data?.error || error?.message || "Unable to update notification.");
      if (data?.notification) setNotifications((items) => items.map((entry) => entry.id === notificationId ? data.notification : entry));
    } catch (error) {
      setNotifications(previous);
      setNotificationsError(error.message || "Unable to update notification.");
    }
  }

  async function markAllRead() {
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((entry) => entry.read_at ? entry : { ...entry, read_at: readAt }));
    try {
      const { data, error } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "live-admin" },
        body: { action: "mark-all-notifications-read", client_id: clientId, ...(selectedFbPageId ? { fb_page_id: selectedFbPageId } : {}) },
      });
      if (error || data?.error) throw new Error(data?.detail || data?.error || error?.message || "Unable to update notifications.");
      setNotificationsError("");
    } catch (error) {
      setNotificationsError(error.message || "Unable to update notifications.");
      loadNotifications();
    }
  }

  async function openMessenger() {
    if (!clientId || !selectedFbPageId) return;
    setMessengerBusy(true);
    try {
      await supabase.functions.invoke("meta", {
        method: "POST",
        headers: { "x-eo2mate-meta-route": "messenger-notifications" },
        body: { client_id: clientId, action: "mark-read", fb_page_id: selectedFbPageId },
      });
      setMessengerUnread(0);
    } finally {
      setMessengerBusy(false);
      window.open(`https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(selectedFbPageId)}`, "_blank", "noopener,noreferrer");
    }
  }

  const unreadNotifications = notifications.filter((entry) => !entry.read_at);
  const displayedNotifications = unreadNotifications.slice(0, 5);
  const messengerFloatVisible = floatingWidgetSettings?.messenger !== false;
  const notificationsFloatVisible = floatingWidgetSettings?.notifications !== false;
  return <section className="dashboard-panel dashboard-communications-panel">
    <div className="panel-header"><div><h2>Notifications &amp; Messenger</h2><p>Review saved Live activity and open the selected Facebook Page inbox.</p></div><button type="button" className="dashboard-notifications-page-link" onClick={() => navigateTo?.("notifications")}>Open Notification Center <span aria-hidden="true">→</span></button></div>
    <div className="dashboard-floating-controls">
      <div className="dashboard-floating-controls-copy"><strong>Floating buttons</strong><span>Right-click or use the × on a floating button to hide it. Turn it back on here.</span></div>
      <label className="dashboard-floating-toggle">
        <input type="checkbox" role="switch" aria-label="Show Messenger floating button" checked={messengerFloatVisible} onChange={(event) => onFloatingWidgetSettingChange?.("messenger", event.target.checked)} />
        <span className="dashboard-floating-toggle-switch" aria-hidden="true"><span /></span>
        <span className="dashboard-floating-toggle-label"><strong>Messenger button</strong><small>{messengerFloatVisible ? "On · visible on dashboard" : "Off · hidden from dashboard"}</small></span>
      </label>
      <label className="dashboard-floating-toggle">
        <input type="checkbox" role="switch" aria-label="Show Notification floating button" checked={notificationsFloatVisible} onChange={(event) => onFloatingWidgetSettingChange?.("notifications", event.target.checked)} />
        <span className="dashboard-floating-toggle-switch" aria-hidden="true"><span /></span>
        <span className="dashboard-floating-toggle-label"><strong>Notification button</strong><small>{notificationsFloatVisible ? "On · visible on dashboard" : "Off · hidden from dashboard"}</small></span>
      </label>
    </div>
    <div className="dashboard-communications-grid">
      <div className="dashboard-communication-card">
        <div className="dashboard-communication-heading">
          <span className="dashboard-communication-icon notification"><NavIcon type="bell" /></span>
          <div><strong>Notification center</strong><span>{unreadCount ? `${unreadCount} unread` : "Saved activity"}</span></div>
          {unreadCount > 0 && <b className="dashboard-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</b>}
          <button type="button" className="table-link-button" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button>
        </div>
        {notificationsError && <p className="dashboard-communication-error" role="status">{notificationsError}</p>}
        <div className="dashboard-notification-list">
          {!displayedNotifications.length && !notificationsError && <p className="dashboard-notification-empty">No unread notifications.</p>}
          {displayedNotifications.map((entry) => <button type="button" key={entry.id} className={`dashboard-notification-entry${entry.read_at ? " read" : " unread"}`} onClick={() => !entry.read_at && markRead(entry.id)}>
            <span className="dashboard-notification-status-dot" />
            <span><strong>{entry.title}</strong><small>{entry.message}</small><time>{entry.created_at ? new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : ""}</time></span>
          </button>)}
        </div>
        {unreadNotifications.length > 5 && <p className="dashboard-notifications-more">Showing 5 of {unreadNotifications.length} unread notifications. Open Notification Center to view all.</p>}
      </div>
      <div className="dashboard-communication-card dashboard-messenger-card">
        <div className="dashboard-communication-heading">
          <span className="dashboard-communication-icon messenger"><NavIcon type="chat" /></span>
          <div><strong>Facebook Messenger</strong><span>{selectedFbPageName || "Selected Facebook Page"}</span></div>
        </div>
        <p>Open the Messenger inbox for the Page selected at the top of your dashboard.</p>
        {hasConnectedPage ? <button type="button" className="dashboard-messenger-open" onClick={openMessenger} disabled={messengerBusy}>
          <NavIcon type="chat" /><span>{messengerBusy ? "Opening Messenger…" : "Open Messenger"}</span>
          {messengerUnread > 0 && <b>{messengerUnread > 99 ? "99+" : messengerUnread} unread</b>}
        </button> : <button type="button" className="dashboard-messenger-connect" onClick={openFacebookSetup}>Connect a Facebook Page to use Messenger</button>}
      </div>
    </div>
  </section>;
}

export default function DashboardPage({ client, facebookStatus, goToAuctions, goToDeliveries, goToOrders, goToPayments, navigateTo, onboardingChecked, openDelivery, openFacebookSetup, page, paymentAccountLoading, paymentAccountMessage, paymentAccountStatus, setErrorMessage, setPage , selectedFbPageId, selectedFbPageName, floatingWidgetSettings, onFloatingWidgetSettingChange }) {
  const activePageLabel = String(selectedFbPageName || "").trim();
  const welcomeName = activePageLabel || client?.name || "Business overview";
  const pageChangedLabel = activePageLabel ? `Active Facebook Page: ${activePageLabel}` : "Client workspace overview";
  const [auctions, setAuctions] = useState([]);

  const [orders, setOrders] = useState([]);

  const [payments, setPayments] = useState([]);

  const [deliveries, setDeliveries] = useState([]);

  function openOnlinePayments() {
    const status = String(paymentAccountStatus?.account_status || "NOT_CONFIGURED").toUpperCase();
    const url = status === "NOT_CONFIGURED"
      ? (paymentAccountStatus?.setup_url || "https://dashboard.paymongo.com/signup")
      : (paymentAccountStatus?.dashboard_url || "https://dashboard.paymongo.com/login");

    window.open(url, "_blank", "noopener,noreferrer");
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


  const [pageDataLoading, setPageDataLoading] = useState(true);
  const pageLoadVersion = useRef(0);
  async function loadPortal() {
    if (!client?.client_id) return;
    const version = ++pageLoadVersion.current;
    setPageDataLoading(true);
    setErrorMessage("");
    try {
      const results = await Promise.all([
        supabase.from("client_auction_list").select("*").eq("client_id", client.client_id).order("post_created_at", { ascending: false }),
        supabase.from("client_order_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false }),
        supabase.from("client_payment_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false }),
        supabase.from("client_delivery_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false })
      ]);
      if (version !== pageLoadVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setAuctions(onlySelectedPage(results[0].data, selectedFbPageId));
      setOrders(onlySelectedPage(results[1].data, selectedFbPageId));
      setPayments(onlySelectedPage(results[2].data, selectedFbPageId));
      setDeliveries(onlySelectedPage(results[3].data, selectedFbPageId));
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id, selectedFbPageId]);
  if (pageDataLoading) return <div className="loading-card"><h2>Loading page</h2></div>;
  return (<>
    {page === "dashboard" && (
          <>
            <section className="eo2-dashboard-welcome">
              <div className="eo2-dashboard-welcome-copy">
                <div className="eo2-dashboard-kicker"><span className="eo2-dashboard-kicker-dot" /> YOUR EO2MATE WORKSPACE</div>
                <h1>{`Welcome, ${welcomeName}`}</h1>
                <p>{pageChangedLabel}{activePageLabel && client?.name ? ` · Managed by ${client.name}` : ""}</p>
                <p>See your sales, orders, payments, inventory and deliveries in one place.</p>
              </div>
              <div className="eo2-dashboard-welcome-actions">
                <button className="eo2-welcome-secondary" type="button" onClick={() => setPage("reports")}>
                  <NavIcon type="reports" /><span>Reports</span>
                </button>
                <button className="eo2-welcome-primary" type="button" onClick={() => navigateTo("posts")}>
                  <NavIcon type="create" /><span>Create Post</span>
                </button>
                <button className="eo2-welcome-refresh" type="button" onClick={loadPortal} title="Refresh dashboard" aria-label="Refresh dashboard">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg>
                </button>
              </div>
            </section>

            {onboardingChecked && facebookStatus && !facebookStatus.connected && (
              <section className="connection-warning-card">
                <div><strong>Facebook is optional</strong><span>Your EO2MATE workspace is ready. Connect Facebook only when you want Facebook selling and Messenger features.</span></div>
                <button className="primary-button" type="button" onClick={openFacebookSetup}>Connect Facebook</button>
              </section>
            )}

            <DashboardCommunicationPanel client={client} selectedFbPageId={selectedFbPageId} selectedFbPageName={selectedFbPageName} facebookStatus={facebookStatus} openFacebookSetup={openFacebookSetup} navigateTo={navigateTo} floatingWidgetSettings={floatingWidgetSettings} onFloatingWidgetSettingChange={onFloatingWidgetSettingChange} />

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
              {[
                { icon: "orders", label: "Orders", value: orders.length, note: `${orderMetrics.pending} awaiting payment`, action: () => goToOrders("ALL") },
                { icon: "payments", label: "Paid payments", value: paymentMetrics.paid, note: `${paymentMetrics.pending} pending`, action: () => goToPayments("all") },
                { icon: "auction", label: "Active auctions", value: auctionMetrics.active, note: `${auctions.length} total`, action: () => goToAuctions("ACTIVE"), meta: true },
                { icon: "delivery", label: "Ready to ship", value: deliveryMetrics.ready, note: `${deliveryMetrics.inTransit} in transit`, action: () => goToDeliveries("READY_FOR_BOOKING") },
                { icon: "delivery", label: "Delivered", value: deliveryMetrics.delivered, note: "Completed fulfillment", action: () => goToDeliveries("DELIVERED") },
              ].filter((item) => !item.meta || facebookStatus?.connected).map((item) => (
                <button key={item.label} type="button" onClick={item.action} style={{ textAlign: "left", border: "1px solid #e5ebf1", borderRadius: 18, padding: 18, background: "#fff", cursor: "pointer", boxShadow: "0 8px 24px rgba(15,35,55,.055)" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: "#eef8f1", color: "#258c43", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><NavIcon type={item.icon} /></div>
                  <div style={{ color: "#66788a", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>{item.label}</div>
                  <div style={{ color: "#14283d", fontSize: 30, fontWeight: 900, margin: "5px 0 3px" }}>{item.value}</div>
                  <div style={{ color: "#7b8b9b", fontSize: 12 }}>{item.note}</div>
                </button>
              ))}
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, .8fr)", gap: 18, marginBottom: 20 }} className="eo2-dashboard-report-grid">
              <div className="dashboard-panel" style={{ margin: 0, overflow: "hidden" }}>
                <div className="panel-header">
                  <div><h2>Order activity</h2><p>Orders created during the last 7 days.</p></div>
                  <button className="secondary-button" type="button" onClick={() => setPage("reports")}>Full reports</button>
                </div>
                <OrderActivityChart orders={orders} />
              </div>

              <div className="dashboard-panel" style={{ margin: 0 }}>
                <div className="panel-header"><div><h2>Attention</h2><p>Items that may need action.</p></div></div>
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    { label: "Awaiting payment", value: orderMetrics.pending, action: () => goToOrders("PAYMENT_PENDING") },
                    { label: "Pending settlement", value: paymentMetrics.pending, action: () => goToPayments("pending") },
                    { label: "Ready for booking", value: deliveryMetrics.ready, action: () => goToDeliveries("READY_FOR_BOOKING") },
                    ...(facebookStatus?.connected ? [{ label: "Active auctions", value: auctionMetrics.active, action: () => goToAuctions("ACTIVE") }] : []),
                  ].map((item) => <button key={item.label} type="button" onClick={item.action} style={{ border: "1px solid #e8edf2", background: "#fbfcfd", borderRadius: 13, padding: "13px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "#263b50" }}><span style={{ fontWeight: 700 }}>{item.label}</span><strong style={{ fontSize: 18 }}>{item.value}</strong></button>)}
                </div>
              </div>
            </section>

            <section className="dashboard-panel" style={{ marginBottom: 20 }}>
              <div className="panel-header"><div><h2>Quick actions</h2><p>Jump directly to your most-used EO2MATE workspaces.</p></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {[
                  { icon: "create", label: "Create Post", action: () => navigateTo("posts"), meta: true },
                  { icon: "inventory", label: "Inventory", action: () => setPage("inventory") },
                  { icon: "sales", label: "Sales", action: () => setPage("sales") },
                  { icon: "orders", label: "Orders", action: () => goToOrders("ALL") },
                  { icon: "payments", label: "Payment Methods", action: () => setPage("payment-settings") },
                  { icon: "reports", label: "Reports", action: () => setPage("reports") },
                ].filter((item) => !item.meta || facebookStatus?.connected).map((item) => <button key={item.label} className="secondary-button" type="button" onClick={item.action} style={{ minHeight: 48, justifyContent: "flex-start", gap: 9 }}><NavIcon type={item.icon}/>{item.label}</button>)}
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 20 }}>
              <div className={`payment-setup-card ${paymentAccountStatus?.payment_enabled ? "active" : ""}`} style={{ margin: 0 }}>
                <div className="payment-setup-copy"><div className="payment-logo">P</div><div><strong>Online Payments</strong><span>{paymentAccountStatus?.payment_enabled ? "Online checkout is active." : "Configure online checkout when you're ready."}</span><small>Status: {statusLabel(paymentAccountStatus?.account_status || "NOT_CONFIGURED")}</small></div></div>
                <div className="payment-setup-actions"><button className="primary-button" type="button" onClick={openOnlinePayments} disabled={paymentAccountLoading}>{String(paymentAccountStatus?.account_status || "NOT_CONFIGURED").toUpperCase() === "NOT_CONFIGURED" ? "Set Up" : "Open Dashboard"}</button></div>
              </div>
              {client?.client_id && <div className="payment-setup-card" style={{ margin: 0 }}><div className="payment-setup-copy"><div className="payment-logo">P</div><div><strong>Payment Methods</strong><span>Manual, Maya and other supported providers are configured per client.</span><small>Manage enabled methods and your default provider.</small></div></div><div className="payment-setup-actions"><button className="primary-button" type="button" onClick={() => setPage("payment-settings")}>Manage</button></div></div>}
            </section>

            {paymentAccountMessage && <div className="success-message global-error">{paymentAccountMessage}</div>}

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Recent deliveries</h2><p>Latest paid-order fulfillment activity.</p></div><button className="secondary-button" onClick={() => goToDeliveries("ALL")}>View all</button></div>
              <div className="table-wrapper"><table><thead><tr><th>Order</th><th>Item</th><th>Recipient</th><th>Courier</th><th>Tracking</th><th>Status</th><th>Created</th></tr></thead><tbody>
                {deliveries.length ? deliveries.slice(0, 8).map((delivery) => <tr key={delivery.delivery_id} className="clickable-row" onClick={() => openDelivery(delivery.delivery_id)}><td>{delivery.order_number}</td><td>{delivery.item_label}</td><td>{delivery.recipient_name || delivery.buyer_name || "-"}</td><td>{delivery.courier_name || "-"}</td><td>{delivery.tracking_number || "-"}</td><td><StatusBadge status={delivery.delivery_status}/></td><td>{formatDateTime(delivery.created_at)}</td></tr>) : <tr><td colSpan="7">No delivery activity yet.</td></tr>}
              </tbody></table></div>
            </section>
          </>
        )}
  </>);
}
