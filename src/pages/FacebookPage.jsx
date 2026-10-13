import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import "./FacebookPageRepair.css";


function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusLabel(value) {
  return String(value || "-").replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  let className = "status-badge";

  if (
    ["ACTIVE", "PAID", "READY_FOR_DELIVERY", "READY_FOR_BOOKING", "DELIVERED", "COMPLETED", "VALID"].includes(normalized)
  ) {
    className += " status-active";
  } else if (normalized === "COMPLETED_WITH_WINNER") {
    className += " status-success";
  } else if (
    ["PAYMENT_PENDING", "PAYMENT_REOPENED", "PENDING", "AWAITING_FINALIZER", "BOOKED", "PICKED_UP", "DROPPED_OFF", "IN_TRANSIT", "SHIPPED"].includes(normalized)
  ) {
    className += " status-warning";
  } else if (
    ["CANCELLED", "PAYMENT_EXPIRED", "FAILED", "EXPIRED", "REFUNDED", "INVALID"].includes(normalized)
  ) {
    className += " status-danger";
  } else {
    className += " status-muted";
  }

  return <span className={className}>{statusLabel(normalized)}</span>;
}

export default function FacebookPage({ client, facebookLoading, facebookMessage, facebookStatus, loadFacebookStatus, page, setFacebookMessage, setPage }) {
  const connectedPages = facebookStatus?.pages || [];
  const [showAddPageGuide, setShowAddPageGuide] = useState(false);

  const [connecting, setConnecting] = useState(false);
  const [repairPage,setRepairPage]=useState(null);
  const [repairPassword,setRepairPassword]=useState("");
  const [repairBusy,setRepairBusy]=useState(false);
  const [repairMessage,setRepairMessage]=useState("");
  const [repairHealth,setRepairHealth]=useState({});
  async function inspectPage(pageId){
    if(!client?.client_id)return;
    const {data,error}=await supabase.functions.invoke(`meta?route=page-repair&client_id=${encodeURIComponent(client.client_id)}&fb_page_id=${encodeURIComponent(pageId)}`,{method:"GET"});
    if(error||!data?.success)throw new Error(data?.message||data?.error||error?.message||"Unable to inspect Page");
    setRepairHealth(old=>({...old,[pageId]:data}));
  }
  async function runRepair(){
    if(!repairPage||!repairPassword||repairBusy)return;
    setRepairBusy(true);setRepairMessage("");
    try{
      const {data,error}=await supabase.functions.invoke("meta",{method:"POST",headers:{"x-eo2mate-meta-route":"page-repair"},body:{client_id:client.client_id,fb_page_id:repairPage.fb_page_id,password:repairPassword}});
      if(error)throw new Error(data?.message||data?.error||error.message);
      if(!data?.success){setRepairMessage(`Repair incomplete: ${JSON.stringify(data?.results||data?.error)}`)}
      else setRepairMessage("Page verification and repair completed. Automation remains subject to administrator settings.");
      await inspectPage(repairPage.fb_page_id);
      await loadFacebookStatus?.();
      setRepairPage(null);
    }catch(e){setRepairMessage(e.message||"Repair failed");}
    finally{setRepairBusy(false);setRepairPassword("");}
  }
  async function connectFacebook() {
    if (!client?.client_id || connecting) return;
    setConnecting(true);
    setFacebookMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("meta", {
        method: "POST", headers: { "x-eo2mate-meta-route": "oauth-start" },
        body: { client_id: client.client_id },
      });
      if (error || !data?.success || !data?.authorization_url) throw new Error(data?.message || "Unable to initiate Facebook authorization.");
      const destination = new URL(data.authorization_url);
      if (destination.protocol !== "https:" || destination.hostname !== "www.facebook.com") throw new Error("Invalid Facebook authorization destination.");
      window.location.assign(destination.toString());
    } catch (error) { setFacebookMessage(error.message || "Facebook connection failed."); setConnecting(false); }
  }

  return (<>
    {page === "facebook" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">ACCOUNT & SECURITY · FACEBOOK</p>
                <h1>Connect Facebook Page</h1>
                <p>Connect or reconnect a Facebook Page for your workspace. Existing Pages remain associated with your client.</p>
              </div>

              <button className="icon-button refresh-icon-button" type="button" onClick={loadFacebookStatus} disabled={facebookLoading} title="Refresh Facebook status" aria-label="Refresh Facebook status">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg>
              </button>
            </header>

            <section className="dashboard-panel setup-panel eo-page-health" aria-label="Facebook Page connection health">
              <div className="panel-header eo-page-health-heading">
                <div><h2>Page connection health</h2><p>Inspect or repair Page setup without changing existing automation preferences.</p></div>
                <span className="eo-page-health-count">{connectedPages.length} connected {connectedPages.length === 1 ? "Page" : "Pages"}</span>
              </div>
              {repairMessage && <div className="eo-page-repair-notice" role="status">{repairMessage}</div>}
              <div className="eo-page-health-grid">
                {connectedPages.map(p => {
                  const id = p.fb_page_id;
                  const h = repairHealth[id];
                  const steps = h?.steps || [];
                  const allComplete = steps.length >= 4 && ["PAGE_TOKEN", "FEED_SUBSCRIPTION", "PAGE_AUTOMATION_CONTROL", "PAGE_PAYMENT_CONTROL"].every(key => steps.some(s => s.step_key === key && s.status === "COMPLETED"));
                  const automation = !h ? "Not inspected" : !h.automation_control_exists ? "Missing" : h.automation_enabled ? "Enabled" : "Disabled";
                  return <article key={id} className="eo-page-health-card">
                    <div className="eo-page-health-card-top">
                      <div className="eo-page-health-identity"><span className="eo-page-health-facebook" aria-hidden="true">f</span><div><h3>{p.page_name || p.page_nm || id}</h3><p>Page ID: {id}</p></div></div>
                      <span className={`eo-page-health-badge ${!h ? "is-neutral" : allComplete ? "is-success" : "is-warning"}`}>{!h ? "Not inspected" : allComplete ? "Setup verified" : "Needs attention"}</span>
                    </div>
                    <div className="eo-page-health-meta">
                      <div><span>Provisioning</span><strong>{!h ? "Not inspected" : steps.length === 0 ? "Not initialized" : `${steps.filter(s => s.status === "COMPLETED").length}/${steps.length} completed`}</strong></div>
                      <div><span>Automation</span><strong>{automation}</strong></div>
                    </div>
                    {h && steps.length > 0 && <div className="eo-page-health-steps" aria-label="Provisioning checks">{steps.map(s => <span key={s.step_key} className={`eo-page-step ${s.status === "COMPLETED" ? "is-complete" : "is-pending"}`} title={s.last_error || s.step_key}>{s.status === "COMPLETED" ? "✓" : "!"} {s.step_key.replaceAll("_", " ")}</span>)}</div>}
                    <div className="eo-page-health-actions">
                      <button type="button" className="secondary-button" disabled={repairBusy} onClick={() => inspectPage(id).catch(e => setRepairMessage(e.message))}>↻ Inspect</button>
                      <button type="button" className="primary-button" disabled={repairBusy} onClick={() => {setRepairPage(p);setRepairPassword("");setRepairMessage("");}}>⚙ Repair Connection</button>
                    </div>
                  </article>;
                })}
                {connectedPages.length === 0 && <p className="eo-page-health-empty">No connected Facebook Pages yet.</p>}
              </div>
              {repairPage && <div className="setup-modal-backdrop eo-repair-backdrop" onMouseDown={e => {if(e.target === e.currentTarget && !repairBusy){setRepairPage(null);setRepairPassword("");}}}>
                <div className="eo-repair-dialog" role="dialog" aria-modal="true" aria-labelledby="eo-repair-title" aria-describedby="eo-repair-description">
                  <div className="eo-repair-dialog-header"><span className="eo-repair-dialog-icon" aria-hidden="true">⚙</span><div><h3 id="eo-repair-title">Repair Page connection</h3><p className="eo-repair-page-name">{repairPage.page_name || repairPage.page_nm || repairPage.fb_page_id}</p></div></div>
                  <p id="eo-repair-description" className="eo-repair-description">Verify the Meta feed subscription and restore missing Page controls. Existing automation settings will not be enabled or overwritten.</p>
                  <label className="eo-repair-password-label" htmlFor="eo-repair-password">Current password</label>
                  <input id="eo-repair-password" className="eo-repair-password" type="password" autoComplete="current-password" autoFocus value={repairPassword} onChange={e => setRepairPassword(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && repairPassword && !repairBusy)runRepair();}} />
                  <div className="eo-repair-dialog-actions"><button type="button" className="secondary-button" disabled={repairBusy} onClick={() => {setRepairPage(null);setRepairPassword("");}}>Cancel</button><button type="button" className="primary-button" disabled={repairBusy || !repairPassword} onClick={runRepair}>{repairBusy ? "Repairing…" : "Verify & Repair"}</button></div>
                </div>
              </div>}
            </section>
            {facebookMessage && (
              <div className="success-message global-error">{facebookMessage}</div>
            )}

            <section className="onboarding-steps">
              <div className="onboarding-step done">
                <span>1</span>
                <div><strong>Client Account</strong><small>{client?.name || "Account ready"}</small></div>
              </div>
              <div className={`onboarding-step ${facebookStatus?.connected ? "done" : "current"}`}>
                <span>2</span>
                <div><strong>Connect Facebook</strong><small>{facebookStatus?.connected ? "Connected" : "Authorization required"}</small></div>
              </div>
              <div className={`onboarding-step ${facebookStatus?.connected ? "done" : ""}`}>
                <span>3</span>
                <div><strong>Page Registration</strong><small>{facebookStatus?.connected ? `${facebookStatus.active_page_count || 0} active page(s)` : "Waiting for Facebook"}</small></div>
              </div>
              <div className="onboarding-step">
                <span>4</span>
                <div><strong>Optional Services</strong><small>Facebook and Online Payments can be configured anytime</small></div>
              </div>
            </section>

            <section className="facebook-connect-card">
              <div className="facebook-connect-copy">
                <div className="facebook-icon">f</div>
                <div>
                  <h2>{facebookStatus?.connected ? "Facebook is connected" : "Connect your Facebook Page"}</h2>
                  <p>Use the Facebook account that has management access to the Page you want to automate. You do not need your own Meta Developer app.</p>
                </div>
              </div>

              <div className="facebook-connect-actions">
                <button className="primary-button facebook-action-button" type="button" onClick={() => setShowAddPageGuide((open) => !open)}>
                  <span className="facebook-action-mark" aria-hidden="true">f</span>
                  <span>{facebookStatus?.connected ? "Add Another Facebook Page" : "Connect Facebook Page"}</span>
                </button>

                <button
                  className="secondary-button facebook-action-button"
                  type="button"
                  onClick={() => setPage("dashboard")}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  <span>Back to Dashboard</span>
                </button>
              </div>
            </section>

            {showAddPageGuide && (
              <section className="dashboard-panel" aria-label="Add Facebook Page instructions">
                <div className="panel-header"><div><h2>Add a Facebook Page</h2><p>Your existing connected Pages will remain registered. Authorization may ask you to select or grant access to additional Pages.</p></div></div>
                <ol style={{ paddingLeft: "1.5rem", lineHeight: 1.9 }}>
                  <li>Sign in with a Facebook account that has sufficient access to the new business Page.</li>
                  <li>Select the new Page during Meta authorization, and retain access to existing Pages when prompted.</li>
                  <li>Review the permissions requested by EO2MATE and complete authorization.</li>
                  <li>Return to EO2MATE and refresh Connected Pages to confirm that the new Page appears.</li>
                  <li>Configure automation and selling settings for that Page before publishing.</li>
                </ol>
                <p><strong>Important:</strong> Meta authorization does not guarantee that a new Page has been registered. If it does not appear below, do not start automation; contact support for provisioning verification.</p>
                <button className="primary-button facebook-action-button" type="button" onClick={connectFacebook} disabled={!client?.client_id || connecting}>
                  <span className="facebook-action-mark" aria-hidden="true">f</span>
                  <span>Continue to Facebook Authorization</span>
                </button>
              </section>
            )}

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Connected Pages</h2>
                  <p>Pages registered to this client ({connectedPages.length}). Access tokens are never shown in the browser.</p>
                </div>
                <StatusBadge status={facebookStatus?.connected ? "CONNECTED" : "NOT_CONNECTED"} />
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Facebook Page ID</th>
                      <th>Status</th>
                      <th>Authorization</th>
                      <th>Connected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(facebookStatus?.pages || []).map((fbPage) => (
                      <tr key={fbPage.fb_page_id}>
                        <td>{fbPage.page_name || "Facebook Page"}</td>
                        <td>{fbPage.fb_page_id || "-"}</td>
                        <td><StatusBadge status={fbPage.status || "ACTIVE"} /></td>
                        <td><StatusBadge status={fbPage.token_present ? "AUTHORIZED" : "RECONNECT"} /></td>
                        <td>{formatDateTime(fbPage.connected_at)}</td>
                      </tr>
                    ))}

                    {!facebookLoading && !(facebookStatus?.pages || []).length && (
                      <tr>
                        <td colSpan="5" className="empty-table-cell">No Facebook Page connected yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="setup-requirements-card">
              <h2>What the client needs</h2>
              <div className="requirements-grid">
                <div><strong>Facebook account</strong><span>Use the account that manages the business Page.</span></div>
                <div><strong>Page access</strong><span>The account must have enough Page permissions to authorize your automation.</span></div>
                <div><strong>No developer setup</strong><span>Your platform's Meta app handles OAuth, webhook and API integration.</span></div>
              </div>
            </section>
          </>
        )}
  </>);
}
