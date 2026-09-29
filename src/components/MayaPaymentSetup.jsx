import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const FUNCTION_BASE =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function MayaPaymentSetup({
  clientId,
  onChanged,
}) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function sessionToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session?.access_token || null;
  }

  async function callMaya(body) {
    const token = await sessionToken();

    if (!token) {
      throw new Error(
        "Your EO2MATE session has expired. Please sign in again."
      );
    }

    const response = await fetch(
      `${FUNCTION_BASE}/maya`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-eo2mate-route": "onboarding",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok || data?.success === false) {
      const backendError =
        typeof data?.message === "string"
          ? data.message
          : typeof data?.error === "string"
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : JSON.stringify(data);
    
      throw new Error(
        backendError ||
          `Maya request failed (${response.status})`
      );
    }

    return data;
  }

  async function load() {
    if (!clientId) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const data = await callMaya({
        action: "status",
        client_id: clientId,
      });

      setStatus(data);
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to load Maya payment status."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [clientId]);

  async function enable() {
    if (!clientId || busy) return;

    setBusy(true);
    setMessage("");

    try {
      const data = await callMaya({
        action: "enable-sandbox",
        client_id: clientId,
        status: "SANDBOX_READY",
        payment_enabled: true,
        is_default: true,
      });

      setStatus(data);

      setMessage(
        "Maya Sandbox online payments are enabled."
      );

      await onChanged?.();
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to enable Maya Sandbox."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!clientId || busy) return;

    setBusy(true);
    setMessage("");

    try {
      const data = await callMaya({
        action: "disable",
        client_id: clientId,
        status: "DISABLED",
        payment_enabled: false,
        is_default: false,
      });

      setStatus(data);

      setMessage(
        "Maya online payments are disabled."
      );

      await onChanged?.();
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to disable Maya online payments."
      );
    } finally {
      setBusy(false);
    }
  }

  const account =
    status?.account ||
    status?.payment_account ||
    null;

  const enabled =
    Boolean(account?.payment_enabled);

  const environment =
    account?.environment ||
    status?.environment ||
    "SANDBOX";

  const accountStatus =
    account?.account_status ||
    account?.onboarding_status ||
    (enabled
      ? "SANDBOX_READY"
      : "NOT_CONFIGURED");

  return (
    <section
      className={`payment-setup-card ${
        enabled ? "active" : ""
      }`}
    >
      <div className="payment-setup-copy">
        <div className="payment-logo">M</div>

        <div>
          <strong>Maya Online Payments</strong>

          <span>
            {loading
              ? "Checking Maya Sandbox status..."
              : enabled
                ? "Maya Sandbox checkout is enabled for this client."
                : "Enable Maya Sandbox to test EO2MATE online checkout."}
          </span>

          <small>
            Environment: {environment} · Status:{" "}
            {accountStatus}
          </small>
        </div>
      </div>

      <div className="payment-setup-actions">
        {!enabled ? (
          <button
            className="primary-button"
            type="button"
            disabled={
              busy ||
              loading ||
              !clientId
            }
            onClick={enable}
          >
            {busy
              ? "Enabling..."
              : "Enable Maya Sandbox"}
          </button>
        ) : (
          <button
            className="secondary-button"
            type="button"
            disabled={busy || loading}
            onClick={disable}
          >
            {busy
              ? "Disabling..."
              : "Disable Maya"}
          </button>
        )}

        <button
          className="icon-button refresh-icon-button"
          type="button"
          onClick={load}
          disabled={
            busy ||
            loading ||
            !clientId
          }
          title="Refresh Maya status"
          aria-label="Refresh Maya status"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
      </div>

      {message && (
        <div className="form-message">
          {message}
        </div>
      )}
    </section>
  );
}
