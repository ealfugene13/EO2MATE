import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

function dt(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Badge({ value }) {
  const v = String(value || "-").toUpperCase();
  const cls =
    ["ACTIVE", "TRIAL", "COMPLETE"].includes(v)
      ? "status-badge status-active"
      : ["PAST_DUE", "SUSPENDED", "INACTIVE", "EXPIRED", "CANCELLED"].includes(v)
        ? "status-badge status-danger"
        : "status-badge status-warning";
  return <span className={cls}>{v.replaceAll("_", " ")}</span>;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState([]);
  const [adminRole, setAdminRole] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => { loadClients(); }, []);

  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke("admin-clients", { method: "POST", body });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || "Admin request failed.");
    return data;
  }

  async function loadClients() {
    setLoading(true);
    setErrorMessage("");
    try {
      const data = await invoke({ action: "LIST" });
      setClients(data.clients || []);
      setAdminRole(data.admin_role || "");
    } catch (error) {
      setErrorMessage(error.message || "Unable to load clients.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      [client.name, client.contact_email, client.client_id, client.subscription?.subscription_status, client.subscription?.allowed_environment]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [clients, search]);

  function editClient(client) {
    setEditing(client);
    setForm({
      name: client.name || "",
      status: client.status || "ACTIVE",
      subscription_status: client.subscription?.subscription_status || "TRIAL",
      allowed_environment: client.subscription?.allowed_environment || "CLNT",
      subscription_ends_at: client.subscription?.ends_at ? new Date(client.subscription.ends_at).toISOString().slice(0, 10) : "",
      subscription_notes: client.subscription?.notes || "",
    });
    window.setTimeout(() => document.getElementById("admin-client-editor")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  async function saveClient(event) {
    event.preventDefault();
    if (!editing) return;

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      await invoke({
        action: "UPDATE",
        client_id: editing.client_id,
        name: form.name,
        status: form.status,
        subscription_status: form.subscription_status,
        allowed_environment: form.allowed_environment,
        default_environment: form.allowed_environment,
        subscription_ends_at: form.subscription_ends_at ? `${form.subscription_ends_at}T23:59:59+08:00` : null,
        subscription_notes: form.subscription_notes || null,
      });
      setMessage(`${form.name} updated.`);
      setEditing(null);
      await loadClients();
    } catch (error) {
      setErrorMessage(error.message || "Unable to update client.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">EO2MATE PLATFORM ADMIN</p>
          <h1>Clients</h1>
          <p>Cross-client administration. Tenant users never receive this client list.</p>
        </div>
        <button className="icon-button refresh-icon-button" type="button" onClick={loadClients} disabled={loading} title="Refresh" aria-label="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" /><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
      </header>

      <section className="admin-security-banner">
        <div className="admin-security-icon">A</div>
        <div><strong>Platform access · {adminRole || "ADMIN"}</strong><span>Subscription, environment and cross-client controls are handled through platform-admin APIs.</span></div>
      </section>

      {message && <div className="success-message global-error">{message}</div>}
      {errorMessage && <div className="dashboard-error global-error">{errorMessage}</div>}

      {editing && (
        <section id="admin-client-editor" className="dashboard-panel admin-client-editor">
          <div className="panel-header"><div><h2>Editing {editing.name}</h2><p>Subscription status automatically synchronizes client automation ON/OFF.</p></div></div>
          <form className="admin-client-form" onSubmit={saveClient}>
            <label>Client name<input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required /></label>
            <label>Account<select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
            <label>Subscription<select value={form.subscription_status} onChange={(e) => setForm((c) => ({ ...c, subscription_status: e.target.value }))}><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="PAST_DUE">Past Due</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option><option value="EXPIRED">Expired</option></select></label>
            <label>Allowed mode<select value={form.allowed_environment} onChange={(e) => setForm((c) => ({ ...c, allowed_environment: e.target.value }))}><option value="CLNT">CLNT · Manual</option><option value="TEST">TEST · PayMongo test</option><option value="PROD">PROD · Live PayMongo</option></select></label>
            <label>Subscription ends<input type="date" value={form.subscription_ends_at} onChange={(e) => setForm((c) => ({ ...c, subscription_ends_at: e.target.value }))} /></label>
            <label className="admin-client-notes">Admin notes<input value={form.subscription_notes} onChange={(e) => setForm((c) => ({ ...c, subscription_notes: e.target.value }))} placeholder="Internal notes" /></label>
            <div className="admin-client-form-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(null)} disabled={loading}>Cancel</button>
              <button type="submit" className="primary-button" disabled={loading}>{loading ? "Saving..." : "Save Client"}</button>
            </div>
          </form>
        </section>
      )}

      <section className="dashboard-panel">
        <div className="panel-header">
          <div><h2>Client accounts</h2><p>{filtered.length} of {clients.length} clients</p></div>
          <input className="admin-client-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, email, mode..." />
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Client</th><th>Onboarding</th><th>Subscription</th><th>Mode</th><th>Automation</th><th>Pages</th><th>End</th><th>Admin</th></tr></thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.client_id}>
                  <td><strong>{client.name}</strong><div className="table-muted">{client.contact_email || client.client_id}</div></td>
                  <td><Badge value={client.onboarding_status} /></td>
                  <td><Badge value={client.subscription?.subscription_status || "-"} /></td>
                  <td><strong>{client.subscription?.allowed_environment || client.default_environment || "CLNT"}</strong></td>
                  <td><Badge value={client.automation_enabled ? "ACTIVE" : "SUSPENDED"} />{!client.automation_enabled && client.automation_reason && <div className="table-muted">{client.automation_reason}</div>}</td>
                  <td>{client.active_page_count || 0} / {client.page_count || 0}</td>
                  <td>{dt(client.subscription?.ends_at || client.trial_ends_at)}</td>
                  <td><button type="button" className="table-action-button" onClick={() => editClient(client)}>Manage</button></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan="8" className="empty-table-cell">No clients found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
