import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function OnboardingPage({ session, initialStatus = null, onComplete }) {
  const [status, setStatus] = useState(initialStatus);
  const [businessName, setBusinessName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!status) loadStatus();
  }, []);

  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke("eo2mate", {
      method: "POST",
      headers: { "x-eo2mate-route": "client-onboarding" },
      body,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || "Onboarding request failed.");
    return data;
  }

  async function loadStatus() {
    setLoading(true);
    setErrorMessage("");
    try { setStatus(await invoke({ action: "STATUS" })); }
    catch (error) { setErrorMessage(error.message || "Unable to load onboarding."); }
    finally { setLoading(false); }
  }

  async function createClient(event) {
    event.preventDefault();
    setLoading(true); setMessage(""); setErrorMessage("");
    try {
      const data = await invoke({
        action: "CREATE_CLIENT",
        business_name: businessName.trim(),
        contact_email: session?.user?.email || null,
        contact_phone: contactPhone.trim() || null,
        timezone: "Asia/Manila",
      });
      setStatus(data);
      setMessage("Business profile created. Continue by connecting the Facebook Page you want EO2MATE to manage.");
    } catch (error) { setErrorMessage(error.message || "Unable to create client profile."); }
    finally { setLoading(false); }
  }

  function connectFacebook() {
    const clientId = status?.client?.client_id;
    if (!clientId) return;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.assign(`${baseUrl}/functions/v1/meta?route=oauth-start&client_id=${encodeURIComponent(clientId)}`);
  }

  async function cancelOnboarding() {
    const confirmed = window.confirm("Cancel onboarding? This removes the incomplete EO2MATE business/trial setup. Your login account and MFA remain intact.");
    if (!confirmed) return;
    setLoading(true); setMessage(""); setErrorMessage("");
    try {
      const data = await invoke({ action: "CANCEL" });
      setMessage(data?.message || "Onboarding cancelled. Your login account was kept.");
      setStatus(null);
      window.setTimeout(async () => { await supabase.auth.signOut(); }, 500);
    } catch (error) { setErrorMessage(error.message || "Unable to cancel onboarding."); }
    finally { setLoading(false); }
  }

  async function finishOnboarding() {
    setLoading(true); setMessage(""); setErrorMessage("");
    try {
      const data = await invoke({ action: "COMPLETE" });
      setStatus(data);
      setMessage("Setup complete. Your EO2MATE client workspace is ready.");
      window.setTimeout(() => onComplete?.(), 400);
    } catch (error) { setErrorMessage(error.message || "Unable to complete onboarding."); }
    finally { setLoading(false); }
  }

  const client = status?.client;
  const pages = status?.pages || [];
  const subscription = status?.subscription;
  const pageNames = pages.map((page) => page.page_name || page.fb_page_id).join(", ");

  return (
    <div className="onboarding-shell">
      <main className="onboarding-wizard-card onboarding-v2">
        <div className="onboarding-brand-row">
          <div className="brand-logo">E</div>
          <div><strong>EO2MATE</strong><span>Workspace Setup</span></div>
        </div>

        <div className="wizard-heading">
          <p className="eyebrow">GET STARTED</p>
          <h1>Set up your EO2MATE workspace</h1>
          <p>Your account is secured with MFA. Add your business details, connect your Facebook Page, then activate your client workspace.</p>
        </div>

        <div className="wizard-stepper wizard-stepper-four">
          <div className="wizard-step done"><span>✓</span><div><strong>Security</strong><small>MFA enabled</small></div></div>
          <div className={`wizard-step ${client ? "done" : "current"}`}><span>2</span><div><strong>Business</strong><small>{client ? "Complete" : "Required"}</small></div></div>
          <div className={`wizard-step ${pages.length ? "done" : client ? "current" : ""}`}><span>3</span><div><strong>Facebook</strong><small>{pages.length ? "Connected" : "Connect Page"}</small></div></div>
          <div className={`wizard-step ${status?.onboarding_complete ? "done" : pages.length ? "current" : ""}`}><span>4</span><div><strong>Workspace</strong><small>{status?.onboarding_complete ? "Ready" : "Activate"}</small></div></div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {errorMessage && <div className="form-error">{errorMessage}</div>}

        {!client ? (
          <section className="onboarding-stage-card">
            <div className="onboarding-stage-heading"><span>Step 2</span><div><strong>Business profile</strong><small>This identifies the client workspace and its owner.</small></div></div>
            <form className="wizard-form onboarding-clean-form" onSubmit={createClient}>
              <label>Business / shop name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Euan Collectibles" required maxLength="120" /></label>
              <label>Account email<input value={session?.user?.email || ""} disabled /></label>
              <label>Contact phone<input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Optional" /></label>
              <label>Timezone<input value="Asia/Manila" disabled /></label>
              <button className="primary-button onboarding-primary-action" type="submit" disabled={loading}>{loading ? "Creating..." : "Continue"}</button>
            </form>
          </section>
        ) : (
          <div className="wizard-summary">
            <div className="wizard-summary-row"><span>Business</span><strong>{client.name}</strong></div>
            <div className="wizard-summary-row"><span>Environment</span><strong>EO2MATE-CLNT</strong></div>
            <div className="wizard-summary-row"><span>Payment setup</span><strong>Manual</strong></div>
            <div className="wizard-summary-row"><span>Subscription</span><strong>{subscription?.subscription_status || "TRIAL"}</strong></div>
          </div>
        )}

        {client && !pages.length && (
          <section className="onboarding-stage-card active-stage">
            <div className="onboarding-stage-heading"><span>Step 3</span><div><strong>Connect Facebook Page</strong><small>Sign in with a Facebook account that has the required access to the Page.</small></div></div>
            <div className="onboarding-permission-note">EO2MATE uses the Page connection for supported selling automation such as Auction, Mining and Pre-Order. Facebook authorization remains managed through Meta.</div>
            <div className="wizard-action-buttons">
              <button className="secondary-button danger-outline-button" type="button" onClick={cancelOnboarding} disabled={loading}>Cancel onboarding</button>
              <button className="primary-button" type="button" onClick={connectFacebook} disabled={loading}>Connect Facebook Page</button>
            </div>
          </section>
        )}

        {pages.length > 0 && !status?.onboarding_complete && (
          <section className="onboarding-stage-card active-stage ready">
            <div className="onboarding-stage-heading"><span>Step 4</span><div><strong>Activate workspace</strong><small>Your Facebook connection is ready.</small></div></div>
            <div className="connected-page-row"><span>Connected Page</span><strong>{pageNames}</strong></div>
            <button className="primary-button onboarding-primary-action" type="button" onClick={finishOnboarding} disabled={loading}>{loading ? "Activating..." : "Activate EO2MATE Workspace"}</button>
          </section>
        )}

        <div className="wizard-fyi onboarding-fyi">
          <strong>Current client workspace</strong>
          <span>Auction, Mining and Pre-Order automation are available in the current Posts workflow. Payment remains manual while payment-provider integration is being finalized.</span>
        </div>
      </main>
    </div>
  );
}
