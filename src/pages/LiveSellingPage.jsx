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

export default function LiveSellingPage({ liveSellingWorkspaceTab, metaConnected, page, setLiveSellingWorkspaceTab }) {


  return (<>
    {metaConnected && page === "live-selling" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">FACEBOOK SELLING</p>
                <h1>Live Selling</h1>
                <p>Live-selling dashboard for sessions, claims, buyers and sales performance. Transaction processing will activate when the Live Selling module is enabled.</p>
              </div>
            </header>
            <section className="metrics-grid">
              <MetricCard title="Live sessions" value="0" subtitle="Sessions in selected period" />
              <MetricCard title="Active session" value="0" subtitle="Currently live" />
              <MetricCard title="Claims" value="0" subtitle="Live comment claims" />
              <MetricCard title="Unique buyers" value="0" subtitle="Live customers" />
              <MetricCard title="Items sold" value="0" subtitle="Allocated quantity" />
              <MetricCard title="Sales value" value={formatCurrency(0)} subtitle="Gross live-selling value" />
            </section>
            <section className="selling-tabs">
              <div>
                {["DASHBOARD", "SUMMARY", "POSTS"].map((tab) => (
                  <button key={tab} type="button" className={liveSellingWorkspaceTab === tab ? "primary-button" : "secondary-button"} onClick={() => setLiveSellingWorkspaceTab(tab)}>
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
                <button type="button" className="secondary-button" disabled title="Coming soon">Create Post · Soon</button>
              </div>
            </section>
            <section className="dashboard-panel">
              <div className="panel-header"><div><h2>{liveSellingWorkspaceTab === "POSTS" ? "Live Selling posts" : liveSellingWorkspaceTab === "SUMMARY" ? "Live Selling summary" : "Live Selling dashboard"}</h2><p>Ready for the Live Selling backend connection without exposing placeholder data as real activity.</p></div></div>
              <div className="table-wrapper"><table><thead><tr><th>Session / Post</th><th>Status</th><th>Claims</th><th>Buyers</th><th>Items</th><th>Sales</th></tr></thead><tbody><tr><td colSpan="6">No Live Selling records yet.</td></tr></tbody></table></div>
            </section>
          </>
        )}
  </>);
}
