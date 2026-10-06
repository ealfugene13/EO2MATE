import InventoryPage from "./InventoryPage";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import SetupPage from "./SetupPage";
import OnboardingPage from "./OnboardingPage";
import AdminClientsPage from "./AdminClientsPage";
import FacebookPostPage from "./FacebookPostPage";
import PreorderAdminPage from "./PreorderAdminPage";
import AutomatedMessagesPage from "./AutomatedMessagesPage";
import AccountSecurityPage from "./AccountSecurityPage";
import PaymentMethodsSettings from "../components/PaymentMethodsSettings";



function FloatingMetaMessenger({ clientId }) {
  const [pages, setPages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [messengerAvailable, setMessengerAvailable] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [position, setPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem("eo2mateMessengerFloatPosition")) || { right: 22, bottom: 24 }; }
    catch { return { right: 22, bottom: 24 }; }
  });
  const [drag, setDrag] = useState(null);
  const dragGestureRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });

  async function refreshNotifications() {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.functions.invoke("meta", {
        method: "POST",
        headers: { "x-eo2mate-meta-route": "messenger-notifications" },
        body: { client_id: clientId },
      });
      if (error || !data?.success) return;
      const connectedPages = data.pages || [];
      setPages(connectedPages);
      setUnread(Number(data.total_unread || 0));
      setMessengerAvailable(connectedPages.length > 0);
    } catch { /* notification failure must never block the portal */ }
  }

  useEffect(() => {
    if (!clientId) return undefined;
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshNotifications(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [clientId]);

  useEffect(() => {
    if (!drag) return undefined;
    const move = (event) => {
      const point = event.touches?.[0] || event;
      const gesture = dragGestureRef.current;
      if (Math.hypot(point.clientX - gesture.startX, point.clientY - gesture.startY) > 5) gesture.moved = true;
      const size = 58;
      const x = Math.min(Math.max(point.clientX - drag.dx, 8), window.innerWidth - size - 8);
      const y = Math.min(Math.max(point.clientY - drag.dy, 8), window.innerHeight - size - 8);
      setPosition({ left: x, top: y });
    };
    const end = () => {
      setDrag(null);
      window.setTimeout(() => { dragGestureRef.current.active = false; }, 0);
      setPosition((current) => {
        const size = 58;
        const left = current.left ?? (window.innerWidth - size - (current.right || 22));
        const top = current.top ?? (window.innerHeight - size - (current.bottom || 24));
        const snapped = left + size / 2 < window.innerWidth / 2
          ? { left: 12, top }
          : { right: 12, top };
        localStorage.setItem("eo2mateMessengerFloatPosition", JSON.stringify(snapped));
        return snapped;
      });
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", end);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", end); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", end); };
  }, [drag]);

  async function openPage(page) {
    const fbPageId = String(page?.fb_page_id || "");
    if (!fbPageId) return;
    // Clear EO2MATE's Page notification when the operator intentionally opens that Page inbox.
    try {
      await supabase.functions.invoke("meta", {
        method: "POST",
        headers: { "x-eo2mate-meta-route": "messenger-notifications" },
        body: { client_id: clientId, action: "mark-read", fb_page_id: fbPageId },
      });
    } catch { /* Meta inbox should still open */ }
    setPickerOpen(false);
    setPages((current) => current.map((p) => String(p.fb_page_id) === fbPageId ? { ...p, unread_count: 0 } : p));
    setUnread((current) => Math.max(0, current - Number(page?.unread_count || 0)));
    window.open(`https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(fbPageId)}`, "_blank", "noopener,noreferrer");
  }

  function activate() {
    if (pages.length === 1) openPage(pages[0]);
    else if (pages.length > 1) setPickerOpen((value) => !value);
    else refreshNotifications();
  }

  if (!clientId || messengerAvailable === false) return null;
  const style = position.left != null ? { left: position.left, top: position.top } : position.top != null ? { right: position.right ?? 12, top: position.top } : { right: position.right ?? 22, bottom: position.bottom ?? 24 };
  return <div className="meta-messenger-float-wrap" style={style}>
    {pickerOpen && pages.length > 1 && <div className="meta-messenger-page-picker">
      <strong>Open Page Messenger</strong>
      {pages.map((page) => <button key={page.fb_page_id} type="button" onClick={() => openPage(page)}>
        <span>{page.page_name || "Facebook Page"}</span>
        {Number(page.unread_count || 0) > 0 && <b>{Number(page.unread_count) > 99 ? "99+" : page.unread_count}</b>}
      </button>)}
    </div>}
    <button
      type="button"
      className="meta-messenger-float"
      aria-label={unread ? `Open Meta Messenger, ${unread} unread messages` : "Open Meta Messenger"}
      title="Open Meta Messenger"
      onMouseDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); dragGestureRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY }; setDrag({ dx: e.clientX-r.left, dy: e.clientY-r.top }); }}
      onTouchStart={(e) => { const p=e.touches[0], r=e.currentTarget.getBoundingClientRect(); dragGestureRef.current = { active: true, moved: false, startX: p.clientX, startY: p.clientY }; setDrag({ dx:p.clientX-r.left, dy:p.clientY-r.top }); }}
      onClick={(e) => { if (dragGestureRef.current.moved) { e.preventDefault(); e.stopPropagation(); dragGestureRef.current.moved = false; return; } activate(); }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.91 1.45 5.5 3.72 7.2V22l3.4-1.87c.91.25 1.88.39 2.88.39 5.52 0 10-4.15 10-9.25S17.52 2 12 2Z"/><path className="meta-messenger-bolt" d="m6.8 14.2 3.4-3.6 2.1 2 4.9-2.8-3.4 3.6-2.1-2-4.9 2.8Z"/></svg>
      {unread > 0 && <span className="meta-messenger-badge">{unread > 99 ? "99+" : unread}</span>}
    </button>
  </div>;
}

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

function SidebarLogo({ admin = false }) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div
      className="sidebar-brand eo2-sidebar-brand"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {!logoFailed ? (
        <img
          src={`${import.meta.env.BASE_URL}eo2mate-logo.png`}
          alt="EO2MATE"
          onError={() => setLogoFailed(true)}
          style={{
            display: "block",
            width: "100%",
            maxWidth: 170,
            height: "auto",
            objectFit: "contain",
            borderRadius: 8,
            background: "#ffffff",
          }}
        />
      ) : (
        <div
          aria-label="EO2MATE"
          style={{
            width: "100%",
            maxWidth: 170,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#ffffff",
            color: "#08233f",
            textAlign: "center",
            fontWeight: 900,
            letterSpacing: "0.12em",
          }}
        >
          EO2MATE
        </div>
      )}

      {admin && <span className="eo2-admin-label">Platform Admin</span>}
    </div>
  );
}

