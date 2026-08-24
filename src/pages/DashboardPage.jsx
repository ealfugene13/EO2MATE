import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

function formatCurrency(value) {
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

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  let className = "status-badge";

  if (normalized === "ACTIVE") className += " status-active";
  else if (normalized === "COMPLETED_WITH_WINNER") className += " status-success";
  else if (normalized === "CLOSED_NO_WINNER") className += " status-muted";
  else if (normalized === "AWAITING_FINALIZER") className += " status-warning";

  return <span className={className}>{normalized.replaceAll("_", " ")}</span>;
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </div>
  );
}

export default function DashboardPage({ session }) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [client, setClient] = useState(null);
  const [auctions, setAuctions] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: clientUser, error: clientUserError } = await supabase
        .from("client_users")
        .select("client_id, role, status")
        .eq("user_id", session.user.id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (clientUserError) throw clientUserError;
      if (!clientUser) throw new Error("Your login is not mapped to an active client.");

      const { data: clientData, error: clientError } = await supabase
        .from("master_clients")
        .select("client_id, name, status, created_at")
        .eq("client_id", clientUser.client_id)
        .maybeSingle();

      if (clientError) throw clientError;

      setClient({ ...clientData, role: clientUser.role });

      const { data: auctionData, error: auctionError } = await supabase
        .from("client_auction_dashboard")
        .select("*")
        .order("post_created_at", { ascending: false });

      if (auctionError) throw auctionError;

      setAuctions(auctionData || []);
    } catch (error) {
      setErrorMessage(error.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const active = auctions.filter((a) => a.ui_status === "ACTIVE").length;
    const completed = auctions.filter((a) => a.ui_status === "COMPLETED_WITH_WINNER").length;
    const noWinner = auctions.filter((a) => a.ui_status === "CLOSED_NO_WINNER").length;
    const pendingPayments = auctions.filter(
      (a) => String(a.payment_status || "").toLowerCase() === "pending"
    ).length;
    const totalWinningAmount = auctions.reduce(
      (total, a) => total + Number(a.winning_amt || 0),
      0
    );

    return { active, completed, noWinner, pendingPayments, totalWinningAmount };
  }, [auctions]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <h2>Loading dashboard</h2>
          <p>Retrieving auction data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo small">A</div>
          <div>
            <strong>Auction Automation</strong>
            <span>Client Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item" disabled>Auctions</button>
          <button className="nav-item" disabled>Payments</button>
          <button className="nav-item" disabled>Facebook</button>
          <button className="nav-item" disabled>Reports</button>
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
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">CLIENT DASHBOARD</p>
            <h1>{client?.name ? `Welcome, ${client.name}` : "Dashboard"}</h1>
            <p>Monitor auctions, winners and payments.</p>
          </div>

          <button className="secondary-button" onClick={loadDashboard}>
            Refresh
          </button>
        </header>

        {errorMessage && <div className="dashboard-error">{errorMessage}</div>}

        <section className="metrics-grid">
          <MetricCard title="Active auctions" value={metrics.active} subtitle="Currently open" />
          <MetricCard title="Completed" value={metrics.completed} subtitle="With winner" />
          <MetricCard title="No winner" value={metrics.noWinner} subtitle="Closed auctions" />
          <MetricCard title="Pending payments" value={metrics.pendingPayments} subtitle="Awaiting payment" />
          <MetricCard
            title="Winning value"
            value={formatCurrency(metrics.totalWinningAmount)}
            subtitle="Total winning amount"
          />
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>Recent auctions</h2>
              <p>Latest auction activity.</p>
            </div>

            <span className="record-count">{auctions.length} records</span>
          </div>

          {auctions.length === 0 ? (
            <div className="empty-state">
              <h3>No auctions yet</h3>
              <p>Auction activity will appear here.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Highest bid</th>
                    <th>Highest bidder</th>
                    <th>Valid bidders</th>
                    <th>Ends</th>
                    <th>Payment</th>
                  </tr>
                </thead>

                <tbody>
                  {auctions.slice(0, 10).map((auction) => (
                    <tr key={auction.auction_item_id}>
                      <td>
                        <div className="item-cell">
                          <strong>{auction.item_label}</strong>
                          <span>{auction.post_type || "-"}</span>
                        </div>
                      </td>

                      <td>
                        <StatusBadge status={auction.ui_status} />
                      </td>

                      <td>
                        {auction.highest_bid
                          ? formatCurrency(auction.highest_bid)
                          : "-"}
                      </td>

                      <td>{auction.highest_bidder_name || "-"}</td>

                      <td>
                        <div className="bidder-cell">
                          <span>
                            {auction.valid_bidder_count}/{auction.min_bidder_count}
                          </span>

                          {auction.minimum_bidder_reached ? (
                            <small className="qualified">Qualified</small>
                          ) : (
                            <small className="not-qualified">Not qualified</small>
                          )}
                        </div>
                      </td>

                      <td>{formatDateTime(auction.auction_end_dt)}</td>

                      <td>
                        {auction.payment_status ? (
                          <span
                            className={`payment-status payment-${String(
                              auction.payment_status
                            ).toLowerCase()}`}
                          >
                            {auction.payment_status}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
