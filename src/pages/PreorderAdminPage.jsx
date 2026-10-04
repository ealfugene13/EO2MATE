import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const fmtDate = (v) => v ? new Date(v).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const money = (v) => v == null ? "—" : `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Badge({ value }) { const v=String(value||"—").toUpperCase(); const cls=["ACTIVE","ACCEPTED","OPEN"].includes(v)?"status-badge status-active":["CLOSED","CANCELLED","REJECTED","SOLD_OUT"].includes(v)?"status-badge status-danger":"status-badge status-warning"; return <span className={cls}>{v.replaceAll("_"," ")}</span>; }
const pretty = (v) => String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
function BackIcon(){return <svg className="inline-button-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>}

export default function PreorderAdminPage({ client, onCreatePost }) {
  const [workspaceTab,setWorkspaceTab]=useState("DASHBOARD");
  const [postSearch,setPostSearch]=useState(""), [postFilter,setPostFilter]=useState("ALL"), [postSort,setPostSort]=useState("NEWEST");
  const [posts,setPosts]=useState([]), [entries,setEntries]=useState([]);
  const [selected,setSelected]=useState(null), [notice,setNotice]=useState(""), [error,setError]=useState(""), [loading,setLoading]=useState(false);
  const [detailTab,setDetailTab]=useState("OVERVIEW"), [copied,setCopied]=useState("");

  async function call(action,extra={}) { const {data,error}=await supabase.functions.invoke("eo2mate",{headers:{"x-eo2mate-route":"preorder-admin"},body:{action,client_id:client.client_id,...extra}}); if(error)throw error; if(!data?.success)throw new Error(data?.error||"Request failed"); return data; }
  async function load(){ setLoading(true); setError(""); try { const p=await call("LIST"); setPosts(p.posts||[]); } catch(e){setError(e.message)} finally{setLoading(false)} }
  useEffect(()=>{if(client?.client_id)load()},[client?.client_id]);
  async function open(post){ setSelected(post); setDetailTab("OVERVIEW"); setCopied(""); setError(""); try{const d=await call("ENTRIES",{post_id:post.post_id});setEntries(d.entries||[])}catch(e){setError(e.message)} }
  async function cancel(entry){const reason=window.prompt("Cancellation reason code (BUYER_REQUESTED, NO_PAYMENT, DUMMY_FAKE_SUSPECTED, NUISANCE_FAKE_ACTIVITY, OTHER):","BUYER_REQUESTED");if(!reason)return;try{await call("CANCEL_ENTRY",{post_entry_id:entry.post_entry_id,reason_code:reason});await open(selected);setNotice("Reservation cancelled and quantity released.")}catch(e){setError(e.message)}}

  const summary=useMemo(()=>{
    const active=posts.filter(p=>["ACTIVE","OPEN","PUBLISHED"].includes(String(p.status||"").toUpperCase())).length;
    const closed=posts.filter(p=>["CLOSED","SOLD_OUT","COMPLETED","CANCELLED"].includes(String(p.status||"").toUpperCase())).length;
    const items=posts.reduce((n,p)=>n+(p.eo2mate_post_items?.length||0),0);
    const withDeadline=posts.filter(p=>p.ends_at && new Date(p.ends_at).getTime()>Date.now()).length;
    return {total:posts.length,active,closed,items,withDeadline};
  },[posts]);

  const visiblePosts=useMemo(()=>{
    const q=postSearch.trim().toLowerCase();
    const rows=posts.filter(p=>{
      const status=String(p.status||"").toUpperCase();
      const matchesSearch=!q || String(p.caption||p.post_type_code||"").toLowerCase().includes(q);
      const matchesFilter=postFilter==="ALL" ||
        (postFilter==="ACTIVE" && ["ACTIVE","OPEN","PUBLISHED"].includes(status)) ||
        (postFilter==="DRAFT" && ["DRAFT","SCHEDULED"].includes(status)) ||
        (postFilter==="COMPLETED" && ["CLOSED","SOLD_OUT","COMPLETED"].includes(status)) ||
        (postFilter==="CANCELLED" && status==="CANCELLED");
      return matchesSearch && matchesFilter;
    });
    return [...rows].sort((a,b)=>{
      const av=new Date(a.created_at||a.updated_at||a.ends_at||0).getTime();
      const bv=new Date(b.created_at||b.updated_at||b.ends_at||0).getTime();
      if(postSort==="OLDEST") return av-bv;
      if(postSort==="STATUS") return String(a.status||"").localeCompare(String(b.status||""));
      if(postSort==="UPDATED") return new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0);
      return bv-av;
    });
  },[posts,postSearch,postFilter,postSort]);

  const tabs=["DASHBOARD","POSTS"];

  return <>
    {!selected && <>
    <header className="dashboard-header preorder-admin-header selling-hero"><div><p className="eyebrow">SELLING · PRE-ORDER</p><h1>Pre-Order</h1><p>Summary, Pre-Order posts and buyer reservations in one workspace.</p></div><button className="icon-button refresh-icon-button" type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg></button></header>
    {notice&&<div className="success-message global-error">{notice}</div>}{error&&<div className="dashboard-error global-error">{error}</div>}

    <section className="selling-tabs">
      <div>
        {tabs.map(tab=><button key={tab} type="button" className={workspaceTab===tab?"primary-button":"secondary-button"} onClick={()=>{setWorkspaceTab(tab);if(tab!=="POSTS"){setSelected(null);setEntries([])}}}>{tab==="POSTS"?"Posts":tab.charAt(0)+tab.slice(1).toLowerCase()}</button>)}
        <button type="button" className="secondary-button" onClick={()=>onCreatePost?.()}>Create Post</button>
      </div>
    </section>
    </>}

    {workspaceTab==="DASHBOARD"&&!selected&&<>
      <section className="metrics-grid" style={{ marginBottom:18 }}>
        <div className="metric-card"><span className="metric-title">Total Pre-Orders</span><strong className="metric-value">{summary.total}</strong><small className="metric-subtitle">All Pre-Order posts</small></div>
        <div className="metric-card"><span className="metric-title">Active</span><strong className="metric-value">{summary.active}</strong><small className="metric-subtitle">Currently accepting orders</small></div>
        <div className="metric-card"><span className="metric-title">Closed</span><strong className="metric-value">{summary.closed}</strong><small className="metric-subtitle">Closed, sold out or completed</small></div>
        <div className="metric-card"><span className="metric-title">Items</span><strong className="metric-value">{summary.items}</strong><small className="metric-subtitle">Items across Pre-Orders</small></div>
        <div className="metric-card"><span className="metric-title">Upcoming deadlines</span><strong className="metric-value">{summary.withDeadline}</strong><small className="metric-subtitle">Posts with future ordering deadlines</small></div>
      </section>
      <section className="dashboard-panel preorder-panel"><div className="panel-header"><div><h2>Pre-Order summary</h2><p>Quick operational view of your current Pre-Order activity.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Type</th><th>Status</th><th>Deadline</th><th>Closure</th><th>Items</th><th></th></tr></thead><tbody>{posts.slice(0,8).map(p=><tr key={p.post_id}><td><strong>{pretty(p.post_type_code)}</strong></td><td><Badge value={p.status}/></td><td>{fmtDate(p.ends_at)}</td><td>{p.eo2mate_preorder_settings?.ordering_close_reason?<Badge value={p.eo2mate_preorder_settings.ordering_close_reason}/>:<span className="table-muted">—</span>}</td><td>{p.eo2mate_post_items?.length||0}</td><td><button className="table-action-button" type="button" onClick={()=>open(p)}>Reservations</button></td></tr>)}{!loading&&posts.length===0&&<tr><td colSpan="6" className="empty-table-cell">No Pre-Orders yet.</td></tr>}</tbody></table></div></section>
    </>}



    {workspaceTab==="POSTS"&&!selected&&<>
      <section className="toolbar-card" style={{marginBottom:16}}>
        <input className="search-input" value={postSearch} onChange={e=>setPostSearch(e.target.value)} placeholder="Search posts..." />
        <select className="filter-select" value={postFilter} onChange={e=>setPostFilter(e.target.value)}><option value="ALL">Filter: All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft / Scheduled</option><option value="COMPLETED">Completed / Closed</option><option value="CANCELLED">Cancelled</option></select>
        <select className="filter-select" value={postSort} onChange={e=>setPostSort(e.target.value)}><option value="NEWEST">Sort: Newest</option><option value="OLDEST">Sort: Oldest</option><option value="UPDATED">Recently updated</option><option value="STATUS">Status</option></select>
      </section>
      <section className="dashboard-panel preorder-panel"><div className="panel-header"><div><h2>Pre-Order posts</h2><p>{posts.length} post{posts.length===1?"":"s"} · select a post to review reservations</p></div></div><div className="table-wrapper"><table><thead><tr><th>Type</th><th>Status</th><th>Ordering deadline</th><th>Closure</th><th>Items</th><th></th></tr></thead><tbody>{visiblePosts.map(p=><tr key={p.post_id} className={selected?.post_id===p.post_id?"selected-table-row":""}><td><strong>{pretty(p.post_type_code)}</strong></td><td><Badge value={p.status}/></td><td>{fmtDate(p.ends_at)}</td><td>{p.eo2mate_preorder_settings?.ordering_close_reason?<Badge value={p.eo2mate_preorder_settings.ordering_close_reason}/>:<span className="table-muted">—</span>}</td><td>{p.eo2mate_post_items?.length||0}</td><td><button className="table-action-button" type="button" onClick={()=>open(p)}>View</button></td></tr>)}{!loading&&posts.length===0&&<tr><td colSpan="6" className="empty-table-cell">No Pre-Orders yet.</td></tr>}</tbody></table></div></section></>}

    {workspaceTab==="POSTS" && selected && (()=>{
      const items=selected.eo2mate_post_items||[];
      const accepted=entries.filter(e=>["ACCEPTED","PARTIAL","CONFIRMED"].includes(String(e.status||"").toUpperCase()));
      const buyers=new Set(accepted.map(e=>e.fb_user_id).filter(Boolean)).size;
      const qty=accepted.reduce((n,e)=>n+Number(e.accepted_quantity||0),0);
      const itemWinners=items.map(item=>({item,winners:accepted.filter(e=>e.post_item_id===item.post_item_id)}));
      const copy=async(label,value)=>{if(!value)return;try{await navigator.clipboard.writeText(String(value));setCopied(label);window.setTimeout(()=>setCopied(""),1400)}catch(_){}};
      return <div className="selling-detail-workspace">
        <header className="dashboard-header selling-hero" style={{marginBottom:16}}><div>
          <button className="secondary-button icon-only-nav" type="button" onClick={()=>{setSelected(null);setEntries([])}} style={{marginBottom:14}} aria-label="Back to posts" title="Back to posts"><BackIcon/></button>
          <p className="eyebrow">FACEBOOK SELLING · PRE-ORDER</p><h1>Pre-Order Post Details</h1><p>{pretty(selected.post_type_code)} · Created {fmtDate(selected.created_at)}</p>
        </div><Badge value={selected.status}/></header>
        <section className="metrics-grid" style={{marginBottom:16}}>
          <div className="metric-card"><span>Items</span><strong>{items.length}</strong><small>Products attached</small></div>
          <div className="metric-card"><span>Reservations</span><strong>{entries.length}</strong><small>Buyer entries</small></div>
          <div className="metric-card"><span>Accepted qty</span><strong>{qty}</strong><small>Confirmed units</small></div>
          <div className="metric-card"><span>Buyers</span><strong>{buyers}</strong><small>Unique accepted buyers</small></div>
        </section>
        <section className="selling-tabs" style={{marginBottom:16}}><div>{["OVERVIEW","ITEMS","ORDERS"].map(t=><button key={t} type="button" className={detailTab===t?"primary-button":"secondary-button"} onClick={()=>setDetailTab(t)}>{t.charAt(0)+t.slice(1).toLowerCase()}</button>)}</div></section>
        {detailTab==="OVERVIEW"&&<section className="dashboard-panel preorder-panel selling-card"><div className="panel-header"><div><h2>Post overview</h2><p>Ordering lifecycle, deadline and Facebook references.</p></div></div>
          <div className="preorder-caption-card"><span>Facebook post caption</span><p>{selected.caption||"—"}</p></div><div className="preorder-summary-grid"><div><span>Post Type</span><strong>{pretty(selected.post_type_code)||"—"}</strong></div><div><span>Status</span><strong>{pretty(selected.status)||"—"}</strong></div><div><span>Created</span><strong>{fmtDate(selected.created_at)}</strong></div><div><span>Deadline</span><strong>{fmtDate(selected.ends_at)}</strong></div><div><span>Closure</span><strong>{pretty(selected.eo2mate_preorder_settings?.ordering_close_reason)||"—"}</strong></div><div><span>Items</span><strong>{items.length}</strong></div></div>
          <div className="panel-header"><div><h3>Winner / buyer per item</h3><p>Accepted buyer allocations for each Pre-Order item.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Item</th><th>Winner / Buyer</th><th>Accepted Qty</th><th>Status</th></tr></thead><tbody>{itemWinners.map(({item,winners})=>winners.length?winners.map((winner,index)=><tr key={`${item.post_item_id}-${winner.post_entry_id}`}><td>{index===0?<strong>{item.item_label||item.item_name_snapshot||`Item ${item.item_no||""}`}</strong>:""}</td><td>{winner.fb_user_name||winner.fb_user_id||"—"}</td><td>{winner.accepted_quantity??"—"}</td><td><Badge value={winner.status}/></td></tr>):<tr key={item.post_item_id}><td><strong>{item.item_label||item.item_name_snapshot||`Item ${item.item_no||""}`}</strong></td><td>—</td><td>—</td><td>—</td></tr>)}</tbody></table></div>
          <div className="panel-header"><div><h3>References</h3><p>Copy IDs for tracing in EO2MATE or Meta.</p></div></div><div className="preorder-summary-grid"><div><span>EO2MATE Post ID</span><strong title={selected.post_id}>{selected.post_id||"—"}</strong>{selected.post_id&&<button className="table-action-button" type="button" onClick={()=>copy("post",selected.post_id)}>{copied==="post"?"Copied":"Copy"}</button>}</div><div><span>Facebook Post ID</span><strong title={selected.fb_post_id}>{selected.fb_post_id||"—"}</strong>{selected.fb_post_id&&<button className="table-action-button" type="button" onClick={()=>copy("fb",selected.fb_post_id)}>{copied==="fb"?"Copied":"Copy"}</button>}</div></div>
        </section>}
        {detailTab==="ITEMS"&&<section className="dashboard-panel preorder-panel selling-card"><div className="panel-header"><div><h2>Items</h2><p>Products attached to this Pre-Order post.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Winner / Buyer</th><th>Status</th><th>Fulfillment</th></tr></thead><tbody>{items.map(i=>{const winners=itemWinners.find(x=>x.item.post_item_id===i.post_item_id)?.winners||[];return <tr key={i.post_item_id}><td><strong>{i.item_label||i.item_name_snapshot||"—"}</strong></td><td>{money(i.unit_price)}</td><td>{i.quantity_limit??"—"}</td><td>{winners.length?winners.map(w=>w.fb_user_name||w.fb_user_id||"—").join(", "):"—"}</td><td><Badge value={i.status}/></td><td>{pretty(i.fulfillment_status)||"—"}</td></tr>})}{!items.length&&<tr><td colSpan="6" className="empty-table-cell">No item records for this post.</td></tr>}</tbody></table></div></section>}
        {detailTab==="ORDERS"&&<section className="dashboard-panel preorder-panel selling-card"><div className="panel-header"><div><h2>Reservations / Orders</h2><p>Buyer quantities, status and required down payment.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Buyer</th><th>Status</th><th>Requested</th><th>Accepted</th><th>Required DP</th><th>Comment</th><th></th></tr></thead><tbody>{entries.map(e=><tr key={e.post_entry_id}><td><strong>{e.fb_user_name||e.fb_user_id||"—"}</strong></td><td><Badge value={e.status}/></td><td>{e.requested_quantity}</td><td>{e.accepted_quantity}</td><td>{money(e.required_down_payment_amount)}</td><td>{e.comment_text||"—"}</td><td>{!["CANCELLED","REJECTED"].includes(String(e.status).toUpperCase())&&<button className="table-action-button danger-action" type="button" onClick={()=>cancel(e)}>Cancel</button>}</td></tr>)}{entries.length===0&&<tr><td colSpan="7" className="empty-table-cell">No reservations for this post.</td></tr>}</tbody></table></div></section>}
      </div>;
    })()}

  </>;
}