function SidebarNavButton({ icon, children, ...props }) {
  return (
    <button
      {...props}
      style={{
        ...(props.style || {}),
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <NavIcon type={icon} />
      <span>{children}</span>
    </button>
  );
}

function SidebarSectionLabel({ children }) {
  return (
    <div
      aria-hidden="true"
      style={{
        padding: "16px 14px 6px",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#8a98a8",
      }}
    >
      {children}
    </div>
  );
}

const REPORT_CATALOG = [
  {
    key: "sales-summary",
    title: "Sales Summary",
    group: "Sales",
    description: "Gross sales, paid sales, unpaid or forfeited orders, discounts, shipping and order count.",
    highlights: ["Gross and net sales", "Paid vs unpaid", "Average order value", "Sales by channel"],
  },
  {
    key: "auction-performance",
    title: "Auction Performance",
    group: "Selling",
    description: "Auction participation, sell-through, bids, bidders, buyouts and winning values.",
    highlights: ["Sell-through rate", "Average bidders", "Buyout usage", "Top auction items"],
  },
  {
    key: "post-mining-performance",
    title: "Post Mining Performance",
    group: "Selling",
    description: "MINE activity, claimed quantities, unclaimed items, buyers and conversion by post.",
    highlights: ["Claim conversion", "Fastest claimed items", "Unclaimed stock", "Top MINE buyers"],
  },
  {
    key: "payment-collection",
    title: "Payment Collection",
    group: "Finance",
    description: "Paid, pending and expired payments with collection rate and aging visibility.",
    highlights: ["Collection rate", "Payment aging", "Expired payments", "Method breakdown"],
  },
  {
    key: "order-fulfillment",
    title: "Order Fulfillment",
    group: "Operations",
    description: "Order status movement from payment through booking, shipment and delivery.",
    highlights: ["Processing time", "Ready for booking", "Delivery completion", "Cancelled orders"],
  },
  {
    key: "inventory-movement",
    title: "Inventory Movement",
    group: "Inventory",
    description: "Beginning, received, reserved, sold, adjusted and ending stock once Inventory is enabled.",
    highlights: ["Fast movers", "Slow movers", "Stock movement", "Low-stock opportunities"],
  },
  {
    key: "buyer-analysis",
    title: "Buyer Analysis",
    group: "Customers",
    description: "Unique and repeat buyers, order frequency, average spend and customer value.",
    highlights: ["Repeat buyer rate", "Average spend", "Top buyers", "Order frequency"],
  },
  {
    key: "facebook-page-performance",
    title: "Facebook Page Performance",
    group: "Facebook",
    description: "Compare selling results and activity across connected Facebook Pages.",
    highlights: ["Sales by Page", "Orders by Page", "Auction activity", "MINE activity"],
  },
  {
    key: "opportunity",
    title: "EO2MATE Opportunity Report",
    group: "Insights",
    description: "A decision-focused report that surfaces where the client may be gaining or losing sales opportunities.",
    highlights: ["High interest / low close", "Unpaid sales at risk", "Fast-demand products", "Best selling windows"],
    featured: true,
  },
];

async function getEdgeFunctionErrorMessage(error, fallbackMessage) {
  let message = error?.message || fallbackMessage;
  const context = error?.context;

  if (context && typeof context.clone === "function") {
    try {
      const response = context.clone();
      const contentType = response.headers?.get?.("content-type") || "";

      if (contentType.includes("application/json")) {
        const body = await response.json();
        const metaCode = body?.facebook_error?.code;
        const metaSubcode = body?.facebook_error?.error_subcode;
        const suffix = [
          metaCode ? `Meta code ${metaCode}` : "",
          metaSubcode ? `subcode ${metaSubcode}` : "",
        ].filter(Boolean).join(", ");

        message = body?.message || body?.error || message;
        if (suffix) message = `${message} (${suffix})`;
      } else {
        const text = await response.text();
        if (text?.trim()) message = text.trim();
      }
    } catch {
      // Preserve the original FunctionsHttpError message.
    }
  }

  return message || fallbackMessage;
}

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

const META_OPERATIONAL_PAGES = new Set([
  "posts",
  "facebook-post",
  "post-mining",
  "mining-create",
  "pre-order",
  "pre-order-create",
  "regular-sale",
]);

function isMetaOperationalPage(page) {
  return META_OPERATIONAL_PAGES.has(page) || String(page || "").includes("auction");
}


function SellingPostDetailPanel({ detail, loading, error, onClose }) {
  const [detailTab, setDetailTab] = useState("OVERVIEW");
  const [copied, setCopied] = useState("");
  useEffect(() => { setDetailTab("OVERVIEW"); setCopied(""); }, [detail?.post_id, detail?.post?.post_id]);
  const copyValue = async (label, value) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(String(value)); setCopied(label); window.setTimeout(() => setCopied(""), 1400); } catch (_) {}
  };
  if (loading) return <section className="dashboard-panel selling-card"><div className="panel-header"><div><p className="eyebrow">POST DETAILS</p><h2>Loading post…</h2><p>Retrieving items and transaction activity.</p></div></div></section>;
  if (error) return <section className="dashboard-panel selling-card"><div className="panel-header"><div><h2>Post details unavailable</h2><p className="dashboard-error global-error">{error}</p></div><button className="secondary-button icon-only-nav" type="button" onClick={onClose} aria-label="Back to posts" title="Back to posts"><span className="button-icon"><NavIcon type="back" /></span></button></div></section>;
  if (!detail) return null;
  const post = detail.post || detail;
  const mining = detail.mode_code === "MINING";
  const items = detail.items || [];
  const activity = detail.activity || [];
  const buyers = new Set(activity.map(a => a.fb_user_id).filter(Boolean)).size;
  const value = mining ? activity.reduce((n,a)=>n + Number(a.claim_price||0),0) : items.reduce((n,i)=>n + Number(i.unit_price||0) * Number(i.quantity_limit||0),0);
  const itemWinners = items.map((item) => {
    const candidates = activity.filter((a) => a.post_item_id === item.post_item_id);
    const eligible = mining
      ? candidates.filter((a) => !a.superseded_at && !["REJECTED","CANCELLED","INVALID","SUPERSEDED"].includes(String(a.status || "").toUpperCase()))
      : candidates.filter((a) => Number(a.accepted_quantity || 0) > 0 && !["REJECTED","CANCELLED","INVALID"].includes(String(a.status || "").toUpperCase()));
    return { item, winners: eligible };
  });
  const tabs = ["OVERVIEW","ITEMS", mining ? "CLAIMS" : "ORDERS"];
  return (
    <div className="selling-detail-workspace">
      <header className="dashboard-header selling-hero" style={{marginBottom:16}}>
        <div>
          <button className="secondary-button icon-only-nav" type="button" onClick={onClose} style={{marginBottom:14}} aria-label="Back to posts" title="Back to posts"><span className="button-icon"><NavIcon type="back" /></span></button>
          <p className="eyebrow">FACEBOOK SELLING · {String(detail.mode_code || "POST").replaceAll("_", " ")}</p>
          <h1>{mining ? "Mining Post Details" : "Regular Sale Post Details"}</h1>
          <p>{post.post_type_code || "—"} · {detail.facebook_page || "Facebook Page"} · Created {formatDateTime(post.created_at)}</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><StatusBadge status={post.status}/></div>
      </header>

      <section className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric-card"><span>Items</span><strong>{items.length}</strong><small>Products attached</small></div>
        <div className="metric-card"><span>{mining ? "Claims" : "Orders"}</span><strong>{activity.length}</strong><small>Recorded activity</small></div>
        <div className="metric-card"><span>Buyers</span><strong>{buyers}</strong><small>Unique customers</small></div>
        <div className="metric-card"><span>{mining ? "Claimed value" : "Listed value"}</span><strong>{formatCurrency(value)}</strong><small>{mining ? "Total claim price" : "Price × quantity"}</small></div>
      </section>

      <section className="selling-tabs" style={{marginBottom:16}}><div>{tabs.map(t=><button key={t} type="button" className={detailTab===t?"primary-button":"secondary-button"} onClick={()=>setDetailTab(t)}>{t.charAt(0)+t.slice(1).toLowerCase()}</button>)}</div></section>

      {detailTab === "OVERVIEW" && <section className="dashboard-panel selling-card">
        <div className="panel-header"><div><h2>Post overview</h2><p>Facebook reference, lifecycle and source information.</p></div></div>
        {post.caption && <div className="preorder-caption-card"><span>Facebook post caption</span><p>{post.caption}</p></div>}
        <div className="preorder-summary-grid">
          <div><span>Facebook Page *</span><strong>{detail.facebook_page || "—"}</strong></div>
          <div><span>Post Type</span><strong>{post.post_type_code || "—"}</strong></div>
          <div><span>Status</span><strong>{statusLabel(post.status) || "—"}</strong></div>
          <div><span>Created</span><strong>{formatDateTime(post.created_at)}</strong></div>
          <div><span>Starts</span><strong>{formatDateTime(post.starts_at)}</strong></div>
          <div><span>Ends</span><strong>{formatDateTime(post.ends_at)}</strong></div>
        </div>
        <div className="panel-header"><div><h3>Winner / buyer per item</h3><p>{mining ? "Accepted mining claimant(s) for each item." : "Accepted buyer(s) allocated to each item."}</p></div></div>
        <div className="table-wrapper"><table><thead><tr><th>Item</th><th>Winner / Buyer</th><th>{mining ? "Claim" : "Accepted Qty"}</th><th>Status</th></tr></thead><tbody>
          {itemWinners.map(({item,winners}) => winners.length ? winners.map((winner,index)=><tr key={`${item.post_item_id}-${winner.mining_claim_id || winner.post_entry_id}`}><td>{index===0?<strong>{item.item_label || item.item_name_snapshot || `Item ${item.item_no || ""}`}</strong>:""}</td><td>{winner.fb_user_name || winner.fb_user_id || "—"}</td><td>{mining ? `${winner.action_code || "CLAIM"} · ${formatCurrency(winner.claim_price)}` : (winner.accepted_quantity ?? "—")}</td><td><StatusBadge status={winner.status}/></td></tr>) : <tr key={item.post_item_id}><td><strong>{item.item_label || item.item_name_snapshot || `Item ${item.item_no || ""}`}</strong></td><td>—</td><td>—</td><td>—</td></tr>)}
        </tbody></table></div>
        <div className="panel-header"><div><h3>References</h3><p>Use these IDs when tracing a post in Meta or EO2MATE logs.</p></div></div>
        <div className="preorder-summary-grid">
          <div><span>EO2MATE Post ID</span><strong title={post.post_id}>{post.post_id || "—"}</strong>{post.post_id&&<button className="table-action-button" type="button" onClick={()=>copyValue("post",post.post_id)}>{copied==="post"?"Copied":"Copy"}</button>}</div>
          <div><span>Facebook Post ID</span><strong title={post.fb_post_id}>{post.fb_post_id || "—"}</strong>{post.fb_post_id&&<button className="table-action-button" type="button" onClick={()=>copyValue("fb",post.fb_post_id)}>{copied==="fb"?"Copied":"Copy"}</button>}</div>
        </div>
      </section>}

      {detailTab === "ITEMS" && <section className="dashboard-panel selling-card">
        <div className="panel-header"><div><h2>Items</h2><p>Products and inventory references attached to this post.</p></div></div>
        <div className="table-wrapper"><table><thead><tr><th>#</th><th>Item</th><th>Source</th><th>SKU / Inventory</th><th>Price</th><th>Qty</th><th>Winner / Buyer</th><th>Status</th><th>Fulfillment</th></tr></thead><tbody>
          {items.map(item => { const winners=itemWinners.find(x=>x.item.post_item_id===item.post_item_id)?.winners||[]; return <tr key={item.post_item_id}><td>{item.item_no ?? "—"}</td><td><strong>{item.item_label || item.item_name_snapshot || "—"}</strong></td><td>{item.item_source || "—"}</td><td title={item.inventory_item_id}>{item.item_code_snapshot || item.inventory_item_id || "—"}</td><td>{formatCurrency(item.unit_price)}</td><td>{item.quantity_limit ?? "—"}</td><td>{winners.length ? winners.map(w=>w.fb_user_name || w.fb_user_id || "—").join(", ") : "—"}</td><td><StatusBadge status={item.status}/></td><td>{statusLabel(item.fulfillment_status) || "—"}</td></tr>})}
          {!items.length && <tr><td colSpan="9" className="empty-table-cell">No item records found.</td></tr>}
        </tbody></table></div>
      </section>}

      {(detailTab === "CLAIMS" || detailTab === "ORDERS") && <section className="dashboard-panel selling-card">
        <div className="panel-header"><div><h2>{mining ? "Claims" : "Orders"}</h2><p>{mining ? "MINE / TAKE / LOCK activity and claim value." : "Buyer order activity and accepted quantities."}</p></div></div>
        <div className="table-wrapper"><table><thead><tr><th>Buyer</th><th>{mining ? "Action" : "Requested"}</th><th>{mining ? "Claim Price" : "Accepted"}</th><th>Status</th><th>Facebook Comment</th><th>Comment</th><th>Time</th></tr></thead><tbody>
          {activity.map(a => <tr key={a.mining_claim_id || a.post_entry_id}><td><strong>{a.fb_user_name || a.fb_user_id || "—"}</strong></td><td>{mining ? (a.action_code || "—") : (a.requested_quantity ?? "—")}</td><td>{mining ? formatCurrency(a.claim_price) : (a.accepted_quantity ?? "—")}</td><td><StatusBadge status={a.status}/></td><td title={a.fb_comment_id}>{a.fb_comment_id || "—"}</td><td>{a.comment_text || "—"}</td><td>{formatDateTime(a.created_at || a.commented_at)}</td></tr>)}
          {!activity.length && <tr><td colSpan="7" className="empty-table-cell">No {mining ? "claim" : "order"} records found.</td></tr>}
        </tbody></table></div>
      </section>}
    </div>
  );
}

