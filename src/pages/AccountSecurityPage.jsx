import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import "./AccountSecurityPage.css";

function SecurityIcon({ type, size = 18 }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/></>,
    shield: <><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-4"/></>,
    refresh: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || paths.user}</svg>;
}

export default function AccountSecurityPage({ session }) {
  const [email, setEmail] = useState(session?.user?.email || "");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaFactors, setMfaFactors] = useState([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const emailSubmitLock = useRef(false);

  async function loadSecurity() {
    setError("");
    const [{ data: userData }, { data: factorData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.mfa.listFactors(),
    ]);
    if (userData?.user?.email) setEmail(userData.user.email);
    setMfaFactors(factorData?.totp || []);
  }

  useEffect(() => { loadSecurity(); }, []);

  async function changeEmail(e) {
    e.preventDefault();
    if (emailSubmitLock.current) return;

    const value = newEmail.trim().toLowerCase();
    if (!value) return setError("Enter your new email address.");
    if (value === String(email).toLowerCase()) return setError("The new email is the same as your current email.");
    if (!emailPassword) return setError("Enter your current password to change your email.");

    emailSubmitLock.current = true;
    setBusy("email"); setError(""); setNotice("");
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: emailPassword });
      if (verifyError) throw new Error("Incorrect current password. Email was not changed.");
      // Resolve against the deployed app directory. This works with Vite's relative
      // base and GitHub Pages sub-path deployments such as /EO2MATE/.
      const emailRedirectTo = new URL("./", window.location.href).href;
      const { error: updateError } = await supabase.auth.updateUser(
        { email: value },
        { emailRedirectTo }
      );
      if (updateError) throw updateError;
      setNewEmail(""); setEmailPassword("");
      setNotice("Email change requested. Open the verification email to complete the change.");
      await loadSecurity();
    } catch (err) {
      setError(err?.message || "Unable to change email.");
    } finally {
      emailSubmitLock.current = false;
      setBusy("");
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < 8) return setError("Use at least 8 characters for the new password.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    setBusy("password"); setError(""); setNotice("");
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verifyError) throw new Error("Incorrect current password. Password was not changed.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setNotice("Password changed successfully. Your authenticator remains enrolled.");
    } catch (err) {
      setError(err?.message || "Unable to change password.");
    } finally { setBusy(""); }
  }

  const verifiedTotp = mfaFactors.filter((f) => f.status === "verified");

  return <div className="account-security-page">
    <header className="dashboard-header account-security-header">
      <div>
        <div className="account-security-title-row"><span className="account-security-page-icon"><SecurityIcon type="shield" size={20} /></span><div><p className="eyebrow">ACCOUNT · SECURITY</p>
        <h1>Account &amp; Security</h1>
        <p>Manage your EO2MATE sign-in email, password and authenticator status.</p></div></div>
      </div>
      <button className="icon-button refresh-icon-button" type="button" onClick={loadSecurity} title="Refresh account security" aria-label="Refresh account security"><SecurityIcon type="refresh" /></button>
    </header>

    {notice && <div className="success-message global-error">{notice}</div>}
    {error && <div className="dashboard-error global-error">{error}</div>}

    <div className="account-security-grid">
      <section className="settings-card account-security-card">
        <div className="account-security-card-heading"><span className="account-security-card-icon email"><SecurityIcon type="mail" /></span><div><h2>Email address</h2><p>Used to sign in and receive account recovery messages.</p></div></div>
        <div className="account-current-value"><span>Current email</span><strong>{email || "—"}</strong></div>
        <form className="account-security-form" onSubmit={changeEmail}>
          <label>New email address<input type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" /></label>
          <label>Current password<input type="password" autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Verify your password" /></label>
          <p className="account-security-help">Supabase may require confirmation from your current and/or new email address before the change takes effect.</p>
          <button className="primary-button account-security-action" type="submit" disabled={busy === "email"}><SecurityIcon type="mail" />{busy === "email" ? "Updating…" : "Change email"}</button>
        </form>
      </section>

      <section className="settings-card account-security-card">
        <div className="account-security-card-heading"><span className="account-security-card-icon password"><SecurityIcon type="lock" /></span><div><h2>Password</h2><p>Choose a strong password that you do not use elsewhere.</p></div></div>
        <form className="account-security-form" onSubmit={changePassword}>
          <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" /></label>
          <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" /></label>
          <button className="primary-button account-security-action" type="submit" disabled={busy === "password"}><SecurityIcon type="lock" />{busy === "password" ? "Updating…" : "Change password"}</button>
        </form>
      </section>

      <section className="settings-card account-security-card account-security-wide">
        <div className="account-security-card-heading"><span className="account-security-card-icon authenticator"><SecurityIcon type="shield" /></span><div><h2>Authenticator</h2><p>Two-step verification protects this account after the password is accepted.</p></div><span className={`security-status ${verifiedTotp.length ? "ok" : "warn"}`}>{verifiedTotp.length ? "Enabled" : "Not enrolled"}</span></div>
        <div className="security-summary-row"><span>Two-step verification</span><strong>{verifiedTotp.length ? "Active" : "Not active"}</strong></div>
        <p className="account-security-help">Authenticator secrets and internal security details are intentionally not displayed.</p>
      </section>
    </div>
  </div>;
}
