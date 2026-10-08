import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import "./ReportsPage.css";


function ReportIcon({type="sales-summary"}) {
  const shapes={
    excel:<><path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 11l5 6m0-6-5 6"/></>,
    pdf:<><path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/></>,
    clear:<><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/></>,
    generate:<><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 17v-3m4 3v-6m4 6v-4"/></>,
    "sales-summary":<><path d="M4 20V10m5 10V4m5 16v-7m5 7V8M2 20h20"/></>,
    "auction-performance":<><path d="m14 3 7 7-4 4-7-7 4-4ZM5 12l7 7-4 4-7-7 4-4ZM8 15l5-5M13 21h9"/></>,
    "post-mining-performance":<><path d="M4 3h16v15H9l-5 4V3ZM8 8h8M8 12h5"/></>,
    "payment-collection":<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    "order-fulfillment":<><path d="M3 5h11v12H3zM14 10h4l3 4v3h-7M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></>,
    "inventory-movement":<><path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10"/></>,
    "buyer-analysis":<><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 6"/></>,
    "facebook-page-performance":<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M14 7h-2a2 2 0 0 0-2 2v12M8 12h7"/></>,
    opportunity:<><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 4H9l-1-4Z"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[type] || shapes["sales-summary"]}</svg>;
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
      <div className="metric-title report-metric-title"><ReportIcon/>{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </button>
  );
}

export default function ReportsPage({ client, page, setErrorMessage }) {
  const [auctions, setAuctions] = useState([]);

  const [orders, setOrders] = useState([]);

  const [payments, setPayments] = useState([]);

  const [deliveries, setDeliveries] = useState([]);

  const [automationPages, setAutomationPages] = useState([]);

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

  const [sellingPostRows, setSellingPostRows] = useState({ REGULAR_SALE: [], MINING: [] });

  const [sellingPostLoading, setSellingPostLoading] = useState(false);

  const [sellingPostError, setSellingPostError] = useState("");

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
    setGeneratedReport(null);
    setReportGeneratedAt(null);
    setReportMessage("");
  }, [selectedReport, reportDateRange, reportCustomFrom, reportCustomTo, reportPageFilter, reportChannelFilter, reportStatusFilter, reportSortBy]);

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
  return (<div className="reports-workspace">
    {page === "reports" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">REPORTS · INSIGHTS</p>
                <h1>Reports &amp; Insights</h1>
                <p>Operational reports plus EO2MATE insights designed to help clients decide what to sell, collect and improve next.</p>
              </div>
              <div className="report-export-actions">
                <button className="secondary-button report-icon-action" type="button" aria-label="Generate Excel" title="Export report to Excel" onClick={exportReportExcel} disabled={!generatedReport}><ReportIcon type="excel"/><span>Excel</span></button>
                <button className="secondary-button report-icon-action" type="button" aria-label="Generate PDF" title="Print report or save as PDF" onClick={printReport} disabled={!generatedReport}><ReportIcon type="pdf"/><span>PDF</span></button>
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
                  <button className="secondary-button report-icon-action" type="button" aria-label="Clear Filters" onClick={() => { setSelectedReport(""); setReportDateRange(""); setReportCustomFrom(""); setReportCustomTo(""); setReportPageFilter(""); setReportChannelFilter(""); setReportStatusFilter(""); setReportSortBy(""); setGeneratedReport(null); setReportMessage(""); }}><ReportIcon type="clear"/><span>Clear Filters</span></button>
                  <button className="primary-button report-icon-action" type="submit"><ReportIcon type="generate"/><span>Generate Report</span></button>
                </div>
              </form>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
              {REPORT_CATALOG.map((report) => (
                <button
                  key={report.key}
                  className="report-catalog-button"
                  aria-pressed={report.key === selectedReport}
                  type="button"
                  onClick={() => setSelectedReport(report.key)}
                  style={{
                    border: report.key === selectedReport ? "2px solid #2ea84a" : "1px solid #e3e9ef",
                    background: report.featured ? "linear-gradient(135deg, #f1fff4 0%, #ffffff 65%)" : "#ffffff",
                    borderRadius: 14,
                    padding: 18,
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: report.key === selectedReport ? "0 8px 24px rgba(46,168,74,.10)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span className="report-card-title"><span className="report-card-icon"><ReportIcon type={report.key}/></span><strong style={{ color: "#1e2d3d" }}>{report.title}</strong></span>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: report.featured ? "#20833a" : "#718096" }}>{report.featured ? "EO2MATE" : report.group.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "#607083" }}>{report.description}</div>
                </button>
              ))}
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
  </div>);
}