export default function PortalPage({ session }) {
  const [client, setClient] = useState(null);
  const [platformAdmin, setPlatformAdmin] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  const [auctions, setAuctions] = useState([]);
  const [auctionBids, setAuctionBids] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentGroups, setPaymentGroups] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [page]);
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

  // Meta/Facebook is an optional integration. Operational Meta features are
  // exposed only after the backend confirms an active connection.
  const metaConnected = facebookStatus?.connected === true;

  useEffect(() => {
    if (onboardingChecked && !metaConnected && isMetaOperationalPage(page)) {
      setPage("dashboard");
    }
  }, [onboardingChecked, metaConnected, page]);

  const [paymentAccountStatus, setPaymentAccountStatus] = useState(null);
  const [paymentAccountLoading, setPaymentAccountLoading] = useState(false);
  const [paymentAccountMessage, setPaymentAccountMessage] = useState("");


  const [automationControls, setAutomationControls] = useState([]);
  const [automationPages, setAutomationPages] = useState([]);
  const [paymentAutomation, setPaymentAutomation] = useState({ payment_automation_enabled: true, payment_automation_reason: null });
  const [automationControlLoading, setAutomationControlLoading] = useState(false);
  const [automationControlMessage, setAutomationControlMessage] = useState("");
  const [automationModal, setAutomationModal] = useState(null);
  const [automationModalError, setAutomationModalError] = useState("");
  const [automationReason, setAutomationReason] = useState("");
  const [automationPassword, setAutomationPassword] = useState("");

  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffDraft, setStaffDraft] = useState({ name: "", email: "", role: "STAFF" });
  const [selectedReport, setSelectedReport] = useState("");
  const [reportDateRange, setReportDateRange] = useState("");
  const [reportPageFilter, setReportPageFilter] = useState("");
  const [reportChannelFilter, setReportChannelFilter] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("");
  const [reportSortBy, setReportSortBy] = useState("");
  const [reportCustomFrom, setReportCustomFrom] = useState("");
  const [reportCustomTo, setReportCustomTo] = useState("");
  const [reportGeneratedAt, setReportGeneratedAt] = useState(null);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportMessage, setReportMessage] = useState("");

  // UI-first operational dashboards. Data wiring follows after UI approval.
  const [auctionWorkspaceTab, setAuctionWorkspaceTab] = useState("SUMMARY");
  const [miningWorkspaceTab, setMiningWorkspaceTab] = useState("SUMMARY");
  const [regularSaleWorkspaceTab, setRegularSaleWorkspaceTab] = useState("SUMMARY");
  const [liveSellingWorkspaceTab, setLiveSellingWorkspaceTab] = useState("DASHBOARD");
  const [miningStatusFilter, setMiningStatusFilter] = useState("ALL");
  const [sellingPostRows, setSellingPostRows] = useState({ REGULAR_SALE: [], MINING: [] });
  const [sellingPostLoading, setSellingPostLoading] = useState(false);
  const [sellingPostError, setSellingPostError] = useState("");
  const [sellingPostDetail, setSellingPostDetail] = useState(null);
  const [sellingPostDetailLoading, setSellingPostDetailLoading] = useState(false);
  const [sellingPostDetailError, setSellingPostDetailError] = useState("");
  const [inventoryTab, setInventoryTab] = useState("SUMMARY");
  const [salesTab, setSalesTab] = useState("SUMMARY");
  const [purchasesTab, setPurchasesTab] = useState("SUMMARY");

  const reportData = useMemo(() => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    if (reportDateRange === "7D") start.setDate(start.getDate() - 7);
    else if (reportDateRange === "30D") start.setDate(start.getDate() - 30);
    else if (reportDateRange === "MTD") start.setDate(1);
    else if (reportDateRange === "YTD") { start.setMonth(0); start.setDate(1); }
    else if (reportDateRange === "CUSTOM") {
      start = reportCustomFrom ? new Date(`${reportCustomFrom}T00:00:00`) : new Date(0);
      end = reportCustomTo ? new Date(`${reportCustomTo}T23:59:59.999`) : now;
    } else start.setDate(start.getDate() - 30);
    start.setHours(0,0,0,0);
    const inRange = (row) => {
      const raw = row?.created_at || row?.post_created_at || row?.paid_at || row?.updated_at;
      if (!raw) return true;
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    };
    const pageMatches = (row) => reportPageFilter === "ALL" || String(row?.fb_page_id || row?.page_id || "") === String(reportPageFilter);
    const channelOf = (row) => String(row?.mode_code || row?.sale_type || row?.source_type || row?.order_source || row?.channel || row?.selling_mode || "").toUpperCase();
    const channelMatches = (row) => {
      if (reportChannelFilter === "ALL") return true;
      const c = channelOf(row);
      if (reportChannelFilter === "POST_MINING") return c.includes("MINING") || c.includes("MINE");
      if (reportChannelFilter === "REGULAR_SALE") return c.includes("REGULAR");
      if (reportChannelFilter === "PREORDER") return c.includes("PRE") || c.includes("PO");
      if (reportChannelFilter === "AUCTION") return c.includes("AUCTION") || Boolean(row?.auction_id || row?.auction_post_id);
      return c.includes(reportChannelFilter);
    };
    const statusOf = (row) => String(row?.status || row?.order_status || row?.payment_status || row?.provider_status || row?.delivery_status || "").toUpperCase();
    const statusMatches = (row) => reportStatusFilter === "ALL" || statusOf(row) === reportStatusFilter;
    const baseFilter = (r) => inRange(r) && pageMatches(r) && channelMatches(r) && statusMatches(r);
    const filteredOrders = (orders || []).filter(baseFilter);
    const filteredPayments = (payments || []).filter(baseFilter);
    const filteredAuctions = (auctions || []).filter((r) => inRange(r) && pageMatches(r) && statusMatches(r));
    const filteredDeliveries = (deliveries || []).filter((r) => inRange(r) && pageMatches(r) && statusMatches(r));
    const mining = (sellingPostRows.MINING || []).filter((r) => inRange(r) && pageMatches(r) && statusMatches(r));
    const regular = (sellingPostRows.REGULAR_SALE || []).filter((r) => inRange(r) && pageMatches(r) && statusMatches(r));
    const money = (r) => Number(r?.total_amount ?? r?.amount ?? r?.grand_total ?? r?.order_total ?? r?.value ?? r?.winning_amount ?? r?.claim_price ?? 0) || 0;
    const paid = filteredPayments.filter((r) => ["PAID","SUCCESS","COMPLETED","SETTLED"].includes(statusOf(r)));
    const pending = filteredPayments.filter((r) => ["PENDING","AWAITING_PAYMENT","READY_FOR_PAYMENT","UNPAID"].includes(statusOf(r)));
    const gross = filteredOrders.reduce((a,r)=>a+money(r),0);
    const paidValue = paid.reduce((a,r)=>a+money(r),0);
    const buyers = new Set(filteredOrders.map(r=>r.fb_user_id || r.buyer_id || r.customer_id || r.psid).filter(Boolean));

    let sourceRows = filteredOrders;
    if (selectedReport === "payment-collection") sourceRows = filteredPayments;
    else if (selectedReport === "auction-performance") sourceRows = filteredAuctions;
    else if (selectedReport === "post-mining-performance") sourceRows = mining;
    else if (selectedReport === "order-fulfillment") sourceRows = filteredDeliveries;

    let rows = sourceRows.map((r) => ({
      Date: r.created_at || r.post_created_at || r.paid_at || r.updated_at || "",
      Reference: r.order_group_no || r.order_no || r.reference_no || r.fb_post_id || r.order_group_id || r.order_id || r.auction_id || r.post_id || r.payment_id || r.delivery_id || r.id || "—",
      Channel: channelOf(r) || (selectedReport === "auction-performance" ? "AUCTION" : selectedReport === "post-mining-performance" ? "MINING" : "—"),
      Buyer: r.buyer_name || r.fb_user_name || r.customer_name || r.fb_user_id || r.psid || "—",
      Status: r.status || r.order_status || r.payment_status || r.provider_status || r.delivery_status || "—",
      Amount: money(r),
    }));
    rows.sort((a,b) => {
      if (reportSortBy === "AMOUNT_DESC") return Number(b.Amount)-Number(a.Amount);
      if (reportSortBy === "AMOUNT_ASC") return Number(a.Amount)-Number(b.Amount);
      const ad = new Date(a.Date).getTime() || 0, bd = new Date(b.Date).getTime() || 0;
      return reportSortBy === "DATE_ASC" ? ad-bd : bd-ad;
    });
    rows = rows.slice(0,500);
    return { filteredOrders, filteredPayments, filteredAuctions, filteredDeliveries, mining, regular, paid, pending, gross, paidValue, buyers: buyers.size, rows, start, end };
  }, [orders, payments, auctions, deliveries, sellingPostRows, reportDateRange, reportCustomFrom, reportCustomTo, reportPageFilter, reportChannelFilter, reportStatusFilter, reportSortBy, selectedReport]);

  function currentReportParameters() {
    return {
      report: REPORT_CATALOG.find((x) => x.key === selectedReport)?.title || selectedReport,
      dateRange: reportDateRange,
      from: reportDateRange === "CUSTOM" ? reportCustomFrom : reportData.start?.toISOString?.().slice(0,10),
      to: reportDateRange === "CUSTOM" ? reportCustomTo : reportData.end?.toISOString?.().slice(0,10),
      page: reportPageFilter,
      channel: reportChannelFilter,
      status: reportStatusFilter,
      sortBy: reportSortBy,
    };
  }

  useEffect(() => {
    setGeneratedReport(null);
    setReportGeneratedAt(null);
    setReportMessage("");
  }, [selectedReport, reportDateRange, reportCustomFrom, reportCustomTo, reportPageFilter, reportChannelFilter, reportStatusFilter, reportSortBy]);

  function generateReport(event) {
    event?.preventDefault?.();
    const missing = [];
    if (!selectedReport) missing.push("Report Type");
    if (!reportDateRange) missing.push("Date Range");
    if (!reportPageFilter) missing.push("Facebook Page");
    if (!reportChannelFilter) missing.push("Sales Channel");
    if (!reportStatusFilter) missing.push("Status");
    if (!reportSortBy) missing.push("Sort By");
    if (reportDateRange === "CUSTOM" && (!reportCustomFrom || !reportCustomTo)) missing.push("From and To dates");
    if (missing.length) {
      setGeneratedReport(null);
      setReportGeneratedAt(null);
      setReportMessage(`Complete the required report parameters: ${missing.join(", ")}.`);
      return;
    }
    if (reportDateRange === "CUSTOM" && new Date(reportCustomFrom) > new Date(reportCustomTo)) {
      setReportMessage("The From date cannot be later than the To date.");
      return;
    }
    const generatedAt = new Date();
    const snapshot = { ...reportData, rows: [...reportData.rows] };
    setGeneratedReport({ data: snapshot, parameters: currentReportParameters(), generatedAt });
    setReportGeneratedAt(generatedAt);
    setReportMessage(`Report generated successfully with ${snapshot.rows.length} matching record${snapshot.rows.length === 1 ? "" : "s"}.`);
  }

  function exportReportExcel() {
    if (!generatedReport) return;
    const { data, parameters, generatedAt } = generatedReport;
    const headers = ["Date","Reference","Channel","Buyer","Status","Amount"];
    const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
    const parameterRows = Object.entries(parameters).map(([k,v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
    const dataRows = data.rows.map(r => `<tr>${headers.map(h=>`<td>${esc(r[h])}</td>`).join("")}</tr>`).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table><tr><th colspan="2">EO2MATE Report Parameters</th></tr><tr><td>Generated</td><td>${esc(generatedAt.toLocaleString())}</td></tr>${parameterRows}</table><br/><table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>${dataRows}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url;
    a.download = `EO2MATE-${String(parameters.report || "report").replace(/[^a-z0-9]+/gi,"-")}-${generatedAt.toISOString().slice(0,10)}.xls`; a.click(); URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!generatedReport) return;
    const { data, parameters, generatedAt } = generatedReport;
    const w = window.open("", "_blank", "width=1000,height=760");
    if (!w) { setReportMessage("Pop-up blocked. Allow pop-ups to generate PDF."); return; }
    const rows = data.rows.map(r=>`<tr><td>${r.Date||""}</td><td>${r.Reference}</td><td>${r.Channel}</td><td>${r.Buyer}</td><td>${r.Status}</td><td>₱${Number(r.Amount||0).toLocaleString()}</td></tr>`).join("");
    const params = Object.entries(parameters).map(([k,v])=>`<span><b>${k}:</b> ${v || "—"}</span>`).join("");
    w.document.write(`<html><head><title>EO2MATE Report</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;padding:12px;color:#172235}h1{margin-bottom:4px}small{color:#667085}.params{display:flex;flex-wrap:wrap;gap:8px 18px;margin:14px 0;font-size:11px}.kpi{display:inline-block;margin:10px 24px 8px 0}.kpi b{display:block;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f4f6f8}</style></head><body><h1>${parameters.report}</h1><small>Generated ${generatedAt.toLocaleString()}</small><div class="params">${params}</div><div><span class="kpi">Gross Sales<b>₱${data.gross.toLocaleString()}</b></span><span class="kpi">Orders<b>${data.filteredOrders.length}</b></span><span class="kpi">Paid<b>${data.paid.length}</b></span><span class="kpi">Buyers<b>${data.buyers}</b></span></div><table><thead><tr><th>Date</th><th>Reference</th><th>Channel</th><th>Buyer</th><th>Status</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No matching records.</td></tr>'}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close();
  }

  useEffect(() => {
    if (!client?.client_id) return;

    let cancelled = false;

    async function loadSellingPostRows() {
      setSellingPostLoading(true);
      setSellingPostError("");

      try {
        const { data: posts, error: postsError } = await supabase
          .from("eo2mate_posts")
          .select("post_id, client_id, page_id, mode_code, post_type_code, fb_post_id, status, created_at")
          .eq("client_id", client.client_id)
          .in("mode_code", ["REGULAR_SALE", "MINING"])
          .order("created_at", { ascending: false });

        if (postsError) throw postsError;

        const postRows = posts || [];
        const postIds = postRows.map((post) => post.post_id);
        const pageIds = [...new Set(postRows.map((post) => post.page_id).filter(Boolean))];

        const [itemsResult, entriesResult, claimsResult, pagesResult] = await Promise.all([
          postIds.length
            ? supabase.from("eo2mate_post_items").select("post_item_id, post_id, unit_price").in("post_id", postIds)
            : Promise.resolve({ data: [], error: null }),
          postIds.length
            ? supabase.from("eo2mate_post_entries").select("post_entry_id, post_id, post_item_id, fb_user_id, accepted_quantity, status").in("post_id", postIds)
            : Promise.resolve({ data: [], error: null }),
          postIds.length
            ? supabase.from("eo2mate_mining_claims").select("mining_claim_id, post_id, post_item_id, fb_user_id, claim_price, status, superseded_at").in("post_id", postIds)
            : Promise.resolve({ data: [], error: null }),
          pageIds.length
            ? supabase.from("fb_pages").select("page_id, page_nm").in("page_id", pageIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const firstError = itemsResult.error || entriesResult.error || claimsResult.error || pagesResult.error;
        if (firstError) throw firstError;

        const items = itemsResult.data || [];
        const entries = entriesResult.data || [];
        const claims = claimsResult.data || [];
        const pageNames = new Map((pagesResult.data || []).map((pageRow) => [pageRow.page_id, pageRow.page_nm]));
        const itemPrices = new Map(items.map((item) => [item.post_item_id, Number(item.unit_price || 0)]));
        const excludedMiningStatuses = new Set(["INVALID", "REJECTED", "CANCELLED", "SUPERSEDED"]);

        const rows = postRows.map((post) => {
          const postItems = items.filter((item) => item.post_id === post.post_id);

          if (post.mode_code === "MINING") {
            const validClaims = claims.filter((claim) =>
              claim.post_id === post.post_id &&
              !claim.superseded_at &&
              !excludedMiningStatuses.has(String(claim.status || "").toUpperCase())
            );

            return {
              ...post,
              facebook_page: pageNames.get(post.page_id) || "—",
              items: postItems.length,
              transactions: validClaims.length,
              buyer_ids: [...new Set(validClaims.map((claim) => claim.fb_user_id).filter(Boolean))],
              buyers: new Set(validClaims.map((claim) => claim.fb_user_id).filter(Boolean)).size,
              value: validClaims.reduce((sum, claim) => sum + Number(claim.claim_price || 0), 0),
              quantity: validClaims.length,
            };
          }

          const acceptedEntries = entries.filter((entry) =>
            entry.post_id === post.post_id && Number(entry.accepted_quantity || 0) > 0
          );

          return {
            ...post,
            facebook_page: pageNames.get(post.page_id) || "—",
            items: postItems.length,
            transactions: acceptedEntries.length,
            buyer_ids: [...new Set(acceptedEntries.map((entry) => entry.fb_user_id).filter(Boolean))],
            buyers: new Set(acceptedEntries.map((entry) => entry.fb_user_id).filter(Boolean)).size,
            value: acceptedEntries.reduce(
              (sum, entry) => sum + Number(entry.accepted_quantity || 0) * Number(itemPrices.get(entry.post_item_id) || 0),
              0
            ),
            quantity: acceptedEntries.reduce((sum, entry) => sum + Number(entry.accepted_quantity || 0), 0),
          };
        });

        if (!cancelled) {
          setSellingPostRows({
            REGULAR_SALE: rows.filter((row) => row.mode_code === "REGULAR_SALE"),
            MINING: rows.filter((row) => row.mode_code === "MINING"),
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load selling post records", error);
          setSellingPostError(error?.message || "Unable to load selling post records.");
        }
      } finally {
        if (!cancelled) setSellingPostLoading(false);
      }
    }

    loadSellingPostRows();
    return () => { cancelled = true; };
  }, [client?.client_id]);

  async function openSellingPostDetail(row) {
    if (!row?.post_id) return;
    setSellingPostDetailLoading(true);
    setSellingPostDetailError("");
    setSellingPostDetail(null);
    try {
      const [postResult, itemsResult, activityResult] = await Promise.all([
        supabase.from("eo2mate_posts").select("post_id, client_id, page_id, mode_code, post_type_code, fb_post_id, caption, status, starts_at, ends_at, cancelled_at, cancellation_reason, created_at, updated_at").eq("post_id", row.post_id).single(),
        supabase.from("eo2mate_post_items").select("post_item_id, post_id, item_no, item_label, fb_object_id, item_source, inventory_item_id, inventory_owner_id, item_code_snapshot, item_name_snapshot, unit_price, quantity_limit, max_quantity_per_buyer, status, close_reason, fulfillment_status, created_at, closed_at").eq("post_id", row.post_id).order("item_no"),
        row.mode_code === "MINING"
          ? supabase.from("eo2mate_mining_claims").select("mining_claim_id, post_id, post_item_id, fb_comment_id, fb_user_id, fb_user_name, comment_text, action_code, claim_price, status, superseded_at, created_at").eq("post_id", row.post_id).order("created_at", { ascending: false })
          : supabase.from("eo2mate_post_entries").select("post_entry_id, post_id, post_item_id, fb_comment_id, fb_user_id, fb_user_name, comment_text, requested_quantity, accepted_quantity, required_down_payment_amount, status, invalid_reason, commented_at, created_at").eq("post_id", row.post_id).order("created_at", { ascending: false }),
      ]);
      const firstError = postResult.error || itemsResult.error || activityResult.error;
      if (firstError) throw firstError;
      setSellingPostDetail({ ...row, post: postResult.data, items: itemsResult.data || [], activity: activityResult.data || [] });
    } catch (error) {
      console.error("Failed to load selling post detail", error);
      setSellingPostDetailError(error?.message || "Unable to load post details.");
    } finally {
      setSellingPostDetailLoading(false);
    }
  }

  const regularSaleStats = useMemo(() => {
    const rows = sellingPostRows.REGULAR_SALE || [];
    return {
      total: rows.length,
      active: rows.filter((row) => String(row.status || "").toUpperCase() === "ACTIVE").length,
      soldOut: rows.filter((row) => ["CLOSED", "SOLD_OUT"].includes(String(row.status || "").toUpperCase())).length,
      orders: rows.reduce((sum, row) => sum + row.transactions, 0),
      itemsSold: rows.reduce((sum, row) => sum + row.quantity, 0),
      value: rows.reduce((sum, row) => sum + row.value, 0),
      buyers: new Set(rows.flatMap((row) => row.buyer_ids || [])).size,
    };
  }, [sellingPostRows.REGULAR_SALE]);

  const miningStats = useMemo(() => {
    const rows = sellingPostRows.MINING || [];
    return {
      total: rows.length,
      active: rows.filter((row) => String(row.status || "").toUpperCase() === "ACTIVE").length,
      completed: rows.filter((row) => ["CLOSED", "COMPLETED"].includes(String(row.status || "").toUpperCase())).length,
      cancelled: rows.filter((row) => String(row.status || "").toUpperCase() === "CANCELLED").length,
      claims: rows.reduce((sum, row) => sum + row.transactions, 0),
      buyers: new Set(rows.flatMap((row) => row.buyer_ids || [])).size,
      value: rows.reduce((sum, row) => sum + row.value, 0),
    };
  }, [sellingPostRows.MINING]);



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
        "meta",
        {
          method: "POST",
          headers: {
            "x-eo2mate-meta-route": "connection-status",
          },
          body: {},
        },
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
        throw new Error(data?.message || "Unable to update Online Payments setup status.");
      }

      setPaymentAccountStatus(data);
      setPaymentAccountMessage(
        "Online Payments account recorded. Online checkout remains disabled until the account is linked and activated for this client."
      );
    } catch (error) {
      setPaymentAccountMessage(error.message || "Unable to update Online Payments setup status.");
    } finally {
      setPaymentAccountLoading(false);
    }
  }

  function openOnlinePayments() {
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
    const connectUrl = `${baseUrl}/functions/v1/meta?route=oauth-start&client_id=${encodeURIComponent(client.client_id)}`;
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
    setAutomationModalError("");
    setAutomationControlMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "eo2mate",
        {
          method: "POST",
          headers: { "x-eo2mate-route": "automation-admin" },
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
      setPaymentAutomation(data.payment_automation || { payment_automation_enabled: true, payment_automation_reason: null });
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

  function requestAutomationChange({
    scopeType,
    scopeId,
    label,
    enabled,
  }) {
    setAutomationReason("");
    setAutomationPassword("");
    setAutomationModalError("");
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
      setAutomationModalError("Please enter a reason before disabling automation.");
      return;
    }

    if (!automationPassword) {
      setAutomationModalError("Enter your current password to confirm this setup change.");
      return;
    }

    setAutomationControlLoading(true);
    setAutomationControlMessage("");

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult?.user?.email) throw new Error("Unable to verify the signed-in account.");
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: userResult.user.email, password: automationPassword });
      if (verifyError) throw new Error("Incorrect password. No setup changes were made.");
      const isPaymentAutomationChange = automationModal.kind === "PAYMENT_AUTOMATION";
      const { data, error } = await supabase.functions.invoke(
        "eo2mate",
        {
          method: "POST",
          headers: { "x-eo2mate-route": "automation-admin" },
          body: isPaymentAutomationChange ? {
            action: "SET_PAYMENT_AUTOMATION",
            client_id: client.client_id,
            is_enabled: automationModal.enabled,
            reason: automationReason.trim() || null,
          } : {
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
        `${automationModal.label} ${automationModal.enabled ? "enabled" : "disabled"}.`
      );
      setAutomationModal(null);
      setAutomationReason("");
      setAutomationPassword("");
      await loadAutomationControls();
    } catch (error) {
      setAutomationModalError(error.message || "Unable to update automation control.");
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
          await supabase.functions.invoke("eo2mate", {
            method: "POST",
            headers: { "x-eo2mate-route": "client-onboarding" },
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
        await supabase.functions.invoke("eo2mate", {
          method: "POST",
          headers: { "x-eo2mate-route": "client-onboarding" },
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
        auctionBidResult,
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
          .from("client_auction_bid_history")
          .select("*")
          .order("commented_at", { ascending: false }),

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
      if (auctionBidResult.error) console.warn("Unable to load consolidated auction bids", auctionBidResult.error);
      if (orderResult.error) throw orderResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (paymentGroupResult.error) throw paymentGroupResult.error;
      if (deliveryResult.error) throw deliveryResult.error;

      setAuctions(auctionResult.data || []);
      setAuctionBids(auctionBidResult.data || []);
      setOrders(orderResult.data || []);
      setPayments(paymentResult.data || []);
      setPaymentGroups(paymentGroupResult.data || []);
      setDeliveries(deliveryResult.data || []);

      /*
       * Facebook is optional for workspace access.
       * Load its status for the Facebook feature area without gating the portal.
       */
      await Promise.all([
        loadFacebookStatus({
          applyOnboardingGate: false,
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

  function navigateTo(nextPage) {
    setPage(nextPage);
    setMobileMenuOpen(false);
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
        <aside className="sidebar" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          <SidebarLogo admin />
          <nav className="sidebar-nav" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 12 }}>
            <SidebarNavButton
              icon="clients"
              className={`nav-item ${page !== "account-security" ? "active" : ""}`}
              onClick={() => setPage("admin-clients")}
            >
              Clients
            </SidebarNavButton>
            <SidebarSectionLabel>Account</SidebarSectionLabel>
            <SidebarNavButton
              icon="users"
              className={`nav-item ${page === "account-security" ? "active" : ""}`}
              onClick={() => setPage("account-security")}
            >
              Account &amp; Security
            </SidebarNavButton>
          </nav>
          <div className="sidebar-footer" style={{ flexShrink: 0 }}>
            <div className="user-mini-card"><strong>{session.user.email}</strong><span>{platformAdmin.role}</span></div>
            <button className="logout-button" onClick={handleLogout}>Sign out</button>
          </div>
        </aside>
        <main className="dashboard-content">
          {page === "account-security" ? (
            <AccountSecurityPage session={session} />
          ) : (
            <AdminClientsPage />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className={`mobile-nav-backdrop ${mobileMenuOpen ? "open" : ""}`}
        aria-label="Close navigation"
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside className={`sidebar client-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`} style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <div className="mobile-sidebar-head">
          <SidebarLogo />
          <button type="button" className="mobile-sidebar-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>×</button>
        </div>

        <nav className="sidebar-nav" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 16 }}>
          {platformAdmin && (
            <SidebarNavButton
              icon="clients"
              className={`nav-item ${page === "admin-clients" ? "active" : ""}`}
              onClick={() => setPage("admin-clients")}
            >
              Admin · Clients
            </SidebarNavButton>
          )}

          <SidebarNavButton
            icon="dashboard"
            className={`nav-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => navigateTo("dashboard")}
          >
            Dashboard
          </SidebarNavButton>

          {metaConnected && (
            <>
              <SidebarSectionLabel>Selling</SidebarSectionLabel>

              <SidebarNavButton
                icon="create"
                className={`nav-item ${page === "posts" ? "active" : ""}`}
                onClick={() => navigateTo("posts")}
              >
                Posts
              </SidebarNavButton>

              <SidebarNavButton
                icon="auction"
                className={`nav-item ${page === "auctions" || page === "facebook-post" ? "active" : ""}`}
                onClick={() => { setAuctionWorkspaceTab("SUMMARY"); goToAuctions("ALL"); setMobileMenuOpen(false); }}
              >
                Auctions
              </SidebarNavButton>

              <SidebarNavButton
                icon="mining"
                className={`nav-item ${page === "post-mining" || page === "mining-create" ? "active" : ""}`}
                onClick={() => { setMiningWorkspaceTab("SUMMARY"); navigateTo("post-mining"); }}
              >
                Mining
              </SidebarNavButton>

              <SidebarNavButton
                icon="orders"
                className={`nav-item ${page === "pre-order" || page === "pre-order-create" ? "active" : ""}`}
                onClick={() => navigateTo("pre-order")}
              >
                Pre-Orders
              </SidebarNavButton>

              <SidebarNavButton
                icon="sales"
                className={`nav-item ${page === "regular-sale" ? "active" : ""}`}
                onClick={() => { setRegularSaleWorkspaceTab("SUMMARY"); navigateTo("regular-sale"); }}
              >
                Regular Sales
              </SidebarNavButton>

              <SidebarNavButton
                icon="sales"
                className={`nav-item ${page === "live-selling" ? "active" : ""}`}
                onClick={() => { setLiveSellingWorkspaceTab("DASHBOARD"); navigateTo("live-selling"); }}
              >
                Live Selling
              </SidebarNavButton>

            </>
          )}

          <SidebarSectionLabel>Operations</SidebarSectionLabel>

          <SidebarNavButton
            icon="orders"
            className={`nav-item ${page.includes("order") ? "active" : ""}`}
            onClick={() => goToOrders("ALL")}
          >
            Orders
          </SidebarNavButton>

          <SidebarNavButton
            icon="payments"
            className={`nav-item ${page.includes("payment") ? "active" : ""}`}
            onClick={() => paymentAccountStatus?.payment_enabled && goToPayments("ALL")}
            disabled={!paymentAccountStatus?.payment_enabled}
            title={paymentAccountStatus?.payment_enabled ? "Payments" : "Set up and activate Online Payments to enable online payments"}
          >
            Payments
          </SidebarNavButton>

          <SidebarNavButton
            icon="delivery"
            className={`nav-item ${page.includes("deliver") ? "active" : ""}`}
            onClick={() => goToDeliveries("ALL")}
          >
            Delivery
          </SidebarNavButton>

          <SidebarNavButton
            icon="inventory"
            className={`nav-item ${page === "inventory" ? "active" : ""}`}
            onClick={() => setPage("inventory")}
          >
            Inventory
          </SidebarNavButton>

          <SidebarNavButton
            icon="sales"
            className={`nav-item ${page === "sales" ? "active" : ""}`}
            onClick={() => setPage("sales")}
          >
            Sales
          </SidebarNavButton>

          <SidebarNavButton
            icon="purchases"
            className={`nav-item ${page === "purchases" ? "active" : ""}`}
            onClick={() => setPage("purchases")}
          >
            Purchases
          </SidebarNavButton>

          {metaConnected ? (
            <>
              <SidebarSectionLabel>Facebook</SidebarSectionLabel>

              <SidebarNavButton
                icon="facebook"
                className={`nav-item ${page === "facebook" ? "active" : ""}`}
                onClick={openFacebookSetup}
              >
                Facebook Setup
              </SidebarNavButton>
            </>
          ) : (
            <>
              <SidebarSectionLabel>Integrations</SidebarSectionLabel>
              <SidebarNavButton
                icon="facebook"
                className={`nav-item ${page === "facebook" ? "active" : ""}`}
                onClick={openFacebookSetup}
              >
                Connect Facebook
              </SidebarNavButton>
            </>
          )}

          <SidebarSectionLabel>Shared</SidebarSectionLabel>

          <SidebarNavButton
            icon="payments"
            className={`nav-item ${page === "payment-settings" ? "active" : ""}`}
            onClick={() => navigateTo("payment-settings")}
          >
            Payment Settings
          </SidebarNavButton>

          <SidebarSectionLabel>Maintenance</SidebarSectionLabel>

          <SidebarNavButton
            icon="users"
            className={`nav-item ${page === "users-staff" ? "active" : ""}`}
            onClick={() => setPage("users-staff")}
          >
            Users &amp; Staff
          </SidebarNavButton>

          <SidebarNavButton
            icon="users"
            className={`nav-item ${page === "account-security" ? "active" : ""}`}
            onClick={() => navigateTo("account-security")}
          >
            Account &amp; Security
          </SidebarNavButton>

          <SidebarNavButton
            icon="reports"
            className={`nav-item ${page === "reports" ? "active" : ""}`}
            onClick={() => setPage("reports")}
          >
            Reports
          </SidebarNavButton>

          <SidebarNavButton
            icon="setup"
            className={`nav-item ${page === "setup" ? "active" : ""}`}
            onClick={() => setPage("setup")}
          >
            Setup
          </SidebarNavButton>
        </nav>

        <div className="sidebar-footer" style={{ flexShrink: 0 }}>
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
        <div className="mobile-topbar">
          <button type="button" className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}>☰</button>
          <img src={`${import.meta.env.BASE_URL}eo2mate-logo.png`} alt="EO2MATE" />
          <span>{client?.name || "Portal"}</span>
        </div>

        {page !== "dashboard" && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
            <button
              type="button"
              className="secondary-button icon-only-nav"
              onClick={() => navigateTo("dashboard")}
              aria-label="Back to main dashboard"
              title="Back to main dashboard"
            >
              <span className="button-icon"><NavIcon type="dashboard" /></span>
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="dashboard-error global-error">
            {errorMessage}
          </div>
        )}

        {page === "admin-clients" && platformAdmin && (
          <AdminClientsPage />
        )}

        {metaConnected && page === "posts" && (
          <section className="post-hub">
            <header className="dashboard-header post-hub-header">
              <div>
                <p className="eyebrow">SELLING · POSTS</p>
                <h1>Create Post</h1>
                <p>Choose how you want to sell on Facebook. All post types live in one consolidated workspace.</p>
              </div>
            </header>

            <div className="post-type-grid">
              <button type="button" className="post-type-card ready" onClick={() => navigateTo("facebook-post")}>
                <span className="post-type-icon"><NavIcon type="auction" /></span>
                <span className="post-type-copy"><strong>Auction</strong><small>Publish a bidding post with minimum bid, increment, buyout and cutoff rules.</small></span>
                <span className="post-type-action">Create →</span>
              </button>
              <button type="button" className="post-type-card ready" onClick={() => navigateTo("mining-create")}>
                <span className="post-type-icon"><NavIcon type="mining" /></span>
                <span className="post-type-copy"><strong>Mining</strong><small>Fixed-price comment claiming for regular Facebook posts.</small></span>
                <span className="post-type-action">Create →</span>
              </button>
              <button type="button" className="post-type-card ready" onClick={() => navigateTo("pre-order-create")}>
                <span className="post-type-icon"><NavIcon type="orders" /></span>
                <span className="post-type-copy"><strong>Pre-Order</strong><small>Reserve upcoming products with allocation, cutoff, ETA and optional down payment.</small></span>
                <span className="post-type-action">Create →</span>
              </button>
              <button type="button" className="post-type-card ready" onClick={() => { setRegularSaleWorkspaceTab("POSTING"); navigateTo("regular-sale"); }}>
                <span className="post-type-icon"><NavIcon type="sales" /></span>
                <span className="post-type-copy"><strong>Regular Sale</strong><small>Simple fixed-price Facebook selling with Single and Multiple item support.</small></span>
                <span className="post-type-action">Create →</span>
              </button>
              <div className="post-type-card disabled-card">
                <span className="post-type-icon"><NavIcon type="facebook" /></span>
                <span className="post-type-copy"><strong>Live Selling</strong><small>Connect Facebook Live and process claims from live comments.</small></span>
                <span className="coming-soon-pill">Coming soon</span>
              </div>
            </div>
          </section>
        )}

        {metaConnected && page === "regular-sale" && (
          (sellingPostDetailLoading || sellingPostDetailError || sellingPostDetail?.mode_code === "REGULAR_SALE") ? (
            <SellingPostDetailPanel detail={sellingPostDetail} loading={sellingPostDetailLoading} error={sellingPostDetailError} onClose={() => { setSellingPostDetail(null); setSellingPostDetailError(""); }} />
          ) : (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">FACEBOOK SELLING</p>
                <h1>Regular Sales</h1>
                <p>Manage fixed-price Facebook sales, posts and selling performance from one workspace.</p>
              </div>
            </header>

            <section className="metrics-grid">
              <MetricCard title="Total posts" value={regularSaleStats.total} subtitle="All Regular Sale posts" />
              <MetricCard title="Active" value={regularSaleStats.active} subtitle="Currently accepting orders" />
              <MetricCard title="Sold out" value={regularSaleStats.soldOut} subtitle="Closed after stock sold out" />
              <MetricCard title="Orders" value={regularSaleStats.orders} subtitle="Accepted customer orders" />
              <MetricCard title="Items sold" value={regularSaleStats.itemsSold} subtitle="Total allocated quantity" />
              <MetricCard title="Sales value" value={formatCurrency(regularSaleStats.value)} subtitle="Gross Regular Sale value" />
            </section>

            <section className="dashboard-panel selling-workspace-nav-panel" style={{ marginBottom: 18 }}>
              <div className="selling-workspace-nav">
                {[
                  { key: "SUMMARY", label: "Summary", icon: "dashboard" },
                  { key: "POSTS", label: "Posts", icon: "sales" },
                  { key: "POSTING", label: "Create Post", icon: "create" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={regularSaleWorkspaceTab === tab.key ? "primary-button" : "secondary-button"}
                    onClick={() => setRegularSaleWorkspaceTab(tab.key)}
                  >
                    <span className="selling-nav-icon"><NavIcon type={tab.icon} /></span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {regularSaleWorkspaceTab === "SUMMARY" && (
              <>
                <section className="toolbar-card">
                  <select className="filter-select" defaultValue="ALL">
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SOLD_OUT">Sold out</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <select className="filter-select" defaultValue="30D">
                    <option value="TODAY">Today</option>
                    <option value="7D">Last 7 days</option>
                    <option value="30D">Last 30 days</option>
                    <option value="MONTH">This month</option>
                  </select>
                </section>
                <section className="dashboard-panel">
                  <div className="panel-header">
                    <div><h2>Regular Sale summary</h2><p>Orders, inventory movement, buyers and sales value for fixed-price selling.</p></div>
                  </div>
                  <div className="metrics-grid">
                    <MetricCard title="Sell-through rate" value="—" subtitle="Sold quantity versus offered stock" />
                    <MetricCard title="Unique buyers" value={regularSaleStats.buyers} subtitle="Regular Sale customers" />
                    <MetricCard title="Remaining items" value="0" subtitle="Available quantity" />
                    <MetricCard title="Paid value" value={formatCurrency(0)} subtitle="Collected Regular Sale sales" />
                    <MetricCard title="Pending value" value={formatCurrency(0)} subtitle="Awaiting payment" />
                    <MetricCard title="Average order" value={formatCurrency(0)} subtitle="Average accepted order value" />
                  </div>
                </section>
              </>
            )}

            {regularSaleWorkspaceTab === "POSTS" && (
              <section className="dashboard-panel">
                <div className="panel-header">
                  <div><h2>Regular Sale posts</h2><p>Single and Multiple Regular Sale posts by status.</p></div>
                  <button className="primary-button" type="button" onClick={() => setRegularSaleWorkspaceTab("POSTING")}>Create Regular Sale Post</button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Post</th><th>Facebook Page</th><th>Status</th><th>Items</th><th>Orders</th><th>Buyers</th><th>Value</th><th>Created</th><th>Action</th></tr></thead>
                    <tbody>
                      {sellingPostLoading && <tr><td colSpan="9">Loading Regular Sale records...</td></tr>}
                      {!sellingPostLoading && sellingPostError && <tr><td colSpan="9">{sellingPostError}</td></tr>}
                      {!sellingPostLoading && !sellingPostError && !(sellingPostRows.REGULAR_SALE || []).length && <tr><td colSpan="9">No Regular Sale records yet.</td></tr>}
                      {!sellingPostLoading && !sellingPostError && (sellingPostRows.REGULAR_SALE || []).map((row) => (
                        <tr key={row.post_id}>
                          <td>{row.post_type_code || "—"}</td>
                          <td>{row.facebook_page}</td>
                          <td>{row.status || "—"}</td>
                          <td>{row.items}</td>
                          <td>{row.transactions}</td>
                          <td>{row.buyers}</td>
                          <td>{formatCurrency(row.value)}</td>
                          <td>{formatDateTime(row.created_at)}</td>
                          <td><button className="table-action-button" type="button" onClick={() => openSellingPostDetail(row)}>Details</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {regularSaleWorkspaceTab === "POSTING" && (
              <FacebookPostPage client={client} initialPostMode="REGULAR_SALE" />
            )}
          </>
          )
        )}

        {metaConnected && page === "pre-order" && (
          <>
            <section className="dashboard-panel" style={{ marginBottom: 18 }}>
              <div className="preorder-primary-nav">
                <button type="button" className="primary-button"><span className="preorder-nav-icon" aria-hidden="true">▦</span>Dashboard / Summary</button>
                <button type="button" className="secondary-button" onClick={() => navigateTo("pre-order-create")}><span className="preorder-nav-icon" aria-hidden="true">＋</span>Create Post</button>
              </div>
            </section>
            <PreorderAdminPage client={client} onCreatePost={() => navigateTo("pre-order-create")} />
          </>
        )}

        {metaConnected && page === "facebook-post" && (
          <FacebookPostPage client={client} initialPostMode="AUCTION" />
        )}

        {page === "pre-order-create" && (
          <FacebookPostPage client={client} initialPostMode="PREORDER" />
        )}

        {page === "mining-create" && (
          <FacebookPostPage client={client} initialPostMode="MINING" />
        )}


        {metaConnected && page === "live-selling" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">FACEBOOK SELLING</p>
                <h1>Live Selling</h1>
                <p>Live-selling dashboard for sessions, claims, buyers and sales performance. Transaction processing will activate when the Live Selling module is enabled.</p>
              </div>
            </header>
            <section className="metrics-grid">
              <MetricCard title="Live sessions" value="0" subtitle="Sessions in selected period" />
              <MetricCard title="Active session" value="0" subtitle="Currently live" />
              <MetricCard title="Claims" value="0" subtitle="Live comment claims" />
              <MetricCard title="Unique buyers" value="0" subtitle="Live customers" />
              <MetricCard title="Items sold" value="0" subtitle="Allocated quantity" />
              <MetricCard title="Sales value" value={formatCurrency(0)} subtitle="Gross live-selling value" />
            </section>
            <section className="dashboard-panel selling-workspace-nav-panel" style={{ marginBottom: 18 }}>
              <div className="selling-workspace-nav">
                {[
                  { key: "DASHBOARD", label: "Dashboard", icon: "dashboard" },
                  { key: "SUMMARY", label: "Summary", icon: "reports" },
                  { key: "POSTS", label: "Posts", icon: "sales" },
                ].map((tab) => (
                  <button key={tab.key} type="button" className={liveSellingWorkspaceTab === tab.key ? "primary-button" : "secondary-button"} onClick={() => setLiveSellingWorkspaceTab(tab.key)}>
                    <span className="selling-nav-icon"><NavIcon type={tab.icon} /></span>
                    <span>{tab.label}</span>
                  </button>
                ))}
                <button type="button" className="secondary-button" disabled title="Coming soon">
                  <span className="selling-nav-icon"><NavIcon type="create" /></span>
                  <span>Create Post · Soon</span>
                </button>
              </div>
            </section>
            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>{liveSellingWorkspaceTab === "POSTS" ? "Live Selling posts" : liveSellingWorkspaceTab === "SUMMARY" ? "Live Selling summary" : "Live Selling dashboard"}</h2><p>Ready for the Live Selling backend connection without exposing placeholder data as real activity.</p></div></div>
              <div className="table-wrapper"><table><thead><tr><th>Session / Post</th><th>Status</th><th>Claims</th><th>Buyers</th><th>Items</th><th>Sales</th></tr></thead><tbody><tr><td colSpan="6">No Live Selling records yet.</td></tr></tbody></table></div>
            </section>
          </>
        )}

        {page === "facebook" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">ONBOARDING · FACEBOOK</p>
                <h1>Connect Facebook Page</h1>
                <p>Authorize your Facebook account and connect the Page that will run auctions.</p>
              </div>

              <button className="icon-button refresh-icon-button" onClick={loadFacebookStatus} disabled={facebookLoading} title="Refresh Facebook status" aria-label="Refresh Facebook status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg></button>
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
                <div><strong>Optional Services</strong><small>Facebook and Online Payments can be configured anytime</small></div>
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
                <button className={facebookStatus?.connected ? "icon-button facebook-reconnect-icon" : "primary-button"} onClick={connectFacebook} title={facebookStatus?.connected ? "Reconnect Facebook" : "Connect Facebook"} aria-label={facebookStatus?.connected ? "Reconnect Facebook" : "Connect Facebook"}>{facebookStatus?.connected ? <svg viewBox="0 0 24 24" aria-hidden="true" className="facebook-mark-icon"><path d="M13.6 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V13h2.8v8h3.4Z" fill="currentColor" stroke="none"/></svg> : "Connect Facebook"}</button>
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
                      <th>Status</th>
                      <th>Authorization</th>
                      <th>Connected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(facebookStatus?.pages || []).map((fbPage) => (
                      <tr key={fbPage.fb_page_id}>
                        <td>{fbPage.page_name || "Facebook Page"}</td>
                        <td><StatusBadge status={fbPage.status || "ACTIVE"} /></td>
                        <td><StatusBadge status={fbPage.token_present ? "AUTHORIZED" : "RECONNECT"} /></td>
                        <td>{formatDateTime(fbPage.connected_at)}</td>
                      </tr>
                    ))}

                    {!facebookLoading && !(facebookStatus?.pages || []).length && (
                      <tr>
                        <td colSpan="4" className="empty-table-cell">No Facebook Page connected yet.</td>
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

        {page === "users-staff" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">MAINTENANCE · ACCESS</p>
                <h1>Users &amp; Staff</h1>
                <p>Create and maintain client staff access without exposing platform administration.</p>
              </div>
              <button className="primary-button" type="button" onClick={() => setShowStaffForm((current) => !current)}>
                {showStaffForm ? "Close Form" : "Add Staff"}
              </button>
            </header>

            {showStaffForm && (
              <section className="dashboard-panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Invite Client Staff</h2>
                    <p>Prepare the account and permission role. Invitation delivery will be wired after the access-control backend is finalized.</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
                  <label>
                    <span>Full Name</span>
                    <input
                      value={staffDraft.name}
                      onChange={(event) => setStaffDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Staff name"
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={staffDraft.email}
                      onChange={(event) => setStaffDraft((current) => ({ ...current, email: event.target.value }))}
                      placeholder="staff@example.com"
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <select value={staffDraft.role} onChange={(event) => setStaffDraft((current) => ({ ...current, role: event.target.value }))}>
                      <option value="STAFF">Client Staff</option>
                      <option value="ADMIN">Client Admin</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                  <button className="secondary-button" type="button" onClick={() => { setShowStaffForm(false); setStaffDraft({ name: "", email: "", role: "STAFF" }); }}>Cancel</button>
                  <button className="primary-button" type="button" disabled title="Staff invitation backend will be connected after UI completion">Send Invitation</button>
                </div>
              </section>
            )}

            <section className="metrics-grid">
              <MetricCard title="Client Admins" value="—" subtitle="Administrative users" />
              <MetricCard title="Client Staff" value="—" subtitle="Operational users" />
              <MetricCard title="Pending Invites" value="—" subtitle="Awaiting acceptance" />
              <MetricCard title="Inactive Users" value="—" subtitle="Access disabled" />
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Client Users</h2>
                  <p>Role, status and access activity for this client only.</p>
                </div>
                <input type="search" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search users" style={{ maxWidth: 260 }} />
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Added</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: 30, color: "#718096" }}>
                        Staff accounts will appear here once client user provisioning is connected.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#f8fafc", fontSize: 13, color: "#526274" }}>
                <strong style={{ color: "#263548" }}>Access model:</strong> Client Admin can manage staff and permitted sensitive settings. Client Staff receives only the modules and actions explicitly allowed for their role.
              </div>
            </section>
          </>
        )}

        {page === "reports" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">REPORTS · INSIGHTS</p>
                <h1>Reports &amp; Insights</h1>
                <p>Operational reports plus EO2MATE insights designed to help clients decide what to sell, collect and improve next.</p>
              </div>

            </header>

            <section className="dashboard-panel report-filter-panel">
              <div className="panel-header report-filter-header">
                <div>
                  <p className="eyebrow">REPORT PARAMETERS</p>
                  <h2>Report Filters</h2>
                  <p>Choose the parameters used for the report preview and exported files.</p>
                </div>
              </div>
              <form className="report-filter-form" onSubmit={generateReport}>
                <div className="report-filter-grid">
                  <label className="report-field"><span>Report Type <b>*</b></span><select value={selectedReport} onChange={(event) => setSelectedReport(event.target.value)} required><option value="" disabled>Select report type</option>{REPORT_CATALOG.map((report) => <option key={report.key} value={report.key}>{report.title}</option>)}</select></label>
                  <label className="report-field"><span>Date Range <b>*</b></span><select value={reportDateRange} onChange={(event) => setReportDateRange(event.target.value)} required><option value="" disabled>Select date range</option><option value="7D">Last 7 days</option><option value="30D">Last 30 days</option><option value="MTD">Month to date</option><option value="YTD">Year to date</option><option value="CUSTOM">Custom range</option></select></label>
                  <label className="report-field"><span>Facebook Page <b>*</b></span><select value={reportPageFilter} onChange={(event) => setReportPageFilter(event.target.value)} required><option value="" disabled>Select Facebook Page</option><option value="ALL">All My Pages</option>{(automationPages || []).filter((fbPage) => !fbPage.client_id || String(fbPage.client_id) === String(client?.client_id || "")).map((fbPage) => (<option key={fbPage.fb_page_id} value={fbPage.fb_page_id}>{fbPage.page_name || fbPage.page_nm || fbPage.fb_page_id}</option>))}</select><small>Only Facebook Pages connected to this client are available.</small></label>
                  {reportDateRange === "CUSTOM" && (<><label className="report-field"><span>From <b>*</b></span><input type="date" required value={reportCustomFrom} onChange={(event) => setReportCustomFrom(event.target.value)} /></label><label className="report-field"><span>To <b>*</b></span><input type="date" required value={reportCustomTo} onChange={(event) => setReportCustomTo(event.target.value)} /></label></>)}
                  <label className="report-field"><span>Sales Channel <b>*</b></span><select value={reportChannelFilter} onChange={(event) => setReportChannelFilter(event.target.value)} required><option value="" disabled>Select sales channel</option><option value="ALL">All channels</option><option value="AUCTION">Auction</option><option value="POST_MINING">Post Mining</option><option value="REGULAR_SALE">Regular Sale</option><option value="PREORDER">Pre-Order</option><option value="MANUAL">Manual / Other</option></select></label>
                  <label className="report-field"><span>Status <b>*</b></span><select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value)} required><option value="" disabled>Select status</option><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="CLOSED">Closed</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>
                  <label className="report-field"><span>Sort By <b>*</b></span><select value={reportSortBy} onChange={(event) => setReportSortBy(event.target.value)} required><option value="" disabled>Select sort order</option><option value="DATE_DESC">Newest first</option><option value="DATE_ASC">Oldest first</option><option value="AMOUNT_DESC">Amount: high to low</option><option value="AMOUNT_ASC">Amount: low to high</option></select></label>
                </div>
                {reportMessage && !generatedReport && <div className="info-banner report-filter-message">{reportMessage}</div>}
                <div className="report-filter-actions">
                  <button className="icon-button report-action-icon" type="button" title="Clear filters" aria-label="Clear filters" onClick={() => { setSelectedReport(""); setReportDateRange(""); setReportCustomFrom(""); setReportCustomTo(""); setReportPageFilter(""); setReportChannelFilter(""); setReportStatusFilter(""); setReportSortBy(""); setGeneratedReport(null); setReportMessage(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18"/><path d="M6 5l1 15h10l1-15"/><path d="M9 9v7"/><path d="M15 9v7"/></svg></button>
                  <button className="primary-button report-short-action" type="submit"><span className="report-run-icon"><NavIcon type="reports" /></span><span>Run</span></button>
                  <button className="secondary-button report-short-action" type="button" onClick={exportReportExcel} disabled={!generatedReport} title="Export Excel">▦ Excel</button>
                  <button className="secondary-button report-short-action" type="button" onClick={printReport} disabled={!generatedReport} title="Export PDF">▤ PDF</button>
                </div>
              </form>
            </section>

            {(() => {
              const report = REPORT_CATALOG.find((item) => item.key === selectedReport);
              if (!report) return (
                <section className="dashboard-panel">
                  <div className="panel-header"><div><p className="eyebrow">REPORT PREVIEW</p><h2>Select report parameters</h2><p>Complete the required fields above, then click Generate Report.</p></div></div>
                </section>
              );
              const displayData = generatedReport?.data || reportData;
              return (
                <section className="dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">SELECTED REPORT</p>
                      <h2>{report.title}</h2>
                      <p>{report.description}</p>
                    </div>
                    {report.featured && <StatusBadge status="INSIGHT" />}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
                    {report.highlights.map((highlight) => (
                      <div key={highlight} style={{ padding: 14, border: "1px solid #e5eaf0", borderRadius: 12, background: "#fbfcfd" }}>
                        <strong style={{ display: "block", color: "#263548", marginBottom: 4 }}>{highlight}</strong>
                        <span style={{ fontSize: 12, color: "#718096" }}>Calculated from validated EO2MATE transaction data once reporting is connected.</span>
                      </div>
                    ))}
                  </div>

                  {report.featured && (
                    <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "#f3fbf5", border: "1px solid #d6efdc" }}>
                      <strong style={{ display: "block", color: "#1d6530", marginBottom: 6 }}>What makes this report different</strong>
                      <span style={{ fontSize: 13, lineHeight: 1.55, color: "#456353" }}>
                        Instead of only listing totals, the Opportunity Report will flag patterns such as high-interest auctions with weak closing values, fast MINE claims, unpaid sales at risk, repeat high-value buyers, underperforming stock and the strongest historical selling windows.
                      </span>
                    </div>
                  )}

                  <div className="metrics-grid" style={{ marginTop: 18 }}>
                    <MetricCard title="Gross Sales" value={formatCurrency(displayData.gross)} subtitle={`${displayData.filteredOrders.length} matching orders`} />
                    <MetricCard title="Paid" value={displayData.paid.length} subtitle={formatCurrency(displayData.paidValue)} />
                    <MetricCard title="Pending" value={displayData.pending.length} subtitle="Payments awaiting completion" />
                    <MetricCard title="Buyers" value={displayData.buyers} subtitle="Unique matching buyers" />
                    <MetricCard title="Auctions" value={displayData.filteredAuctions.length} subtitle="Matching auction records" />
                    <MetricCard title="Deliveries" value={displayData.filteredDeliveries.length} subtitle="Matching delivery records" />
                  </div>

                  {reportGeneratedAt && (
                    <div className="table-wrapper" style={{ marginTop: 18 }}>
                      <table><thead><tr><th>Date</th><th>Reference</th><th>Channel</th><th>Buyer</th><th>Status</th><th>Amount</th></tr></thead><tbody>
                        {displayData.rows.map((r, i) => <tr key={`${r.Reference}-${i}`}><td>{formatDateTime(r.Date)}</td><td>{r.Reference}</td><td>{r.Channel}</td><td>{r.Buyer}</td><td><StatusBadge status={r.Status} /></td><td>{formatCurrency(r.Amount)}</td></tr>)}
                        {!displayData.rows.length && <tr><td colSpan="6" className="empty-table-cell">No records match the selected report filters.</td></tr>}
                      </tbody></table>
                    </div>
                  )}
                  {reportMessage && <div className="info-banner" style={{ marginTop: 12 }}>{reportMessage}</div>}

                </section>
              );
            })()}
          </>
        )}

        {page === "setup" && (
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
                  className="control-modal setup-password-modal"
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

                  <label className="control-modal-reason">
                    Current password
                    <input type="password" autoComplete="current-password" value={automationPassword} onChange={(e) => setAutomationPassword(e.target.value)} placeholder="Verify your password" />
                  </label>

                  {automationModalError && (
                    <div className="setup-modal-inline-error" role="alert">{automationModalError}</div>
                  )}

                  <div className="control-modal-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setAutomationModal(null);
                        setAutomationReason("");
                        setAutomationPassword("");
                        setAutomationModalError("");
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
                <h2>Automation Control</h2>
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

            <section className="dashboard-panel automation-control-panel payment-automation-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">PAYMENT MODE</p>
                  <h2>Payment automation</h2>
                  <p>Control whether EO2MATE may automatically provide payment or checkout links to buyers.</p>
                </div>
              </div>

              <div className={`payment-automation-notice ${paymentAutomation.payment_automation_enabled !== false ? "enabled" : "manual"}`}>
                <div>
                  <strong>{paymentAutomation.payment_automation_enabled !== false ? "Automated payment mode" : "Manual payment mode"}</strong>
                  <span>
                    {paymentAutomation.payment_automation_enabled !== false
                      ? "EO2MATE may send payment instructions and secure checkout links through supported buyer flows."
                      : "Selling remains active, but EO2MATE will not issue payment links in winner/order replies or through payment Messenger commands."}
                  </span>
                  {paymentAutomation.payment_automation_enabled === false && paymentAutomation.payment_automation_reason && (
                    <small>Reason: {paymentAutomation.payment_automation_reason}</small>
                  )}
                </div>
                <StatusBadge status={paymentAutomation.payment_automation_enabled !== false ? "ACTIVE" : "MANUAL"} />
              </div>

              <div className="payment-automation-setting-row">
                <div className="payment-automation-setting-copy">
                  <strong>Automated payment</strong>
                  <span>Automatically send supported checkout and payment links. Turn off to handle buyer payments manually.</span>
                </div>
                <button
                  type="button"
                  className="payment-automation-toggle"
                  aria-pressed={paymentAutomation.payment_automation_enabled !== false}
                  aria-label={paymentAutomation.payment_automation_enabled !== false ? "Disable payment automation" : "Enable payment automation"}
                  title={paymentAutomation.payment_automation_enabled !== false ? "Turn payment automation off" : "Turn payment automation on"}
                  disabled={automationControlLoading || !["ADMIN", "OWNER", "CLIENT_ADMIN", "SUPER_ADMIN"].includes(String(client?.role || "").toUpperCase())}
                  onClick={() => {
                    setAutomationReason("");
                    setAutomationPassword("");
                    setAutomationModalError("");
                    setAutomationModal({ kind: "PAYMENT_AUTOMATION", label: "Payment automation", enabled: !(paymentAutomation.payment_automation_enabled !== false) });
                  }}
                >
                  <span className={`automation-switch-orb ${paymentAutomation.payment_automation_enabled !== false ? "enabled" : "disabled"}`} aria-hidden="true"><span /></span>
                </button>
              </div>
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

        {metaConnected && page === "post-mining" && (
          (sellingPostDetailLoading || sellingPostDetailError || sellingPostDetail?.mode_code === "MINING") ? (
            <SellingPostDetailPanel detail={sellingPostDetail} loading={sellingPostDetailLoading} error={sellingPostDetailError} onClose={() => { setSellingPostDetail(null); setSellingPostDetailError(""); }} />
          ) : (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">FACEBOOK SELLING</p>
                <h1>Post Mining</h1>
                <p>Manage regular MINE posts and Live Mining activity from one workspace.</p>
              </div>
            </header>

            <section className="metrics-grid">
              <MetricCard title="Total posts" value={miningStats.total} subtitle="All mining posts" />
              <MetricCard title="Active" value={miningStats.active} subtitle="Currently accepting MINE" />
              <MetricCard title="Live Mining" value="0" subtitle="Active live sessions" />
              <MetricCard title="Completed" value={miningStats.completed} subtitle="Closed mining posts" />
              <MetricCard title="Cancelled" value={miningStats.cancelled} subtitle="Cancelled posts" />
              <MetricCard title="Total claims" value={miningStats.claims} subtitle="Recorded MINE claims" />
              <MetricCard title="Unique buyers" value={miningStats.buyers} subtitle="Mining customers" />
              <MetricCard title="Claimed value" value={formatCurrency(miningStats.value)} subtitle="Gross claimed sales" />
            </section>

            <section className="dashboard-panel selling-workspace-nav-panel" style={{ marginBottom: 18 }}>
              <div className="selling-workspace-nav">
                {[
                  { key: "SUMMARY", label: "Summary", icon: "dashboard" },
                  { key: "POSTS", label: "Posts", icon: "mining" },
                  { key: "LIVE MINING", label: "Live Mining", icon: "reports" },
                  { key: "CLAIMS", label: "Claims", icon: "orders" },
                  { key: "BUYERS", label: "Buyers", icon: "users" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={miningWorkspaceTab === tab.key ? "primary-button" : "secondary-button"}
                    onClick={() => setMiningWorkspaceTab(tab.key)}
                  >
                    <span className="selling-nav-icon"><NavIcon type={tab.icon} /></span>
                    <span>{tab.label}</span>
                  </button>
                ))}
                <button type="button" className="secondary-button" onClick={() => navigateTo("mining-create")}>
                  <span className="selling-nav-icon"><NavIcon type="create" /></span>
                  <span>Create Post</span>
                </button>
              </div>
            </section>

            {miningWorkspaceTab === "SUMMARY" && (
              <>
                <section className="toolbar-card">
                  <select className="filter-select" value={miningStatusFilter} onChange={(e) => setMiningStatusFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Scheduled / Draft</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <select className="filter-select" defaultValue="30D">
                    <option value="TODAY">Today</option>
                    <option value="7D">Last 7 days</option>
                    <option value="30D">Last 30 days</option>
                    <option value="MONTH">This month</option>
                  </select>
                </section>

                <section className="dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Mining summary</h2>
                      <p>Claims, conversion, buyers and selling value across regular and live mining.</p>
                    </div>
                  </div>
                  <div className="metrics-grid">
                    <MetricCard title="Claim conversion" value="—" subtitle="Claims versus offered stock" />
                    <MetricCard title="Items claimed" value="0" subtitle="Total claimed quantity" />
                    <MetricCard title="Remaining items" value="0" subtitle="Unclaimed quantity" />
                    <MetricCard title="Paid value" value={formatCurrency(0)} subtitle="Collected mining sales" />
                    <MetricCard title="Pending value" value={formatCurrency(0)} subtitle="Awaiting payment" />
                    <MetricCard title="Released claims" value={formatCurrency(0)} subtitle="Cancelled / expired claims" />
                  </div>
                </section>
              </>
            )}

            {miningWorkspaceTab === "POSTS" && (
              <section className="dashboard-panel">
                <div className="panel-header">
                  <div><h2>Mining posts</h2><p>All regular Post Mining records by status.</p></div>
                  <button className="primary-button" type="button" onClick={() => navigateTo("mining-create")}>Create Mining Post</button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Post</th><th>Facebook Page</th><th>Status</th><th>Items</th><th>Claims</th><th>Buyers</th><th>Value</th><th>Created</th><th>Action</th></tr></thead>
                    <tbody>
                      {sellingPostLoading && <tr><td colSpan="9">Loading Post Mining records...</td></tr>}
                      {!sellingPostLoading && sellingPostError && <tr><td colSpan="8">{sellingPostError}</td></tr>}
                      {!sellingPostLoading && !sellingPostError && !(sellingPostRows.MINING || []).length && <tr><td colSpan="9">No Post Mining records yet.</td></tr>}
                      {!sellingPostLoading && !sellingPostError && (sellingPostRows.MINING || []).map((row) => (
                        <tr key={row.post_id}>
                          <td>{row.post_type_code || "—"}</td>
                          <td>{row.facebook_page}</td>
                          <td>{row.status || "—"}</td>
                          <td>{row.items}</td>
                          <td>{row.transactions}</td>
                          <td>{row.buyers}</td>
                          <td>{formatCurrency(row.value)}</td>
                          <td>{formatDateTime(row.created_at)}</td>
                          <td><button className="table-action-button" type="button" onClick={() => openSellingPostDetail(row)}>Details</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {miningWorkspaceTab === "LIVE MINING" && (
              <>
                <section className="dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Live Mining</h2>
                      <p>Monitor Facebook Live selling sessions using MINE codes and real-time buyer claims.</p>
                    </div>
                    <button className="primary-button" type="button" disabled title="Enabled after Facebook Live backend integration">Start / Connect Live</button>
                  </div>
                  <div className="metrics-grid">
                    <MetricCard title="Live sessions" value="0" subtitle="Currently connected" />
                    <MetricCard title="Live comments" value="0" subtitle="Processed comments" />
                    <MetricCard title="Valid MINE claims" value="0" subtitle="Matched MINE codes" />
                    <MetricCard title="Live buyers" value="0" subtitle="Unique buyers" />
                    <MetricCard title="Live sales" value={formatCurrency(0)} subtitle="Claimed value" />
                  </div>
                </section>
                <section className="dashboard-panel">
                  <div className="panel-header"><div><h2>Live sessions</h2><p>Current and previous Live Mining sessions.</p></div></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Live</th><th>Facebook Page</th><th>Status</th><th>MINE Codes</th><th>Claims</th><th>Buyers</th><th>Sales</th><th>Started</th></tr></thead>
                      <tbody><tr><td colSpan="8">No Live Mining sessions yet.</td></tr></tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {miningWorkspaceTab === "CLAIMS" && (
              <section className="dashboard-panel">
                <div className="panel-header"><div><h2>Claims</h2><p>Buyer MINE claims from posts and live sessions.</p></div></div>
                <div className="table-wrapper"><table><thead><tr><th>Buyer</th><th>MINE Code</th><th>Item</th><th>Qty</th><th>Source</th><th>Status</th><th>Amount</th><th>Claimed</th></tr></thead><tbody><tr><td colSpan="8">No claims yet.</td></tr></tbody></table></div>
              </section>
            )}

            {miningWorkspaceTab === "BUYERS" && (
              <section className="dashboard-panel">
                <div className="panel-header"><div><h2>Mining buyers</h2><p>Buyer activity across Post Mining and Live Mining.</p></div></div>
                <div className="table-wrapper"><table><thead><tr><th>Buyer</th><th>Claims</th><th>Items</th><th>Total value</th><th>Paid</th><th>Pending</th><th>Last activity</th></tr></thead><tbody><tr><td colSpan="7">No mining buyers yet.</td></tr></tbody></table></div>
              </section>
            )}
          </>
          )
        )}

        {page === "dashboard" && (
          <>
            <section style={{
              background: "linear-gradient(135deg, #08233f 0%, #0f3558 62%, #17623a 140%)",
              borderRadius: 24,
              padding: "28px clamp(20px, 4vw, 38px)",
              color: "#fff",
              marginBottom: 20,
              boxShadow: "0 18px 45px rgba(8,35,63,.14)",
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}>
              <div style={{ minWidth: 260, flex: "1 1 520px" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", opacity: .72, marginBottom: 8 }}>EO2MATE BUSINESS OVERVIEW</div>
                <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.08 }}>
                  {client?.name ? `${client.name} Dashboard` : "Business Dashboard"}
                </h1>
                <p style={{ margin: "10px 0 0", maxWidth: 720, color: "rgba(255,255,255,.78)", lineHeight: 1.55 }}>
                  Monitor today’s selling activity, orders, payments, inventory and fulfillment from one clear operational dashboard.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh dashboard" aria-label="Refresh dashboard" style={{ background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.18)", color: "#fff" }}>
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
                {(() => {
                  const days = Array.from({ length: 7 }, (_, index) => {
                    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-index)); return d;
                  });
                  const points = days.map((day) => {
                    const next = new Date(day); next.setDate(next.getDate()+1);
                    return { label: day.toLocaleDateString("en-PH", { weekday: "short" }), count: orders.filter((o) => { const d = new Date(o.created_at || o.order_created_at || 0); return d >= day && d < next; }).length };
                  });
                  const max = Math.max(1, ...points.map((p) => p.count));
                  const poly = points.map((p, i) => `${8 + i*(84/6)},${82 - (p.count/max)*64}`).join(" ");
                  return <div style={{ padding: "4px 4px 0" }}>
                    <svg viewBox="0 0 100 92" preserveAspectRatio="none" style={{ width: "100%", height: 230, display: "block" }} aria-label="Seven day order activity chart">
                      {[18,34,50,66,82].map((y) => <line key={y} x1="7" y1={y} x2="94" y2={y} stroke="#edf1f5" strokeWidth=".6" />)}
                      <polyline points={poly} fill="none" stroke="#2b9a4b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p,i) => <circle key={i} cx={8+i*(84/6)} cy={82-(p.count/max)*64} r="1.7" fill="#2b9a4b" />)}
                    </svg>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "0 3% 8px", color: "#7b8b9b", fontSize: 11, textAlign: "center" }}>{points.map((p) => <span key={p.label}>{p.label}</span>)}</div>
                  </div>;
                })()}
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

        {page === "auctions" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">AUCTION MANAGEMENT</p>
                <h1>Auctions</h1>
                <p>Monitor auction status, bids, winners and overall selling performance.</p>
              </div>
              <button className="icon-button refresh-icon-button" onClick={loadPortal} title="Refresh" aria-label="Refresh">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" /><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" /></svg>
              </button>
            </header>

            <section className="metrics-grid">
              <MetricCard title="Total auctions" value={auctions.length} subtitle="All auction items" onClick={() => { setAuctionWorkspaceTab("AUCTIONS"); setAuctionStatusFilter("ALL"); }} />
              <MetricCard title="Active" value={auctions.filter((a) => a.ui_status === "ACTIVE").length} subtitle="Currently open" onClick={() => { setAuctionWorkspaceTab("AUCTIONS"); setAuctionStatusFilter("ACTIVE"); }} />
              <MetricCard title="Completed" value={auctions.filter((a) => ["COMPLETED", "COMPLETED_WITH_WINNER", "CLOSED_NO_WINNER"].includes(a.ui_status)).length} subtitle="Closed auctions" />
              <MetricCard title="Cancelled" value={auctions.filter((a) => a.ui_status === "CANCELLED").length} subtitle="Cancelled auctions" />
              <MetricCard title="Total bids" value={auctions.reduce((sum, a) => sum + Number(a.valid_bid_count || a.bid_count || 0), 0)} subtitle="Recorded valid bids" />
              <MetricCard title="Winning value" value={formatCurrency(auctions.reduce((sum, a) => sum + Number(a.highest_bid || 0), 0))} subtitle="Current / final highest bids" />
            </section>

            <section className="dashboard-panel selling-workspace-nav-panel" style={{ marginBottom: 18 }}>
              <div className="selling-workspace-nav">
                {[
                  { key: "SUMMARY", label: "Summary", icon: "dashboard" },
                  { key: "AUCTIONS", label: "Auctions", icon: "auction" },
                  { key: "BIDS", label: "Bids", icon: "sales" },
                  { key: "WINNERS", label: "Winners", icon: "users" },
                ].map((tab) => (
                  <button key={tab.key} type="button" className={auctionWorkspaceTab === tab.key ? "primary-button" : "secondary-button"} onClick={() => setAuctionWorkspaceTab(tab.key)}>
                    <span className="selling-nav-icon"><NavIcon type={tab.icon} /></span>
                    <span>{tab.label}</span>
                  </button>
                ))}
                <button type="button" className="secondary-button" onClick={() => navigateTo("facebook-post")}>
                  <span className="selling-nav-icon"><NavIcon type="create" /></span>
                  <span>Create Post</span>
                </button>
              </div>
            </section>

            {auctionWorkspaceTab === "SUMMARY" && (
              <>
                <section className="toolbar-card">
                  <select className="filter-select" value={auctionStatusFilter} onChange={(e) => setAuctionStatusFilter(e.target.value)}>
                    <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Scheduled / Draft</option><option value="COMPLETED_WITH_WINNER">Completed</option><option value="CANCELLED">Cancelled</option>
                  </select>
                  <select className="filter-select" defaultValue="30D"><option value="TODAY">Today</option><option value="7D">Last 7 days</option><option value="30D">Last 30 days</option><option value="MONTH">This month</option></select>
                </section>
                <section className="dashboard-panel">
                  <div className="panel-header"><div><h2>Auction summary</h2><p>Quick operational and financial view of auction performance.</p></div></div>
                  <div className="metrics-grid">
                    <MetricCard title="Unique bidders" value="—" subtitle="Across selected period" />
                    <MetricCard title="Average bids / auction" value="—" subtitle="Participation level" />
                    <MetricCard title="Sell-through rate" value="—" subtitle="Auctions ending with winner" />
                    <MetricCard title="Buyouts" value="—" subtitle="Closed through buyout" />
                    <MetricCard title="Paid value" value="—" subtitle="Collected auction sales" />
                    <MetricCard title="Pending value" value="—" subtitle="Awaiting payment" />
                  </div>
                </section>
              </>
            )}

            {auctionWorkspaceTab === "AUCTIONS" && (
              <>
                <section className="toolbar-card">
                  <input className="search-input" value={auctionSearch} onChange={(e) => setAuctionSearch(e.target.value)} placeholder="Search auctions..." />
                  <select className="filter-select" value={auctionStatusFilter} onChange={(e) => setAuctionStatusFilter(e.target.value)}>
                    <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="COMPLETED_WITH_WINNER">Completed with winner</option><option value="CLOSED_NO_WINNER">Closed no winner</option><option value="AWAITING_FINALIZER">Awaiting finalizer</option><option value="CANCELLED">Cancelled</option>
                  </select>
                </section>
                <section className="dashboard-panel">
                  <div className="panel-header"><div><h2>Auction list</h2><p>{filteredAuctions.length} record(s)</p></div></div>
                  <div className="table-wrapper"><table><thead><tr><th>Item</th><th>Status</th><th>Highest bid</th><th>Bidder</th><th>Valid bidders</th><th>Ends</th><th>Payment</th><th>Action</th></tr></thead><tbody>{filteredAuctions.map((auction) => (<tr key={auction.auction_item_id}><td>{auction.item_label}</td><td><StatusBadge status={auction.ui_status} /></td><td>{formatCurrency(auction.highest_bid)}</td><td>{auction.highest_bidder_name || "-"}</td><td>{auction.valid_bidder_count}/{auction.min_bidder_count}</td><td>{formatDateTime(auction.auction_end_dt)}</td><td>{auction.payment_status || "-"}</td><td><button className="table-action-button" type="button" onClick={() => openAuction(auction.auction_item_id)}>Details</button></td></tr>))}</tbody></table></div>
                </section>
              </>
            )}

            {auctionWorkspaceTab === "BIDS" && (
              <section className="dashboard-panel"><div className="panel-header"><div><h2>Bid activity</h2><p>Validated bid history across your auction items.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Auction</th><th>Bidder</th><th>Bid</th><th>Validity</th><th>Facebook Comment</th><th>Time</th></tr></thead><tbody>{auctionBids.map((bid) => { const auction=auctions.find(a=>a.auction_item_id===bid.auction_item_id); return <tr key={bid.bid_id || `${bid.auction_item_id}-${bid.fb_comment_id || bid.commented_at}`} className="clickable-row" onClick={()=>openAuction(bid.auction_item_id)}><td><strong>{auction?.item_label || bid.item_label || "Auction"}</strong></td><td>{bid.fb_user_name || bid.fb_user_id || "—"}</td><td>{formatCurrency(bid.bid_amt)}</td><td><StatusBadge status={bid.is_valid ? "VALID" : "INVALID"}/></td><td>{bid.fb_comment_id || bid.comment_text || "—"}</td><td>{formatDateTime(bid.commented_at)}</td></tr>})}{!auctionBids.length&&<tr><td colSpan="6" className="empty-table-cell">No bid records found.</td></tr>}</tbody></table></div></section>
            )}

            {auctionWorkspaceTab === "WINNERS" && (
              <section className="dashboard-panel"><div className="panel-header"><div><h2>Auction winners</h2><p>Winner, winning amount and downstream payment/order status.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Auction</th><th>Winner</th><th>Winning amount</th><th>Order</th><th>Payment</th><th>Completed</th></tr></thead><tbody>{auctions.filter((a) => a.highest_bidder_name && ["COMPLETED_WITH_WINNER", "COMPLETED", "CLOSED"].includes(String(a.ui_status || "").toUpperCase())).map((a) => (<tr key={a.auction_item_id} className="clickable-row" onClick={() => openAuction(a.auction_item_id)}><td>{a.item_label}</td><td><button className="table-link-button" type="button" onClick={(event)=>{event.stopPropagation();openAuction(a.auction_item_id)}}>{a.highest_bidder_name}</button></td><td>{formatCurrency(a.highest_bid)}</td><td>{a.order_status || "-"}</td><td>{a.payment_status || "-"}</td><td>{formatDateTime(a.auction_end_dt)}</td></tr>))}</tbody></table></div></section>
            )}
          </>
        )}

        {page === "inventory" && (
          <InventoryPage client={client} />
        )}

        {page === "sales" && (
          <>
            <header className="dashboard-header"><div><p className="eyebrow">SALES</p><h1>Sales</h1><p>Consolidated sales from Auctions, Post Mining, Live Mining and manual transactions.</p></div></header>
            <section className="metrics-grid"><MetricCard title="Gross sales" value={formatCurrency(0)} subtitle="Before deductions" /><MetricCard title="Net sales" value={formatCurrency(0)} subtitle="After discounts / adjustments" /><MetricCard title="Paid" value={formatCurrency(0)} subtitle="Collected sales" /><MetricCard title="Pending" value={formatCurrency(0)} subtitle="Awaiting payment" /><MetricCard title="Transactions" value="0" subtitle="Sales records" /><MetricCard title="Average sale" value={formatCurrency(0)} subtitle="Per transaction" /></section>
            <section className="dashboard-panel" style={{ marginBottom: 18 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["SUMMARY", "TRANSACTIONS", "RETURNS"].map((tab) => <button key={tab} type="button" className={salesTab === tab ? "primary-button" : "secondary-button"} onClick={() => setSalesTab(tab)}>{tab.charAt(0)+tab.slice(1).toLowerCase()}</button>)}</div></section>
            <section className="dashboard-panel"><div className="panel-header"><div><h2>{salesTab === "SUMMARY" ? "Sales summary" : salesTab.charAt(0)+salesTab.slice(1).toLowerCase()}</h2><p>Sales data will consolidate all enabled EO2MATE selling channels.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Date</th><th>Reference</th><th>Channel</th><th>Buyer</th><th>Items</th><th>Gross</th><th>Paid</th><th>Status</th></tr></thead><tbody><tr><td colSpan="8">No consolidated sales records yet.</td></tr></tbody></table></div></section>
          </>
        )}

        {page === "purchases" && (
          <>
            <header className="dashboard-header"><div><p className="eyebrow">PURCHASING</p><h1>Purchases</h1><p>Record stock purchases, suppliers, receiving and inventory cost.</p></div></header>
            <section className="metrics-grid"><MetricCard title="Purchases" value={formatCurrency(0)} subtitle="Selected period" /><MetricCard title="Open POs" value="0" subtitle="Awaiting receipt" /><MetricCard title="Received" value="0" subtitle="Completed receipts" /><MetricCard title="Suppliers" value="0" subtitle="Active suppliers" /><MetricCard title="Items received" value="0" subtitle="Purchased quantity" /><MetricCard title="Outstanding" value={formatCurrency(0)} subtitle="Supplier payable" /></section>
            <section className="dashboard-panel" style={{ marginBottom: 18 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["SUMMARY", "PURCHASES", "SUPPLIERS", "RECEIVING"].map((tab) => <button key={tab} type="button" className={purchasesTab === tab ? "primary-button" : "secondary-button"} onClick={() => setPurchasesTab(tab)}>{tab.charAt(0)+tab.slice(1).toLowerCase()}</button>)}</div></section>
            <section className="dashboard-panel"><div className="panel-header"><div><h2>{purchasesTab === "SUMMARY" ? "Purchase summary" : purchasesTab.charAt(0)+purchasesTab.slice(1).toLowerCase()}</h2><p>Purchase and supplier backend will be connected after the UI structure is approved.</p></div>{purchasesTab === "PURCHASES" && <button className="primary-button" type="button" disabled>New Purchase</button>}</div><div className="table-wrapper"><table><thead><tr><th>Date</th><th>Purchase Ref</th><th>Supplier</th><th>Items</th><th>Total Cost</th><th>Received</th><th>Payment</th><th>Status</th></tr></thead><tbody><tr><td colSpan="8">No purchase records yet.</td></tr></tbody></table></div></section>
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
                <p>Monitor Online Payments transactions, payment deadlines and manual payment extensions.</p>
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

        {page === "payment-settings" && (
          <PaymentMethodsSettings clientId={client?.client_id} onChanged={loadPortal} />
        )}

        {page === "setup" && (
          <AutomatedMessagesPage client={client} />
        )}

        {page === "account-security" && (
          <AccountSecurityPage session={session} />
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
            <button className="back-button icon-only-nav" onClick={() => setPage("auctions")} aria-label="Back to auctions" title="Back to auctions"><span className="button-icon"><NavIcon type="back" /></span></button>

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
                    <div className="detail-card-header"><h2>Online Payments</h2></div>
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
      <FloatingMetaMessenger clientId={client?.client_id} />
    </div>
  );
}
