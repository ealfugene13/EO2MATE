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

import LiveMiningPage from "./LiveMiningPage";

const LIVE_MODES = [
  { key: "SELLING", label: "Live Selling", icon: "sales", command: "+1 / +2", description: "Quantity-based claims during Facebook Live." },
  { key: "MINING", label: "Live Mining", icon: "mining", command: "MINE / TAKE / LOCK", description: "Priority-based claims during Facebook Live." },
  { key: "AUCTION", label: "Live Auction", icon: "auction", command: "Numeric bids", description: "Increment-validated bidding during Facebook Live." },
];

export default function LiveSellingPage({ metaConnected, page }) {
  const [mode, setMode] = useState("SELLING");
  const [section, setSection] = useState("SUMMARY");
  if (page !== "live-selling") return null;
  const current = LIVE_MODES.find((entry) => entry.key === mode);
  return <>
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">FACEBOOK LIVE OPERATIONS</p>
        <h1>Live Selling</h1>
        <p>Manage Live Selling, Live Mining and Live Auction in one workspace.</p>
      </div>
    </header>
    <section className="selling-workspace-tabs" style={{ marginBottom: 18 }}>
      <div className="selling-workspace-tablist selling-workspace-nav" role="tablist" aria-label="Live selling modes">
        {LIVE_MODES.map((entry) => <button key={entry.key} type="button" role="tab" aria-selected={mode === entry.key} className={`selling-workspace-tab${mode === entry.key ? " active" : ""}`} onClick={() => { setMode(entry.key); setSection("SUMMARY"); }}>
          <span className="selling-nav-icon"><NavIcon type={entry.icon} /></span><span>{entry.label}</span>
        </button>)}
      </div>
    </section>
    <section className="dashboard-panel" style={{ marginBottom: 18 }}>
      <div className="panel-header"><div><h2>{current.label}</h2><p>{current.description} Buyer command: <strong>{current.command}</strong>.</p></div></div>
      <div className="selling-workspace-tablist selling-workspace-nav" role="tablist" aria-label={`${current.label} sections`} style={{ margin: 14 }}>
        {[
          { key: "SUMMARY", label: "Summary", icon: "dashboard" },
          { key: "SESSIONS", label: "Sessions", icon: "reports" },
          { key: "ACTIVITY", label: mode === "AUCTION" ? "Bids" : "Claims", icon: "orders" },
          { key: "BUYERS", label: "Buyers", icon: "users" },
          { key: "REPORTS", label: "Reports", icon: "reports" },
        ].map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={section === tab.key} className={`selling-workspace-tab${section === tab.key ? " active" : ""}`} onClick={() => setSection(tab.key)}><span className="selling-nav-icon"><NavIcon type={tab.icon} /></span><span>{tab.label}</span></button>)}
      </div>
    </section>
    {mode === "MINING" && (section === "SUMMARY" || section === "SESSIONS") ? <LiveMiningPage /> : <>
      {section === "SUMMARY" && <section className="metrics-grid">
        <MetricCard title="Live sessions" value="—" subtitle="Awaiting live integration" />
        <MetricCard title="Active sessions" value="—" subtitle="Awaiting live integration" />
        <MetricCard title={mode === "AUCTION" ? "Bids" : "Claims"} value="—" subtitle="Awaiting live integration" />
        <MetricCard title="Buyers" value="—" subtitle="Awaiting live integration" />
        <MetricCard title="Sales value" value="—" subtitle="Awaiting live integration" />
      </section>}
      <section className="dashboard-panel">
        <div className="panel-header"><div><h2>{current.label} — {section.toLowerCase()}</h2><p>Facebook Live session processing and live activity retrieval are not connected yet.</p></div>
          {section === "SESSIONS" && <button type="button" className="secondary-button" disabled title="Requires live session backend and Meta permissions">Create Live Session · Soon</button>}
        </div>
        <div className="table-wrapper"><table><thead><tr><th>Session</th><th>Facebook Page</th><th>Status</th><th>{mode === "AUCTION" ? "Bids" : "Claims"}</th><th>Buyers</th><th>Sales</th></tr></thead><tbody><tr><td colSpan="6">No verified live session data available. Backend integration pending.</td></tr></tbody></table></div>
      </section>
    </>}
    {!metaConnected && <section className="dashboard-panel"><div className="panel-header"><div><h2>Facebook Page required</h2><p>Connect an authorized Facebook Page before starting a real livestream. Simulated Pages cannot publish to Meta.</p></div></div></section>}
  </>;
}
