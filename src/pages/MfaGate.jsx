import { useEffect, useState } from "react";
import { supabase } from "../supabase";

function normalizeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export default function MfaGate({ children }) {
  const [state, setState] = useState("checking");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkMfa();
  }, []);

  async function checkMfa() {
    setError("");
    try {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      if (aal?.currentLevel === "aal2") {
        setState("ready");
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verifiedTotp = (factors?.totp || []).find(
        (factor) => String(factor.status || "").toLowerCase() === "verified"
      );

      if (verifiedTotp || aal?.nextLevel === "aal2") {
        setFactorId(verifiedTotp?.id || factors?.totp?.[0]?.id || "");
        setState("challenge");
        return;
      }

      setState("enroll-intro");
    } catch (err) {
      setError(err.message || "Unable to check multi-factor authentication.");
      setState("error");
    }
  }

  async function beginEnrollment() {
    setLoading(true);
    setError("");
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverified = (factors?.totp || []).filter(
        (factor) => String(factor.status || "").toLowerCase() !== "verified"
      );
      for (const factor of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "EO2MATE Authenticator",
        issuer: "EO2MATE",
      });
      if (enrollError) throw enrollError;

      setFactorId(data.id);
      setQrCode(data.totp?.qr_code || "");
      setSecret(data.totp?.secret || "");
      setCode("");
      setState("enroll");
    } catch (err) {
      setError(err.message || "Unable to start authenticator setup.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment(event) {
    event.preventDefault();
    if (code.length !== 6 || !factorId) return;
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (verifyError) throw verifyError;
      setCode("");
      setState("ready");
    } catch (err) {
      setError(err.message || "The authenticator code could not be verified.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyLogin(event) {
    event.preventDefault();
    if (code.length !== 6 || !factorId) return;
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (verifyError) throw verifyError;
      setCode("");
      setState("ready");
    } catch (err) {
      setError(err.message || "Invalid authenticator code.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (state === "ready") return children;

  return (
    <div className="auth-page mfa-page">
      <main className="auth-card mfa-card">
        <div className="auth-brand">
          <div className="brand-logo">E</div>
          <div>
            <div className="brand-name">EO2MATE</div>
            <div className="brand-subtitle">Secure Sign In</div>
          </div>
        </div>

        {state === "checking" && (
          <div className="auth-heading">
            <h1>Checking account security</h1>
            <p>Verifying your multi-factor authentication status...</p>
          </div>
        )}

        {state === "enroll-intro" && (
          <>
            <div className="auth-heading">
              <h1>Secure your EO2MATE account</h1>
              <p>EO2MATE requires an authenticator app as a second sign-in factor. You can use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.</p>
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="button" onClick={beginEnrollment} disabled={loading}>
              {loading ? "Preparing..." : "Set up authenticator"}
            </button>
            <button className="auth-mode-button" type="button" onClick={signOut}>Sign out</button>
          </>
        )}

        {state === "enroll" && (
          <>
            <div className="auth-heading">
              <h1>Scan the QR code</h1>
              <p>Scan this code with your authenticator app, then enter the 6-digit code it generates.</p>
            </div>
            <div className="mfa-qr-wrap">
              {qrCode ? <img src={qrCode} alt="EO2MATE authenticator QR code" className="mfa-qr" /> : null}
            </div>
            {secret && (
              <div className="mfa-secret">
                <span>Can't scan?</span>
                <code>{secret}</code>
              </div>
            )}
            <form className="login-form" onSubmit={verifyEnrollment}>
              <label>
                6-digit authenticator code
                <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="000000" required />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button" type="submit" disabled={loading || code.length !== 6}>
                {loading ? "Verifying..." : "Enable MFA"}
              </button>
            </form>
          </>
        )}

        {state === "challenge" && (
          <>
            <div className="auth-heading">
              <h1>Authenticator verification</h1>
              <p>Enter the current 6-digit code from your authenticator app to continue to EO2MATE.</p>
            </div>
            <form className="login-form" onSubmit={verifyLogin}>
              <label>
                Authenticator code
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="000000" required />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button" type="submit" disabled={loading || code.length !== 6}>
                {loading ? "Verifying..." : "Verify and continue"}
              </button>
              <button className="auth-mode-button" type="button" onClick={signOut} disabled={loading}>Sign out</button>
            </form>
          </>
        )}

        {state === "error" && (
          <>
            <div className="auth-heading"><h1>Security check unavailable</h1></div>
            <div className="form-error">{error}</div>
            <button className="primary-button" type="button" onClick={() => { setState("checking"); checkMfa(); }}>Try again</button>
            <button className="auth-mode-button" type="button" onClick={signOut}>Sign out</button>
          </>
        )}
      </main>
    </div>
  );
}
