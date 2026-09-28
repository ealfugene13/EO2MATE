import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const FUNCTION_BASE = "https://mimyptmwejkahfiblopu.supabase.co/functions/v1";

export default function MayaPaymentSetup({ clientId, onChanged }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sessionToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function callMaya(body) {
    const token = await sessionToken();
    if (!token) throw new Error("Your EO2MATE session has expired.");
    const r = await fetch(`${FUNCTION_BASE}/maya/onboarding`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.success === false) throw new Error(data?.message || data?.error || `Request failed (${r.status})`);
    return data;
  }

  async function load() {
    if (!clientId) return;
    try {
      const data = await callMaya({ action: "status", client_id: clientId });
      setStatus(data);
    } catch (e) {
      setMessage(e.message);
    }
  }

  useEffect(() => { load(); }, [clientId]);

  async function enable() {
    setBusy(true); setMessage("");
    try {
      const data = await callMaya({
        action: "enable-sandbox",
        client_id: clientId,
        status: "SANDBOX_READY",
        payment_enabled: true,
        is_default: true
      });
      setStatus(data);
      setMessage("Maya Sandbox online payments are enabled.");
      onChanged?.();
    } catch (e) {
      setMessage(e.message);
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try {
      const data = await callMaya({
        action: "disable",
        client_id: clientId,
        status: "DISABLED",
        payment_enabled: false,
        is_default: false
      });
      setStatus(data);
      setMessage("Maya online payments are disabled.");
      onChanged?.();
    } catch (e) {
      setMessage(e.message);
    } finally { setBusy(false); }
  }

  const account = status?.account || status?.payment_account || null;
  const enabled = Boolean(account?.payment_enabled);

  return (
    <section className="portal-card">
      <div className="portal-card-heading">
        <div>
          <strong>Maya Online Payments</strong>
          <small>Sandbox checkout for EO2MATE buyer payments.</small>
        </div>
        <span className={`status-pill ${enabled ? "active" : ""}`}>{enabled ? "ENABLED" : "OFF"}</span>
      </div>
      <div className="payment-provider-details">
        <div><span>Provider</span><strong>Maya</strong></div>
        <div><span>Environment</span><strong>{account?.environment || "SANDBOX"}</strong></div>
        <div><span>Checkout</span><strong>{enabled ? "Online" : "Manual only"}</strong></div>
      </div>
      <p>Sandbox uses EO2MATE's server-side Maya credentials. No Maya secret is stored in the browser.</p>
      <div className="wizard-action-buttons">
        {!enabled
          ? <button className="primary-button" disabled={busy} onClick={enable}>{busy ? "Enabling..." : "Enable Maya Sandbox"}</button>
          : <button className="secondary-button" disabled={busy} onClick={disable}>{busy ? "Disabling..." : "Disable Maya Online Payment"}</button>}
      </div>
      {message && <div className="form-message">{message}</div>}
    </section>
  );
}
