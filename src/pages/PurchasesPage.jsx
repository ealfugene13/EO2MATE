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
            <section className="dashboard-panel" style={{ marginBottom: 18 }}><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["SUMMARY", "PURCHASES", "SUPPLIERS", "RECEIVING"].map((tab) => <button key={tab} type="button" className={purchasesTab === tab ? "primary-button" : "secondary-button"} onClick={() => setPurchasesTab(tab)}>{tab.charAt(0)+tab.slice(1).toLowerCase()}</button>)}</div></section>
            <section className="dashboard-panel"><div className="panel-header"><div><h2>{purchasesTab === "SUMMARY" ? "Purchase summary" : purchasesTab.charAt(0)+purchasesTab.slice(1).toLowerCase()}</h2><p>Purchase and supplier backend will be connected after the UI structure is approved.</p></div>{purchasesTab === "PURCHASES" && <button className="primary-button" type="button" disabled>New Purchase</button>}</div><div className="table-wrapper"><table><thead><tr><th>Date</th><th>Purchase Ref</th><th>Supplier</th><th>Items</th><th>Total Cost</th><th>Received</th><th>Payment</th><th>Status</th></tr></thead><tbody><tr><td colSpan="8">No purchase records yet.</td></tr></tbody></table></div></section>
          </>
        )}
  </>);
}
