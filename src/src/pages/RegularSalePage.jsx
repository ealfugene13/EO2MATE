import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import FacebookPostPage from "./FacebookPostPage";

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

export default function RegularSalePage({ client, metaConnected, page, regularSaleWorkspaceTab, setRegularSaleWorkspaceTab }) {
  const [sellingPostRows, setSellingPostRows] = useState({ REGULAR_SALE: [], MINING: [] });

  const [sellingPostLoading, setSellingPostLoading] = useState(false);

  const [sellingPostError, setSellingPostError] = useState("");

  const [sellingPostDetail, setSellingPostDetail] = useState(null);

  const [sellingPostDetailLoading, setSellingPostDetailLoading] = useState(false);

  const [sellingPostDetailError, setSellingPostDetailError] = useState("");

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
  return (<>
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
  </>);
}
