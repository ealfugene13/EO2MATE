import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const fmtDate = (v) => v ? new Date(v).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const money = (v) => v == null ? "—" : `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Badge({ value }) { const v=String(value||"—").toUpperCase(); const cls=["ACTIVE","ACCEPTED","OPEN"].includes(v)?"status-badge status-active":["CLOSED","CANCELLED","REJECTED","SOLD_OUT"].includes(v)?"status-badge status-danger":"status-badge status-warning"; return <span className={cls}>{v.replaceAll("_"," ")}</span>; }
const pretty = (v) => String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function PreorderAdminPage({ client, onCreatePost }) {
  const [workspaceTab,setWorkspaceTab]=useState("DASHBOARD");
  const [postSearch,setPostSearch]=useState(""), [postFilter,setPostFilter]=useState("ALL"), [postSort,setPostSort]=useState("NEWEST");
  const [posts,setPosts]=useState([]), [entries,setEntries]=useState([]);
  const [selected,setSelected]=useState(null), [notice,setNotice]=useState(""), [error,setError]=useState(""), [loading,setLoading]=useState(false);

  async function call(action,extra={}) { const {data,error}=await supabase.functions.invoke("eo2mate",{headers:{"x-eo2mate-route":"preorder-admin"},body:{action,client_id:client.client_id,...extra}}); if(error)throw error; if(!data?.success)throw new Error(data?.error||"Request failed"); return data; }
  async function load(){ setLoading(true); setError(""); try { const p=await call("LIST"); setPosts(p.posts||[]); } catch(e){setError(e.message)} finally{setLoading(false)} }
  useEffect(()=>{if(client?.client_id)load()},[client?.client_id]);
  async function open(post){ setSelected(post); setError(""); try{const d=await call("ENTRIES",{post_id:post.post_id});setEntries(d.entries||[])}catch(e){setError(e.message)} }
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

  const tabs=["DASHBOARD","SUMMARY","POSTS"];

  return <>
    <header className="dashboard-header preorder-admin-header selling-hero"><div><p className="eyebrow">SELLING · PRE-ORDER</p><h1>Pre-Order</h1><p>Summary, Pre-Order posts and buyer reservations in one workspace.</p></div><button className="icon-button refresh-icon-button" type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg></button></header>
    {notice&&<div className="success-message global-error">{notice}</div>}{error&&<div className="dashboard-error global-error">{error}</div>}

    <section className="selling-tabs">
      <div>
        {tabs.map(tab=><button key={tab} type="button" className={workspaceTab===tab?"primary-button":"secondary-button"} onClick={()=>{setWorkspaceTab(tab);if(tab!=="POSTS"){setSelected(null);setEntries([])}}}>{tab==="POSTS"?"Posts":tab.charAt(0)+tab.slice(1).toLowerCase()}</button>)}
        <button type="button" className="secondary-button" onClick={()=>onCreatePost?.()}>Create Post</button>
      </div>
    </section>

    {workspaceTab==="DASHBOARD"&&<>
      <section className="metrics-grid" style={{ marginBottom:18 }}>
        <div className="metric-card"><span>Total Pre-Orders</span><strong>{summary.total}</strong><small>All Pre-Order posts</small></div>
        <div className="metric-card"><span>Active</span><strong>{summary.active}</strong><small>Currently accepting orders</small></div>
        <div className="metric-card"><span>Closed</span><strong>{summary.closed}</strong><small>Closed, sold out or completed</small></div>
        <div className="metric-card"><span>Items</span><strong>{summary.items}</strong><small>Items across Pre-Orders</small></div>
        <div className="metric-card"><span>Upcoming deadlines</span><strong>{summary.withDeadline}</strong><small>Posts with future ordering deadlines</small></div>
      </section>
      <section className="dashboard-panel preorder-panel"><div className="panel-header"><div><h2>Pre-Order summary</h2><p>Quick operational view of your current Pre-Order activity.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Type</th><th>Status</th><th>Deadline</th><th>Closure</th><th>Items</th><th></th></tr></thead><tbody>{posts.slice(0,8).map(p=><tr key={p.post_id}><td><strong>{pretty(p.post_type_code)}</strong></td><td><Badge value={p.status}/></td><td>{fmtDate(p.ends_at)}</td><td>{p.eo2mate_preorder_settings?.ordering_close_reason?<Badge value={p.eo2mate_preorder_settings.ordering_close_reason}/>:<span className="table-muted">—</span>}</td><td>{p.eo2mate_post_items?.length||0}</td><td><button className="table-action-button" type="button" onClick={()=>open(p)}>Reservations</button></td></tr>)}{!loading&&posts.length===0&&<tr><td colSpan="6" className="empty-table-cell">No Pre-Orders yet.</td></tr>}</tbody></table></div></section>
    </>}

    {workspaceTab==="SUMMARY"&&<section className="dashboard-panel preorder-panel selling-card"><div className="panel-header"><div><h2>Pre-Order summary</h2><p>Operational summary across current Pre-Order activity.</p></div></div><div className="preorder-summary-grid"><div><span>Total posts</span><strong>{summary.total}</strong></div><div><span>Active</span><strong>{summary.active}</strong></div><div><span>Closed</span><strong>{summary.closed}</strong></div><div><span>Items</span><strong>{summary.items}</strong></div></div></section>}

    {workspaceTab==="POSTS"&&<>
      <section className="toolbar-card" style={{marginBottom:16}}>
        <input className="search-input" value={postSearch} onChange={e=>setPostSearch(e.target.value)} placeholder="Search posts..." />
        <select className="filter-select" value={postFilter} onChange={e=>setPostFilter(e.target.value)}><option value="ALL">Filter: All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft / Scheduled</option><option value="COMPLETED">Completed / Closed</option><option value="CANCELLED">Cancelled</option></select>
        <select className="filter-select" value={postSort} onChange={e=>setPostSort(e.target.value)}><option value="NEWEST">Sort: Newest</option><option value="OLDEST">Sort: Oldest</option><option value="UPDATED">Recently updated</option><option value="STATUS">Status</option></select>
      </section>
      <section className="dashboard-panel preorder-panel"><div className="panel-header"><div><h2>Pre-Order posts</h2><p>{posts.length} post{posts.length===1?"":"s"} · select a post to review reservations</p></div></div><div className="table-wrapper"><table><thead><tr><th>Type</th><th>Status</th><th>Ordering deadline</th><th>Closure</th><th>Items</th><th></th></tr></thead><tbody>{visiblePosts.map(p=><tr key={p.post_id} className={selected?.post_id===p.post_id?"selected-table-row":""}><td><strong>{pretty(p.post_type_code)}</strong></td><td><Badge value={p.status}/></td><td>{fmtDate(p.ends_at)}</td><td>{p.eo2mate_preorder_settings?.ordering_close_reason?<Badge value={p.eo2mate_preorder_settings.ordering_close_reason}/>:<span className="table-muted">—</span>}</td><td>{p.eo2mate_post_items?.length||0}</td><td><button className="table-action-button" type="button" onClick={()=>open(p)}>View</button></td></tr>)}{!loading&&posts.length===0&&<tr><td colSpan="6" className="empty-table-cell">No Pre-Orders yet.</td></tr>}</tbody></table></div></section></>}

    {workspaceTab==="POSTS" && selected && (<section className="dashboard-panel preorder-panel"><div className="panel-header"><div><h2>Reservations</h2><p>Select a Pre-Order post to review its buyer reservations.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Pre-Order</th><th>Status</th><th>Deadline</th><th>Items</th><th></th></tr></thead><tbody>{posts.map(p=><tr key={p.post_id}><td><strong>{p.caption||pretty(p.post_type_code)||"Pre-Order"}</strong></td><td><Badge value={p.status}/></td><td>{fmtDate(p.ends_at)}</td><td>{p.eo2mate_post_items?.length||0}</td><td><button className="table-action-button" type="button" onClick={()=>open(p)}>Open reservations</button></td></tr>)}{!loading&&posts.length===0&&<tr><td colSpan="5" className="empty-table-cell">No Pre-Orders yet.</td></tr>}</tbody></table></div></section>:
    <section className="dashboard-panel preorder-panel"><div className="panel-header"><div><p className="eyebrow">{pretty(selected.post_type_code)} PRE-ORDER</p><h2>Reservations</h2><p className="preorder-caption">{selected.caption||"No post caption"}</p></div><div style={{display:"flex",gap:8,alignItems:"center"}}><Badge value={selected.status}/><button className="secondary-button" type="button" onClick={()=>{setSelected(null);setEntries([])}}>Choose another</button></div></div><div className="preorder-summary-grid"><div><span>Items</span><strong>{selected.eo2mate_post_items?.length||0}</strong></div><div><span>Reservations</span><strong>{entries.length}</strong></div><div><span>Deadline</span><strong>{fmtDate(selected.ends_at)}</strong></div><div><span>Closure</span><strong>{pretty(selected.eo2mate_preorder_settings?.ordering_close_reason)||"—"}</strong></div></div><div className="table-wrapper"><table><thead><tr><th>Buyer</th><th>Status</th><th>Requested</th><th>Accepted</th><th>Required DP</th><th></th></tr></thead><tbody>{entries.map(e=><tr key={e.post_entry_id}><td><strong>{e.fb_user_name||e.fb_user_id||"—"}</strong></td><td><Badge value={e.status}/></td><td>{e.requested_quantity}</td><td>{e.accepted_quantity}</td><td>{money(e.required_down_payment_amount)}</td><td>{!["CANCELLED","REJECTED"].includes(String(e.status).toUpperCase())&&<button className="table-action-button danger-action" type="button" onClick={()=>cancel(e)}>Cancel</button>}</td></tr>)}{entries.length===0&&<tr><td colSpan="6" className="empty-table-cell">No reservations for this post.</td></tr>}</tbody></table></div></section>)}
  </>;
}
