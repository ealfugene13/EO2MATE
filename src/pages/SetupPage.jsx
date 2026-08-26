import { useEffect, useMemo, useState } from "react";
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

export default function SetupPage({ client }) {
  const [settings, setSettings] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  function resetSettingForm() {
    setEditingSetting(null);
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
      resetSettingForm();
      await loadSetup();
    } catch (err) {
      setError(err.message || "Unable to save setting.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSetting(item) {
    clearFeedback();

    if (!isAdmin) return;
    if (!item.override) {
      setError("Global defaults cannot be deleted. Edit the row to create a client override first.");
      return;
    }

    if (!window.confirm(`Delete client override for ${item.override.setting_key}?`)) return;

    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from("eo2mate_settings")
        .delete()
        .eq("setting_id", item.override.setting_id);

      if (deleteError) throw deleteError;

      setMessage(`${item.override.setting_key} override deleted. Global default restored.`);
      if (editingSetting === item.override.setting_key) resetSettingForm();
      await loadSetup();
    } catch (err) {
      setError(err.message || "Unable to delete setting override.");
    } finally {
      setLoading(false);
    }
  }

  function resetCommandForm() {
    setEditingCommand(null);
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
      resetCommandForm();
      await loadSetup();
    } catch (err) {
      setError(err.message || "Unable to save command.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCommand(item) {
    clearFeedback();

    if (!isAdmin) return;
    if (!item.override) {
      setError("Global commands cannot be deleted. Edit the row to create a client override first.");
      return;
    }

    if (!window.confirm(`Delete client override for ${normalizeCommand(item.override.command_text)}?`)) return;

    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from("eo2mate_command_aliases")
        .delete()
        .eq("command_alias_id", item.override.command_alias_id);

      if (deleteError) throw deleteError;

      setMessage(`${normalizeCommand(item.override.command_text)} override deleted.`);
      if (editingCommand === normalizeCommand(item.override.command_text)) resetCommandForm();
      await loadSetup();
    } catch (err) {
      setError(err.message || "Unable to delete command override.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">EO2MATE CONFIGURATION</p>
          <h1>Setup</h1>
          <p>CRUD for runtime rules and Messenger commands on one screen.</p>
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

        <form className="setup-inline-form" onSubmit={saveSetting}>
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
              {editingSetting ? "Save" : "Create"}
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
                  <tr key={row.setting_key}>
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

        <form className="setup-inline-form command-form" onSubmit={saveCommand}>
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
              {editingCommand ? "Save" : "Create"}
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
                  <tr key={key}>
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
