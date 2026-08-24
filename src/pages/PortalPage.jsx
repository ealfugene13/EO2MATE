import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

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

function statusLabel(value) {
  return String(value || "-").replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  let className = "status-badge";

  if (
    ["ACTIVE", "PAID", "READY_FOR_DELIVERY", "DELIVERED", "COMPLETED", "VALID"].includes(normalized)
  ) {
    className += " status-active";
  } else if (normalized === "COMPLETED_WITH_WINNER") {
    className += " status-success";
  } else if (
    ["PAYMENT_PENDING", "PENDING", "AWAITING_FINALIZER", "SHIPPED"].includes(normalized)
  ) {
    className += " status-warning";
  } else if (
    ["CANCELLED", "FAILED", "EXPIRED", "REFUNDED", "INVALID"].includes(normalized)
  ) {
    className += " status-danger";
  } else {
    className += " status-muted";
  }

  return (
    <span className={className}>
      {statusLabel(normalized)}
    </span>
  );
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

  const [auctions, setAuctions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);

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

  useEffect(() => {
    loadPortal();
  }, []);

  async function loadPortal() {
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
      if (!clientUser) {
        throw new Error("Your login is not mapped to an active client.");
      }

      const { data: clientData, error: clientError } = await supabase
        .from("master_clients")
        .select("client_id, name, status, created_at")
        .eq("client_id", clientUser.client_id)
        .maybeSingle();

      if (clientError) throw clientError;

      setClient({
        ...clientData,
        role: clientUser.role,
      });

      const [
        auctionResult,
        orderResult,
        paymentResult,
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
      ]);

      if (auctionResult.error) throw auctionResult.error;
      if (orderResult.error) throw orderResult.error;
      if (paymentResult.error) throw paymentResult.error;

      setAuctions(auctionResult.data || []);
      setOrders(orderResult.data || []);
      setPayments(paymentResult.data || []);
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

  const auctionMetrics = useMemo(() => ({
    active: auctions.filter((a) => a.ui_status === "ACTIVE").length,
    completed: auctions.filter((a) => a.ui_status === "COMPLETED_WITH_WINNER").length,
  }), [auctions]);

  const orderMetrics = useMemo(() => ({
    pending: orders.filter((o) => o.order_status === "PAYMENT_PENDING").length,
    paid: orders.filter((o) => o.order_status === "PAID").length,
    value: orders.reduce((total, o) => total + Number(o.total_amount || 0), 0),
  }), [orders]);

  const paymentMetrics = useMemo(() => ({
    pending: payments.filter(
      (p) => String(p.payment_status || "").toLowerCase() === "pending"
    ).length,

    paid: payments.filter(
      (p) => String(p.payment_status || "").toLowerCase() === "paid"
    ).length,

    paidValue: payments
      .filter((p) => String(p.payment_status || "").toLowerCase() === "paid")
      .reduce((total, p) => total + Number(p.amount || 0), 0),
  }), [payments]);

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
        order.latest_payment_status,
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
        payment.checkout_session_id,
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

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <h2>Loading dashboard</h2>
          <p>Retrieving auction, order and payment data...</p>
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
          <button
            className={`nav-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => setPage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={`nav-item ${page.includes("auction") ? "active" : ""}`}
            onClick={() => goToAuctions("ALL")}
          >
            Auctions
          </button>

          <button
            className={`nav-item ${page.includes("order") ? "active" : ""}`}
            onClick={() => goToOrders("ALL")}
          >
            Orders
          </button>

          <button
            className={`nav-item ${page.includes("payment") ? "active" : ""}`}
            onClick={() => goToPayments("ALL")}
          >
            Payments
          </button>

          <button className="nav-item" disabled>
            Delivery
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

        {page === "dashboard" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">CLIENT DASHBOARD</p>
                <h1>
                  {client?.name
                    ? `Welcome, ${client.name}`
                    : "Dashboard"}
                </h1>
                <p>
                  Monitor auctions, orders and payment progress.
                </p>
              </div>

              <button
                className="secondary-button"
                onClick={loadPortal}
              >
                Refresh
              </button>
            </header>

            <section className="metrics-grid">
              <MetricCard
                title="Active auctions"
                value={auctionMetrics.active}
                subtitle="Currently open"
                onClick={() => goToAuctions("ACTIVE")}
              />

              <MetricCard
                title="Pending orders"
                value={orderMetrics.pending}
                subtitle="Awaiting payment"
                onClick={() => goToOrders("PAYMENT_PENDING")}
              />

              <MetricCard
                title="Pending payments"
                value={paymentMetrics.pending}
                subtitle="PayMongo pending"
                onClick={() => goToPayments("pending")}
              />

              <MetricCard
                title="Paid payments"
                value={paymentMetrics.paid}
                subtitle="Payment confirmed"
                onClick={() => goToPayments("paid")}
              />

              <MetricCard
                title="Paid value"
                value={formatCurrency(paymentMetrics.paidValue)}
                subtitle="Confirmed payments"
                onClick={() => goToPayments("paid")}
              />
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Recent payments</h2>
                  <p>Latest PayMongo payment activity.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => goToPayments("ALL")}
                >
                  View all
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Item</th>
                      <th>Buyer</th>
                      <th>Amount</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.slice(0, 10).map((payment) => (
                      <tr
                        key={payment.payment_id}
                        className="clickable-row"
                        onClick={() => openPayment(payment.payment_id)}
                      >
                        <td>{payment.order_number}</td>
                        <td>{payment.item_label}</td>
                        <td>{payment.buyer_name || "-"}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.provider || "-"}</td>
                        <td>
                          <StatusBadge status={payment.payment_status} />
                        </td>
                        <td>{formatDateTime(payment.created_at)}</td>
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

              <button className="secondary-button" onClick={loadPortal}>
                Refresh
              </button>
            </header>

            <section className="toolbar-card">
              <input
                className="search-input"
                value={auctionSearch}
                onChange={(event) => setAuctionSearch(event.target.value)}
                placeholder="Search auctions..."
              />

              <select
                className="filter-select"
                value={auctionStatusFilter}
                onChange={(event) =>
                  setAuctionStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED_WITH_WINNER">
                  Completed with winner
                </option>
                <option value="CLOSED_NO_WINNER">
                  Closed no winner
                </option>
                <option value="AWAITING_FINALIZER">
                  Awaiting finalizer
                </option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Auction list</h2>
                  <p>{filteredAuctions.length} record(s)</p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Status</th>
                      <th>Highest bid</th>
                      <th>Bidder</th>
                      <th>Valid bidders</th>
                      <th>Ends</th>
                      <th>Payment</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAuctions.map((auction) => (
                      <tr
                        key={auction.auction_item_id}
                        className="clickable-row"
                        onClick={() =>
                          openAuction(auction.auction_item_id)
                        }
                      >
                        <td>{auction.item_label}</td>
                        <td>
                          <StatusBadge status={auction.ui_status} />
                        </td>
                        <td>{formatCurrency(auction.highest_bid)}</td>
                        <td>{auction.highest_bidder_name || "-"}</td>
                        <td>
                          {auction.valid_bidder_count}/
                          {auction.min_bidder_count}
                        </td>
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
                <p>
                  Track winner orders from payment pending to completion.
                </p>
              </div>

              <button className="secondary-button" onClick={loadPortal}>
                Refresh
              </button>
            </header>

            <section className="toolbar-card">
              <input
                className="search-input"
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Search order, item or buyer..."
              />

              <select
                className="filter-select"
                value={orderStatusFilter}
                onChange={(event) =>
                  setOrderStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="PAYMENT_PENDING">Payment pending</option>
                <option value="PAID">Paid</option>
                <option value="READY_FOR_DELIVERY">
                  Ready for delivery
                </option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Order list</h2>
                  <p>{filteredOrders.length} record(s)</p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Item</th>
                      <th>Buyer</th>
                      <th>Total</th>
                      <th>Order status</th>
                      <th>Payment</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.order_id}
                        className="clickable-row"
                        onClick={() => openOrder(order.order_id)}
                      >
                        <td>{order.order_number}</td>
                        <td>{order.item_label}</td>
                        <td>{order.buyer_name || "-"}</td>
                        <td>{formatCurrency(order.total_amount)}</td>
                        <td>
                          <StatusBadge status={order.order_status} />
                        </td>
                        <td>
                          <StatusBadge
                            status={
                              order.latest_payment_status ||
                              order.payment_status
                            }
                          />
                        </td>
                        <td>{formatDateTime(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {page === "payments" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">PAYMENT MANAGEMENT</p>
                <h1>Payments</h1>
                <p>
                  Monitor PayMongo transactions and settlement status.
                </p>
              </div>

              <button className="secondary-button" onClick={loadPortal}>
                Refresh
              </button>
            </header>

            <section className="metrics-grid compact-metrics">
              <MetricCard
                title="Pending"
                value={paymentMetrics.pending}
                subtitle="Awaiting payment"
                onClick={() => goToPayments("pending")}
              />

              <MetricCard
                title="Paid"
                value={paymentMetrics.paid}
                subtitle="Confirmed"
                onClick={() => goToPayments("paid")}
              />

              <MetricCard
                title="Paid value"
                value={formatCurrency(paymentMetrics.paidValue)}
                subtitle="Confirmed amount"
                onClick={() => goToPayments("paid")}
              />
            </section>

            <section className="toolbar-card">
              <input
                className="search-input"
                value={paymentSearch}
                onChange={(event) =>
                  setPaymentSearch(event.target.value)
                }
                placeholder="Search order, item, buyer, reference or session..."
              />

              <select
                className="filter-select"
                value={paymentStatusFilter}
                onChange={(event) =>
                  setPaymentStatusFilter(event.target.value)
                }
              >
                <option value="ALL">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="refunded">Refunded</option>
              </select>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Payment list</h2>
                  <p>{filteredPayments.length} record(s)</p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Item</th>
                      <th>Buyer</th>
                      <th>Amount</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Paid at</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr
                        key={payment.payment_id}
                        className="clickable-row"
                        onClick={() =>
                          openPayment(payment.payment_id)
                        }
                      >
                        <td>{payment.order_number}</td>
                        <td>{payment.item_label}</td>
                        <td>{payment.buyer_name || "-"}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.provider || "-"}</td>
                        <td>
                          <StatusBadge status={payment.payment_status} />
                        </td>
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

        {page === "auction-detail" && (
          <>
            <button
              className="back-button"
              onClick={() => setPage("auctions")}
            >
              ← Back to auctions
            </button>

            {detailLoading ? (
              <div className="loading-card detail-loading">
                <h2>Loading auction</h2>
              </div>
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
                    <div className="detail-card-header">
                      <h2>Rules</h2>
                    </div>

                    <DetailRow
                      label="Minimum bid"
                      value={formatCurrency(auctionDetail.min_bid)}
                    />
                    <DetailRow
                      label="Increment"
                      value={formatCurrency(auctionDetail.bid_increment)}
                    />
                    <DetailRow
                      label="Minimum bidders"
                      value={auctionDetail.min_bidder_count}
                    />
                    <DetailRow
                      label="Buyout"
                      value={formatCurrency(auctionDetail.bid_buyout_amt)}
                    />
                    <DetailRow
                      label="Auction ends"
                      value={formatDateTime(auctionDetail.auction_end_dt)}
                    />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header">
                      <h2>Result</h2>
                    </div>

                    <DetailRow
                      label="Highest bid"
                      value={formatCurrency(auctionDetail.highest_bid)}
                    />
                    <DetailRow
                      label="Highest bidder"
                      value={auctionDetail.highest_bidder_name || "-"}
                    />
                    <DetailRow
                      label="Valid bidders"
                      value={auctionDetail.valid_bidder_count}
                    />
                    <DetailRow
                      label="Winner amount"
                      value={formatCurrency(auctionDetail.winning_amt)}
                    />
                    <DetailRow
                      label="Winner status"
                      value={auctionDetail.winner_status || "-"}
                    />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header">
                      <h2>Payment</h2>
                    </div>

                    <DetailRow
                      label="Payment status"
                      value={auctionDetail.payment_status || "-"}
                    />
                    <DetailRow
                      label="Payment amount"
                      value={formatCurrency(auctionDetail.payment_amount)}
                    />
                    <DetailRow
                      label="Winner declared"
                      value={formatDateTime(auctionDetail.won_at)}
                    />
                  </div>
                </section>

                <section className="dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Bid history</h2>
                      <p>Captured comments and validation remarks.</p>
                    </div>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Bidder</th>
                          <th>Comment</th>
                          <th>Bid</th>
                          <th>Valid</th>
                          <th>Reason</th>
                          <th>Time</th>
                        </tr>
                      </thead>

                      <tbody>
                        {bidHistory.map((bid) => (
                          <tr key={bid.bid_id}>
                            <td>{bid.fb_user_name || "-"}</td>
                            <td>{bid.comment_text || "-"}</td>
                            <td>{formatCurrency(bid.bid_amt)}</td>
                            <td>
                              <StatusBadge
                                status={bid.is_valid ? "VALID" : "INVALID"}
                              />
                            </td>
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
            <button
              className="back-button"
              onClick={() => setPage("orders")}
            >
              ← Back to orders
            </button>

            {detailLoading ? (
              <div className="loading-card detail-loading">
                <h2>Loading order</h2>
              </div>
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
                    <div className="detail-card-header">
                      <h2>Order</h2>
                    </div>

                    <DetailRow label="Source" value={orderDetail.source_type} />
                    <DetailRow
                      label="Subtotal"
                      value={formatCurrency(orderDetail.subtotal)}
                    />
                    <DetailRow
                      label="Shipping fee"
                      value={formatCurrency(orderDetail.shipping_fee)}
                    />
                    <DetailRow
                      label="Total"
                      value={formatCurrency(orderDetail.total_amount)}
                    />
                    <DetailRow
                      label="Created"
                      value={formatDateTime(orderDetail.created_at)}
                    />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header">
                      <h2>Buyer</h2>
                    </div>

                    <DetailRow
                      label="Name"
                      value={
                        orderDetail.buyer_name ||
                        orderDetail.winning_bidder_name ||
                        "-"
                      }
                    />
                    <DetailRow
                      label="Facebook user ID"
                      value={
                        orderDetail.buyer_fb_user_id ||
                        orderDetail.winning_bidder_id ||
                        "-"
                      }
                    />
                    <DetailRow
                      label="Phone"
                      value={orderDetail.buyer_phone || "-"}
                    />
                    <DetailRow
                      label="Email"
                      value={orderDetail.buyer_email || "-"}
                    />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header">
                      <h2>Payment</h2>
                    </div>

                    <DetailRow
                      label="Status"
                      value={
                        orderDetail.latest_payment_status ||
                        orderDetail.payment_status ||
                        "-"
                      }
                    />
                    <DetailRow
                      label="Provider"
                      value={orderDetail.provider || "-"}
                    />
                    <DetailRow
                      label="Amount"
                      value={formatCurrency(orderDetail.payment_amount)}
                    />
                    <DetailRow
                      label="Reference"
                      value={orderDetail.payment_reference || "-"}
                    />
                    <DetailRow
                      label="Paid at"
                      value={formatDateTime(
                        orderDetail.payment_paid_at ||
                        orderDetail.paid_at
                      )}
                    />
                  </div>
                </section>

                <section className="detail-card">
                  <div className="detail-card-header">
                    <h2>Shipping</h2>
                  </div>

                  <DetailRow
                    label="Recipient"
                    value={orderDetail.shipping_name || "-"}
                  />
                  <DetailRow
                    label="Phone"
                    value={orderDetail.shipping_phone || "-"}
                  />
                  <DetailRow
                    label="Address 1"
                    value={orderDetail.shipping_address_line1 || "-"}
                  />
                  <DetailRow
                    label="Address 2"
                    value={orderDetail.shipping_address_line2 || "-"}
                  />
                  <DetailRow
                    label="City"
                    value={orderDetail.shipping_city || "-"}
                  />
                  <DetailRow
                    label="Province"
                    value={orderDetail.shipping_province || "-"}
                  />
                  <DetailRow
                    label="Postal code"
                    value={orderDetail.shipping_postal_code || "-"}
                  />
                  <DetailRow
                    label="Country"
                    value={orderDetail.shipping_country || "-"}
                  />
                </section>
              </>
            ) : null}
          </>
        )}

        {page === "payment-detail" && (
          <>
            <button
              className="back-button"
              onClick={() => setPage("payments")}
            >
              ← Back to payments
            </button>

            {detailLoading ? (
              <div className="loading-card detail-loading">
                <h2>Loading payment</h2>
              </div>
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
                    <div className="detail-card-header">
                      <h2>Payment</h2>
                    </div>

                    <DetailRow
                      label="Payment ID"
                      value={paymentDetail.payment_id}
                    />
                    <DetailRow
                      label="Provider"
                      value={paymentDetail.provider || "-"}
                    />
                    <DetailRow
                      label="Amount"
                      value={formatCurrency(paymentDetail.amount)}
                    />
                    <DetailRow
                      label="Currency"
                      value={paymentDetail.currency || "PHP"}
                    />
                    <DetailRow
                      label="Status"
                      value={paymentDetail.payment_status || "-"}
                    />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header">
                      <h2>PayMongo</h2>
                    </div>

                    <DetailRow
                      label="Checkout session"
                      value={paymentDetail.checkout_session_id || "-"}
                    />
                    <DetailRow
                      label="Reference"
                      value={paymentDetail.payment_reference || "-"}
                    />
                    <DetailRow
                      label="Paid at"
                      value={formatDateTime(paymentDetail.paid_at)}
                    />
                    <DetailRow
                      label="Created"
                      value={formatDateTime(paymentDetail.created_at)}
                    />
                    <DetailRow
                      label="Updated"
                      value={formatDateTime(paymentDetail.updated_at)}
                    />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header">
                      <h2>Related order</h2>
                    </div>

                    <DetailRow
                      label="Order number"
                      value={paymentDetail.order_number}
                    />
                    <DetailRow
                      label="Order status"
                      value={paymentDetail.order_status}
                    />
                    <DetailRow
                      label="Buyer"
                      value={paymentDetail.buyer_name || "-"}
                    />
                    <DetailRow
                      label="Winning amount"
                      value={formatCurrency(paymentDetail.winning_amt)}
                    />
                    <DetailRow
                      label="Won at"
                      value={formatDateTime(paymentDetail.won_at)}
                    />
                  </div>
                </section>

                <section className="action-card">
                  <div>
                    <h2>Checkout</h2>
                    <p>
                      Open the PayMongo checkout page for this payment when a checkout URL is available.
                    </p>
                  </div>

                  {paymentDetail.checkout_url ? (
                    <a
                      className="primary-link-button"
                      href={paymentDetail.checkout_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PayMongo Checkout
                    </a>
                  ) : (
                    <span className="muted-text">
                      No checkout URL available
                    </span>
                  )}
                </section>
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
