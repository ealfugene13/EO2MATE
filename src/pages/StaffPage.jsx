import { useState } from "react";
import "./StaffPage.css";

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    add: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    admin: <><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    staff: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" /><path d="M16 5.3a3 3 0 0 1 0 5.4M17 14h.5a4 4 0 0 1 4 4v2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    disabled: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    cancel: <><path d="M5 12h14" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    shield: <><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" /><path d="M9 12h6" /></>,
  };
  return <svg {...common}>{paths[name] || paths.users}</svg>;
}

const metricCards = [
  { title: "Client admins", hint: "Manage staff and settings", icon: "admin" },
  { title: "Client staff", hint: "Operational access", icon: "staff" },
  { title: "Pending invites", hint: "Awaiting acceptance", icon: "clock" },
  { title: "Inactive users", hint: "Access disabled", icon: "disabled" },
];

export default function StaffPage({ page }) {
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffDraft, setStaffDraft] = useState({ name: "", email: "", role: "STAFF" });

  if (page !== "users-staff") return null;

  const closeForm = () => {
    setShowStaffForm(false);
    setStaffDraft({ name: "", email: "", role: "STAFF" });
  };

  return (
    <main className="staff-page">
      <header className="dashboard-header staff-header">
        <div className="staff-heading">
          <span className="staff-page-mark"><Icon name="users" size={19} /></span>
          <div>
            <p className="eyebrow">MAINTENANCE · ACCESS</p>
            <h1>Users &amp; Staff</h1>
            <p>Manage who can access this client workspace and what they can do.</p>
          </div>
        </div>
        <button className="primary-button staff-add-button" type="button" onClick={() => setShowStaffForm((current) => !current)}>
          <Icon name={showStaffForm ? "close" : "add"} />
          <span>{showStaffForm ? "Close form" : "Add staff"}</span>
        </button>
      </header>

      <section className="staff-metrics" aria-label="User access overview">
        {metricCards.map((metric) => (
          <article className="staff-metric-card" key={metric.title}>
            <span className={`staff-metric-icon staff-metric-${metric.icon}`}><Icon name={metric.icon} size={19} /></span>
            <div className="staff-metric-copy">
              <span className="staff-metric-title">{metric.title}</span>
              <strong>—</strong>
              <small>{metric.hint}</small>
            </div>
          </article>
        ))}
      </section>

      {showStaffForm && (
        <section className="dashboard-panel staff-invite-panel">
          <div className="staff-panel-heading">
            <div className="staff-section-icon"><Icon name="mail" /></div>
            <div>
              <h2>Invite a team member</h2>
              <p>Set up their name, email, and access role.</p>
            </div>
          </div>
          <div className="staff-invite-note"><span className="staff-note-dot" /> Invitations are not active yet. User provisioning will be connected in a later update.</div>
          <div className="staff-form-grid">
            <label><span>Full name</span><input value={staffDraft.name} onChange={(event) => setStaffDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Enter staff name" /></label>
            <label><span>Email address</span><input type="email" value={staffDraft.email} onChange={(event) => setStaffDraft((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></label>
            <label><span>Access role</span><select value={staffDraft.role} onChange={(event) => setStaffDraft((current) => ({ ...current, role: event.target.value }))}><option value="STAFF">Client Staff</option><option value="ADMIN">Client Admin</option></select></label>
          </div>
          <div className="staff-form-actions">
            <button className="secondary-button staff-action-button" type="button" onClick={closeForm}><Icon name="cancel" /><span>Cancel</span></button>
            <button className="primary-button staff-action-button" type="button" disabled title="User provisioning is not connected yet"><Icon name="mail" /><span>Send invite</span></button>
          </div>
        </section>
      )}

      <section className="dashboard-panel staff-users-panel">
        <div className="staff-users-heading">
          <div>
            <div className="staff-title-line"><span className="staff-section-icon small"><Icon name="users" size={16} /></span><h2>Client users</h2></div>
            <p>People with access to this client account.</p>
          </div>
          <label className="staff-search"><Icon name="search" size={17} /><input type="search" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search users" aria-label="Search users" /></label>
        </div>

        <div className="table-wrapper staff-table-wrapper">
          <table className="staff-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th>Added</th><th>Actions</th></tr></thead>
            <tbody><tr><td colSpan="7"><div className="staff-empty-state"><span className="staff-empty-icon"><Icon name="users" size={22} /></span><strong>User list isn’t connected yet</strong><span>Once client user provisioning is available, users and their access activity will appear here.</span></div></td></tr></tbody>
          </table>
        </div>

        <div className="staff-access-note"><span className="staff-access-icon"><Icon name="shield" size={17} /></span><div><strong>Access model</strong><p>Client Admins can manage staff and approved settings. Client Staff see only the modules and actions assigned to their role.</p></div></div>
      </section>
    </main>
  );
}
