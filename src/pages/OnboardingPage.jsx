import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function OnboardingPage({ session, initialStatus = null, onComplete }) {
  const [status, setStatus] = useState(initialStatus);
  const [businessName, setBusinessName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [skipCode, setSkipCode] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [kyc, setKyc] = useState({ legal_business_name: "", business_type: "SOLE_PROPRIETORSHIP", government_id_type: "", government_id_name: "" });
  const [kycStatus, setKycStatus] = useState(null);
  const [kycDocuments, setKycDocuments] = useState([]);
  const [kycBusy, setKycBusy] = useState(false);
  const [kycNotice, setKycNotice] = useState("");
  const [kycError, setKycError] = useState("");
  const [kycConsent, setKycConsent] = useState(false);

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
    setLoadingStep("Checking your existing workspace and setup progress...");
    setErrorMessage("");
    try { setStatus(await invoke({ action: "STATUS" })); }
    catch (error) { setErrorMessage(error.message || "Unable to load onboarding."); }
    finally { setLoading(false); }
  }

  async function createClient(event) {
    event.preventDefault();
    setLoading(true); setLoadingStep("Creating or resuming your business setup..."); setMessage(""); setErrorMessage("");
    try {
      const data = await invoke({
        action: "CREATE_CLIENT",
        business_name: businessName.trim(),
        contact_email: session?.user?.email || null,
        contact_phone: contactPhone.trim() || null,
        timezone: "Asia/Manila",
      });
      setStatus(data);
      setMessage("Business profile created. You can activate your workspace now and connect Facebook later from Facebook Setup.");
    } catch (error) { setErrorMessage(error.message || "Unable to create client profile."); }
    finally { setLoading(false); }
  }

  function connectFacebook() {
    const clientId = status?.client?.client_id;
    if (!clientId) return;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.assign(`${baseUrl}/functions/v1/meta?route=oauth-start&client_id=${encodeURIComponent(clientId)}`);
  }

  async function authorizeTestSkip(event) {
    event.preventDefault();
    setLoading(true); setLoadingStep("Creating or recovering the simulated test Page..."); setErrorMessage("");
    try {
      const data = await invoke({action:"META_SKIP_TEST", authorization_code:skipCode});
      setStatus(data);
      setMessage(`Simulated Page ${data.simulated_page_id} is ready for internal setup testing. Meta operations remain disabled.`);
      setSkipCode(""); setShowSkipDialog(false);
    } catch (error) { setErrorMessage(error.message || "Unable to authorize test Page."); }
    finally { setLoading(false); }
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
    setLoading(true); setLoadingStep("Activating your workspace..."); setMessage(""); setErrorMessage("");
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

  useEffect(() => {
    if (!client?.client_id || !session?.user?.id) return;
    let cancelled = false;
    async function loadKyc() {
      const [submissionResult, documentResult] = await Promise.all([
        supabase.from("eo2mate_kyc_submissions").select("*").eq("client_id", client.client_id).maybeSingle(),
        supabase.from("eo2mate_kyc_documents").select("document_id,document_type,object_path,content_type,file_size_bytes").eq("client_id", client.client_id),
      ]);
      if (cancelled) return;
      if (submissionResult.error) { setKycError(submissionResult.error.message || "Unable to load verification status. Apply the KYC migration first."); return; }
      if (documentResult.error) { setKycError(documentResult.error.message || "Unable to load uploaded documents."); return; }
      const submission = submissionResult.data;
      if (submission) {
        setKycStatus(submission);
        setKyc({ legal_business_name: submission.legal_business_name || "", business_type: submission.business_type || "SOLE_PROPRIETORSHIP", government_id_type: submission.government_id_type || "", government_id_name: submission.government_id_name || "" });
      }
      setKycDocuments(documentResult.data || []);
    }
    loadKyc().catch(error => { if (!cancelled) setKycError(error.message || "Unable to load verification status."); });
    return () => { cancelled = true; };
  }, [client?.client_id, session?.user?.id]);

  async function uploadKycDocument(documentType, file) {
    if (!client?.client_id || !session?.user?.id || kycBusy) return;
    const isBusinessDoc = documentType === "BUSINESS_REGISTRATION";
    const acceptedMime = isBusinessDoc ? ["image/jpeg", "image/png", "image/webp", "application/pdf"] : ["image/jpeg", "image/png", "image/webp"];
    if (!acceptedMime.includes(file.type)) { setKycError(isBusinessDoc ? "Use a JPG, PNG, WebP, or PDF file." : "Government ID images must be JPG, PNG, or WebP."); return; }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) { setKycError("Each verification document must be 10 MB or smaller."); return; }
    setKycBusy(true); setKycError(""); setKycNotice("");
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" })[file.type];
    const objectPath = `${client.client_id}/${session.user.id}/${documentType}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("eo2mate-kyc-private").upload(objectPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const prior = kycDocuments.find(row => row.document_type === documentType);
      const { data, error: saveError } = await supabase.from("eo2mate_kyc_documents").upsert({
        client_id: client.client_id, document_type: documentType, object_path: objectPath,
        content_type: file.type, file_size_bytes: file.size, uploaded_by: session.user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,document_type" }).select("document_id,document_type,object_path,content_type,file_size_bytes").single();
      if (saveError) { await supabase.storage.from("eo2mate-kyc-private").remove([objectPath]); throw saveError; }
      if (prior?.object_path) await supabase.storage.from("eo2mate-kyc-private").remove([prior.object_path]);
      setKycDocuments(current => [...current.filter(row => row.document_type !== documentType), data]);
      setKycNotice(`${documentType.replaceAll("_", " ")} uploaded to private storage.`);
    } catch (error) { setKycError(error.message || "Document upload failed."); }
    finally { setKycBusy(false); }
  }

  async function submitKyc(event) {
    event.preventDefault();
    if (!client?.client_id || !kycConsent || kycBusy) return;
    const required = ["GOVERNMENT_ID_FRONT", "GOVERNMENT_ID_BACK", "BUSINESS_REGISTRATION"];
    if (required.some(type => !kycDocuments.some(row => row.document_type === type))) { setKycError("Upload the front and back of your government ID, plus your business registration document."); return; }
    setKycBusy(true); setKycError(""); setKycNotice("");
    try {
      const { data, error } = await supabase.rpc("submit_eo2mate_kyc", {
        p_client_id: client.client_id,
        p_legal_business_name: kyc.legal_business_name.trim(),
        p_business_type: kyc.business_type,
        p_government_id_type: kyc.government_id_type,
        p_government_id_name: kyc.government_id_name.trim(),
      });
      if (error) throw error;
      setKycStatus(data);
      setKycNotice("Documents submitted for EO2MATE manual review.");
      setKycConsent(false);
    } catch (error) { setKycError(error.message || "KYC/KYB submission failed."); }
    finally { setKycBusy(false); }
  }

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
          <p>Your account is secured with MFA. Add your client or brand details, submit private business verification documents, and activate your workspace. Your client/brand name may differ from the Facebook Page names you connect.</p>
        </div>

        <div className="wizard-stepper wizard-stepper-five">
          <div className="wizard-step done"><span>✓</span><div><strong>Security</strong><small>MFA enabled</small></div></div>
          <div className={`wizard-step ${client ? "done" : "current"}`}><span>2</span><div><strong>Client / brand</strong><small>{client ? "Complete" : "Required"}</small></div></div>
          <div className={`wizard-step ${pages.length ? "done" : client ? "optional" : ""}`}><span>3</span><div><strong>Facebook Pages</strong><small>{pages.length ? `${pages.length} connected` : "Optional / later"}</small></div></div>
          <div className={`wizard-step ${["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(kycStatus?.status) ? "done" : client ? "current" : ""}`}><span>4</span><div><strong>KYC / KYB</strong><small>{kycStatus?.status ? kycStatus.status.replaceAll("_", " ") : "Submit documents"}</small></div></div>
          <div className={`wizard-step ${status?.onboarding_complete ? "done" : client ? "current" : ""}`}><span>5</span><div><strong>Workspace</strong><small>{status?.onboarding_complete ? "Ready" : "Activate"}</small></div></div>
        </div>

        {showSkipDialog && <div role="dialog" aria-modal="true" aria-label="Authorize simulated test Page" style={{position:"fixed",inset:0,background:"rgba(15,23,42,.65)",zIndex:9999,display:"grid",placeItems:"center",padding:16}}>
          <form onSubmit={authorizeTestSkip} style={{background:"white",color:"#172033",padding:24,borderRadius:14,width:"min(440px,100%)",boxShadow:"0 12px 40px #0003"}}>
            <h3>🔒 Skip Meta Connection — TEST</h3>
            <p>Enter the administrator-configured authorization code. A simulated Page will be created for internal testing only. No Facebook API access will be enabled.</p>
            <label>Authorization code<input type="password" autoComplete="off" required value={skipCode} onChange={e=>setSkipCode(e.target.value)} style={{display:"block",width:"100%",marginTop:8}} /></label>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
              <button type="button" className="secondary-button" disabled={loading} onClick={()=>{setShowSkipDialog(false);setSkipCode("");}}>Cancel</button>
              <button type="submit" className="primary-button" disabled={loading || !skipCode}>{loading ? "Verifying..." : "Verify & Create Test Page"}</button>
            </div>
          </form>
        </div>}
        {loading && <div role="status" aria-live="polite" className="onboarding-provision-progress" style={{padding:"14px 18px",marginBottom:16,border:"1px solid #cbd5e1",borderRadius:12,background:"#f8fafc",display:"flex",alignItems:"center",gap:12}}><span aria-hidden="true" style={{fontSize:22}}>⏳</span><div><strong>Setting up EO2MATE</strong><div>{loadingStep || "Checking setup..."}</div><small>Completed operations are preserved when you retry.</small></div></div>}
        {Array.isArray(status?.provisioning_steps) && status.provisioning_steps.length > 0 && (
          <section className="onboarding-stage-card" aria-label="Database provisioning status">
            <strong>Database Setup Progress</strong>
            {status.provisioning_steps.map((step) => (
              <div key={`${step.scope_type}:${step.scope_key}:${step.step_code}`} className="wizard-summary-row">
                <span>{step.step_code.replaceAll("_", " ")}</span>
                <strong>{step.status === "COMPLETED" ? "✓ Completed" : step.status === "FAILED" ? "⚠ Retry needed" : step.status === "IN_PROGRESS" ? "⏳ Processing" : "Pending"}</strong>
              </div>
            ))}
          </section>
        )}
        {message && <div className="success-message">{message}</div>}
        {errorMessage && <div className="form-error">{errorMessage} {status?.client && <button type="button" disabled={loading} onClick={async () => { setLoading(true); setLoadingStep("Resuming incomplete setup..."); try { setStatus(await invoke({action:"RESUME"})); setErrorMessage(""); setMessage("Existing setup verified. You can continue."); } catch (e) {setErrorMessage(e.message || "Unable to resume setup.");} finally {setLoading(false);} }}>↻ Resume Setup</button>}</div>}

        {!client ? (
          <section className="onboarding-stage-card">
            <div className="onboarding-stage-heading"><span>Step 2</span><div><strong>Client / brand profile</strong><small>This name identifies your EO2MATE client workspace and may differ from your Facebook Page name.</small></div></div>
            <form className="wizard-form onboarding-clean-form" onSubmit={createClient}>
              <label>Client / brand name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Euan Collectibles" required maxLength="120" /></label>
              <label>Account email<input value={session?.user?.email || ""} disabled /></label>
              <label>Contact phone<input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Optional" /></label>
              <label>Timezone<input value="Asia/Manila" disabled /></label>
              <button className="primary-button onboarding-primary-action" type="submit" disabled={loading}>{loading ? "Creating..." : "Continue"}</button>
            </form>
          </section>
        ) : (
          <div className="wizard-summary">
            <div className="wizard-summary-row"><span>Client / brand</span><strong>{client.name}</strong></div>
            <div className="wizard-summary-row"><span>Environment</span><strong>EO2MATE-CLNT</strong></div>
            <div className="wizard-summary-row"><span>Payment setup</span><strong>Manual</strong></div>
            <div className="wizard-summary-row"><span>Subscription</span><strong>{subscription?.subscription_status || "TRIAL"}</strong></div>
          </div>
        )}

        {client && !status?.onboarding_complete && (
          <>
            <section className="onboarding-stage-card">
              <div className="onboarding-stage-heading"><span>Step 3</span><div><strong>Facebook Pages & automation (optional)</strong><small>{pages.length ? `${pages.length} Page${pages.length === 1 ? "" : "s"} connected` : "Connect now or later from Facebook Setup."}</small></div></div>
              {pages.length ? (
                <>
                  <div className="onboarding-connected-pages">
                    {pages.map((page) => {
                      const connectionStatus = String(page.connection_status || "").toUpperCase();
                      const setupLabel = connectionStatus === "ACTIVE"
                        ? "Connection ready"
                        : connectionStatus === "SETUP_INCOMPLETE"
                          ? "Automation setup needs attention"
                          : connectionStatus === "ERROR"
                            ? "Reconnect required"
                            : "Connection saved";
                      return (
                        <div className="connected-page-row" key={page.fb_page_id}>
                        <span>Facebook Page: {page.page_name || page.fb_page_id}</span>
                          <strong>{setupLabel}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <div className="onboarding-permission-note">
                    After activation, choose the Active Facebook Page at the top of EO2MATE. Page-specific automation status and controls follow that selection, along with the connected Page's activity. A separate all-Pages suspension is reserved for Super Admins. Newly connected Pages can remain paused until an administrator enables them.
                  </div>
                  <button className="secondary-button" type="button" onClick={connectFacebook} disabled={loading}>Connect another Facebook Page</button>
                </>
              ) : (
                <>
                  <div className="onboarding-permission-note">Facebook is not required to activate EO2MATE. Connect one or more Pages now only if you want to start using Facebook selling automation immediately. After activation, choose the Active Facebook Page to view its Page-specific automation status and controls. A separate all-Pages suspension is reserved for Super Admins.</div>
                  <button className="secondary-button" type="button" onClick={connectFacebook} disabled={loading}>Connect Facebook Page Now</button>
                  {status?.meta_skip_enabled && <button className="secondary-button" type="button" disabled={loading} onClick={() => setShowSkipDialog(true)} style={{marginLeft:8}}>🔒 Skip Meta (TEST)</button>}
                </>
              )}
            </section>
            <section className="onboarding-stage-card" aria-label="KYC and KYB verification">
              <div className="onboarding-stage-heading"><span>Step 4</span><div><strong>KYC / KYB verification</strong><small>Submit your legal business name, government ID images, and business registration document.</small></div></div>
              <div className="onboarding-permission-note">Files are stored in a private EO2MATE bucket. We do not store your ID number in the database. This first release supports secure intake and manual review; automated OCR and image-fraud analysis are not active yet.</div>
              {kycStatus && <div className="wizard-summary-row" style={{ marginBottom: 12, border: "1px solid #e7ebf1", borderRadius: 10 }}><span>Review status</span><strong>{kycStatus.status.replaceAll("_", " ")}</strong></div>}
              {kycStatus?.reviewer_notes && <div className="onboarding-permission-note"><strong>Reviewer note:</strong> {kycStatus.reviewer_notes}</div>}
              {kycError && <div className="form-error" role="alert">{kycError}</div>}
              {kycNotice && <div className="success-message" role="status">{kycNotice}</div>}
              {client && !["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(kycStatus?.status) && <form className="wizard-form onboarding-clean-form" onSubmit={submitKyc}>
                <label>Legal business name<input value={kyc.legal_business_name} onChange={e => setKyc(current => ({ ...current, legal_business_name: e.target.value }))} required maxLength="180" placeholder="Name shown on your registration documents" /></label>
                <label>Business type<select value={kyc.business_type} onChange={e => setKyc(current => ({ ...current, business_type: e.target.value }))}><option value="SOLE_PROPRIETORSHIP">Sole proprietorship</option><option value="PARTNERSHIP">Partnership</option><option value="CORPORATION">Corporation</option><option value="OTHER">Other</option></select></label>
                <label>Government ID type<select value={kyc.government_id_type} onChange={e => setKyc(current => ({ ...current, government_id_type: e.target.value }))} required><option value="">Select ID type</option><option>Philippine National ID</option><option>Passport</option><option>Driver's license</option><option>UMID</option><option>PRC ID</option><option>Other government ID</option></select></label>
                <label>Name exactly as printed on ID<input value={kyc.government_id_name} onChange={e => setKyc(current => ({ ...current, government_id_name: e.target.value }))} required maxLength="180" autoComplete="name" /></label>
                {[{type:"GOVERNMENT_ID_FRONT",title:"Government ID · front",accept:"image/jpeg,image/png,image/webp"},{type:"GOVERNMENT_ID_BACK",title:"Government ID · back",accept:"image/jpeg,image/png,image/webp"},{type:"BUSINESS_REGISTRATION",title:"Business registration · DTI / SEC / other",accept:"image/jpeg,image/png,image/webp,application/pdf"}].map(doc => {
                  const existing = kycDocuments.find(row => row.document_type === doc.type);
                  return <label key={doc.type} className="onboarding-kyc-file"><span>{doc.title}</span><input type="file" accept={doc.accept} capture={doc.type === "BUSINESS_REGISTRATION" ? undefined : "environment"} disabled={kycBusy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadKycDocument(doc.type, file); }} /><small>{existing ? `Uploaded · ${Math.ceil(existing.file_size_bytes / 1024)} KB` : "Required · maximum 10 MB"}</small></label>;
                })}
                <label className="onboarding-kyc-consent"><input type="checkbox" checked={kycConsent} onChange={e => setKycConsent(e.target.checked)} />I authorize EO2MATE platform administrators to review these documents for business verification.</label>
                <button className="primary-button onboarding-primary-action" type="submit" disabled={kycBusy || !kycConsent}>{kycBusy ? "Submitting…" : kycStatus ? "Resubmit for review" : "Submit for review"}</button>
              </form>}
            </section>
            <section className="onboarding-stage-card active-stage ready">
              <div className="onboarding-stage-heading"><span>Step 5</span><div><strong>Activate workspace</strong><small>Facebook can be connected now or later. KYC review is tracked separately during rollout.</small></div></div>
              <div className="wizard-action-buttons">
                <button className="secondary-button danger-outline-button" type="button" onClick={cancelOnboarding} disabled={loading}>Cancel onboarding</button>
                <button className="primary-button onboarding-primary-action" type="button" onClick={finishOnboarding} disabled={loading}>{loading ? "Activating..." : "Activate EO2MATE Workspace"}</button>
              </div>
            </section>
          </>
        )}

        <div className="wizard-fyi onboarding-fyi">
          <strong>Current client workspace</strong>
          <span>Auction, Mining, Pre-Order and Regular Sale automation are available in the current Posts workflow. Manual payment remains available, and enabled online payment providers can be used from the buyer checkout.</span>
        </div>
      </main>
    </div>
  );
}
