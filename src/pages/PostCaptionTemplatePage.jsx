import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  captionTemplateSettingKey,
  DEFAULT_POST_CAPTION_TEMPLATES,
  POST_CAPTION_TEMPLATE_CONTEXTS,
  POST_CAPTION_TEMPLATE_MODES,
  POST_CAPTION_TEMPLATE_PREFIX,
  POST_CAPTION_TEMPLATE_TOKENS,
  renderPostCaptionTemplate,
} from "../postCaptionTemplates";

const prettyMode = (code) => POST_CAPTION_TEMPLATE_MODES.find((row) => row.code === code)?.label || code;
const prettyContext = (code) => POST_CAPTION_TEMPLATE_CONTEXTS.find((row) => row.code === code)?.label || code;
const keyFor = (mode, context) => `${mode}|${context}`;
const templateRows = POST_CAPTION_TEMPLATE_MODES.flatMap((mode) =>
  POST_CAPTION_TEMPLATE_CONTEXTS.map((context) => ({
    mode: mode.code,
    context: context.code,
    key: captionTemplateSettingKey(mode.code, context.code),
    label: `${mode.label} · ${context.label}`,
    defaultText: DEFAULT_POST_CAPTION_TEMPLATES[mode.code][context.code],
  })),
);

function Icon({ name }) {
  const paths = {
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    reset: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/></>,
    close: <><path d="m18 6-12 12"/><path d="m6 6 12 12"/></>,
    save: <><path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function StatusPill({ customized }) {
  return <span className={customized ? "override-pill" : "default-pill"}>{customized ? "Client override" : "System default"}</span>;
}

export default function PostCaptionTemplatePage({ client }) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const [text, setText] = useState("");
  const [secureAction, setSecureAction] = useState(null);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const isAdmin = ["ADMIN", "OWNER", "CLIENT_ADMIN", "SUPER_ADMIN"].includes(String(client?.role || "").toUpperCase());

  async function load() {
    if (!client?.client_id) return;
    setLoading(true); setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("eo2mate_settings")
        .select("setting_id,client_id,setting_key,setting_value,updated_at")
        .eq("client_id", client.client_id)
        .like("setting_key", `${POST_CAPTION_TEMPLATE_PREFIX}%`);
      if (queryError) throw queryError;
      setOverrides(data || []);
    } catch (e) {
      setError(e.message || "Unable to load post caption templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [client?.client_id]);

  const rows = useMemo(() => {
    const overrideMap = new Map(overrides.map((row) => [row.setting_key, row]));
    return templateRows.map((row) => ({ ...row, override: overrideMap.get(row.key) || null }))
      .filter((row) => !query.trim() || `${row.label} ${row.defaultText} ${row.override?.setting_value || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [overrides, query]);

  function beginEdit(row) {
    setEditor(row);
    setText(row.override?.setting_value ?? row.defaultText);
    setError(""); setNotice("");
  }

  function requestSecureAction(type, row = editor) {
    if (!isAdmin) return setError("Admin access is required to change post caption templates.");
    if (!row) return;
    setPassword(""); setModalError(""); setSecureAction({ type, row });
  }

  function validateTemplate(value) {
    const allowed = new Set(POST_CAPTION_TEMPLATE_TOKENS.map(({ token }) => token));
    const found = [...String(value).matchAll(/\{\{[^{}]+\}\}/g)].map(([token]) => token);
    const unsupported = found.filter((token) => !allowed.has(token));
    if (unsupported.length) return `Unsupported placeholder${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}`;
    if (!String(value).includes("{{details}}")) return "Keep {{details}} in the template. It contains the generated post data used by EO2MATE.";
    if (!String(value).includes("{{instructions}}")) return "Keep {{instructions}} in the template so buyers see how to participate.";
    return "";
  }

  async function verifyAndSave() {
    if (!password) return setModalError("Enter your current password.");
    const validation = validateTemplate(text);
    if (validation) return setModalError(validation);
    setSaving(true); setModalError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error("Unable to verify the signed-in account.");
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (authError) throw new Error("Incorrect password. No template changes were made.");
      const { row } = secureAction;
      const existing = row.override;
      if (existing) {
        const { error: updateError } = await supabase.from("eo2mate_settings")
          .update({ setting_value: text, value_type: "TEXT", updated_at: new Date().toISOString() })
          .eq("setting_id", existing.setting_id).eq("client_id", client.client_id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("eo2mate_settings").insert({
          client_id: client.client_id,
          setting_key: row.key,
          setting_value: text,
          value_type: "TEXT",
          description: `Client override for ${row.label} Meta post caption template`,
          is_active: true,
        });
        if (insertError) throw insertError;
      }
      setSecureAction(null); setEditor(null); setPassword(""); setNotice(`${row.label} template saved.`);
      await load();
    } catch (e) {
      setModalError(e.message || "Unable to save the template.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyAndReset() {
    if (!password) return setModalError("Enter your current password.");
    setSaving(true); setModalError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error("Unable to verify the signed-in account.");
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (authError) throw new Error("Incorrect password. No template changes were made.");
      const row = secureAction.row;
      if (row.override) {
        const { error: deleteError } = await supabase.from("eo2mate_settings").delete()
          .eq("setting_id", row.override.setting_id).eq("client_id", client.client_id);
        if (deleteError) throw deleteError;
      }
      setSecureAction(null); setEditor(null); setPassword(""); setNotice(`${row.label} reset to the EO2MATE default.`);
      await load();
    } catch (e) {
      setModalError(e.message || "Unable to reset the template.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyAndRun() {
    if (secureAction?.type === "RESET") return verifyAndReset();
    return verifyAndSave();
  }

  const preview = editor ? renderPostCaptionTemplate(text, {
    seller_caption: "✨ New arrivals are here! ✨",
    caption_marker: editor.mode === "AUCTION" ? "" : "[Configured caption marker]",
    details: "Item: Sample item\nPrice: 1,250\nAvailable Qty: 3",
    instructions: "To buy, comment +<qty> below. Example: +1.",
    follow_text: "Follow this page for more great finds and new arrivals!",
  }) : "";

  return <>
    <header className="dashboard-header automated-messages-header">
      <div><p className="eyebrow">MAINTENANCE · COMMUNICATION</p><h1>Post Caption Template</h1><p>Customize the layout of generated Meta post captions. EO2MATE keeps the item details and buyer instructions available to automation.</p></div>
      <button className="icon-button refresh-icon-button" type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><Icon name="refresh" /></button>
    </header>
    {notice && <div className="success-message global-error" role="status">{notice}</div>}
    {error && <div className="dashboard-error global-error" role="alert">{error}</div>}

    <section className="dashboard-panel automated-messages-panel inventory-panel">
      <div className="panel-header"><div><h2>Caption templates</h2><p>EO2MATE system defaults are read-only. Saving creates a client override; reset removes the override and restores the system default.</p></div><div className="template-count">{rows.length} template{rows.length === 1 ? "" : "s"}</div></div>
      <div className="automated-message-toolbar automated-message-toolbar-single"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mode or post format..." /></div>
      <div className="table-wrapper automated-message-table-wrap"><table className="data-table automated-message-table">
        <thead><tr><th>Post mode</th><th>Format</th><th>Template preview</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={keyFor(row.mode, row.context)}>
          <td><strong>{prettyMode(row.mode)}</strong></td>
          <td>{prettyContext(row.context)}</td>
          <td><div className="message-cell-text">{row.override?.setting_value || row.defaultText}</div></td>
          <td><StatusPill customized={!!row.override} /></td>
          <td><div className="message-table-actions">
            <button className="icon-button" type="button" onClick={() => beginEdit(row)} disabled={!isAdmin || loading} title={`Edit ${row.label}`} aria-label={`Edit ${row.label}`}><Icon name="edit" /></button>
            {row.override && <button className="icon-button" type="button" onClick={() => requestSecureAction("RESET", row)} disabled={!isAdmin || loading} title={`Reset ${row.label}`} aria-label={`Reset ${row.label}`}><Icon name="reset" /></button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
      {!loading && rows.length === 0 && <div className="empty-message-state">No caption templates match your search.</div>}
    </section>

    {editor && <div className="eo2-modal-backdrop" role="presentation" onMouseDown={() => !saving && setEditor(null)}><div className="eo2-modal-card post-caption-editor" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
      <div className="eo2-modal-header"><div><p className="eyebrow">{prettyMode(editor.mode)} · {prettyContext(editor.context)}</p><h2>Edit caption template</h2><span>System default stays unchanged; this saves a client-specific override.</span></div><button className="icon-button" type="button" onClick={() => setEditor(null)} disabled={saving} title="Close" aria-label="Close"><Icon name="close" /></button></div>
      <label className="message-editor-label">Template<textarea rows="8" value={text} onChange={(e) => setText(e.target.value)} disabled={saving} spellCheck="false" /></label>
      <div className="message-editor-help"><strong>Placeholders</strong><div className="template-variable-row">{POST_CAPTION_TEMPLATE_TOKENS.map(({ token, description }) => <span key={token}><code>{token}</code> {description}</span>)}</div><p><code>{"{{details}}"}</code> and <code>{"{{instructions}}"}</code> are required to preserve post data and buyer guidance.</p></div>
      <div className="default-message-preview"><strong>Preview</strong><p>{preview}</p></div>
      <div className="eo2-modal-actions">{editor.override && <button className="secondary-button danger-action" type="button" onClick={() => requestSecureAction("RESET", editor)} disabled={saving}><Icon name="reset" /> Reset</button>}<button className="secondary-button" type="button" onClick={() => setEditor(null)} disabled={saving}>Cancel</button><button className="primary-button" type="button" onClick={() => requestSecureAction("SAVE", editor)} disabled={saving || !text.trim()}><Icon name="save" /> Save template</button></div>
    </div></div>}

    {secureAction && <div className="setup-modal-backdrop"><div className="setup-modal setup-password-modal" role="dialog" aria-modal="true"><div className="setup-modal-icon">🔒</div><div className="setup-modal-copy"><h3>Verify template change</h3><p>Enter your current EO2MATE password before {secureAction.type === "SAVE" ? "saving this client caption template" : "resetting it to the EO2MATE default"}.</p></div><label className="setup-password-field">Current password<input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setModalError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); verifyAndRun(); } }} /></label>{modalError && <div className="setup-modal-inline-error" role="alert">{modalError}</div>}<div className="setup-modal-actions"><button className="secondary-button" type="button" onClick={() => { setSecureAction(null); setPassword(""); setModalError(""); }} disabled={saving}>Cancel</button><button className="primary-button" type="button" onClick={verifyAndRun} disabled={saving}>{saving ? "Verifying…" : "Verify & Continue"}</button></div></div></div>}
  </>;
}
