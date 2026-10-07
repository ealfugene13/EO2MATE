function MetricCard({ title, value, subtitle, onClick }) {
  return (
    <button type="button" className="metric-card metric-button" onClick={onClick}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </button>
  );
}

function formatCurrency(value) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0)); }
export default function LiveMiningPage() { return (<>
                <section className="dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Live Mining</h2>
                      <p>Monitor Facebook Live selling sessions using MINE codes and real-time buyer claims.</p>
                    </div>
                    <button className="primary-button" type="button" disabled title="Enabled after Facebook Live backend integration">Start / Connect Live</button>
                  </div>
                  <div className="metrics-grid">
                    <MetricCard title="Live sessions" value="0" subtitle="Currently connected" />
                    <MetricCard title="Live comments" value="0" subtitle="Processed comments" />
                    <MetricCard title="Valid MINE claims" value="0" subtitle="Matched MINE codes" />
                    <MetricCard title="Live buyers" value="0" subtitle="Unique buyers" />
                    <MetricCard title="Live sales" value={formatCurrency(0)} subtitle="Claimed value" />
                  </div>
                </section>
                <section className="dashboard-panel">
                  <div className="panel-header"><div><h2>Live sessions</h2><p>Current and previous Live Mining sessions.</p></div></div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Live</th><th>Facebook Page</th><th>Status</th><th>MINE Codes</th><th>Claims</th><th>Buyers</th><th>Sales</th><th>Started</th></tr></thead>
                      <tbody><tr><td colSpan="8">No Live Mining sessions yet.</td></tr></tbody>
                    </table>
                  </div>
                </section>
              </>); }
