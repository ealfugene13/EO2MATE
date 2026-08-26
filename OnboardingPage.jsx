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
    const { data, error } = await supabase.functions.invoke("client-onboarding", {
      method: "POST",
      body,
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || "Onboarding request failed.");
    return data;
  }

  async function loadStatus() {
    setLoading(true);
    setErrorMessage("");
    try {
      setStatus(await invoke({ action: "STATUS" }));
    } catch (error) {
      setErrorMessage(error.message || "Unable to load onboarding.");
    } finally {
      setLoading(false);
    }
  }

  async function createClient(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const data = await invoke({
        action: "CREATE_CLIENT",
        business_name: businessName.trim(),
        contact_email: session?.user?.email || null,
        contact_phone: contactPhone.trim() || null,
        timezone: "Asia/Manila",
      });
      setStatus(data);
      setMessage("Business profile created. Next, connect your Facebook Page.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to create client profile.");
    } finally {
      setLoading(false);
    }
  }

  function connectFacebook() {
    const clientId = status?.client?.client_id;
    if (!clientId) return;

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.assign(
      `${baseUrl}/functions/v1/facebook-oauth-start?client_id=${encodeURIComponent(clientId)}`
    );
  }

  async function finishOnboarding() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const data = await invoke({ action: "COMPLETE" });
      setStatus(data);
      setMessage("Onboarding complete. EO2MATE CLNT trial is ready.");
      window.setTimeout(() => onComplete?.(), 400);
    } catch (error) {
      setErrorMessage(error.message || "Unable to complete onboarding.");
    } finally {
      setLoading(false);
    }
  }

  const client = status?.client;
  const pages = status?.pages || [];
  const subscription = status?.subscription;

  return (
    <div className="onboarding-shell">
      <main className="onboarding-wizard-card">
        <div className="onboarding-brand-row">
          <div className="brand-logo">E</div>
          <div><strong>EO2MATE</strong><span>Client Onboarding</span></div>
        </div>

        <div className="wizard-heading">
          <p className="eyebrow">WELCOME TO EO2MATE</p>
          <h1>Set up your auction automation</h1>
          <p>New clients start in EO2MATE-CLNT manual-payment trial mode. No PayMongo is required to try the auction flow.</p>
        </div>

        <div className="wizard-stepper">
          <div className={`wizard-step ${client ? "done" : "current"}`}>
            <span>1</span><div><strong>Business</strong><small>{client ? "Complete" : "Required"}</small></div>
          </div>
          <div className={`wizard-step ${pages.length ? "done" : client ? "current" : ""}`}>
            <span>2</span><div><strong>Facebook Page</strong><small>{pages.length ? "Connected" : "Connect Page"}</small></div>
          </div>
          <div className={`wizard-step ${status?.onboarding_complete ? "done" : pages.length ? "current" : ""}`}>
            <span>3</span><div><strong>CLNT Trial</strong><small>{status?.onboarding_complete ? "Ready" : "Activate"}</small></div>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {errorMessage && <div className="form-error">{errorMessage}</div>}

        {!client ? (
          <form className="wizard-form" onSubmit={createClient}>
            <label>
              Business name
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="ABC Collectibles" required maxLength="120" />
            </label>
            <label>
              Email
              <input value={session?.user?.email || ""} disabled />
            </label>
            <label>
              Contact phone
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Optional" />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Business Profile"}
            </button>
          </form>
        ) : (
          <div className="wizard-summary">
            <div className="wizard-summary-row"><span>Business</span><strong>{client.name}</strong></div>
            <div className="wizard-summary-row"><span>Mode</span><strong>EO2MATE-CLNT</strong></div>
            <div className="wizard-summary-row"><span>Payment</span><strong>Manual</strong></div>
            <div className="wizard-summary-row"><span>Subscription</span><strong>{subscription?.subscription_status || "TRIAL"}</strong></div>
          </div>
        )}

        {client && !pages.length && (
          <section className="wizard-action-card">
            <div>
              <strong>Connect your Facebook Page</strong>
              <span>Use the Facebook account that manages the Page you want EO2MATE to automate.</span>
            </div>
            <button className="primary-button" type="button" onClick={connectFacebook} disabled={loading}>
              Connect Facebook
            </button>
          </section>
        )}

        {pages.length > 0 && !status?.onboarding_complete && (
          <section className="wizard-action-card ready">
            <div>
              <strong>Facebook connected</strong>
              <span>{pages.map((page) => page.page_name || page.fb_page_id).join(", ")}</span>
            </div>
            <button className="primary-button" type="button" onClick={finishOnboarding} disabled={loading}>
              {loading ? "Activating..." : "Activate CLNT Trial"}
            </button>
          </section>
        )}

        <div className="wizard-fyi">
          <strong>What CLNT includes</strong>
          <span>Auction parsing, bidding, validation, announcements, closing, winner selection and Messenger. Payment remains manual with the Page.</span>
        </div>
      </main>
    </div>
  );
}
