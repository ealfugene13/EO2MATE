import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const pretty = (v) => String(v || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const keyOf = (x) => `${x.mode_code}|${x.event_code}|${x.channel_code}`;

export default function AutomatedMessagesPage({ client }) {
  const [catalog, setCatalog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [secureAction, setSecureAction] = useState(null);
  const [password, setPassword] = useState("");
  const [modalError, setModalError] = useState("");

  async function call(action, extra = {}) {
    const { data, error: invokeError } = await supabase.functions.invoke("eo2mate", {
      method: "POST",
      headers: { "x-eo2mate-route": "messaging-admin" },
      body: { action, client_id: client.client_id, ...extra },
    });
    if (invokeError) throw invokeError;
    if (!data?.success) {
      const suffix = data?.invalid_variables?.length ? `: ${data.invalid_variables.join(", ")}` : "";
      throw new Error(`${data?.error || "Request failed"}${suffix}`);
    }
    return data;
  }

  async function load() {
    if (!client?.client_id) return;
    setLoading(true); setError("");
    try {
      const data = await call("LIST");
      setCatalog(data.catalog || []);
      setTemplates(data.templates || []);
    } catch (e) { setError(e.message || "Unable to load automated messages."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [client?.client_id]);

  const rows = useMemo(() => {
    const globals = new Map();
    const overrides = new Map();
    for (const t of templates) {
      if (t.client_id == null) globals.set(keyOf(t), t);
      else overrides.set(keyOf(t), t);
    }
    return catalog.map((def) => {
      const k = keyOf(def);
      const global = globals.get(k);
      const override = overrides.get(k);
      return {
        ...def,
        default_text: global?.message_text || def.default_text,
        effective_text: override?.message_text || global?.message_text || def.default_text,
        override,
      };
    });
  }, [catalog, templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q || `${r.mode_code} ${r.event_code} ${r.channel_code} ${r.description} ${r.effective_text}`.toLowerCase().includes(q));
  }, [rows, query]);

  const grouped = useMemo(() => {
    const order = ["AUCTION", "MINING", "PREORDER", "REGULAR_SALE", "LIVE_SELLING", "LIVE_MINING", "SHARED", "GENERAL"];
    const map = new Map();
    for (const row of filtered) {
      const key = String(row.mode_code || "GENERAL").toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a), bi = order.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
    });
  }, [filtered]);

  function beginEdit(row) { setEditing(row); setText(row.effective_text || ""); setError(""); setNotice(""); }

  async function saveVerified() {
    if (!editing || !text.trim()) return;
    setSaving(true); setError("");
    try {
      await call("SAVE", { mode_code: editing.mode_code, event_code: editing.event_code, channel_code: editing.channel_code, message_text: text });
      setEditing(null); setNotice("Automated message saved."); await load();
    } catch (e) { setError(e.message || "Unable to save automated message."); }
    finally { setSaving(false); }
  }

  async function resetVerified(row = editing) {
    if (!row) return;
    setSaving(true); setError("");
    try {
      await call("RESET", { mode_code: row.mode_code, event_code: row.event_code, channel_code: row.channel_code });
      setEditing(null); setNotice("Message reset to the EO2MATE default."); await load();
    } catch (e) { setError(e.message || "Unable to reset automated message."); }
    finally { setSaving(false); }
  }

  function requestSecureAction(type, row = editing) { setPassword(""); setError(""); setModalError(""); setSecureAction({ type, row }); }

  async function verifyAndRun() {
    if (!password) return setModalError("Enter your current password.");
    setSaving(true); setModalError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error("Unable to verify the signed-in account.");
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (verifyError) throw new Error("Incorrect password. No message changes were made.");
      const action = secureAction; setSecureAction(null); setPassword(""); setSaving(false);
      if (action.type === "SAVE") await saveVerified(); else await resetVerified(action.row);
    } catch (e) { setModalError(e.message || "Unable to verify password."); setSaving(false); }
  }

  return <>
    <header className="dashboard-header automated-messages-header">
      <div><p className="eyebrow">MAINTENANCE · COMMUNICATION</p><h1>Automated Messages</h1><p>Customize buyer-facing EO2MATE messages without changing automation logic.</p></div>
      <button className="icon-button refresh-icon-button" type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg></button>
    </header>
    {notice && <div className="success-message global-error">{notice}</div>}
    {error && <div className="dashboard-error global-error">{error}</div>}

    <section className="dashboard-panel automated-messages-panel">
      <div className="panel-header"><div><h2>Message templates</h2><p>EO2MATE defaults remain active until you save a client override. Reset any customized message at any time.</p></div><div className="template-count">{filtered.length} message{filtered.length === 1 ? "" : "s"}</div></div>
      <div className="automated-message-toolbar automated-message-toolbar-single">
        <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search post type, event, channel or message..." />
      </div>
      <div className="message-type-sections">
        {grouped.map(([group, groupRows]) => <section className="message-type-section" key={group}>
          <div className="message-type-heading"><div><span className="message-type-kicker">POST TYPE</span><h3>{pretty(group)}</h3></div><span className="template-count">{groupRows.length} message{groupRows.length === 1 ? "" : "s"}</span></div>
          <div className="table-wrapper automated-message-table-wrap"><table className="data-table automated-message-table">
            <thead><tr><th>Event / Channel</th><th>EO2MATE Default</th><th>Client Override</th><th>Effective Message</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{groupRows.map((r) => <tr key={keyOf(r)}>
              <td><strong>{pretty(r.event_code)}</strong><small>{pretty(r.channel_code)}</small>{r.description && <small>{r.description}</small>}</td>
              <td><div className="message-cell-text">{r.default_text}</div></td>
              <td><div className="message-cell-text">{r.override?.message_text || <span className="muted-cell">No override</span>}</div></td>
              <td><div className="message-cell-text effective-message-cell">{r.effective_text}</div>{r.variables?.length > 0 && <div className="template-variable-row compact">{r.variables.map((v) => <code key={v}>{`{{${v}}}`}</code>)}</div>}</td>
              <td><span className={r.override ? "override-pill" : "default-pill"}>{r.override ? "Customized" : "System default"}</span></td>
              <td><div className="message-table-actions">{r.override && <button className="table-action-button" type="button" onClick={() => requestSecureAction("RESET", r)}>Reset</button>}<button className="table-action-button" type="button" onClick={() => beginEdit(r)}>Edit</button></div></td>
            </tr>)}</tbody>
          </table></div>
        </section>)}
        {!loading && grouped.length === 0 && <div className="empty-message-state">No automated messages match this search.</div>}
      </div>
    </section>

    {secureAction && <div className="setup-modal-backdrop"><div className="setup-modal setup-password-modal" role="dialog" aria-modal="true"><div className="setup-modal-icon">🔒</div><div className="setup-modal-copy"><h3>Verify message change</h3><p>Enter your current EO2MATE password before {secureAction.type === "SAVE" ? "saving this client message override" : "resetting this message to the EO2MATE default"}.</p></div><label className="setup-password-field">Current password<input type="password" autoComplete="current-password" value={password} onChange={(e)=>{setPassword(e.target.value);setModalError("")}} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();verifyAndRun()}}} /></label>{modalError&&<div className="setup-modal-inline-error" role="alert">{modalError}</div>}<div className="setup-modal-actions"><button className="secondary-button" type="button" onClick={()=>{setSecureAction(null);setPassword("");setModalError("")}} disabled={saving}>Cancel</button><button className="primary-button" type="button" onClick={verifyAndRun} disabled={saving}>{saving?"Verifying…":"Verify & Continue"}</button></div></div></div>}

    {editing && <div className="eo2-modal-backdrop" role="presentation" onMouseDown={() => !saving && setEditing(null)}><div className="eo2-modal-card" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
      <div className="eo2-modal-header"><div><p className="eyebrow">{pretty(editing.mode_code)} · {pretty(editing.channel_code)}</p><h2>{pretty(editing.event_code)}</h2><span>{editing.description}</span></div><button className="icon-button" type="button" onClick={() => setEditing(null)} disabled={saving}>×</button></div>
      <label className="message-editor-label">Message<textarea rows="8" value={text} onChange={(e) => setText(e.target.value)} disabled={saving}/></label>
      <div className="message-editor-help"><strong>Allowed variables:</strong> {editing.variables?.length ? editing.variables.map((v) => `{{${v}}}`).join(", ") : "None"}. Unsupported variables are rejected by EO2MATE.</div>
      <div className="default-message-preview"><strong>EO2MATE default</strong><p>{editing.default_text}</p></div>
      <div className="eo2-modal-actions">{editing.override && <button className="secondary-button danger-action" type="button" onClick={() => requestSecureAction("RESET")} disabled={saving}>Reset to default</button>}<button className="secondary-button" type="button" onClick={() => setEditing(null)} disabled={saving}>Cancel</button><button className="primary-button" type="button" onClick={() => requestSecureAction("SAVE")} disabled={saving || !text.trim()}>{saving ? "Saving..." : "Save message"}</button></div>
    </div></div>}
  </>;
}
