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

export default function AuctionPage({ auctionWorkspaceTab, client, detailRequest, navigateTo, page, setAuctionWorkspaceTab, setErrorMessage, setPage, navigationFilter }) {
  const [auctionSearch, setAuctionSearch] = useState("");
  const [auctionStatusFilter, setAuctionStatusFilter] = useState("ALL");
  useEffect(() => { if (navigationFilter?.page === "auctions") { setAuctionStatusFilter(navigationFilter.value); setAuctionSearch(""); } }, [navigationFilter]);
  const [auctions, setAuctions] = useState([]);

  const [auctionBids, setAuctionBids] = useState([]);

  const [detailLoading, setDetailLoading] = useState(false);

  const [auctionDetail, setAuctionDetail] = useState(null);

  const [bidHistory, setBidHistory] = useState([]);

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
        supabase.from("client_auction_bid_history").select("*").eq("client_id", client.client_id).order("commented_at", { ascending: false })
      ]);
      if (version !== pageLoadVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setAuctions(results[0].data || []);
      setAuctionBids(results[1].data || []);
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id]);

  useEffect(() => { if (detailRequest?.kind === "auction" && page === "auction-detail") openAuction(detailRequest.id); }, [detailRequest]);
  if (pageDataLoading) return <div className="loading-card"><h2>Loading page</h2></div>;
  return (<>
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
  </>);
}
