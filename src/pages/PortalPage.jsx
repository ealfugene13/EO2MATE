import PostsPage from "./PostsPage";
import RegularSalePage from "./RegularSalePage";
import LiveSellingPage from "./LiveSellingPage";
import FacebookPage from "./FacebookPage";
import StaffPage from "./StaffPage";
import ReportsPage from "./ReportsPage";
import AutomationControlPage from "./AutomationControlPage";
import MiningPage from "./MiningPage";
import DashboardPage from "./DashboardPage";
import AuctionPage from "./AuctionPage";
import OrdersPage from "./OrdersPage";
import PaymentsPage from "./PaymentsPage";
import PurchasesPage from "./PurchasesPage";
import DeliveriesPage from "./DeliveriesPage";
import SalesPage from "./SalesPage";
import InventoryPage from "./InventoryPage";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import SetupPage from "./SetupPage";
import OnboardingPage from "./OnboardingPage";
import AdminClientsPage from "./AdminClientsPage";
import FacebookPostPage from "./FacebookPostPage";
import PreorderPage from "./PreorderPage";
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

export default function PortalPage({ session }) {
  const [detailRequest, setDetailRequest] = useState(null);
  const [navigationFilter, setNavigationFilter] = useState(null);
  function openAuction(id) { setDetailRequest({ kind: 'auction', id }); setPage('auction-detail'); }
  function openOrder(id) { setDetailRequest({ kind: 'order', id }); setPage('order-detail'); }
  function openPayment(id) { setDetailRequest({ kind: 'payment', id }); setPage('payment-detail'); }
  function openDelivery(id) { setDetailRequest({ kind: 'delivery', id }); setPage('delivery-detail'); }
  const [client, setClient] = useState(null);
  const [platformAdmin, setPlatformAdmin] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [page]);
  const [loading, setLoading] = useState(true);
  
  const [errorMessage, setErrorMessage] = useState("");

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


  // UI-first operational dashboards. Data wiring follows after UI approval.
  const [auctionWorkspaceTab, setAuctionWorkspaceTab] = useState("SUMMARY");
  const [miningWorkspaceTab, setMiningWorkspaceTab] = useState("SUMMARY");
  const [regularSaleWorkspaceTab, setRegularSaleWorkspaceTab] = useState("SUMMARY");
  const [liveSellingWorkspaceTab, setLiveSellingWorkspaceTab] = useState("DASHBOARD");

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

  function goToAuctions(filter = "ALL") {
    setNavigationFilter({ page: "auctions", value: filter });
    setPage("auctions");
  }

  function goToOrders(filter = "ALL") {
    setNavigationFilter({ page: "sales", value: filter, tab: "TRANSACTIONS", requestId: Date.now() });
    setPage("sales");
  }

  function goToPayments(filter = "ALL") {
    setNavigationFilter({ page: "payments", value: filter });
    setPage("payments");
  }

  function goToDeliveries(filter = "ALL") {
    setNavigationFilter({ page: "deliveries", value: filter });
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
            className={`nav-item ${["sales", "orders", "order-detail"].includes(page) ? "active" : ""}`}
            onClick={() => setPage("sales")}
          >
            Sales &amp; Orders
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
            icon="automation"
            className={`nav-item ${page === "automation-control" ? "active" : ""}`}
            onClick={() => navigateTo("automation-control")}
          >
            Automation Control
          </SidebarNavButton>

          <SidebarNavButton
            icon="chat"
            className={`nav-item ${page === "automated-messages" ? "active" : ""}`}
            onClick={() => navigateTo("automated-messages")}
          >
            Automated Messages
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

        {(page === "posts") && <PostsPage metaConnected={metaConnected} navigateTo={navigateTo} page={page} setRegularSaleWorkspaceTab={setRegularSaleWorkspaceTab} />}

        {(page === "regular-sale") && <RegularSalePage client={client} metaConnected={metaConnected} page={page} regularSaleWorkspaceTab={regularSaleWorkspaceTab} setRegularSaleWorkspaceTab={setRegularSaleWorkspaceTab} />}

        {metaConnected && page === "pre-order" && <PreorderPage client={client} navigateTo={navigateTo} />}

        {metaConnected && page === "facebook-post" && (
          <FacebookPostPage client={client} initialPostMode="AUCTION" />
        )}

        {page === "pre-order-create" && (
          <FacebookPostPage client={client} initialPostMode="PREORDER" />
        )}

        {page === "mining-create" && (
          <FacebookPostPage client={client} initialPostMode="MINING" />
        )}


        {(page === "live-selling") && <LiveSellingPage liveSellingWorkspaceTab={liveSellingWorkspaceTab} metaConnected={metaConnected} page={page} setLiveSellingWorkspaceTab={setLiveSellingWorkspaceTab} />}

        {(page === "facebook") && <FacebookPage client={client} facebookLoading={facebookLoading} facebookMessage={facebookMessage} facebookStatus={facebookStatus} loadFacebookStatus={loadFacebookStatus} page={page} setFacebookMessage={setFacebookMessage} setPage={setPage} />}

        {(page === "users-staff") && <StaffPage page={page} />}

        {(page === "reports") && <ReportsPage client={client} page={page} setErrorMessage={setErrorMessage} />}

        {(page === "automation-control") && <AutomationControlPage client={client} page={page} />}

        {(page === "post-mining") && <MiningPage client={client} metaConnected={metaConnected} miningWorkspaceTab={miningWorkspaceTab} navigateTo={navigateTo} page={page} setMiningWorkspaceTab={setMiningWorkspaceTab} />}

        {(page === "dashboard") && <DashboardPage client={client} facebookStatus={facebookStatus} goToAuctions={goToAuctions} goToDeliveries={goToDeliveries} goToOrders={goToOrders} goToPayments={goToPayments} navigateTo={navigateTo} onboardingChecked={onboardingChecked} openDelivery={openDelivery} openFacebookSetup={openFacebookSetup} page={page} paymentAccountLoading={paymentAccountLoading} paymentAccountMessage={paymentAccountMessage} paymentAccountStatus={paymentAccountStatus} setErrorMessage={setErrorMessage} setPage={setPage} />}

        {(page === "auctions" || page === "auction-detail") && <AuctionPage navigationFilter={navigationFilter} auctionWorkspaceTab={auctionWorkspaceTab} client={client} detailRequest={detailRequest} navigateTo={navigateTo} page={page} setAuctionWorkspaceTab={setAuctionWorkspaceTab} setErrorMessage={setErrorMessage} setPage={setPage} />}

        {page === "inventory" && (
          <InventoryPage client={client} />
        )}

        {page === "sales" && (
          <SalesPage client={client} navigationFilter={navigationFilter} />
        )}

        {(page === "purchases") && <PurchasesPage client={client} />}

        {(page === "order-detail") && <OrdersPage navigationFilter={navigationFilter} client={client} detailRequest={detailRequest} page={page} setErrorMessage={setErrorMessage} setPage={(next) => setPage(next === "orders" ? "sales" : next)} />}

        {(page === "payments" || page === "payment-detail") && <PaymentsPage navigationFilter={navigationFilter} client={client} detailRequest={detailRequest} page={page} paymentAccountStatus={paymentAccountStatus} setErrorMessage={setErrorMessage} setPage={setPage} />}

        {page === "payment-settings" && (
          <PaymentMethodsSettings clientId={client?.client_id} onChanged={loadPortal} />
        )}

        {page === "automated-messages" && (
          <AutomatedMessagesPage client={client} />
        )}

        {page === "account-security" && (
          <AccountSecurityPage session={session} />
        )}

        {page === "setup" && (
          <SetupPage client={client} />
        )}

        {(page === "deliveries" || page === "delivery-detail") && <DeliveriesPage navigationFilter={navigationFilter} client={client} detailRequest={detailRequest} goToDeliveries={goToDeliveries} page={page} setErrorMessage={setErrorMessage} setPage={setPage} />}

      </main>
      <FloatingMetaMessenger clientId={client?.client_id} />
    </div>
  );
}
