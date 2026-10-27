import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import Eo2DatePicker from "../components/Eo2DatePicker";
import RecordPagination, { useRecordPagination } from "../components/RecordPagination";
import "./OrdersPage.css";

const normalized = value => String(value || "").toUpperCase();
const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderDay = value => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Manila"}).format(new Date(value)) : "";

function OrdersIcon({type}) {
  const paths={
    export:<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>,
    reset:<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/>,
    refresh:<><path d="M20 5v6h-6M4 19v-6h6"/><path d="M6 8a7 7 0 0 1 12-1l2 4M4 13l2 4a7 7 0 0 0 12-1"/></>,
    summary:<><path d="M4 5.5h7v6H4z"/><path d="M13 5.5h7v6h-7z"/><path d="M4 13.5h7V20H4z"/><path d="M13 13.5h7V20h-7z"/></>,
    transactions:<><path d="M7 4v16"/><path d="M12 10v10"/><path d="M17 7v13"/><path d="M4 20h16"/></>,
    groups:<><path d="M7 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M17 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M12 13.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/><path d="M8.8 10.7 10.9 14"/><path d="M15.2 10.7 13.1 14"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

function OrderField({label,children}) {return <label className="orders-filter-field"><span>{label}</span>{children}</label>;}
function OrderMetric({title,value,note}) {return <div className="metric-card metric-button"><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-subtitle">{note}</div></div>;}
function ManualField({label,children}) {return <label className="manual-order-field"><span>{label}</span>{children}</label>;}
function csvCell(value){let text=String(value??"");if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
function newRequestId(){return globalThis.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16);});}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
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
    ["PAYMENT_PENDING", "PAYMENT_REOPENED", "PENDING", "AWAITING_FINALIZER", "BOOKED", "PICKED_UP", "DROPPED_OFF", "IN_TRANSIT", "SHIPPED", "OPEN"].includes(normalized)
  ) {
    className += " status-warning";
  } else if (
    ["CANCELLED", "PAYMENT_EXPIRED", "FAILED", "EXPIRED", "REFUNDED", "INVALID", "FORFEITED", "VOID"].includes(normalized)
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


// Defense-in-depth only: SQL views and server actions must also enforce Page ownership.
// Rows with missing or ambiguous Page attribution are never displayed.
function onlySelectedPage(rows, pageId) {
  if (!pageId) return [];
  return (rows || []).filter((row) =>
    String(row.fb_page_id || row.page_fb_id || "") === String(pageId)
  );
}

export default function OrdersPage({ client, detailRequest, page, setErrorMessage, setPage, navigationFilter , selectedFbPageId }) {
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [channel,setChannel]=useState("ALL"),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const [activeTab, setActiveTab] = useState("ORDERS");
  const invalidRange=!!(from && to && from>to);
  useEffect(() => {
    if (navigationFilter?.page === "orders") {
      setOrderStatusFilter(navigationFilter.value);
      setOrderSearch("");
      setChannel("ALL");
      setFrom("");
      setTo("");
      setActiveTab("ORDERS");
    }
  }, [navigationFilter]);

  const [orders, setOrders] = useState([]);
  const [orderGroups, setOrderGroups] = useState([]);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [manualMessageOpen, setManualMessageOpen] = useState(false);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualRequestId, setManualRequestId] = useState("");
  const [manualNotice, setManualNotice] = useState("");
  const [manualItems, setManualItems] = useState([]);
  const [manualInventory, setManualInventory] = useState([]);
  const [manualOrder, setManualOrder] = useState({buyer_name:"",buyer_fb_user_id:"",buyer_phone:"",buyer_email:"",shipping_name:"",shipping_phone:"",shipping_address_line1:"",shipping_address_line2:"",shipping_city:"",shipping_province:"",shipping_postal_code:"",shipping_fee:"0",notes:""});
  const [manualMessage, setManualMessage] = useState({channel:"MESSENGER",fb_page_id:"",target_id:"",message:""});
  const [manualPages, setManualPages] = useState([]);
  const [manualPaymentMethod, setManualPaymentMethod] = useState("CASH");
  const [manualPaymentReference, setManualPaymentReference] = useState("");

  const canUseManualActions = ["ADMIN","CLIENT_ADMIN","OWNER","SUPER_ADMIN","STAFF"].includes(String(client?.role || "").toUpperCase());
  const manualSubtotal = manualItems.reduce((sum,row)=>sum+(Number(row.quantity)||0)*(Number(row.unit_price)||0),0);
  const manualShippingFee = Number(manualOrder.shipping_fee) || 0;
  const manualTotal = manualSubtotal + manualShippingFee;
  const manualStockIssues = manualItems.reduce((issues,row,index)=>{
    if(!row.inventory_item_id) return issues;
    const item=manualInventory.find(candidate=>candidate.inventory_item_id===row.inventory_item_id);
    const requested=manualItems.filter(line=>line.inventory_item_id===row.inventory_item_id).reduce((sum,line)=>sum+(Number(line.quantity)||0),0);
    if(item && requested>Number(item.qty_available)) issues.push(`${item.item_name} has ${item.qty_available} available; ${requested} selected.`);
    return issues;
  },[]);

  async function openManualOrder() {
    if(!selectedFbPageId) { setManualNotice("Select an active Facebook Page before creating a manual order."); return; }
    setManualNotice(""); setManualRequestId(newRequestId()); setManualOrderOpen(true); setManualItems([{inventory_item_id:"",quantity:"1",unit_price:""}]);
    setManualOrder({buyer_name:"",buyer_fb_user_id:"",buyer_phone:"",buyer_email:"",shipping_name:"",shipping_phone:"",shipping_address_line1:"",shipping_address_line2:"",shipping_city:"",shipping_province:"",shipping_postal_code:"",shipping_fee:"0",notes:""});
    try {
      const {data,error}=await supabase.functions.invoke("eo2mate",{method:"POST",headers:{"x-eo2mate-route":"inventory-admin"},body:{action:"LIST_ITEMS",client_id:client.client_id,status:"ACTIVE",fb_page_id:selectedFbPageId}});
      if(error) throw error;
      if(!data?.success) throw new Error(data?.message || "Unable to load inventory.");
      setManualInventory((data.items||[]).filter(item=>Number(item.qty_available)>0));
      if(!(data.items||[]).some(item=>Number(item.qty_available)>0)) setManualNotice("Add active inventory with available stock before creating a manual order.");
    } catch(error) { setManualNotice(error.message || "Unable to load inventory."); }
  }

  async function openManualMessage() {
    setManualNotice(""); setManualMessageOpen(true);
    try {
      const {data,error}=await supabase.from("fb_pages").select("fb_page_id,page_nm,status").eq("client_id",client.client_id).eq("status","ACTIVE").order("created_at");
      if(error) throw error;
      setManualPages(data||[]);
      setManualMessage(current=>({...current,fb_page_id:current.fb_page_id || data?.[0]?.fb_page_id || ""}));
      if(!data?.length) setManualNotice("Connect an active Facebook Page before sending a message or comment reply.");
    } catch(error) { setManualNotice(error.message || "Unable to load Facebook Pages."); }
  }

  async function submitManualOrder(event) {
    event.preventDefault(); if(manualBusy) return;
    const lines=manualItems.filter(row=>row.inventory_item_id).map(row=>({inventory_item_id:row.inventory_item_id,quantity:Number(row.quantity),unit_price:Number(row.unit_price)}));
    if(!lines.length) { setManualNotice("Add at least one inventory item."); return; }
    if(lines.some(line=>!Number.isFinite(line.quantity)||line.quantity<=0||!Number.isFinite(line.unit_price)||line.unit_price<0)) { setManualNotice("Check each item quantity and unit price."); return; }
    if(manualStockIssues.length) { setManualNotice(manualStockIssues[0]); return; }
    if(!Number.isFinite(manualShippingFee)||manualShippingFee<0) { setManualNotice("Shipping fee must be zero or more."); return; }
    if(!window.confirm(`Create this manual order for ${manualOrder.buyer_name}? Inventory will be reserved immediately.`)) return;
    setManualBusy(true); setManualNotice("");
    try {
      const {data,error}=await supabase.functions.invoke("eo2mate",{method:"POST",headers:{"x-eo2mate-route":"manual-order-admin"},body:{action:"CREATE",client_id:client.client_id,fb_page_id:selectedFbPageId,manual_request_id:manualRequestId,...manualOrder,shipping_fee:Number(manualOrder.shipping_fee||0),items:lines}});
      if(error) throw error;
      if(!data?.success) throw new Error(data?.message || "Manual order could not be created.");
      setManualOrderOpen(false); setManualNotice(`Manual order ${data.order_number || "created"}. Inventory was reserved.`); await loadPortal();
    } catch(error) { setManualNotice(error.message || "Manual order could not be created."); }
    finally { setManualBusy(false); }
  }

  async function submitManualMessage(event) {
    event.preventDefault(); if(manualBusy) return;
    const channel=manualMessage.channel;
    if(!manualMessage.fb_page_id || !manualMessage.target_id.trim() || !manualMessage.message.trim()) { setManualNotice("Choose a Page and enter a recipient or comment ID and message."); return; }
    const targetLabel=channel==="MESSENGER"?"Messenger recipient":"Facebook comment";
    if(!window.confirm(`Send this ${channel==="MESSENGER"?"Messenger message":"public comment reply"} to ${targetLabel} ${manualMessage.target_id.trim()}?`)) return;
    setManualBusy(true); setManualNotice("");
    try {
      const {data,error}=await supabase.functions.invoke("meta",{method:"POST",headers:{"x-eo2mate-meta-route":"manual-send"},body:{client_id:client.client_id,fb_page_id:manualMessage.fb_page_id,channel,target_id:manualMessage.target_id.trim(),message:manualMessage.message.trim()}});
      if(error) throw error;
      if(!data?.success) throw new Error(data?.message || "Meta did not accept the message.");
      setManualMessageOpen(false); setManualNotice(data.audit_logged===false?"Message sent, but EO2MATE could not save its audit record. Please notify an administrator.":`${channel==="MESSENGER"?"Messenger message":"Comment reply"} sent and recorded.`);
    } catch(error) { setManualNotice(error.message || "Message was not sent."); }
    finally { setManualBusy(false); }
  }

  async function runManualOrderAction(action, extra={}) {
    if(!orderDetail?.order_id || manualBusy) return;
    setManualBusy(true); setManualNotice("");
    try {
      if(action==="CANCEL"){
        const {data,error}=await supabase.rpc("cancel_sales_order",{p_client_id:client.client_id,p_order_id:orderDetail.order_id,p_order_group_id:null,p_reason:extra.reason||null});
        if(error) throw error;
        setManualNotice(data?.result==="ALREADY_CANCELLED"?"This order was already cancelled.":`${Number(data?.cancelled_orders||0)} order cancelled. ${Number(data?.restocked_movements||0)} inventory deduction(s) reversed. Any buyer refund must be handled separately.`);
      }else{
        const {data,error}=await supabase.functions.invoke("eo2mate",{method:"POST",headers:{"x-eo2mate-route":"manual-order-admin"},body:{action,client_id:client.client_id,order_id:orderDetail.order_id,...extra}});
        if(error) throw error;
        if(!data?.success) throw new Error(data?.message || "Manual order action failed.");
        setManualNotice("Payment recorded. The order is marked paid and ready for delivery when shipping details are complete.");
      }
      setManualPaymentOpen(false); await openOrder(orderDetail.order_id); await loadPortal();
    } catch(error) { const raw=String(error.message||"");setManualNotice(raw.includes("ORDER_CANCELLATION_TOO_LATE")?"This order cannot be cancelled after it has shipped, been delivered, or completed.":raw.includes("ORDER_CANCELLATION_FORBIDDEN")?"You do not have permission to cancel orders for this workspace.":raw || "Manual order action failed."); }
    finally { setManualBusy(false); }
  }
  const [detailLoading, setDetailLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);

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

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        orderStatusFilter === "ALL" ||
        normalized(order.order_status) === normalized(orderStatusFilter);

      const haystack = [
        order.order_number,
        order.item_label,
        order.buyer_name,
        order.payment_status,
        order.order_group_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !orderSearch.trim() ||
        haystack.includes(orderSearch.trim().toLowerCase());

      const day=orderDay(order.created_at);
      return !invalidRange && matchesStatus && matchesSearch && (channel==="ALL" || normalized(order.source_type)===channel) && (!from || day>=from) && (!to || (!!day && day<=to));
    });
  }, [orders, orderStatusFilter, orderSearch,channel,from,to,invalidRange]);

  const activeOrders=filteredOrders.filter(order=>!["CANCELLED","CANCELED","FORFEITED","PAYMENT_EXPIRED","FAILED","VOID"].includes(normalized(order.order_status)));
  const channels=[...new Set(orders.map(order=>normalized(order.source_type)).filter(Boolean))].sort();
  const statuses=[...new Set(["PAYMENT_PENDING","PAID","READY_FOR_DELIVERY","SHIPPED","DELIVERED","COMPLETED","CANCELLED",...orders.map(order=>normalized(order.order_status)).filter(Boolean),orderStatusFilter!=="ALL"?normalized(orderStatusFilter):""])].filter(Boolean);

  const groupMap = useMemo(() => new Map(orderGroups.map(group => [group.order_group_id, group])), [orderGroups]);
  const filteredGroups = useMemo(() => {
    const matchingGroupIds = new Set(filteredOrders.map(order => order.order_group_id).filter(Boolean));
    return orderGroups.filter(group => matchingGroupIds.has(group.order_group_id));
  }, [orderGroups, filteredOrders]);
  const orderPagination = useRecordPagination(filteredOrders, `${orderStatusFilter}|${orderSearch}|${channel}|${from}|${to}|${selectedFbPageId || ""}`);
  const groupPagination = useRecordPagination(filteredGroups, `${orderStatusFilter}|${orderSearch}|${channel}|${from}|${to}|${selectedFbPageId || ""}`);
  const summaryRows = useMemo(() => {
    const map = new Map();
    for (const order of activeOrders) {
      const key = normalized(order.source_type) || "UNSPECIFIED";
      if (!map.has(key)) map.set(key, { channel: key, count: 0, subtotal: 0, total: 0 });
      const current = map.get(key);
      current.count += 1;
      current.subtotal += amount(order.subtotal);
      current.total += amount(order.total_amount);
    }
    return [...map.values()].sort((a,b) => a.channel.localeCompare(b.channel));
  }, [activeOrders]);

  function resetFilters(){setOrderSearch("");setOrderStatusFilter("ALL");setChannel("ALL");setFrom("");setTo("");}
  function exportOrders(){
    const rows=[["Order","Item","Buyer","Channel","Subtotal","Shipping","Total","Order status","Payment status","Created (Manila)","Order group"],...filteredOrders.map(order=>[order.order_number,order.item_label,order.buyer_name,order.source_type,order.subtotal,order.shipping_fee,order.total_amount,order.order_status,order.latest_payment_status||order.payment_status,formatDateTime(order.created_at),groupMap.get(order.order_group_id)?.group_number||order.order_group_id||""] )];
    const url=URL.createObjectURL(new Blob(["\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="EO2MATE-Orders.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
        supabase.from("client_order_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false }),
        supabase.from("client_order_group_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false }),
      ]);
      if (version !== pageLoadVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setOrders(onlySelectedPage(results[0].data, selectedFbPageId));
      setOrderGroups(onlySelectedPage(results[1].data, selectedFbPageId));
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id, selectedFbPageId]);

  useEffect(() => { if (detailRequest?.kind === "order" && page === "order-detail") openOrder(detailRequest.id); }, [detailRequest]);
  if (pageDataLoading) return <div className="loading-card"><h2>Loading page</h2></div>;
  return (<div className="orders-workspace">
    {page === "orders" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">ORDER MANAGEMENT</p>
                <h1>Orders</h1>
                <p>Track winner orders from payment pending to completion.</p>
              </div>
              <div className="orders-header-actions">
                {canUseManualActions && <button type="button" className="secondary-button orders-icon-action" onClick={openManualOrder}><span aria-hidden="true">＋</span><span>Manual order</span></button>}
                {canUseManualActions && <button type="button" className="secondary-button orders-icon-action" onClick={openManualMessage}><span aria-hidden="true">↗</span><span>Send chat / comment</span></button>}
                <button type="button" className="secondary-button orders-icon-action" onClick={exportOrders} disabled={!filteredOrders.length || invalidRange}><OrdersIcon type="export"/><span>Export</span></button>
                <button type="button" className="icon-button refresh-icon-button orders-icon-action" onClick={loadPortal} title="Refresh Orders" aria-label="Refresh Orders"><OrdersIcon type="refresh"/></button>
              </div>
            </header>
            {manualNotice && !manualOrderOpen && !manualMessageOpen && <div className="manual-order-notice" role="status">{manualNotice}<button type="button" aria-label="Dismiss notice" onClick={()=>setManualNotice("")}>×</button></div>}
            <section className="toolbar-card orders-top-filters" aria-label="Order filters">
              <OrderField label="Search"><input className="search-input" value={orderSearch} onChange={event=>setOrderSearch(event.target.value)} placeholder="Order, buyer or item…"/></OrderField>
              <OrderField label="Channel"><select className="filter-select" value={channel} onChange={event=>setChannel(event.target.value)}><option value="ALL">All channels</option>{channels.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></OrderField>
              <OrderField label="Order status"><select className="filter-select" value={orderStatusFilter} onChange={event=>setOrderStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{statuses.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></OrderField>
              <OrderField label="From (Manila)"><Eo2DatePicker value={from} onChange={event=>setFrom(event.target.value)}/></OrderField>
              <OrderField label="To (Manila)"><Eo2DatePicker value={to} onChange={event=>setTo(event.target.value)}/></OrderField>
              <button type="button" className="secondary-button orders-icon-action" onClick={resetFilters}><OrdersIcon type="reset"/><span>Reset</span></button>
            </section>
            {invalidRange && <div className="error-message" role="alert">The end date must be on or after the start date.</div>}
            <section className="metrics-grid orders-summary" aria-label="Order summary">
              <OrderMetric title="Order subtotal" value={formatCurrency(activeOrders.reduce((sum,order)=>sum+amount(order.subtotal),0))} note="Matching active orders"/>
              <OrderMetric title="Order total" value={formatCurrency(activeOrders.reduce((sum,order)=>sum+amount(order.total_amount),0))} note="Including recorded shipping charges"/>
              <OrderMetric title="Transactions" value={filteredOrders.length} note={`${activeOrders.length} active; ${filteredOrders.length-activeOrders.length} cancelled / expired / forfeited`}/>
              <OrderMetric title="Awaiting payment" value={activeOrders.filter(order=>["PENDING","PAYMENT_PENDING","PARTIAL","PARTIALLY_PAID","UNPAID","PAYMENT_REOPENED"].includes(normalized(order.payment_status||order.latest_payment_status))).length} note="Orders by recorded payment status"/>
            </section>

            <section className="dashboard-panel selling-workspace-nav-panel orders-workspace-nav-panel" style={{ marginBottom: 18 }}>
              <div role="tablist" aria-label="Order sections" className="selling-workspace-nav">
                {[
                  { key: "SUMMARY", label: "Summary", icon: "summary" },
                  { key: "ORDERS", label: "Orders", icon: "transactions" },
                  { key: "GROUPS", label: "Order groups", icon: "groups" },
                ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === key}
                    aria-controls="orders-panel"
                    className={activeTab === key ? "primary-button" : "secondary-button"}
                    onClick={() => setActiveTab(key)}
                  >
                    <span className="selling-nav-icon"><OrdersIcon type={icon} /></span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="dashboard-panel" id="orders-panel" role="tabpanel">
              <div className="panel-header">
                <div>
                  <h2>{activeTab === "SUMMARY" ? "Sales by channel" : activeTab === "GROUPS" ? "Order groups" : "Order list"}</h2>
                  <p>{activeTab === "SUMMARY" ? `${summaryRows.length} channel summary row(s)` : activeTab === "GROUPS" ? `${filteredGroups.length} group(s) linked to matching orders` : `${filteredOrders.length} record(s)`}</p>
                </div>
              </div>

              {activeTab === "SUMMARY" && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Channel</th><th>Transactions</th><th>Subtotal</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row) => (
                        <tr key={row.channel}>
                          <td>{statusLabel(row.channel)}</td>
                          <td>{row.count}</td>
                          <td>{formatCurrency(row.subtotal)}</td>
                          <td>{formatCurrency(row.total)}</td>
                        </tr>
                      ))}
                      {!summaryRows.length && <tr><td colSpan="4" className="empty-table-cell">No active sales match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "ORDERS" && (
                <>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Created</th><th>Order / group</th><th>Buyer / item</th><th>Channel</th><th>Total</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {orderPagination.visibleRecords.map((order) => (
                        <tr key={order.order_id} className="clickable-row" onClick={() => openOrder(order.order_id)}>
                          <td>{orderDay(order.created_at) || "-"}<small className="orders-table-subtext">{formatTime(order.created_at)}</small></td>
                          <td>
                            <button type="button" className="orders-link-button" onClick={(event) => { event.stopPropagation(); openOrder(order.order_id); }}>{order.order_number || order.order_id}</button>
                            {order.order_group_id ? (
                              <small className="orders-table-subtext orders-group-reference">{groupMap.get(order.order_group_id)?.group_number || order.order_group_id}</small>
                            ) : (
                              <small className="orders-table-subtext">Standalone order</small>
                            )}
                          </td>
                          <td>{order.buyer_name || "-"}<small className="orders-table-subtext">{order.item_label || "Item details not supplied"}</small></td>
                          <td>{statusLabel(order.source_type || "Unspecified")}</td>
                          <td>{formatCurrency(order.total_amount)}</td>
                          <td>
                            <div className="orders-status-pair">
                              <span>Order</span>
                              <StatusBadge status={order.order_status} />
                              <span>Payment</span>
                              <StatusBadge status={order.latest_payment_status || order.payment_status} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredOrders.length && <tr><td colSpan="6" className="empty-table-cell">No orders match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <RecordPagination pagination={orderPagination} label="orders" />
                </>
              )}

              {activeTab === "GROUPS" && (
                <>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Created</th><th>Group</th><th>Buyer</th><th>Items</th><th>Total</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {groupPagination.visibleRecords.map((group) => (
                        <tr key={group.order_group_id}>
                          <td>{orderDay(group.created_at) || "-"}<small className="orders-table-subtext">{formatTime(group.created_at)}</small></td>
                          <td>{group.group_number || group.order_group_id}<small className="orders-table-subtext">{group.order_group_id}</small></td>
                          <td>{group.buyer_name || group.buyer_fb_user_id || "-"}</td>
                          <td>{group.item_count ?? 0}</td>
                          <td>{formatCurrency(group.total_amount)}</td>
                          <td><StatusBadge status={group.group_status} /></td>
                        </tr>
                      ))}
                      {!filteredGroups.length && <tr><td colSpan="6" className="empty-table-cell">No order groups match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <RecordPagination pagination={groupPagination} label="groups" />
                </>
              )}
            </section>
          </>
        )}
    {page === "order-detail" && (
          <>
            <button className="back-button" onClick={() => setPage("orders")}>← Back to orders</button>

            {detailLoading ? (
              <div className="loading-card detail-loading"><h2>Loading order</h2></div>
            ) : orderDetail ? (
              <>
                <header className="dashboard-header">
                  <div>
                    <p className="eyebrow">ORDER DETAIL</p>
                    <h1>{orderDetail.order_number}</h1>
                    <p>{orderDetail.item_label}</p>
                  </div>
                  <div className="orders-header-actions">
                    <StatusBadge status={orderDetail.order_status} />
                    {canUseManualActions && !orderDetail.order_group_id && orderDetail.order_status==="PAYMENT_PENDING" && normalized(orderDetail.payment_status||orderDetail.latest_payment_status)!=="PAID" && <button type="button" className="secondary-button" onClick={()=>{setManualNotice("");setManualPaymentReference("");setManualPaymentOpen(true);}}>Record payment</button>}
                    {canUseManualActions && !["CANCELLED","SHIPPED","DELIVERED","COMPLETED"].includes(normalized(orderDetail.order_status)) && <>
                      <button type="button" className="secondary-button danger-action" onClick={()=>{const reason=window.prompt("Reason for cancelling this order:");if(reason===null)return;if(!window.confirm("Cancel this order? Any recorded payment will not be refunded automatically."))return;runManualOrderAction("CANCEL",{reason});}}>Cancel order</button>
                    </>}
                  </div>
                </header>
                {manualNotice && !manualOrderOpen && !manualMessageOpen && <div className="manual-order-notice" role="status">{manualNotice}<button type="button" aria-label="Dismiss notice" onClick={()=>setManualNotice("")}>×</button></div>}

                <section className="detail-grid">
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Order</h2></div>
                    <DetailRow label="Subtotal" value={formatCurrency(orderDetail.subtotal)} />
                    <DetailRow label="Shipping fee" value={formatCurrency(orderDetail.shipping_fee)} />
                    <DetailRow label="Total" value={formatCurrency(orderDetail.total_amount)} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Buyer</h2></div>
                    <DetailRow label="Name" value={orderDetail.buyer_name || "-"} />
                    <DetailRow label="Phone" value={orderDetail.buyer_phone || "-"} />
                    <DetailRow label="Email" value={orderDetail.buyer_email || "-"} />
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Payment</h2></div>
                    <DetailRow label="Status" value={orderDetail.latest_payment_status || orderDetail.payment_status || "-"} />
                    <DetailRow label="Provider" value={orderDetail.provider || "-"} />
                    <DetailRow label="Amount" value={formatCurrency(orderDetail.payment_amount)} />
                  </div>
                  <div className="detail-card">
                    <div className="detail-card-header"><h2>Delivery</h2></div>
                    <DetailRow label="Recipient" value={orderDetail.shipping_name || "-"} />
                    <DetailRow label="Phone" value={orderDetail.shipping_phone || "-"} />
                    <DetailRow label="Address" value={[orderDetail.shipping_address_line1,orderDetail.shipping_address_line2,orderDetail.shipping_city,orderDetail.shipping_province,orderDetail.shipping_postal_code,orderDetail.shipping_country].filter(Boolean).join(", ") || "-"} />
                    {orderDetail.notes && <DetailRow label="Notes" value={orderDetail.notes} />}
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}
    {manualOrderOpen && <div className="manual-order-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!manualBusy)setManualOrderOpen(false);}}>
      <section className="manual-order-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-order-title">
        <header><div><p className="eyebrow">STAFF ACTION</p><h2 id="manual-order-title">Create manual order</h2><p>Choose products, add buyer and delivery details, then reserve available stock.</p></div><button type="button" aria-label="Close" onClick={()=>setManualOrderOpen(false)} disabled={manualBusy}>×</button></header>
        {manualNotice && <div className="manual-order-notice" role="alert">{manualNotice}</div>}
        <form onSubmit={submitManualOrder}>
          <section className="manual-order-section"><div className="manual-order-section-heading"><span className="manual-order-step">01</span><div><h3>Buyer</h3><p>Who is placing the order?</p></div></div>
            <div className="manual-order-grid">
              <ManualField label="Buyer name"><input required maxLength="160" autoComplete="name" value={manualOrder.buyer_name} onChange={e=>setManualOrder({...manualOrder,buyer_name:e.target.value})}/></ManualField>
              <ManualField label="Facebook user ID (optional)"><input value={manualOrder.buyer_fb_user_id} onChange={e=>setManualOrder({...manualOrder,buyer_fb_user_id:e.target.value})}/></ManualField>
              <ManualField label="Buyer phone"><input autoComplete="tel" value={manualOrder.buyer_phone} onChange={e=>setManualOrder({...manualOrder,buyer_phone:e.target.value})}/></ManualField>
              <ManualField label="Buyer email"><input type="email" autoComplete="email" value={manualOrder.buyer_email} onChange={e=>setManualOrder({...manualOrder,buyer_email:e.target.value})}/></ManualField>
            </div>
          </section>
          <section className="manual-order-section"><div className="manual-order-items-heading"><div className="manual-order-section-heading"><span className="manual-order-step">02</span><div><h3>Products</h3><p>Select from active inventory. Available quantities are checked across all lines.</p></div></div><button type="button" className="secondary-button manual-add-item" onClick={()=>setManualItems(current=>[...current,{inventory_item_id:"",quantity:"1",unit_price:""}])}>＋ Add product</button></div>
          <div className="manual-order-lines">{manualItems.map((row,index)=>{
            const selected=manualInventory.find(item=>item.inventory_item_id===row.inventory_item_id);
            const otherSelected=manualItems.filter((line,i)=>i!==index&&line.inventory_item_id===row.inventory_item_id).reduce((sum,line)=>sum+(Number(line.quantity)||0),0);
            const availableForLine=Math.max(0,Number(selected?.qty_available||0)-otherSelected);
            return <div className="manual-order-line" key={index}>
              <ManualField label="Inventory item"><select required value={row.inventory_item_id} onChange={event=>{const item=manualInventory.find(x=>x.inventory_item_id===event.target.value);setManualItems(current=>current.map((line,i)=>i===index?{...line,inventory_item_id:event.target.value,unit_price:String(item?.default_selling_price??"")}:line));}}><option value="">Select product</option>{manualInventory.map(item=><option key={item.inventory_item_id} value={item.inventory_item_id} disabled={Number(item.qty_available)<1}>{item.item_code} · {item.item_name}</option>)}</select>{selected&&<small className="manual-stock-hint">{availableForLine} available for this line</small>}</ManualField>
              <ManualField label="Quantity"><input type="number" min="0.0001" step="0.0001" max={availableForLine||undefined} required value={row.quantity} onChange={event=>setManualItems(current=>current.map((line,i)=>i===index?{...line,quantity:event.target.value}:line))}/></ManualField>
              <ManualField label="Unit price"><input type="number" min="0" step="0.01" required value={row.unit_price} onChange={event=>setManualItems(current=>current.map((line,i)=>i===index?{...line,unit_price:event.target.value}:line))}/></ManualField>
              <button type="button" className="manual-remove-line" aria-label={`Remove product ${index+1}`} title="Remove product" disabled={manualItems.length===1} onClick={()=>setManualItems(current=>current.filter((_,i)=>i!==index))}>×</button>
              <div className="manual-line-total">Line total <strong>{formatCurrency((Number(row.quantity)||0)*(Number(row.unit_price)||0))}</strong></div>
            </div>;
          })}</div>{manualStockIssues.length>0&&<p className="manual-stock-error" role="alert">{manualStockIssues[0]}</p>}
          </section>
          <section className="manual-order-section"><div className="manual-order-section-heading"><span className="manual-order-step">03</span><div><h3>Delivery</h3><p>Required for the order’s delivery record.</p></div></div>
            <div className="manual-order-grid">
              <ManualField label="Recipient name"><input required autoComplete="shipping name" value={manualOrder.shipping_name} onChange={e=>setManualOrder({...manualOrder,shipping_name:e.target.value})}/></ManualField>
              <ManualField label="Recipient phone"><input required autoComplete="shipping tel" value={manualOrder.shipping_phone} onChange={e=>setManualOrder({...manualOrder,shipping_phone:e.target.value})}/></ManualField>
              <ManualField label="Street address"><input required autoComplete="shipping address-line1" value={manualOrder.shipping_address_line1} onChange={e=>setManualOrder({...manualOrder,shipping_address_line1:e.target.value})}/></ManualField>
              <ManualField label="Address line 2"><input autoComplete="shipping address-line2" value={manualOrder.shipping_address_line2} onChange={e=>setManualOrder({...manualOrder,shipping_address_line2:e.target.value})}/></ManualField>
              <ManualField label="City"><input required autoComplete="shipping address-level2" value={manualOrder.shipping_city} onChange={e=>setManualOrder({...manualOrder,shipping_city:e.target.value})}/></ManualField>
              <ManualField label="Province"><input required autoComplete="shipping address-level1" value={manualOrder.shipping_province} onChange={e=>setManualOrder({...manualOrder,shipping_province:e.target.value})}/></ManualField>
              <ManualField label="Postal code"><input autoComplete="shipping postal-code" value={manualOrder.shipping_postal_code} onChange={e=>setManualOrder({...manualOrder,shipping_postal_code:e.target.value})}/></ManualField>
              <ManualField label="Shipping fee"><input type="number" min="0" step="0.01" value={manualOrder.shipping_fee} onChange={e=>setManualOrder({...manualOrder,shipping_fee:e.target.value})}/></ManualField>
              <ManualField label="Staff notes"><input value={manualOrder.notes} onChange={e=>setManualOrder({...manualOrder,notes:e.target.value})}/></ManualField>
            </div>
          </section>
          <aside className="manual-order-summary"><div><span>{manualItems.filter(row=>row.inventory_item_id).length} product line{manualItems.filter(row=>row.inventory_item_id).length===1?"":"s"}</span><span>Subtotal <strong>{formatCurrency(manualSubtotal)}</strong></span><span>Shipping <strong>{formatCurrency(manualShippingFee)}</strong></span></div><p><span>Order total</span><strong>{formatCurrency(manualTotal)}</strong></p></aside>
          <footer><button type="button" className="secondary-button" onClick={()=>setManualOrderOpen(false)} disabled={manualBusy}>Cancel</button><button type="submit" className="primary-button" disabled={manualBusy||!manualInventory.length||manualStockIssues.length>0}>{manualBusy?"Creating order…":"Create order"}</button></footer>
        </form>
      </section>
    </div>}
    {manualMessageOpen && <div className="manual-order-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!manualBusy)setManualMessageOpen(false);}}>
      <section className="manual-order-dialog manual-send-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-send-title">
        <header><div><p className="eyebrow">STAFF ACTION</p><h2 id="manual-send-title">Send chat or comment</h2><p>Review the Page, target and text before sending. Messenger replies must follow Meta’s supported messaging window.</p></div><button type="button" aria-label="Close" onClick={()=>setManualMessageOpen(false)} disabled={manualBusy}>×</button></header>
        {manualNotice && <div className="manual-order-notice" role="alert">{manualNotice}</div>}
        <form onSubmit={submitManualMessage}>
          <div className="manual-order-grid">
            <ManualField label="Send as"><select value={manualMessage.channel} onChange={e=>setManualMessage({...manualMessage,channel:e.target.value,target_id:""})}><option value="MESSENGER">Messenger chat</option><option value="COMMENT">Public comment reply</option></select></ManualField>
            <ManualField label="Facebook Page"><select required value={manualMessage.fb_page_id} onChange={e=>setManualMessage({...manualMessage,fb_page_id:e.target.value})}><option value="">Select Page</option>{manualPages.map(p=><option key={p.fb_page_id} value={p.fb_page_id}>{p.page_nm || p.fb_page_id}</option>)}</select></ManualField>
            <ManualField label={manualMessage.channel==="MESSENGER"?"Recipient PSID":"Facebook comment ID"}><input required value={manualMessage.target_id} onChange={e=>setManualMessage({...manualMessage,target_id:e.target.value})} placeholder={manualMessage.channel==="MESSENGER"?"Paste the Page-scoped recipient ID":"Paste the comment ID to reply to"}/></ManualField>
            <ManualField label="Message"><textarea required rows="5" maxLength="2000" value={manualMessage.message} onChange={e=>setManualMessage({...manualMessage,message:e.target.value})}/></ManualField>
          </div>
          <div className="manual-send-preview"><small>PREVIEW · {manualMessage.channel==="MESSENGER"?"MESSENGER MESSAGE":"PUBLIC COMMENT REPLY"}</small><p>{manualMessage.message || "Your message will appear here."}</p><span>To: {manualMessage.target_id || "Not selected"}</span></div>
          <footer><button type="button" className="secondary-button" onClick={()=>setManualMessageOpen(false)} disabled={manualBusy}>Cancel</button><button type="submit" className="primary-button" disabled={manualBusy||!manualPages.length}>{manualBusy?"Sending…":"Confirm and send"}</button></footer>
        </form>
      </section>
    </div>}
    {manualPaymentOpen && <div className="manual-order-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!manualBusy)setManualPaymentOpen(false);}}>
      <section className="manual-order-dialog manual-send-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-payment-title">
        <header><div><p className="eyebrow">STAFF PAYMENT</p><h2 id="manual-payment-title">Record payment received</h2><p>Use this only after verifying the buyer’s payment. EO2MATE will record the method and update the order.</p></div><button type="button" aria-label="Close" onClick={()=>setManualPaymentOpen(false)} disabled={manualBusy}>×</button></header>
        {manualNotice && <div className="manual-order-notice" role="alert">{manualNotice}</div>}
        <form onSubmit={event=>{event.preventDefault();if(!window.confirm(`Record ${formatCurrency(orderDetail?.total_amount)} as received for ${orderDetail?.order_number}? Continue only after verifying the funds were received.`))return;runManualOrderAction("RECORD_PAYMENT",{method:manualPaymentMethod,reference:manualPaymentReference});}}>
          <div className="manual-order-grid">
            <ManualField label="Payment method"><select value={manualPaymentMethod} onChange={e=>setManualPaymentMethod(e.target.value)}><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="E_WALLET">E-wallet</option><option value="OTHER">Other</option></select></ManualField>
            <ManualField label="Reference or staff note"><input value={manualPaymentReference} onChange={e=>setManualPaymentReference(e.target.value)} maxLength="250"/></ManualField>
          </div>
          <p className="manual-order-total">Amount to record: {formatCurrency(orderDetail?.total_amount)}</p>
          <footer><button type="button" className="secondary-button" onClick={()=>setManualPaymentOpen(false)} disabled={manualBusy}>Cancel</button><button type="submit" className="primary-button" disabled={manualBusy}>{manualBusy?"Saving…":"Confirm payment"}</button></footer>
        </form>
      </section>
    </div>}
  </div>);
}
