import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const PROVIDERS = [
  { code: "MANUAL", name: "Manual Payment", description: "Use the client's own bank, e-wallet, cash or other manual instructions." },
  { code: "MAYA", name: "Maya", description: "EO2MATE hosted online checkout through the configured Maya account." },
  { code: "PAYMONGO", name: "PayMongo", description: "Online checkout through the configured PayMongo account." },
];

async function token() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error("Your EO2MATE session has expired. Please sign in again.");
  return session.access_token;
}

export default function PaymentMethodsSettings({ clientId, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [manualInstructions, setManualInstructions] = useState("");

  async function call(body) {
    const accessToken = await token();
    const response = await fetch(`${FUNCTION_BASE}/payment-shared`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "x-eo2mate-route": body.route },
      body: JSON.stringify({ ...body, route: undefined, client_id: clientId }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) throw new Error(result?.message || result?.error || `Payment settings request failed (${response.status}).`);
    return result;
  }

  async function load() {
    if (!clientId) return;
    setLoading(true); setMessage("");
    try {
      const result = await call({ route: "get-settings" });
      setData(result);
      setManualInstructions(result?.manual_instructions || "");
    } catch (e) { setMessage(e.message || "Unable to load payment methods."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [clientId]);

  const accounts = useMemo(() => new Map((data?.accounts || []).map((x) => [String(x.provider).toUpperCase(), x])), [data]);

  async function update(provider, patch) {
    setBusy(provider); setMessage("");
    try {
      const result = await call({ route: "update-provider", provider, ...patch });
      setData(result);
      setManualInstructions(result?.manual_instructions || manualInstructions);
      setMessage(`${provider} payment settings updated.`);
      await onChanged?.();
    } catch (e) { setMessage(e.message || `Unable to update ${provider}.`); }
    finally { setBusy(""); }
  }

  async function saveManual() {
    setBusy("MANUAL"); setMessage("");
    try {
      const result = await call({ route: "update-manual", instructions: manualInstructions });
      setData(result); setMessage("Manual payment instructions saved."); await onChanged?.();
    } catch (e) { setMessage(e.message || "Unable to save manual payment instructions."); }
    finally { setBusy(""); }
  }

  return (
    <div className="payment-methods-settings">
      <header className="dashboard-header">
        <div><p className="eyebrow">SHARED · PAYMENTS</p><h1>Payment Settings</h1><p>Choose which payment methods buyers can use. EO2MATE resolves these settings per client—no provider is hardcoded.</p></div>
        <button className="secondary-button" type="button" onClick={load} disabled={loading || !!busy}>{loading ? "Refreshing..." : "Refresh"}</button>
      </header>

      <section className="dashboard-panel">
        <div className="panel-header"><div><h2>Buyer payment options</h2><p>Enable one or more methods and choose one default. When multiple online methods are enabled, EO2MATE can present the applicable choices to the buyer.</p></div></div>
        <div className="payment-provider-grid">
          {PROVIDERS.map((provider) => {
            const account = accounts.get(provider.code) || {};
            const enabled = account.payment_enabled === true;
            const isDefault = account.is_default === true;
            const ready = provider.code === "MANUAL" || ["ACTIVE", "SANDBOX_READY"].includes(String(account.account_status || account.onboarding_status || "").toUpperCase());
            return <article className={`payment-provider-card ${enabled ? "active" : ""}`} key={provider.code}>
              <div><strong>{provider.name}</strong><p>{provider.description}</p><small>Status: {account.account_status || account.onboarding_status || "NOT_CONFIGURED"}{account.environment ? ` · ${account.environment}` : ""}</small></div>
              <div className="payment-provider-actions">
                <label><input type="checkbox" checked={enabled} disabled={busy === provider.code || (!ready && !enabled)} onChange={(e) => update(provider.code, { payment_enabled: e.target.checked })} /> Enabled</label>
                <label><input type="radio" name="default-payment-provider" checked={isDefault} disabled={!enabled || busy === provider.code} onChange={() => update(provider.code, { is_default: true })} /> Default</label>
              </div>
              {!ready && provider.code !== "MANUAL" && <small className="payment-provider-warning">Complete this provider's onboarding/setup before enabling it.</small>}
            </article>;
          })}
        </div>
      </section>

      <section className="dashboard-panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><div><h2>Manual payment instructions</h2><p>Sent only when Manual Payment is enabled/selected. Do not place API keys or other secrets here.</p></div></div>
        <textarea className="payment-instructions-input" rows="6" value={manualInstructions} onChange={(e) => setManualInstructions(e.target.value)} placeholder="Example: Send payment to the Page's approved account, then reply with your payment reference." />
        <div style={{ marginTop: 12 }}><button className="primary-button" type="button" onClick={saveManual} disabled={busy === "MANUAL"}>{busy === "MANUAL" ? "Saving..." : "Save Instructions"}</button></div>
      </section>

      {message && <div className="form-message" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
