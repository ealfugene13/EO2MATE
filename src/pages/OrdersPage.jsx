import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import "./OrdersPage.css";


const normalized = value => String(value || "").toUpperCase();
const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const orderDay = value => value && !Number.isNaN(new Date(value).getTime()) ? new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Manila"}).format(new Date(value)) : "";
function OrdersIcon({type}) {
  const paths={export:<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>,reset:<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/>,refresh:<><path d="M20 5v6h-6M4 19v-6h6"/><path d="M6 8a7 7 0 0 1 12-1l2 4M4 13l2 4a7 7 0 0 0 12-1"/></>};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}
function OrderField({label,children}) {return <label className="orders-filter-field"><span>{label}</span>{children}</label>;}
function OrderMetric({title,value,note}) {return <div className="metric-card metric-button"><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-subtitle">{note}</div></div>;}
function csvCell(value){let text=String(value??"");if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}

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

export default function OrdersPage({ client, detailRequest, page, setErrorMessage, setPage, navigationFilter }) {
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [channel,setChannel]=useState("ALL"),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const invalidRange=!!(from && to && from>to);
  useEffect(() => { if (navigationFilter?.page === "orders") { setOrderStatusFilter(navigationFilter.value); setOrderSearch(""); setChannel("ALL"); setFrom(""); setTo(""); } }, [navigationFilter]);
  const [orders, setOrders] = useState([]);

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
  function resetFilters(){setOrderSearch("");setOrderStatusFilter("ALL");setChannel("ALL");setFrom("");setTo("");}
  function exportOrders(){
    const rows=[["Order","Item","Buyer","Channel","Subtotal","Shipping","Total","Order status","Payment status","Created (Manila)"],...filteredOrders.map(order=>[order.order_number,order.item_label,order.buyer_name,order.source_type,order.subtotal,order.shipping_fee,order.total_amount,order.order_status,order.latest_payment_status||order.payment_status,formatDateTime(order.created_at)])];
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
        supabase.from("client_order_list").select("*").eq("client_id", client.client_id).order("created_at", { ascending: false })
      ]);
      if (version !== pageLoadVersion.current) return;
      for (const result of results) if (result.error) throw result.error;
      setOrders(results[0].data || []);
    } catch (error) {
      if (version === pageLoadVersion.current) setErrorMessage(error.message || "Unable to load this page.");
    } finally {
      if (version === pageLoadVersion.current) setPageDataLoading(false);
    }
  }
  useEffect(() => { loadPortal(); return () => { pageLoadVersion.current++; }; }, [client?.client_id]);

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
                <button type="button" className="secondary-button orders-icon-action" onClick={exportOrders} disabled={!filteredOrders.length || invalidRange}><OrdersIcon type="export"/><span>Export</span></button>
                <button type="button" className="icon-button refresh-icon-button orders-icon-action" onClick={loadPortal} title="Refresh Orders" aria-label="Refresh Orders"><OrdersIcon type="refresh"/></button>
              </div>
            </header>
            <section className="toolbar-card orders-top-filters" aria-label="Order filters">
              <OrderField label="Search"><input className="search-input" value={orderSearch} onChange={event=>setOrderSearch(event.target.value)} placeholder="Order, buyer or item…"/></OrderField>
              <OrderField label="Channel"><select className="filter-select" value={channel} onChange={event=>setChannel(event.target.value)}><option value="ALL">All channels</option>{channels.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></OrderField>
              <OrderField label="Order status"><select className="filter-select" value={orderStatusFilter} onChange={event=>setOrderStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{statuses.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></OrderField>
              <OrderField label="From (Manila)"><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></OrderField>
              <OrderField label="To (Manila)"><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></OrderField>
              <button type="button" className="secondary-button orders-icon-action" onClick={resetFilters}><OrdersIcon type="reset"/><span>Reset</span></button>
            </section>
            {invalidRange && <div className="error-message" role="alert">The end date must be on or after the start date.</div>}
            <section className="metrics-grid orders-summary" aria-label="Order summary">
              <OrderMetric title="Order subtotal" value={formatCurrency(activeOrders.reduce((sum,order)=>sum+amount(order.subtotal),0))} note="Matching active orders"/>
              <OrderMetric title="Order total" value={formatCurrency(activeOrders.reduce((sum,order)=>sum+amount(order.total_amount),0))} note="Including recorded shipping charges"/>
              <OrderMetric title="Transactions" value={filteredOrders.length} note={`${activeOrders.length} active; ${filteredOrders.length-activeOrders.length} cancelled / expired / forfeited`}/>
              <OrderMetric title="Awaiting payment" value={activeOrders.filter(order=>["PENDING","PAYMENT_PENDING","PARTIAL","PARTIALLY_PAID","UNPAID","PAYMENT_REOPENED"].includes(normalized(order.payment_status||order.latest_payment_status))).length} note="Orders by recorded payment status"/>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>Order list</h2><p>{filteredOrders.length} record(s)</p></div></div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Order</th><th>Item</th><th>Buyer</th><th>Total</th><th>Order status</th><th>Payment</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.order_id} className="clickable-row" onClick={() => openOrder(order.order_id)}>
                        <td>{order.order_number}</td>
                        <td>{order.item_label}</td>
                        <td>{order.buyer_name || "-"}</td>
                        <td>{formatCurrency(order.total_amount)}</td>
                        <td><StatusBadge status={order.order_status} /></td>
                        <td><StatusBadge status={order.latest_payment_status || order.payment_status} /></td>
                        <td>{formatDateTime(order.created_at)}</td>
                      </tr>
                    ))}
                    {!filteredOrders.length && <tr><td colSpan="7" className="empty-table-cell">No orders match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
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
                  <StatusBadge status={orderDetail.order_status} />
                </header>

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
                </section>
              </>
            ) : null}
          </>
        )}
  </div>);
}
