import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";

const SETTING_LABELS = {
  PAYMENT_DEADLINE_HOURS: "Payment deadline (hours)",
  PAYMENT_REOPEN_HOURS: "Default payment reopen (hours)",
  MAX_PAYMENT_REOPENS: "Maximum payment reopens",
  MAX_PAYMENT_REOPEN_HOURS: "Maximum reopen window (hours)",
  ORDER_GROUP_WINDOW_HOURS: "Order grouping window (hours)",
  WINNER_LINK_EXPIRY_HOURS: "Winner link expiry (hours)",
  ANNOUNCEMENT_INTERVAL_HOURS: "Auction announcement interval (hours)",
  INVALID_COMMAND_REPLY_ENABLED: "Reply to invalid Messenger commands",
};

const COMMAND_ACTIONS = [
  { value: "START_PAYMENT", label: "Start / resend payment" },
  { value: "REFRESH_PAYMENT", label: "Refresh payment QR" },
  { value: "HELP", label: "Show help / commands" },
];

function normalizeCommand(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function StatusPill({ active, children }) {
  return (
    <span className={`status-badge ${active ? "status-active" : "status-danger"}`}>
      {children}
    </span>
  );
}


function SetupPopup({
  open,
  type = "info",
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  showCancel = false,
}) {
  if (!open) return null;

  const icon =
    type === "danger" ? "!" :
    type === "success" ? "✓" :
    "i";

  return (
    <div className="setup-modal-backdrop" role="presentation">
      <div
        className={`setup-modal setup-modal-${type}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-modal-title"
      >
        <div className="setup-modal-icon" aria-hidden="true">{icon}</div>

        <div className="setup-modal-copy">
          <h3 id="setup-modal-title">{title}</h3>
          <p>{message}</p>
        </div>

        <div className="setup-modal-actions">
          {showCancel && (
            <button type="button" className="secondary-button" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}

          <button
            type="button"
            className={type === "danger" ? "danger-confirm-button" : "primary-button"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage({ client }) {
  const [settings, setSettings] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    title: "",
    message: "",
    confirmLabel: "OK",
    showCancel: false,
    onConfirm: null,
  });
  const [highlightedRow, setHighlightedRow] = useState("");

  const settingFormRef = useRef(null);
  const commandFormRef = useRef(null);
  const settingValueRef = useRef(null);
  const commandActionRef = useRef(null);

  const [editingSetting, setEditingSetting] = useState(null);
  const [settingForm, setSettingForm] = useState({
    setting_key: "",
    setting_value: "",
    value_type: "NUMBER",
    description: "",
    is_active: true,
  });

  const [editingCommand, setEditingCommand] = useState(null);
  const [commandForm, setCommandForm] = useState({
    command_text: "",
    action_code: "START_PAYMENT",
    description: "",
    is_active: true,
  });

  const isAdmin = ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(
    String(client?.role || "").trim().toUpperCase()
  );

  useEffect(() => {
    if (client?.client_id) loadSetup();
  }, [client?.client_id]);

  async function loadSetup() {
    if (!client?.client_id) return;

    setLoading(true);
    setError("");

    try {
      const [settingsResult, commandsResult] = await Promise.all([
        supabase
          .from("eo2mate_settings")
          .select("*")
          .or(`client_id.is.null,client_id.eq.${client.client_id}`)
          .order("setting_key", { ascending: true }),
        supabase
          .from("eo2mate_command_aliases")
          .select("*")
          .or(`client_id.is.null,client_id.eq.${client.client_id}`)
          .order("command_text", { ascending: true }),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (commandsResult.error) throw commandsResult.error;

      setSettings(settingsResult.data || []);
      setCommands(commandsResult.data || []);
    } catch (err) {
      setError(err.message || "Unable to load setup.");
    } finally {
      setLoading(false);
    }
  }

  const mergedSettings = useMemo(() => {
    const map = new Map();

    settings.filter((row) => !row.client_id).forEach((row) => {
      map.set(row.setting_key, { global: row, override: null, effective: row });
    });

    settings.filter((row) => row.client_id).forEach((row) => {
      const current = map.get(row.setting_key) || { global: null, override: null, effective: row };
      map.set(row.setting_key, { ...current, override: row, effective: row });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.effective.setting_key.localeCompare(b.effective.setting_key)
    );
  }, [settings]);

  const mergedCommands = useMemo(() => {
    const map = new Map();

    commands.filter((row) => !row.client_id).forEach((row) => {
      map.set(normalizeCommand(row.command_text), { global: row, override: null, effective: row });
    });

    commands.filter((row) => row.client_id).forEach((row) => {
      const key = normalizeCommand(row.command_text);
      const current = map.get(key) || { global: null, override: null, effective: row };
      map.set(key, { ...current, override: row, effective: row });
    });

    return Array.from(map.values()).sort((a, b) =>
      normalizeCommand(a.effective.command_text).localeCompare(
        normalizeCommand(b.effective.command_text)
      )
    );
  }, [commands]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }


  function closePopup() {
    setPopup((current) => ({
      ...current,
      open: false,
      onConfirm: null,
    }));
  }

  function showInfoPopup(title, popupMessage, type = "info") {
    setPopup({
      open: true,
      type,
      title,
      message: popupMessage,
      confirmLabel: "OK",
      showCancel: false,
      onConfirm: null,
    });
  }

  function showConfirmPopup({
    title,
    popupMessage,
    confirmLabel = "Confirm",
    type = "warning",
    onConfirm,
  }) {
    setPopup({
      open: true,
      type,
      title,
      message: popupMessage,
      confirmLabel,
      showCancel: true,
      onConfirm,
    });
  }

  function focusEditor(section, rowKey) {
    setHighlightedRow(rowKey);

    window.setTimeout(() => {
      const target =
        section === "setting"
          ? settingFormRef.current
          : commandFormRef.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        if (section === "setting") {
          settingValueRef.current?.focus();
          settingValueRef.current?.select?.();
        } else {
          commandActionRef.current?.focus();
        }
      }, 350);
    }, 50);
  }

  function resetSettingForm() {
    setEditingSetting(null);
    setHighlightedRow("");
    setSettingForm({
      setting_key: "",
      setting_value: "",
      value_type: "NUMBER",
      description: "",
      is_active: true,
    });
  }

  function editSetting(item) {
    const row = item.effective;
    clearFeedback();
    setEditingSetting(row.setting_key);
    setSettingForm({
      setting_key: row.setting_key,
      setting_value: String(row.setting_value ?? ""),
      value_type: row.value_type || "TEXT",
      description: row.description || "",
      is_active: row.is_active !== false,
    });

    focusEditor("setting", `setting:${row.setting_key}`);
  }

  async function saveSetting(event) {
    event.preventDefault();
    clearFeedback();

    if (!isAdmin) {
      setError("Admin or owner access is required.");
      return;
    }

    const key = String(settingForm.setting_key || "").trim().toUpperCase();
    const value = String(settingForm.setting_value ?? "").trim();

    if (!key || !value) {
      setError("Setting key and value are required.");
      return;
    }

    setLoading(true);

    try {
      const existingOverride = settings.find(
        (row) => row.client_id === client.client_id && row.setting_key === key
      );

      if (existingOverride) {
        const { error: updateError } = await supabase
          .from("eo2mate_settings")
          .update({
            setting_value: value,
            value_type: settingForm.value_type,
            description: settingForm.description || null,
            is_active: settingForm.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_id", existingOverride.setting_id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("eo2mate_settings")
          .insert({
            client_id: client.client_id,
            setting_key: key,
            setting_value: value,
            value_type: settingForm.value_type,
            description: settingForm.description || null,
            is_active: settingForm.is_active,
          });

        if (insertError) throw insertError;
      }

      setMessage(`${key} saved.`);
      showInfoPopup(
        editingSetting ? "Setting updated" : "Setting created",
        `${key} was saved successfully and is now the effective client setup.`,
        "success"
      );
      resetSettingForm();
      await loadSetup();
    } catch (err) {
      setError(err.message || "Unable to save setting.");
    } finally {
      setLoading(false);
    }
  }

  function deleteSetting(item) {
    clearFeedback();

    if (!isAdmin) return;

    if (!item.override) {
      showInfoPopup(
        "System default protected",
        "This is a global default. Edit it first to create a client override. Only client overrides can be deleted from this screen.",
        "info"
      );
      return;
    }

    showConfirmPopup({
      title: "Delete setting override?",
      popupMessage:
        `Delete the client override for ${item.override.setting_key}? ` +
        "EO2MATE will immediately fall back to the global default value.",
      confirmLabel: "Delete Override",
      type: "danger",
      onConfirm: async () => {
        closePopup();
        setLoading(true);

        try {
          const { error: deleteError } = await supabase
            .from("eo2mate_settings")
            .delete()
            .eq("setting_id", item.override.setting_id);

          if (deleteError) throw deleteError;

          setMessage(
            `${item.override.setting_key} override deleted. Global default restored.`
          );
          showInfoPopup(
            "Override deleted",
            `${item.override.setting_key} now uses the global default again.`,
            "success"
          );

          if (editingSetting === item.override.setting_key) resetSettingForm();
          await loadSetup();
        } catch (err) {
          setError(err.message || "Unable to delete setting override.");
          showInfoPopup(
            "Delete failed",
            err.message || "Unable to delete setting override.",
            "danger"
          );
        } finally {
          setLoading(false);
        }
      },
    });
  }

  function resetCommandForm() {
    setEditingCommand(null);
    setHighlightedRow("");
    setCommandForm({
      command_text: "",
      action_code: "START_PAYMENT",
      description: "",
      is_active: true,
    });
  }

  function editCommand(item) {
    const row = item.effective;
    clearFeedback();
    setEditingCommand(normalizeCommand(row.command_text));
    setCommandForm({
      command_text: normalizeCommand(row.command_text),
      action_code: row.action_code || "START_PAYMENT",
      description: row.description || "",
      is_active: row.is_active !== false,
    });

    focusEditor("command", `command:${normalizeCommand(row.command_text)}`);
  }

  async function saveCommand(event) {
    event.preventDefault();
    clearFeedback();

    if (!isAdmin) {
      setError("Admin or owner access is required.");
      return;
    }

    const command = normalizeCommand(commandForm.command_text);

    if (!command || !commandForm.action_code) {
      setError("Command and action are required.");
      return;
    }

    setLoading(true);

    try {
      const existingOverride = commands.find(
        (row) =>
          row.client_id === client.client_id &&
          normalizeCommand(row.command_text) === command
      );

      if (existingOverride) {
        const { error: updateError } = await supabase
          .from("eo2mate_command_aliases")
          .update({
            command_text: command,
            action_code: commandForm.action_code,
            description: commandForm.description || null,
            is_active: commandForm.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("command_alias_id", existingOverride.command_alias_id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("eo2mate_command_aliases")
          .insert({
            client_id: client.client_id,
            command_text: command,
            action_code: commandForm.action_code,
            description: commandForm.description || null,
            is_active: commandForm.is_active,
          });

        if (insertError) throw insertError;
      }

      setMessage(`${command} saved.`);
      showInfoPopup(
        editingCommand ? "Command updated" : "Command created",
        `${command} was saved successfully. Active Messenger payment conversations will use this setup.`,
        "success"
      );
      resetCommandForm();
      await loadSetup();
    } catch (err) {
      setError(err.message || "Unable to save command.");
    } finally {
      setLoading(false);
    }
  }

  function deleteCommand(item) {
    clearFeedback();

    if (!isAdmin) return;

    if (!item.override) {
      showInfoPopup(
        "System command protected",
        "This is a global command. Edit it first to create a client override. Only client overrides can be deleted from this screen.",
        "info"
      );
      return;
    }

    const commandText = normalizeCommand(item.override.command_text);

    showConfirmPopup({
      title: "Delete command override?",
      popupMessage:
        `Delete the client override for "${commandText}"? ` +
        "If a global command with the same text exists, EO2MATE will use that global command again.",
      confirmLabel: "Delete Override",
      type: "danger",
      onConfirm: async () => {
        closePopup();
        setLoading(true);

        try {
          const { error: deleteError } = await supabase
            .from("eo2mate_command_aliases")
            .delete()
            .eq("command_alias_id", item.override.command_alias_id);

          if (deleteError) throw deleteError;

          setMessage(`${commandText} override deleted.`);
          showInfoPopup(
            "Command override deleted",
            `${commandText} was removed from this client's overrides.`,
            "success"
          );

          if (editingCommand === commandText) resetCommandForm();
          await loadSetup();
        } catch (err) {
          setError(err.message || "Unable to delete command override.");
          showInfoPopup(
            "Delete failed",
            err.message || "Unable to delete command override.",
            "danger"
          );
        } finally {
          setLoading(false);
        }
      },
    });
  }

  return (
    <>
      <SetupPopup
        open={popup.open}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        confirmLabel={popup.confirmLabel}
        showCancel={popup.showCancel}
        onCancel={closePopup}
        onConfirm={() => {
          if (popup.onConfirm) popup.onConfirm();
          else closePopup();
        }}
      />

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">EO2MATE CONFIGURATION</p>
          <h1>Setup</h1>
          <p>Manage runtime rules and Messenger commands on one screen.</p>
          <div className="setup-fyi-chip">
            <span>FYI</span>
            Changes here affect new EO2MATE actions immediately. Completed payments and historical auction records are not rewritten.
          </div>
        </div>
        <button className="secondary-button" onClick={loadSetup} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {!isAdmin && (
        <div className="connection-warning-card">
          <div>
            <strong>Read-only setup access</strong>
            <span>ADMIN, OWNER, or SUPER_ADMIN access is required for Create, Update, and Delete.</span>
          </div>
        </div>
      )}

      {message && <div className="success-message global-error">{message}</div>}
      {error && <div className="dashboard-error global-error">{error}</div>}

      <section className="dashboard-panel setup-panel">
        <div className="panel-header">
          <div>
            <h2>Runtime settings</h2>
            <p>Editing a global default creates a client-specific override. Delete removes only the override.</p>
          </div>
        </div>

        <div
          className={`setup-edit-banner ${editingSetting ? "is-editing" : "is-creating"}`}
          aria-live="polite"
        >
          <span className="setup-edit-icon">{editingSetting ? "✎" : "+"}</span>
          <div>
            <strong>
              {editingSetting
                ? `Editing: ${editingSetting}`
                : "Create a client setting override"}
            </strong>
            <span>
              {editingSetting
                ? "The selected row is highlighted. Make your changes here, then click Save Changes."
                : "Enter a client-specific value without changing the global default."}
            </span>
          </div>
        </div>

        <form
          ref={settingFormRef}
          className={`setup-inline-form ${editingSetting ? "setup-form-editing" : ""}`}
          onSubmit={saveSetting}
        >
          <label>
            Setting key
            <input
              value={settingForm.setting_key}
              onChange={(e) => setSettingForm((old) => ({ ...old, setting_key: e.target.value.toUpperCase() }))}
              placeholder="PAYMENT_DEADLINE_HOURS"
              disabled={!isAdmin || Boolean(editingSetting)}
            />
          </label>

          <label>
            Value
            {settingForm.value_type === "BOOLEAN" ? (
              <select
                ref={settingValueRef}
                value={settingForm.setting_value}
                onChange={(e) => setSettingForm((old) => ({ ...old, setting_value: e.target.value }))}
                disabled={!isAdmin}
              >
                <option value="">Select...</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                ref={settingValueRef}
                value={settingForm.setting_value}
                onChange={(e) => setSettingForm((old) => ({ ...old, setting_value: e.target.value }))}
                placeholder="24"
                disabled={!isAdmin}
              />
            )}
          </label>

          <label>
            Type
            <select
              value={settingForm.value_type}
              onChange={(e) => setSettingForm((old) => ({ ...old, value_type: e.target.value, setting_value: "" }))}
              disabled={!isAdmin}
            >
              <option value="NUMBER">Number</option>
              <option value="BOOLEAN">Boolean</option>
              <option value="TEXT">Text</option>
            </select>
          </label>

          <label className="setup-description-field">
            Description
            <input
              value={settingForm.description}
              onChange={(e) => setSettingForm((old) => ({ ...old, description: e.target.value }))}
              placeholder="What this setting controls"
              disabled={!isAdmin}
            />
          </label>

          <label className="setup-checkbox">
            <input
              type="checkbox"
              checked={settingForm.is_active}
              onChange={(e) => setSettingForm((old) => ({ ...old, is_active: e.target.checked }))}
              disabled={!isAdmin}
            />
            Active
          </label>

          <div className="setup-form-actions">
            {editingSetting && (
              <button type="button" className="secondary-button" onClick={resetSettingForm} disabled={loading}>
                Cancel
              </button>
            )}
            <button type="submit" className="primary-button" disabled={!isAdmin || loading}>
              {editingSetting ? "Save Changes" : "Create Setting"}
            </button>
          </div>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
                <th>Type</th>
                <th>Source</th>
                <th>Status</th>
                <th>Description</th>
                <th>CRUD</th>
              </tr>
            </thead>
            <tbody>
              {mergedSettings.length === 0 ? (
                <tr><td colSpan="7" className="empty-table-cell">No runtime settings found.</td></tr>
              ) : mergedSettings.map((item) => {
                const row = item.effective;
                return (
                  <tr
                    key={row.setting_key}
                    className={
                      highlightedRow === `setting:${row.setting_key}`
                        ? "setup-row-selected"
                        : ""
                    }
                  >
                    <td>
                      <strong>{SETTING_LABELS[row.setting_key] || row.setting_key}</strong>
                      <div className="table-muted">{row.setting_key}</div>
                    </td>
                    <td>{String(row.setting_value)}</td>
                    <td>{row.value_type || "TEXT"}</td>
                    <td>{item.override ? "Client override" : "Global default"}</td>
                    <td><StatusPill active={row.is_active}>{row.is_active ? "Active" : "Disabled"}</StatusPill></td>
                    <td className="setup-description-cell">{row.description || "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="table-action-button" type="button" onClick={() => editSetting(item)} disabled={!isAdmin || loading}>Edit</button>
                        <button
                          className="table-action-button danger-button"
                          type="button"
                          onClick={() => deleteSetting(item)}
                          disabled={!isAdmin || loading || !item.override}
                          title={item.override ? "Delete client override" : "Global default cannot be deleted"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel setup-panel">
        <div className="panel-header">
          <div>
            <h2>Messenger command aliases</h2>
            <p>Only active commands are accepted during an EO2MATE payment conversation.</p>
          </div>
        </div>

        <div
          className={`setup-edit-banner ${editingCommand ? "is-editing" : "is-creating"}`}
          aria-live="polite"
        >
          <span className="setup-edit-icon">{editingCommand ? "✎" : "+"}</span>
          <div>
            <strong>
              {editingCommand
                ? `Editing command: ${editingCommand}`
                : "Create a Messenger command override"}
            </strong>
            <span>
              {editingCommand
                ? "The selected row is highlighted. Review the action/status, then click Save Changes."
                : "Add an accepted command word or alias for the buyer."}
            </span>
          </div>
        </div>

        <form
          ref={commandFormRef}
          className={`setup-inline-form command-form ${editingCommand ? "setup-form-editing" : ""}`}
          onSubmit={saveCommand}
        >
          <label>
            Command
            <input
              value={commandForm.command_text}
              onChange={(e) => setCommandForm((old) => ({ ...old, command_text: e.target.value.toUpperCase() }))}
              placeholder="PAY"
              disabled={!isAdmin || Boolean(editingCommand)}
            />
          </label>

          <label>
            Action
            <select
              ref={commandActionRef}
              value={commandForm.action_code}
              onChange={(e) => setCommandForm((old) => ({ ...old, action_code: e.target.value }))}
              disabled={!isAdmin}
            >
              {COMMAND_ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>{action.label}</option>
              ))}
            </select>
          </label>

          <label className="setup-description-field">
            Description
            <input
              value={commandForm.description}
              onChange={(e) => setCommandForm((old) => ({ ...old, description: e.target.value }))}
              placeholder="Shown in HELP / invalid-command response"
              disabled={!isAdmin}
            />
          </label>

          <label className="setup-checkbox">
            <input
              type="checkbox"
              checked={commandForm.is_active}
              onChange={(e) => setCommandForm((old) => ({ ...old, is_active: e.target.checked }))}
              disabled={!isAdmin}
            />
            Active
          </label>

          <div className="setup-form-actions">
            {editingCommand && (
              <button type="button" className="secondary-button" onClick={resetCommandForm} disabled={loading}>Cancel</button>
            )}
            <button type="submit" className="primary-button" disabled={!isAdmin || loading}>
              {editingCommand ? "Save Changes" : "Create Command"}
            </button>
          </div>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Command</th>
                <th>Action</th>
                <th>Source</th>
                <th>Status</th>
                <th>Description</th>
                <th>CRUD</th>
              </tr>
            </thead>
            <tbody>
              {mergedCommands.length === 0 ? (
                <tr><td colSpan="6" className="empty-table-cell">No Messenger commands found.</td></tr>
              ) : mergedCommands.map((item) => {
                const row = item.effective;
                const key = normalizeCommand(row.command_text);
                return (
                  <tr
                    key={key}
                    className={
                      highlightedRow === `command:${key}`
                        ? "setup-row-selected"
                        : ""
                    }
                  >
                    <td><strong>{key}</strong></td>
                    <td>{row.action_code}</td>
                    <td>{item.override ? "Client override" : "Global default"}</td>
                    <td><StatusPill active={row.is_active}>{row.is_active ? "Active" : "Disabled"}</StatusPill></td>
                    <td className="setup-description-cell">{row.description || "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="table-action-button" type="button" onClick={() => editCommand(item)} disabled={!isAdmin || loading}>Edit</button>
                        <button
                          className="table-action-button danger-button"
                          type="button"
                          onClick={() => deleteCommand(item)}
                          disabled={!isAdmin || loading || !item.override}
                          title={item.override ? "Delete client override" : "Global default cannot be deleted"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
