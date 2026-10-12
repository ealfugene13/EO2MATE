import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

const FACTOR_NAME = "EO2MATE Authenticator";
const normalizeCode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);
const totpFactors = (data) => (data?.all || data?.totp || []).filter((factor) =>
  (factor.factor_type || "totp") === "totp"
);

export default function MfaGate({ children }) {
  const [state, setState] = useState("checking");
  const [factorId, setFactorId] = useState("");
  const [verifiedFactors, setVerifiedFactors] = useState([]);
  const [pendingFactor, setPendingFactor] = useState(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);

  const inspect = useCallback(async () => {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aal?.currentLevel === "aal2") return { next: "ready" };
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    const factors = totpFactors(data);
    const verified = factors.filter((f) => f.status === "verified");
    const pending = factors.find((f) => f.status !== "verified" && f.friendly_name === FACTOR_NAME) ||
      factors.find((f) => f.status !== "verified") || null;
    return { next: verified.length ? "challenge" : pending ? "recover" : "enroll-intro", verified, pending };
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await inspect();
      if (!mounted.current) return;
      setVerifiedFactors(result.verified || []);
      setPendingFactor(result.pending || null);
      setFactorId(result.verified?.[0]?.id || "");
      setCode("");
      setQrCode("");
      setSecret("");
      setState(result.next);
    } catch (err) {
      if (mounted.current) {
        setError(err.message || "Unable to check MFA status.");
        setState("error");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [inspect]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  async function beginEnrollment(restart = false) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      // Always recheck before mutation: another tab or a previous request may have enrolled a factor.
      const current = await inspect();
      if (current.next === "ready" || current.next === "challenge") {
        setVerifiedFactors(current.verified || []);
        setFactorId(current.verified?.[0]?.id || "");
        setState(current.next);
        return;
      }
      if (current.pending && !restart) {
        setPendingFactor(current.pending);
        setState("recover");
        return;
      }
      if (current.pending && restart) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: current.pending.id });
        if (removeError) throw removeError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp", friendlyName: FACTOR_NAME, issuer: "EO2MATE",
      });
      if (enrollError) {
        // Duplicate name may mean another tab succeeded. Recover by rereading state.
        if (/already exists|duplicate|friendly name/i.test(enrollError.message || "")) {
          const latest = await inspect();
          setVerifiedFactors(latest.verified || []);
          setPendingFactor(latest.pending || null);
          setFactorId(latest.verified?.[0]?.id || "");
          setState(latest.next);
          return;
        }
        throw enrollError;
      }
      setPendingFactor(null);
      setFactorId(data.id);
      setQrCode(data.totp?.qr_code || "");
      setSecret(data.totp?.secret || "");
      setCode("");
      setState("enroll");
    } catch (err) {
      setError(err.message || "Unable to set up authenticator.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    if (busy.current || code.length !== 6 || !factorId) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      // Check AAL rather than trusting a successful response alone.
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel !== "aal2") throw new Error("MFA verification has not completed. Please retry.");
      setCode("");
      setSecret("");
      setQrCode("");
      setState("ready");
    } catch (err) {
      setError(err.message || "The code could not be verified. Try a current code.");
      setCode("");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function signOut() { await supabase.auth.signOut(); }
  if (state === "ready") return children;

  return (
    <div className="auth-page mfa-page">
      <main className="auth-card mfa-card">
        <div className="auth-brand"><div className="brand-logo">E</div><div><div className="brand-name">EO2MATE</div><div className="brand-subtitle">Secure Sign In</div></div></div>
        {state === "checking" && <div className="auth-heading"><h1>Checking account security</h1><p>Checking your authenticator status...</p></div>}
        {state === "enroll-intro" && <>
          <div className="auth-heading"><h1>Secure your EO2MATE account</h1><p>Use an authenticator app to add a second layer of protection.</p>
            <div className="mfa-setup-panel">
              <div className="mfa-setup-row"><span>1</span><div><strong>Open your authenticator app</strong><small>Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.</small></div></div>
              <div className="mfa-setup-row"><span>2</span><div><strong>Scan the QR code</strong><small>We’ll display it in the next step.</small></div></div>
              <div className="mfa-setup-row"><span>3</span><div><strong>Enter the 6-digit code</strong><small>Confirm your authenticator to complete setup.</small></div></div>
            </div>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button mfa-primary-action" type="button" onClick={() => beginEnrollment(false)} disabled={loading}>{loading ? "Preparing..." : "Set up authenticator"}</button>
          <button className="auth-mode-button" type="button" onClick={signOut}>Sign out</button>
        </>}
        {state === "recover" && <>
          <div className="auth-heading"><h1>Finish authenticator setup</h1><p>An earlier authenticator setup was started but not verified. For security, restart setup to generate a fresh QR code. Any existing verified authenticators will be preserved.</p></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button mfa-primary-action" type="button" disabled={loading} onClick={() => beginEnrollment(true)}>{loading ? "Restarting..." : "Restart incomplete setup"}</button>
          <button className="auth-mode-button" type="button" disabled={loading} onClick={refresh}>Check status again</button>
          <button className="auth-mode-button" type="button" onClick={signOut}>Sign out</button>
        </>}
        {state === "enroll" && <>
          <div className="auth-heading"><h1>Connect your authenticator</h1><p>Scan this QR code and enter the current 6-digit code. Keep the setup key private.</p></div>
          <div className="mfa-qr-wrap">{qrCode && <img src={qrCode} alt="EO2MATE authenticator QR code" className="mfa-qr" />}</div>
          {secret && <div className="mfa-secret"><span>Can't scan? Enter this setup key manually.</span><code>{secret}</code></div>}
          <form className="login-form" onSubmit={verify}><label>6-digit authenticator code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="000000" className="mfa-code-input" maxLength={6} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button mfa-primary-action" type="submit" disabled={loading || code.length !== 6}>{loading ? "Verifying..." : "Enable MFA"}</button>
          </form>
          <button className="auth-mode-button" type="button" disabled={loading} onClick={refresh}>Check setup status</button>
        </>}
        {state === "challenge" && <>
          <div className="auth-heading"><h1>Verify your identity</h1><p>Enter the current 6-digit code from your authenticator app.</p></div>
          <form className="login-form" onSubmit={verify}>
            {verifiedFactors.length > 1 && <label>Authenticator<select value={factorId} onChange={(e) => { setFactorId(e.target.value); setCode(""); }}>{verifiedFactors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendly_name || "Authenticator"}</option>)}</select></label>}
            <label>Authenticator code<input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="000000" className="mfa-code-input" maxLength={6} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button mfa-primary-action" type="submit" disabled={loading || code.length !== 6 || !factorId}>{loading ? "Verifying..." : "Verify and continue"}</button>
          </form>
          <button className="auth-mode-button" type="button" disabled={loading} onClick={refresh}>Refresh authenticator status</button>
          <button className="auth-mode-button" type="button" disabled={loading} onClick={signOut}>Sign out</button>
        </>}
        {state === "error" && <><div className="auth-heading"><h1>Security check unavailable</h1></div><div className="form-error" role="alert">{error}</div><button className="primary-button" type="button" disabled={loading} onClick={refresh}>Try again</button><button className="auth-mode-button" type="button" onClick={signOut}>Sign out</button></>}
      </main>
    </div>
  );
}
