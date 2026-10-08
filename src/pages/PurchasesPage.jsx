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

function WorkspaceIcon({ type }) {
  const paths = {
    summary: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    transactions: <><path d="M4 20V10m6 10V4m6 16v-8M2 20h20"/></>,
    groups: <><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M8 21h11a2 2 0 0 0 2-2V8M7 7h5M7 11h5"/></>,
    purchases: <><path d="M3 3h2l3 12h10l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    suppliers: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6"/></>,
    receiving: <><path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10m-5-5 3 3 6-6"/></>,
    create: <><path d="M12 5v14M5 12h14"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || paths.summary}</svg>;
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

export default function PurchasesPage({ page }) {
  const [purchasesTab, setPurchasesTab] = useState("SUMMARY");

  return (<>
    {page === "purchases" && (
          <>
            <header className="dashboard-header"><div><p className="eyebrow">PURCHASING</p><h1>Purchases</h1><p>Record stock purchases, suppliers, receiving and inventory cost.</p></div></header>
            <section className="metrics-grid"><MetricCard title="Purchases" value={formatCurrency(0)} subtitle="Selected period" /><MetricCard title="Open POs" value="0" subtitle="Awaiting receipt" /><MetricCard title="Received" value="0" subtitle="Completed receipts" /><MetricCard title="Suppliers" value="0" subtitle="Active suppliers" /><MetricCard title="Items received" value="0" subtitle="Purchased quantity" /><MetricCard title="Outstanding" value={formatCurrency(0)} subtitle="Supplier payable" /></section>
            <section className="dashboard-panel selling-workspace-nav-panel" style={{ marginBottom: 18 }}>
              <div className="selling-workspace-nav" role="tablist" aria-label="Purchase sections" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                {[
                  { key: "SUMMARY", label: "Summary", icon: "summary" },
                  { key: "PURCHASES", label: "Purchases", icon: "purchases" },
                  { key: "SUPPLIERS", label: "Suppliers", icon: "suppliers" },
                  { key: "RECEIVING", label: "Receiving", icon: "receiving" },
                ].map(({key,label,icon}) => <button key={key} type="button" role="tab" aria-selected={purchasesTab===key} aria-controls="purchases-panel" className={purchasesTab===key?"primary-button":"secondary-button"} onClick={()=>setPurchasesTab(key)}><span className="selling-nav-icon"><WorkspaceIcon type={icon}/></span><span>{label}</span></button>)}
              </div>
            </section>
            <section className="dashboard-panel" id="purchases-panel" role="tabpanel"><div className="panel-header"><div><h2>{purchasesTab === "SUMMARY" ? "Purchase summary" : purchasesTab.charAt(0)+purchasesTab.slice(1).toLowerCase()}</h2><p>Purchase and supplier backend will be connected after the UI structure is approved.</p></div>{purchasesTab === "PURCHASES" && <button className="primary-button" type="button" disabled><span className="selling-nav-icon"><WorkspaceIcon type="create"/></span>New Purchase</button>}</div><div className="table-wrapper"><table><thead><tr><th>Date</th><th>Purchase Ref</th><th>Supplier</th><th>Items</th><th>Total Cost</th><th>Received</th><th>Payment</th><th>Status</th></tr></thead><tbody><tr><td colSpan="8">No purchase records yet.</td></tr></tbody></table></div></section>
          </>
        )}
  </>);
}
