import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const fmtDate = (v) => v ? new Date(v).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const money = (v) => v == null ? "—" : `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Badge({ value }) { const v=String(value||"—").toUpperCase(); const cls=["ACTIVE","ACCEPTED"].includes(v)?"status-badge status-active":["CLOSED","CANCELLED","REJECTED"].includes(v)?"status-badge status-danger":"status-badge status-warning"; return <span className={cls}>{v.replaceAll("_"," ")}</span>; }
const pretty = (v) => String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function PreorderAdminPage({ client }) {
  const [posts,setPosts]=useState([]), [entries,setEntries]=useState([]);
  const [selected,setSelected]=useState(null), [notice,setNotice]=useState(""), [error,setError]=useState(""), [loading,setLoading]=useState(false);

  async function call(action,extra={}) { const {data,error}=await supabase.functions.invoke("eo2mate",{headers:{"x-eo2mate-route":"preorder-admin"},body:{action,client_id:client.client_id,...extra}}); if(error)throw error; if(!data?.success)throw new Error(data?.error||"Request failed"); return data; }
  async function load(){ setLoading(true); setError(""); try { const p=await call("LIST"); setPosts(p.posts||[]); } catch(e){setError(e.message)} finally{setLoading(false)} }
  useEffect(()=>{if(client?.client_id)load()},[client?.client_id]);
  async function open(post){ setSelected(post); setError(""); try{const d=await call("ENTRIES",{post_id:post.post_id});setEntries(d.entries||[])}catch(e){setError(e.message)} }
  async function cancel(entry){const reason=window.prompt("Cancellation reason code (BUYER_REQUESTED, NO_PAYMENT, DUMMY_FAKE_SUSPECTED, NUISANCE_FAKE_ACTIVITY, OTHER):","BUYER_REQUESTED");if(!reason)return;try{await call("CANCEL_ENTRY",{post_entry_id:entry.post_entry_id,reason_code:reason});await open(selected);setNotice("Reservation cancelled and quantity released.")}catch(e){setError(e.message)}}


  return <>
    <header className="dashboard-header preorder-admin-header"><div><p className="eyebrow">SELLING · PRE-ORDER</p><h1>Pre-Order Management</h1><p>Manage Single and Multiple Pre-Orders, reservations and deadlines.</p></div><button className="icon-button refresh-icon-button" type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg></button></header>
    {notice&&<div className="success-message global-error">{notice}</div>}{error&&<div className="dashboard-error global-error">{error}</div>}

    <section className="dashboard-panel preorder-panel"><div className="panel-header"><div><h2>Pre-Order posts</h2><p>{posts.length} post{posts.length===1?"":"s"} · select a post to review reservations</p></div></div><div className="table-wrapper"><table><thead><tr><th>Type</th><th>Status</th><th>Ordering deadline</th><th>Closure</th><th>Items</th><th></th></tr></thead><tbody>{posts.map(p=><tr key={p.post_id} className={selected?.post_id===p.post_id?"selected-table-row":""}><td><strong>{pretty(p.post_type_code)}</strong></td><td><Badge value={p.status}/></td><td>{fmtDate(p.ends_at)}</td><td>{p.eo2mate_preorder_settings?.ordering_close_reason?<Badge value={p.eo2mate_preorder_settings.ordering_close_reason}/>:<span className="table-muted">—</span>}</td><td>{p.eo2mate_post_items?.length||0}</td><td><button className="table-action-button" type="button" onClick={()=>open(p)}>View</button></td></tr>)}{!loading&&posts.length===0&&<tr><td colSpan="6" className="empty-table-cell">No Pre-Orders yet.</td></tr>}</tbody></table></div></section>

    {selected&&<section className="dashboard-panel preorder-panel"><div className="panel-header"><div><p className="eyebrow">{pretty(selected.post_type_code)} PRE-ORDER</p><h2>Reservations</h2><p className="preorder-caption">{selected.caption||"No post caption"}</p></div><Badge value={selected.status}/></div><div className="preorder-summary-grid"><div><span>Items</span><strong>{selected.eo2mate_post_items?.length||0}</strong></div><div><span>Reservations</span><strong>{entries.length}</strong></div><div><span>Deadline</span><strong>{fmtDate(selected.ends_at)}</strong></div><div><span>Closure</span><strong>{pretty(selected.eo2mate_preorder_settings?.ordering_close_reason)||"—"}</strong></div></div><div className="table-wrapper"><table><thead><tr><th>Buyer</th><th>Status</th><th>Requested</th><th>Accepted</th><th>Required DP</th><th></th></tr></thead><tbody>{entries.map(e=><tr key={e.post_entry_id}><td><strong>{e.fb_user_name||e.fb_user_id||"—"}</strong></td><td><Badge value={e.status}/></td><td>{e.requested_quantity}</td><td>{e.accepted_quantity}</td><td>{money(e.required_down_payment_amount)}</td><td>{!["CANCELLED","REJECTED"].includes(String(e.status).toUpperCase())&&<button className="table-action-button danger-action" type="button" onClick={()=>cancel(e)}>Cancel</button>}</td></tr>)}{entries.length===0&&<tr><td colSpan="6" className="empty-table-cell">No reservations for this post.</td></tr>}</tbody></table></div></section>}
  </>;
}
