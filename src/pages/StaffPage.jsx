import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";


function MetricCard({ title, value, subtitle, onClick }) {
  return (
    <button type="button" className="metric-card metric-button" onClick={onClick}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </button>
  );
}

export default function StaffPage({ page }) {
  const [staffSearch, setStaffSearch] = useState("");

  const [showStaffForm, setShowStaffForm] = useState(false);

  const [staffDraft, setStaffDraft] = useState({ name: "", email: "", role: "STAFF" });

  return (<>
    {page === "users-staff" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">MAINTENANCE · ACCESS</p>
                <h1>Users &amp; Staff</h1>
                <p>Create and maintain client staff access without exposing platform administration.</p>
              </div>
              <button className="primary-button" type="button" onClick={() => setShowStaffForm((current) => !current)}>
                {showStaffForm ? "Close Form" : "Add Staff"}
              </button>
            </header>

            {showStaffForm && (
              <section className="dashboard-panel" style={{ marginBottom: 18 }}>
                <div className="panel-header">
                  <div>
                    <h2>Invite Client Staff</h2>
                    <p>Prepare the account and permission role. Invitation delivery will be wired after the access-control backend is finalized.</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 16 }}>
                  <label>
                    <span>Full Name</span>
                    <input
                      value={staffDraft.name}
                      onChange={(event) => setStaffDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Staff name"
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={staffDraft.email}
                      onChange={(event) => setStaffDraft((current) => ({ ...current, email: event.target.value }))}
                      placeholder="staff@example.com"
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <select value={staffDraft.role} onChange={(event) => setStaffDraft((current) => ({ ...current, role: event.target.value }))}>
                      <option value="STAFF">Client Staff</option>
                      <option value="ADMIN">Client Admin</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                  <button className="secondary-button" type="button" onClick={() => { setShowStaffForm(false); setStaffDraft({ name: "", email: "", role: "STAFF" }); }}>Cancel</button>
                  <button className="primary-button" type="button" disabled title="Staff invitation backend will be connected after UI completion">Send Invitation</button>
                </div>
              </section>
            )}

            <section className="metrics-grid">
              <MetricCard title="Client Admins" value="—" subtitle="Administrative users" />
              <MetricCard title="Client Staff" value="—" subtitle="Operational users" />
              <MetricCard title="Pending Invites" value="—" subtitle="Awaiting acceptance" />
              <MetricCard title="Inactive Users" value="—" subtitle="Access disabled" />
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Client Users</h2>
                  <p>Role, status and access activity for this client only.</p>
                </div>
                <input type="search" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search users" style={{ maxWidth: 260 }} />
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Added</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: 30, color: "#718096" }}>
                        Staff accounts will appear here once client user provisioning is connected.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#f8fafc", fontSize: 13, color: "#526274" }}>
                <strong style={{ color: "#263548" }}>Access model:</strong> Client Admin can manage staff and permitted sensitive settings. Client Staff receives only the modules and actions explicitly allowed for their role.
              </div>
            </section>
          </>
        )}
  </>);
}
