import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import "./StaffPage.css";

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    add: <path d="M12 5v14M5 12h14" />, close: <path d="m18 6-12 12M6 6l12 12" />,
    admin: <><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    staff: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" /><path d="M16 5.3a3 3 0 0 1 0 5.4M17 14h.5a4 4 0 0 1 4 4v2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, disabled: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>, mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    cancel: <path d="M5 12h14" />, users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    shield: <><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" /><path d="M9 12h6" /></>, copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
  };
  return <svg {...common}>{paths[name] || paths.users}</svg>;
}

const metricCards = [
  { title: "Client admins", hint: "Manage staff and settings", icon: "admin", roles: ["OWNER", "ADMIN"] },
  { title: "Client staff", hint: "Operational access", icon: "staff", roles: ["STAFF", "VIEWER"] },
  { title: "Pending invites", hint: "Awaiting acceptance", icon: "clock", key: "invites" },
  { title: "Inactive users", hint: "Access disabled", icon: "disabled", key: "inactive" },
];

function niceDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function StaffPage({ page, client, session }) {
  const clientId = client?.client_id;
  const currentRole = String(client?.role || "").toUpperCase();
  const canManage = ["OWNER", "ADMIN"].includes(currentRole);
  const isOwner = currentRole === "OWNER";
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffDraft, setStaffDraft] = useState({ email: "", role: "STAFF" });
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [copied, setCopied] = useState(false);

  const runAdminAction = useCallback(async (action, payload = {}) => {
    const { data, error } = await supabase.rpc("eo2mate_staff_admin", { p_client_id: clientId, p_action: action, p_payload: payload });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || "Staff action failed.");
    return data;
  }, [clientId]);

  const load = useCallback(async () => {
    if (!clientId || !canManage) { setLoading(false); return; }
    setLoading(true); setErrorMessage("");
    try {
      const [userData, inviteData] = await Promise.all([runAdminAction("LIST_USERS"), runAdminAction("LIST_INVITES")]);
      setUsers(userData.users || []); setInvites(inviteData.invites || []);
    } catch (error) { setErrorMessage(error.message || "Unable to load client users."); }
    finally { setLoading(false); }
  }, [canManage, clientId, runAdminAction]);

  useEffect(() => { load(); }, [load]);
  const visibleUsers = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    return users.filter(row => !query || [row.full_name, row.email, row.role, row.status].some(value => String(value || "").toLowerCase().includes(query)));
  }, [users, staffSearch]);
  const metrics = metricCards.map(metric => ({ ...metric, value: metric.roles ? users.filter(user => metric.roles.includes(user.role)).length : metric.key === "invites" ? invites.length : users.filter(user => user.status !== "ACTIVE").length }));
  if (page !== "users-staff") return null;

  const closeForm = () => { setShowStaffForm(false); setStaffDraft({ email: "", role: "STAFF" }); setNewInviteCode(""); };

  async function sendInvite(event) {
    event.preventDefault(); setBusy(true); setErrorMessage(""); setNotice(""); setNewInviteCode("");
    try {
      const result = await runAdminAction("CREATE_INVITE", { email: staffDraft.email.trim().toLowerCase(), role: staffDraft.role });
      setNewInviteCode(result.invite_code); setNotice(`Invite code created for ${staffDraft.email.trim().toLowerCase()}. Share it with the invited user.`);
      setStaffDraft(current => ({ ...current, email: "" })); await load();
    } catch (error) { setErrorMessage(error.message || "Unable to create invite."); }
    finally { setBusy(false); }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(newInviteCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setErrorMessage("Could not copy automatically. Select and copy the invite code."); }
  }

  async function updateMember(user, payload) {
    const label = payload.status ? (payload.status === "ACTIVE" ? "restore access for" : "deactivate") : "change the role for";
    if (!window.confirm(`Are you sure you want to ${label} ${user.email}?`)) return;
    setBusy(true); setErrorMessage(""); setNotice("");
    try { const result = await runAdminAction("UPDATE_USER", { user_id: user.user_id, ...payload }); setNotice(result.message || "User access updated."); await load(); }
    catch (error) { setErrorMessage(error.message || "Unable to update user access."); }
    finally { setBusy(false); }
  }

  async function cancelInvite(invite) {
    if (!window.confirm(`Cancel the pending invite for ${invite.email}?`)) return;
    setBusy(true); setErrorMessage(""); setNotice("");
    try { await runAdminAction("CANCEL_INVITE", { invite_id: invite.invite_id }); setNotice(`Invite for ${invite.email} cancelled.`); await load(); }
    catch (error) { setErrorMessage(error.message || "Unable to cancel invite."); }
    finally { setBusy(false); }
  }

  return (
    <main className="staff-page">
      <header className="dashboard-header staff-header">
        <div className="staff-heading"><span className="staff-page-mark"><Icon name="users" size={19} /></span><div><p className="eyebrow">MAINTENANCE · ACCESS</p><h1>Users &amp; Staff</h1><p>Manage who can access this client workspace and what they can do.</p></div></div>
        {canManage && <button className="primary-button staff-add-button" type="button" onClick={() => setShowStaffForm(current => !current)}><Icon name={showStaffForm ? "close" : "add"} /><span>{showStaffForm ? "Close form" : "Add staff"}</span></button>}
      </header>

      {errorMessage && <div className="staff-alert error" role="alert">{errorMessage}</div>}
      {notice && <div className="staff-alert success" role="status">{notice}</div>}

      {!canManage && <section className="dashboard-panel staff-permission-panel"><span className="staff-access-icon"><Icon name="shield" size={17} /></span><div><strong>Owner or admin access required</strong><p>Your client role does not have permission to view or manage the workspace user list.</p></div></section>}

      {canManage && <section className="staff-metrics" aria-label="User access overview">{metrics.map(metric => <article className="staff-metric-card" key={metric.title}><span className={`staff-metric-icon staff-metric-${metric.icon}`}><Icon name={metric.icon} size={19} /></span><div className="staff-metric-copy"><span className="staff-metric-title">{metric.title}</span><strong>{loading ? "…" : metric.value}</strong><small>{metric.hint}</small></div></article>)}</section>}

      {showStaffForm && canManage && <section className="dashboard-panel staff-invite-panel"><div className="staff-panel-heading"><div className="staff-section-icon"><Icon name="mail" /></div><div><h2>Invite a team member</h2><p>They need an EO2MATE account that uses this email address.</p></div></div>
        <div className="staff-invite-note"><span className="staff-note-dot" /> EO2MATE creates a one-time code. Share it with the invitee; they can accept it on the sign-in onboarding screen.</div>
        <form onSubmit={sendInvite}><div className="staff-form-grid"><label><span>Email address</span><input type="email" value={staffDraft.email} onChange={event => setStaffDraft(current => ({ ...current, email: event.target.value }))} placeholder="name@example.com" maxLength={254} required /><small>Must match the email on their EO2MATE account.</small></label><label><span>Access role</span><select value={staffDraft.role} onChange={event => setStaffDraft(current => ({ ...current, role: event.target.value }))}><option value="STAFF">Client Staff</option><option value="VIEWER">Viewer</option>{isOwner && <option value="ADMIN">Client Admin</option>}</select></label></div>
        {newInviteCode && <div className="staff-code-card"><div><strong>One-time invite code</strong><code>{newInviteCode}</code><small>Expires in 7 days. It can only be accepted by the email address above.</small></div><button className="secondary-button staff-action-button" type="button" onClick={copyCode}><Icon name="copy"/><span>{copied ? "Copied" : "Copy code"}</span></button></div>}
        <div className="staff-form-actions"><button className="secondary-button staff-action-button" type="button" onClick={closeForm}><Icon name="cancel" /><span>Cancel</span></button><button className="primary-button staff-action-button" type="submit" disabled={busy || !staffDraft.email.trim()}><Icon name="mail" /><span>{busy ? "Creating…" : "Create invite"}</span></button></div></form>
      </section>}

      {canManage && <section className="dashboard-panel staff-users-panel"><div className="staff-users-heading"><div><div className="staff-title-line"><span className="staff-section-icon small"><Icon name="users" size={16} /></span><h2>Client users</h2></div><p>People with access to this client account.</p></div><label className="staff-search"><Icon name="search" size={17} /><input type="search" value={staffSearch} onChange={event => setStaffSearch(event.target.value)} placeholder="Search users" aria-label="Search users" /></label></div>
        <div className="table-wrapper staff-table-wrapper"><table className="staff-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th>Added</th><th>Actions</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="7"><div className="staff-empty-state">Loading client users…</div></td></tr> : visibleUsers.length === 0 ? <tr><td colSpan="7"><div className="staff-empty-state"><span className="staff-empty-icon"><Icon name="users" size={22} /></span><strong>{users.length ? "No matching users" : "No client users found"}</strong><span>{users.length ? "Try another name, email, role, or status." : "Users will appear here after an invitation is accepted."}</span></div></td></tr> : visibleUsers.map(user => {
            const isSelf = user.user_id === session?.user?.id;
            const canEdit = canManage && user.role !== "OWNER" && !isSelf && (isOwner || !["ADMIN", "OWNER"].includes(user.role));
            return <tr key={user.user_id}><td>{user.full_name || "—"}{isSelf && <small className="staff-self-tag">You</small>}</td><td>{user.email || "—"}</td><td><span className={`staff-role-badge role-${user.role.toLowerCase()}`}>{user.role}</span></td><td><span className={`staff-status-badge status-${user.status.toLowerCase()}`}>{user.status}</span></td><td>{niceDate(user.last_sign_in_at)}</td><td>{niceDate(user.created_at)}</td><td><div className="staff-row-actions">{canEdit && <>{user.status === "ACTIVE" ? <button type="button" className="staff-text-action danger" disabled={busy} onClick={() => updateMember(user, { status: "INACTIVE" })}>Deactivate</button> : <button type="button" className="staff-text-action" disabled={busy} onClick={() => updateMember(user, { status: "ACTIVE" })}>Restore</button>}{isOwner && <select aria-label={`Change ${user.email} role`} value={user.role} disabled={busy} onChange={event => updateMember(user, { role: event.target.value })}><option value="STAFF">Staff</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select>}</>}</div></td></tr>;
          })}
        </tbody></table></div>
        {invites.length > 0 && <div className="staff-pending-list"><div className="staff-title-line"><span className="staff-section-icon small"><Icon name="clock" size={16}/></span><h2>Pending invitations</h2></div><div className="staff-pending-table">{invites.map(invite => <div className="staff-pending-row" key={invite.invite_id}><span><strong>{invite.email}</strong><small>{invite.role} · expires {niceDate(invite.expires_at)}</small></span><button className="staff-text-action danger" type="button" disabled={busy} onClick={() => cancelInvite(invite)}>Cancel invite</button></div>)}</div></div>}
        <div className="staff-access-note"><span className="staff-access-icon"><Icon name="shield" size={17} /></span><div><strong>Access model</strong><p>Owners can manage admins and staff. Admins can manage staff and viewers. Deactivated members can no longer use this client workspace.</p></div></div>
      </section>}
    </main>
  );
}
