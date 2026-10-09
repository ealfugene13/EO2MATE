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

export default function DashboardPage({ client, facebookStatus, goToAuctions, goToDeliveries, goToOrders, goToPayments, navigateTo, onboardingChecked, openDelivery, openFacebookSetup, page, paymentAccountLoading, paymentAccountMessage, paymentAccountStatus, setErrorMessage, setPage }) {
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
      setAuctions(results[0].data || []);
      setOrders(results[1].data || []);
      setPayments(results[2].data || []);
      setDeliveries(results[3].data || []);
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id]);
  if (pageDataLoading) return <div className="loading-card"><h2>Loading page</h2></div>;
  return (<>
    {page === "dashboard" && (
          <>
            <section className="eo2-dashboard-welcome">
              <div className="eo2-dashboard-welcome-copy">
                <div className="eo2-dashboard-kicker"><span className="eo2-dashboard-kicker-dot" /> YOUR EO2MATE WORKSPACE</div>
                <h1>{client?.name ? `Welcome, ${client.name}` : "Business overview"}</h1>
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
