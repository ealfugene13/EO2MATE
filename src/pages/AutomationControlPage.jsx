import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";


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

export default function AutomationControlPage({ client, page }) {
  const [automationControls, setAutomationControls] = useState([]);

  const [automationPages, setAutomationPages] = useState([]);

  const [automationControlLoading, setAutomationControlLoading] = useState(false);

  const [automationControlMessage, setAutomationControlMessage] = useState("");

  const [automationModal, setAutomationModal] = useState(null);

  const [automationReason, setAutomationReason] = useState("");

  function findAutomationControl(scopeType, scopeId) {
    return automationControls.find(
      (row) =>
        String(row.scope_type || "").toUpperCase() === String(scopeType).toUpperCase() &&
        String(row.scope_id || "") === String(scopeId || "")
    ) || null;
  }

  function automationScopeEnabled(scopeType, scopeId) {
    const control = findAutomationControl(scopeType, scopeId);
    return control ? control.is_enabled !== false : true;
  }

  function automationScopeReason(scopeType, scopeId) {
    return findAutomationControl(scopeType, scopeId)?.reason || "";
  }

  async function loadAutomationControls() {
    if (!client?.client_id) return;

    setAutomationControlLoading(true);
    setAutomationControlMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "eo2mate",
        {
          method: "POST",
          headers: { "x-eo2mate-route": "automation-admin" },
          body: {
            action: "LIST",
            client_id: client.client_id,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to load automation controls.");
      }

      setAutomationControls(data.controls || []);
      setAutomationPages(data.pages || []);
      return data;
    } catch (error) {
      setAutomationControlMessage(
        error.message || "Unable to load automation controls."
      );
      return null;
    } finally {
      setAutomationControlLoading(false);
    }
  }

  function requestAutomationChange({
    scopeType,
    scopeId,
    label,
    enabled,
  }) {
    setAutomationReason("");
    setAutomationModal({
      scopeType,
      scopeId,
      label,
      enabled,
    });
  }

  async function confirmAutomationChange() {
    if (!automationModal || !client?.client_id) return;

    if (!automationModal.enabled && !automationReason.trim()) {
      setAutomationControlMessage("Please enter a reason before disabling automation.");
      return;
    }

    setAutomationControlLoading(true);
    setAutomationControlMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "eo2mate",
        {
          method: "POST",
          headers: { "x-eo2mate-route": "automation-admin" },
          body: {
            action: automationModal.scopeType === "PAGE_PAYMENT" ? "SET_PAGE_PAYMENT_AUTOMATION" : "SET",
            client_id: client.client_id,
            ...(automationModal.scopeType === "PAGE_PAYMENT"
              ? { fb_page_id: automationModal.scopeId }
              : { scope_type: automationModal.scopeType, scope_id: automationModal.scopeId }),
            is_enabled: automationModal.enabled,
            reason: automationReason.trim() || null,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to update automation control.");
      }

      setAutomationControlMessage(
        `${automationModal.label} automation ${automationModal.enabled ? "enabled" : "disabled"}.`
      );
      setAutomationModal(null);
      setAutomationReason("");
      await loadAutomationControls();
    } catch (error) {
      setAutomationControlMessage(
        error.message || "Unable to update automation control."
      );
    } finally {
      setAutomationControlLoading(false);
    }
  }


  useEffect(() => { loadAutomationControls(); }, [client?.client_id]);
  return (<>
    {page === "automation-control" && (
          <>
            {automationModal && (
              <div
                className="control-modal-backdrop"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 99999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                  background: "rgba(15, 23, 42, 0.48)",
                }}
              >
                <div
                  className="control-modal"
                  role="dialog"
                  aria-modal="true"
                  style={{
                    width: "min(520px, 100%)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    background: "#fff",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
                  }}
                >
                  <div className={`control-modal-icon ${automationModal.enabled ? "on" : "off"}`}>
                    {automationModal.enabled ? "✓" : "!"}
                  </div>

                  <div className="control-modal-copy">
                    <h3>
                      {automationModal.enabled ? "Enable automation?" : "Disable automation?"}
                    </h3>
                    <p>
                      {automationModal.label}
                    </p>
                    <small>
                      {automationModal.enabled
                        ? "Processing can resume immediately, subject to any higher-level suspension."
                        : automationModal.scopeType === "PAGE_PAYMENT"
                          ? "Payment messages and order/payment Messenger commands will stop for this Page. Sales participation stays enabled. Existing orders and payments are preserved."
                          : "New automated activity will stop at this scope. Existing records are preserved."}
                    </small>
                  </div>

                  <label className="control-modal-reason">
                    Reason {automationModal.enabled ? "(optional)" : "(required)"}
                    <textarea
                      rows="3"
                      value={automationReason}
                      onChange={(e) => setAutomationReason(e.target.value)}
                      placeholder={
                        automationModal.enabled
                          ? "Example: Subscription renewed"
                          : automationModal.scopeType === "PAGE_PAYMENT"
                            ? "Example: Switching this Page to manual payment"
                            : "Example: Subscription overdue"
                      }
                    />
                  </label>

                  <div className="control-modal-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setAutomationModal(null);
                        setAutomationReason("");
                      }}
                      disabled={automationControlLoading}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className={automationModal.enabled ? "primary-button" : "danger-confirm-button"}
                      onClick={confirmAutomationChange}
                      disabled={automationControlLoading}
                    >
                      {automationModal.enabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <header className="dashboard-header">
              <div>
                <p className="eyebrow">AUTOMATION GOVERNANCE</p>
                <h1>Automation Control</h1>
                <p>Pause or resume EO2MATE without deleting client, Page, auction, or transaction data.</p>
              </div>

              <button
                className="icon-button refresh-icon-button"
                type="button"
                onClick={loadAutomationControls}
                disabled={automationControlLoading}
                title="Refresh automation controls"
                aria-label="Refresh automation controls"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 6v5h-5" />
                  <path d="M4 18v-5h5" />
                  <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
                  <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
                </svg>
              </button>
            </header>

            {automationControlMessage && (
              <div className="success-message global-error">
                {automationControlMessage}
              </div>
            )}

            <section className="automation-hierarchy-note">
              <div className="automation-hierarchy-icon">i</div>
              <div>
                <strong>Control priority</strong>
                <span>Client OFF overrides general Page ON and Post ON. The separate Page payment control pauses payment messages and buyer order/payment commands without pausing sales participation.</span>
              </div>
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Client automation</h2>
                  <p>Use this for account-wide suspension such as an overdue EO2MATE subscription.</p>
                </div>
              </div>

              <div className="automation-control-row client-scope">
                <div className={`automation-switch-orb ${automationScopeEnabled("CLIENT", client?.client_id) ? "enabled" : "disabled"}`}>
                  <span />
                </div>

                <div className="automation-control-copy">
                  <strong>{client?.name || "Current client"}</strong>
                  <span>
                    Client-wide auction, Messenger and payment automation
                  </span>
                  {!automationScopeEnabled("CLIENT", client?.client_id) && (
                    <small>
                      Reason: {automationScopeReason("CLIENT", client?.client_id) || "No reason recorded"}
                    </small>
                  )}
                </div>

                <StatusBadge
                  status={
                    automationScopeEnabled("CLIENT", client?.client_id)
                      ? "ACTIVE"
                      : "SUSPENDED"
                  }
                />

                <button
                  type="button"
                  className={
                    automationScopeEnabled("CLIENT", client?.client_id)
                      ? "control-off-button"
                      : "control-on-button"
                  }
                  disabled={
                    automationControlLoading ||
                    String(client?.role || "").toUpperCase() !== "SUPER_ADMIN"
                  }
                  title={
                    String(client?.role || "").toUpperCase() === "SUPER_ADMIN"
                      ? "Change client automation"
                      : "Client-level suspension requires SUPER_ADMIN"
                  }
                  onClick={() =>
                    requestAutomationChange({
                      scopeType: "CLIENT",
                      scopeId: client?.client_id,
                      label: client?.name || "Current client",
                      enabled: !automationScopeEnabled("CLIENT", client?.client_id),
                    })
                  }
                >
                  {automationScopeEnabled("CLIENT", client?.client_id) ? "Turn Off" : "Turn On"}
                </button>
              </div>

              {String(client?.role || "").toUpperCase() !== "SUPER_ADMIN" && (
                <div className="automation-permission-note">
                  Client-level ON/OFF is locked to SUPER_ADMIN so a subscription-suspended client cannot reactivate itself.
                </div>
              )}
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Facebook Page automation</h2>
                  <p>Pause one Page while leaving the client's other connected Pages running.</p>
                </div>
              </div>

              <div className="automation-page-list">
                {(automationPages || []).map((fbPage) => {
                  const pageEnabled = automationScopeEnabled("PAGE", fbPage.fb_page_id);
                  const clientEnabled = automationScopeEnabled("CLIENT", client?.client_id);
                  const effectiveEnabled = clientEnabled && pageEnabled;

                  return (
                    <div className="automation-control-row" key={fbPage.fb_page_id}>
                      <div className={`automation-switch-orb ${effectiveEnabled ? "enabled" : "disabled"}`}>
                        <span />
                      </div>

                      <div className="automation-control-copy">
                        <strong>{fbPage.page_name || "Facebook Page"}</strong>
                        <span>{fbPage.fb_page_id}</span>
                        {!pageEnabled && (
                          <small>
                            Reason: {automationScopeReason("PAGE", fbPage.fb_page_id) || "No reason recorded"}
                          </small>
                        )}
                        {pageEnabled && !clientEnabled && (
                          <small>Blocked by client-level suspension.</small>
                        )}
                      </div>

                      <StatusBadge status={effectiveEnabled ? "ACTIVE" : "SUSPENDED"} />

                      <button
                        type="button"
                        className={pageEnabled ? "control-off-button" : "control-on-button"}
                        disabled={
                          automationControlLoading ||
                          !["ADMIN", "OWNER", "SUPER_ADMIN"].includes(
                            String(client?.role || "").toUpperCase()
                          )
                        }
                        onClick={() =>
                          requestAutomationChange({
                            scopeType: "PAGE",
                            scopeId: fbPage.fb_page_id,
                            label: fbPage.page_name || fbPage.fb_page_id,
                            enabled: !pageEnabled,
                          })
                        }
                      >
                        {pageEnabled ? "Turn Off" : "Turn On"}
                      </button>
                    </div>
                  );
                })}

                {!automationControlLoading && !(automationPages || []).length && (
                  <div className="empty-control-state">
                    No connected Facebook Pages found for this client.
                  </div>
                )}
              </div>
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Facebook Page payment automation</h2>
                  <p>Control payment messages, checkout links, and buyer order/payment commands separately for each Page.</p>
                </div>
              </div>

              <div className="automation-page-list">
                {(automationPages || []).map((fbPage) => {
                  const enabled = fbPage.payment_automation_enabled !== false;
                  return (
                    <div className="automation-control-row" key={`payment-${fbPage.fb_page_id}`}>
                      <div className={`automation-switch-orb ${enabled ? "enabled" : "disabled"}`}><span /></div>
                      <div className="automation-control-copy">
                        <strong>{fbPage.page_name || "Facebook Page"}</strong>
                        <span>{fbPage.fb_page_id}</span>
                        {!enabled && <small>Automated payment messages and buyer !ORDER / !PAY commands are blocked for this Page.</small>}
                        {enabled && fbPage.payment_automation_reason && <small>Last change: {fbPage.payment_automation_reason}</small>}
                      </div>
                      <StatusBadge status={enabled ? "ACTIVE" : "SUSPENDED"} />
                      <button
                        type="button"
                        className={enabled ? "control-off-button" : "control-on-button"}
                        disabled={automationControlLoading || !["ADMIN", "OWNER", "SUPER_ADMIN"].includes(String(client?.role || "").toUpperCase())}
                        title={!["ADMIN", "OWNER", "SUPER_ADMIN"].includes(String(client?.role || "").toUpperCase()) ? "Admin access is required" : `${enabled ? "Disable" : "Enable"} payment automation for this Page`}
                        onClick={() => requestAutomationChange({
                          scopeType: "PAGE_PAYMENT",
                          scopeId: fbPage.fb_page_id,
                          label: `${fbPage.page_name || fbPage.fb_page_id} payment automation`,
                          enabled: !enabled,
                        })}
                      >
                        {enabled ? "Turn Off" : "Turn On"}
                      </button>
                    </div>
                  );
                })}
                {!automationControlLoading && !(automationPages || []).length && (
                  <div className="empty-control-state">Connect a Facebook Page to configure its payment automation.</div>
                )}
              </div>
              <div className="automation-permission-note">
                This setting only pauses payment-related automation for the selected Page. Selling participation remains available; buyer !ORDER and !PAY keywords and payment-related notifications are suppressed while it is off.
              </div>
            </section>

            <section className="dashboard-panel automation-control-panel">
              <div className="panel-header">
                <div>
                  <h2>Post-level control</h2>
                  <p>The Facebook Page owner controls individual auction posts directly from the main comment section.</p>
                </div>
              </div>

              <div className="post-command-guide">
                <div>
                  <code>EO2MATE OFF</code>
                  <span>Pause bids, announcements and automatic winner/closing processing for that specific post.</span>
                </div>
                <div>
                  <code>EO2MATE ON</code>
                  <span>Resume the post. Higher-level Client/Page suspension still takes priority.</span>
                </div>
              </div>

              <div className="automation-permission-note">
                These commands are accepted only when posted by the Facebook Page itself on the main auction post, for both Single and Multiple Auction.
              </div>
            </section>
          </>
        )}
  </>);
}
