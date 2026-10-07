import { useEffect, useMemo, useRef, useState } from "react";
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

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

export default function PaymentsPage({ client, detailRequest, page, paymentAccountStatus, setErrorMessage, setPage, navigationFilter }) {
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  useEffect(() => { if (navigationFilter?.page === "payments") { setPaymentStatusFilter(navigationFilter.value); setPaymentSearch(""); } }, [navigationFilter]);
  const [payments, setPayments] = useState([]);

  const [paymentGroups, setPaymentGroups] = useState([]);

  const [detailLoading, setDetailLoading] = useState(false);

  const [paymentDetail, setPaymentDetail] = useState(null);

  const [paymentGroupSearch, setPaymentGroupSearch] = useState("");

  const [paymentGroupStatusFilter, setPaymentGroupStatusFilter] = useState("ALL");

  const [reopenGroup, setReopenGroup] = useState(null);

  const [reopenHours, setReopenHours] = useState("24");

  const [reopenReason, setReopenReason] = useState("");

  const [reopenLoading, setReopenLoading] = useState(false);

  const [reopenMessage, setReopenMessage] = useState("");

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


  const [pageDataLoading, setPageDataLoading] = useState(true);
  const pageLoadVersion = useRef(0);
  async function loadPortal() {
    if (!client?.client_id) return;
    const version = ++pageLoadVersion.current;
    setPageDataLoading(true);
    setErrorMessage("");
    try {
      const results = await Promise.all([
        supabase.from("client_payment_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false }),
        supabase.from("order_groups").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false })
      ]);
      if (version !== pageLoadVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setPayments(results[0].data || []);
      setPaymentGroups(results[1].data || []);
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id]);

  useEffect(() => { if (detailRequest?.kind === "payment" && page === "payment-detail") openPayment(detailRequest.id); }, [detailRequest]);
  if (pageDataLoading) return <div className="loading-card"><h2>Loading page</h2></div>;
  return (<>
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
  </>);
}
