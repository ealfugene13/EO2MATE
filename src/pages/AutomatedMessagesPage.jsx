import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const pretty = (v) => String(v || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const keyOf = (x) => `${x.mode_code}|${x.event_code}|${x.channel_code}`;

export default function AutomatedMessagesPage({ client }) {
  const [catalog, setCatalog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [mode, setMode] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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

  const modes = useMemo(() => ["ALL", ...Array.from(new Set(catalog.map((x) => x.mode_code))).sort()], [catalog]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (mode === "ALL" || r.mode_code === mode) && (!q || `${r.event_code} ${r.channel_code} ${r.description} ${r.effective_text}`.toLowerCase().includes(q)));
  }, [rows, mode, query]);

  function beginEdit(row) { setEditing(row); setText(row.effective_text || ""); setError(""); setNotice(""); }

  async function save() {
    if (!editing || !text.trim()) return;
    setSaving(true); setError("");
    try {
      await call("SAVE", { mode_code: editing.mode_code, event_code: editing.event_code, channel_code: editing.channel_code, message_text: text });
      setEditing(null); setNotice("Automated message saved."); await load();
    } catch (e) { setError(e.message || "Unable to save automated message."); }
    finally { setSaving(false); }
  }

  async function reset(row = editing) {
    if (!row) return;
    setSaving(true); setError("");
    try {
      await call("RESET", { mode_code: row.mode_code, event_code: row.event_code, channel_code: row.channel_code });
      setEditing(null); setNotice("Message reset to the EO2MATE default."); await load();
    } catch (e) { setError(e.message || "Unable to reset automated message."); }
    finally { setSaving(false); }
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
      <div className="automated-message-toolbar">
        <select className="filter-select" value={mode} onChange={(e) => setMode(e.target.value)}>{modes.map((m) => <option key={m} value={m}>{m === "ALL" ? "All modules" : pretty(m)}</option>)}</select>
        <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search event, channel or message..." />
      </div>
      <div className="message-template-grid">
        {filtered.map((r) => <article className="message-template-card" key={keyOf(r)}>
          <div className="message-template-head"><div><span className="message-channel">{pretty(r.mode_code)} · {pretty(r.channel_code)}</span><h3>{pretty(r.event_code)}</h3></div><span className={r.override ? "override-pill" : "default-pill"}>{r.override ? "Client override" : "EO2MATE default"}</span></div>
          <div className="message-description">{r.description}</div>
          <p>{r.effective_text}</p>
          {r.variables?.length > 0 && <div className="template-variable-row">{r.variables.map((v) => <code key={v}>{`{{${v}}}`}</code>)}</div>}
          <div className="message-template-actions">{r.override && <button className="table-action-button" type="button" onClick={() => reset(r)}>Reset</button>}<button className="table-action-button" type="button" onClick={() => beginEdit(r)}>Edit message</button></div>
        </article>)}
        {!loading && filtered.length === 0 && <div className="empty-message-state">No automated messages match this filter.</div>}
      </div>
    </section>

    {editing && <div className="eo2-modal-backdrop" role="presentation" onMouseDown={() => !saving && setEditing(null)}><div className="eo2-modal-card" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
      <div className="eo2-modal-header"><div><p className="eyebrow">{pretty(editing.mode_code)} · {pretty(editing.channel_code)}</p><h2>{pretty(editing.event_code)}</h2><span>{editing.description}</span></div><button className="icon-button" type="button" onClick={() => setEditing(null)} disabled={saving}>×</button></div>
      <label className="message-editor-label">Message<textarea rows="8" value={text} onChange={(e) => setText(e.target.value)} disabled={saving}/></label>
      <div className="message-editor-help"><strong>Allowed variables:</strong> {editing.variables?.length ? editing.variables.map((v) => `{{${v}}}`).join(", ") : "None"}. Unsupported variables are rejected by EO2MATE.</div>
      <div className="default-message-preview"><strong>EO2MATE default</strong><p>{editing.default_text}</p></div>
      <div className="eo2-modal-actions">{editing.override && <button className="secondary-button danger-action" type="button" onClick={() => reset()} disabled={saving}>Reset to default</button>}<button className="secondary-button" type="button" onClick={() => setEditing(null)} disabled={saving}>Cancel</button><button className="primary-button" type="button" onClick={save} disabled={saving || !text.trim()}>{saving ? "Saving..." : "Save message"}</button></div>
    </div></div>}
  </>;
}
