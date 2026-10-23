import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import RecordPagination, { useRecordPagination } from "../components/RecordPagination";
import "./FacebookUsersPage.css";

const upper = (value) => String(value || "").toUpperCase();
const settled = (order) => ["PAID", "READY_FOR_DELIVERY", "SHIPPED", "DELIVERED", "COMPLETED"].includes(upper(order.payment_status)) || ["PAID", "READY_FOR_DELIVERY", "SHIPPED", "DELIVERED", "COMPLETED"].includes(upper(order.order_status));
const cancelled = (order) => ["CANCELLED", "CANCELED", "REFUNDED", "VOID"].includes(upper(order.payment_status)) || ["CANCELLED", "CANCELED"].includes(upper(order.order_status));
const formatDate = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "—";
const facebookProfileUrl = (id) => `https://www.facebook.com/${encodeURIComponent(id)}`;
const facebookPostUrl = (id) => `https://www.facebook.com/${encodeURIComponent(id)}`;

function Icon({ name }) {
  const paths = {
    refresh: <><path d="M20 5v6h-6M4 19v-6h6"/><path d="M6 8a7 7 0 0 1 12-1l2 4M4 13l2 4a7 7 0 0 0 12-1"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6"/></>,
    external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Metric({ label, value, hint }) {
  return <article className="fb-users-metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

export default function FacebookUsersPage({ client, selectedFbPageId, selectedFbPageName }) {
  const [activity, setActivity] = useState([]);
  const [bids, setBids] = useState([]);
  const [orders, setOrders] = useState([]);
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedUser, setExpandedUser] = useState(null);
  const [savingUser, setSavingUser] = useState(null);

  const load = useCallback(async () => {
    if (!client?.client_id || !selectedFbPageId) {
      setActivity([]); setBids([]); setOrders([]); setControls([]); setLoading(false); return;
    }
    setLoading(true); setError(""); setNotice("");
    try {
      const [activityResult, postResult, controlResult, allOrdersResult] = await Promise.all([
        supabase.from("eo2mate_fb_user_activity").select("activity_id,fb_post_id,fb_comment_id,fb_user_id,fb_user_name,comment_text,commented_at").eq("client_id", client.client_id).eq("fb_page_id", selectedFbPageId).order("commented_at", { ascending: false }).limit(5000),
        supabase.from("auction_posts").select("post_id,fb_post_id").eq("client_id", client.client_id).eq("fb_page_id", selectedFbPageId),
        supabase.from("eo2mate_fb_user_controls").select("fb_user_id,fb_user_name,is_blocked,block_reason,blocked_at,updated_at").eq("client_id", client.client_id).eq("fb_page_id", selectedFbPageId),
        supabase.from("orders").select("order_id,buyer_fb_user_id,buyer_name,order_status,payment_status,created_at,auction_item_id,order_group_id").eq("client_id", client.client_id).order("created_at", { ascending: false }).limit(5000),
      ]);
      for (const result of [activityResult, postResult, controlResult, allOrdersResult]) if (result.error) throw result.error;

      const postRows = postResult.data || [];
      const pagePostIds = new Set(postRows.map((row) => String(row.post_id)));
      const itemResult = pagePostIds.size
        ? await supabase.from("auction_items").select("auction_item_id").in("auction_post_id", [...pagePostIds])
        : { data: [], error: null };
      if (itemResult.error) throw itemResult.error;
      const itemIds = (itemResult.data || []).map((row) => String(row.auction_item_id));
      let pageBids = [];
      if (itemIds.length) {
        const bidsResult = await supabase.from("client_auction_bid_history").select("fb_post_id,fb_comment_id,fb_user_id,fb_user_name,comment_text,bid_amt,is_valid,invalid_reason,commented_at").eq("client_id", client.client_id).in("auction_item_id", itemIds).order("commented_at", { ascending: false }).limit(5000);
        if (bidsResult.error) throw bidsResult.error;
        pageBids = bidsResult.data || [];
      }
      const ordersRows = allOrdersResult.data || [];
      const orderItemIds = [...new Set(ordersRows.map((row) => row.auction_item_id).filter(Boolean).map(String))];
      const orderGroupIds = [...new Set(ordersRows.map((row) => row.order_group_id).filter(Boolean).map(String))];
      const [orderItemsResult, orderGroupsResult] = await Promise.all([
        orderItemIds.length ? supabase.from("auction_items").select("auction_item_id,auction_post_id").in("auction_item_id", orderItemIds) : Promise.resolve({ data: [], error: null }),
        orderGroupIds.length ? supabase.from("order_groups").select("order_group_id,fb_page_id").in("order_group_id", orderGroupIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (orderItemsResult.error) throw orderItemsResult.error;
      if (orderGroupsResult.error) throw orderGroupsResult.error;
      const itemPostById = new Map((orderItemsResult.data || []).map((row) => [String(row.auction_item_id), String(row.auction_post_id)]));
      const groupPageById = new Map((orderGroupsResult.data || []).map((row) => [String(row.order_group_id), String(row.fb_page_id || "")]));
      const pageOrders = ordersRows.filter((order) => {
        const postId = itemPostById.get(String(order.auction_item_id));
        return (postId && pagePostIds.has(postId)) || (order.order_group_id && groupPageById.get(String(order.order_group_id)) === String(selectedFbPageId));
      });
      setActivity(activityResult.data || []);
      setBids(pageBids);
      setOrders(pageOrders);
      setControls(controlResult.data || []);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load Facebook users.");
      setActivity([]); setBids([]); setOrders([]); setControls([]);
    } finally {
      setLoading(false);
    }
  }, [client?.client_id, selectedFbPageId]);

  useEffect(() => { load(); }, [load]);

  const users = useMemo(() => {
    const grouped = new Map();
    const controlByUser = new Map(controls.map((control) => [String(control.fb_user_id), control]));
    const ensure = (id, name) => {
      if (!id) return null;
      const key = String(id);
      if (!grouped.has(key)) grouped.set(key, { fb_user_id: key, fb_user_name: name || controlByUser.get(key)?.fb_user_name || "Facebook user", comments: [], validBidCount: 0, invalidBidCount: 0, validTransactions: 0, lastActivity: null, control: controlByUser.get(key) || null });
      const user = grouped.get(key);
      if (name && (!user.fb_user_name || user.fb_user_name === "Facebook user")) user.fb_user_name = name;
      return user;
    };
    for (const row of activity) {
      const user = ensure(row.fb_user_id, row.fb_user_name);
      if (!user) continue;
      user.comments.push({ ...row, kind: "COMMENT" });
      if (!user.lastActivity || new Date(row.commented_at) > new Date(user.lastActivity)) user.lastActivity = row.commented_at;
    }
    for (const row of bids) {
      const user = ensure(row.fb_user_id, row.fb_user_name);
      if (!user) continue;
      if (row.is_valid) user.validBidCount += 1;
      else user.invalidBidCount += 1;
      const existingCommentIndex = user.comments.findIndex((comment) => String(comment.fb_comment_id) === String(row.fb_comment_id));
      if (existingCommentIndex >= 0) user.comments[existingCommentIndex] = { ...user.comments[existingCommentIndex], ...row, kind: "BID" };
      else user.comments.push({ ...row, kind: "BID" });
      if (!user.lastActivity || new Date(row.commented_at) > new Date(user.lastActivity)) user.lastActivity = row.commented_at;
    }
    for (const row of orders) {
      const user = ensure(row.buyer_fb_user_id, row.buyer_name);
      if (!user || cancelled(row)) continue;
      if (settled(row)) user.validTransactions += 1;
      if (!user.lastActivity || new Date(row.created_at) > new Date(user.lastActivity)) user.lastActivity = row.created_at;
    }
    for (const control of controls) {
      const user = ensure(control.fb_user_id, control.fb_user_name);
      if (user) user.control = control;
    }
    return [...grouped.values()].map((user) => ({ ...user, comments: user.comments.sort((a, b) => new Date(b.commented_at || 0) - new Date(a.commented_at || 0)) })).sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
  }, [activity, bids, controls, orders]);

  const visibleUsers = useMemo(() => users.filter((user) => {
    const isBlocked = user.control?.is_blocked === true;
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "BLOCKED" ? isBlocked : !isBlocked);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${user.fb_user_name} ${user.fb_user_id} ${user.comments.slice(0, 30).map((comment) => comment.comment_text || "").join(" ")}`.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  }), [users, statusFilter, search]);
  const pagination = useRecordPagination(visibleUsers, `${search}|${statusFilter}|${selectedFbPageId || ""}`);
  const displayUsers = pagination.visibleRecords;
  const blockedCount = users.filter((user) => user.control?.is_blocked === true).length;
  const validTransactionCount = users.reduce((sum, user) => sum + user.validTransactions, 0);
  const canManageBlocks = ["OWNER", "ADMIN"].includes(upper(client?.role));

  async function toggleBlocked(user) {
    if (!client?.client_id || !selectedFbPageId || !user?.fb_user_id || savingUser) return;
    const willBlock = user.control?.is_blocked !== true;
    const confirmed = window.confirm(willBlock
      ? `Block ${user.fb_user_name} from EO2MATE processing on ${selectedFbPageName || "this Facebook Page"}? All new comments from this user will be ignored without an EO2MATE reply.`
      : `Allow EO2MATE to process comments from ${user.fb_user_name} again on ${selectedFbPageName || "this Facebook Page"}?`);
    if (!confirmed) return;
    setSavingUser(user.fb_user_id); setError(""); setNotice("");
    try {
      const { error: saveError } = await supabase.from("eo2mate_fb_user_controls").upsert({
        client_id: client.client_id,
        fb_page_id: selectedFbPageId,
        fb_user_id: user.fb_user_id,
        fb_user_name: user.fb_user_name || null,
        is_blocked: willBlock,
        block_reason: willBlock ? "Blocked by client from EO2MATE comment processing" : null,
        blocked_at: willBlock ? new Date().toISOString() : null,
        blocked_by: (await supabase.auth.getUser()).data?.user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,fb_page_id,fb_user_id" });
      if (saveError) throw saveError;
      setControls((current) => {
        const without = current.filter((row) => String(row.fb_user_id) !== String(user.fb_user_id));
        return [...without, { fb_user_id: user.fb_user_id, fb_user_name: user.fb_user_name, is_blocked: willBlock, block_reason: willBlock ? "Blocked by client from EO2MATE comment processing" : null, blocked_at: willBlock ? new Date().toISOString() : null, updated_at: new Date().toISOString() }];
      });
      setNotice(willBlock ? `${user.fb_user_name} is blocked from EO2MATE comment processing on this Page.` : `${user.fb_user_name} can be processed again on this Page.`);
    } catch (saveError) {
      setError(saveError?.message || "Unable to update the user block setting.");
    } finally {
      setSavingUser(null);
    }
  }

  return <div className="dashboard-page fb-users-page">
    <header className="dashboard-header"><div><p className="eyebrow">PAGE COMMUNITY</p><h1>Facebook Users</h1><p>Review bidders and commenters for {selectedFbPageName || "the selected Facebook Page"}.</p></div><button className="secondary-button fb-users-refresh" type="button" onClick={load} disabled={loading}><Icon name="refresh"/>Refresh</button></header>
    <section className="fb-users-policy-note"><strong>Page-specific comment control</strong><span>Blocking a user here ignores all of their new comments in EO2MATE on this Page. Their comments are not deleted or blocked on Facebook. Existing activity remains visible.</span></section>
    <section className="fb-users-metrics" aria-label="Facebook user summary"><Metric label="Users tracked" value={users.length.toLocaleString()} hint="Bidders, commenters and buyers"/><Metric label="Valid bids" value={users.reduce((sum, user) => sum + user.validBidCount, 0).toLocaleString()} hint="Recorded auction bids"/><Metric label="Valid transactions" value={validTransactionCount.toLocaleString()} hint="Paid or completed orders"/><Metric label="Blocked on this Page" value={blockedCount.toLocaleString()} hint="New comments ignored by EO2MATE"/></section>
    {error && <div className="error-message" role="alert">{error} <button className="secondary-button" type="button" onClick={load}>Retry</button></div>}
    {notice && <div className="fb-users-notice" role="status">{notice}</div>}
    <section className="toolbar-card fb-users-toolbar" aria-label="Facebook user filters"><label className="fb-users-search"><span>Search users and comments</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Facebook name, ID or comment text"/></label><label className="fb-users-filter"><span>Show</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All users</option><option value="ALLOWED">Allowed</option><option value="BLOCKED">Blocked</option></select></label><span className="fb-users-result-count">{visibleUsers.length.toLocaleString()} users</span></section>
    <section className="dashboard-panel fb-users-table-panel"><div className="panel-header"><div><h2>Bidders and commenters</h2><p>Activity is collected from Facebook comment webhooks after the required database migration is deployed. Auction bid history is also included.</p></div></div>
      {loading ? <div className="loading-card" role="status">Loading Facebook users…</div> : <div className="table-wrapper"><table className="fb-users-table"><thead><tr><th>Facebook name</th><th>Facebook link</th><th>Comments</th><th>Valid bids</th><th>Valid transactions</th><th>Last activity</th><th>Processing</th></tr></thead><tbody>{displayUsers.map((user) => {
        const isBlocked = user.control?.is_blocked === true;
        const expanded = expandedUser === user.fb_user_id;
        return <FragmentRow key={user.fb_user_id} user={user} isBlocked={isBlocked} expanded={expanded} saving={savingUser === user.fb_user_id} canManageBlocks={canManageBlocks} onToggleExpand={() => setExpandedUser(expanded ? null : user.fb_user_id)} onToggleBlocked={() => toggleBlocked(user)} />;
      })}{!displayUsers.length && <tr><td colSpan="7" className="empty-table-cell">{activity.length === 0 && bids.length === 0 ? "No tracked activity yet. New Facebook comments will appear after the migration and webhook update are deployed." : "No users match these filters."}</td></tr>}</tbody></table><RecordPagination pagination={pagination} label="Facebook users"/></div>}
    </section>
  </div>;
}

function FragmentRow({ user, isBlocked, expanded, saving, canManageBlocks, onToggleExpand, onToggleBlocked }) {
  const commentCount = user.comments.length;
  const recentComments = user.comments.slice(0, 6);
  return <>
    <tr className={isBlocked ? "fb-user-row fb-user-row-blocked" : "fb-user-row"}>
      <td data-label="Facebook name"><button type="button" className="fb-user-name-button" onClick={onToggleExpand} aria-expanded={expanded}>{user.fb_user_name || "Facebook user"}<small>ID {user.fb_user_id}</small></button>{isBlocked && <span className="fb-user-blocked-badge">BLOCKED</span>}</td>
      <td data-label="Facebook link"><a className="fb-user-link" href={facebookProfileUrl(user.fb_user_id)} target="_blank" rel="noreferrer">View profile <Icon name="external"/></a></td>
      <td data-label="Comments">{commentCount.toLocaleString()}<small className="fb-user-muted">{user.invalidBidCount ? `${user.invalidBidCount} invalid bid${user.invalidBidCount === 1 ? "" : "s"}` : "Comments captured"}</small></td>
      <td data-label="Valid bids">{user.validBidCount.toLocaleString()}</td>
      <td data-label="Valid transactions">{user.validTransactions.toLocaleString()}</td>
      <td data-label="Last activity">{formatDate(user.lastActivity)}</td>
      <td data-label="Processing"><button type="button" role="switch" aria-checked={isBlocked} aria-label={`${isBlocked ? "Unblock" : "Block"} ${user.fb_user_name || "Facebook user"}`} className={`fb-user-switch${isBlocked ? " is-blocked" : ""}`} onClick={onToggleBlocked} disabled={saving || !canManageBlocks} title={!canManageBlocks ? "Only client owners and admins can change block status" : isBlocked ? "Unblock: allow EO2MATE processing" : "Block: ignore all new comments in EO2MATE"}><span/><strong>{!canManageBlocks ? (isBlocked ? "Blocked" : "Admin only") : saving ? "Saving…" : isBlocked ? "Blocked" : "Allowed"}</strong></button></td>
    </tr>
    {expanded && <tr className="fb-user-detail-row"><td colSpan="7"><section className="fb-user-detail"><header><div><strong>{user.fb_user_name || "Facebook user"}</strong><span>Facebook user ID: {user.fb_user_id}</span></div><span className={isBlocked ? "fb-user-status is-blocked" : "fb-user-status"}>{isBlocked ? "Blocked on this Page" : "Allowed on this Page"}</span></header><div className="fb-user-detail-metrics"><span><b>{commentCount}</b> comments</span><span><b>{user.validBidCount}</b> valid bids</span><span><b>{user.validTransactions}</b> valid transactions</span><span><b>{user.invalidBidCount}</b> invalid bids</span></div><h3>Recent comments and bids</h3>{recentComments.length ? <ol className="fb-user-activity-list">{recentComments.map((comment) => <li key={comment.fb_comment_id || comment.activity_id}><div><span className={`fb-user-activity-kind${comment.is_valid === false ? " is-invalid" : ""}`}>{comment.is_valid === true ? "Valid bid" : comment.is_valid === false ? "Invalid bid" : "Comment"}</span><time>{formatDate(comment.commented_at)}</time></div><p>{comment.comment_text || "Comment text unavailable"}</p>{comment.fb_post_id && <a href={facebookPostUrl(comment.fb_post_id)} target="_blank" rel="noreferrer">Open Facebook post <Icon name="external"/></a>}</li>)}</ol> : <p className="fb-user-no-activity">No comment details are available for this user yet.</p>}</section></td></tr>}
  </>;
}
