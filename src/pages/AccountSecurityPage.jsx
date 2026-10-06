import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

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

  return <>
    <header className="dashboard-header account-security-header">
      <div>
        <p className="eyebrow">ACCOUNT · SECURITY</p>
        <h1>Account &amp; Security</h1>
        <p>Manage your EO2MATE sign-in email, password and authenticator status.</p>
      </div>
    </header>

    {notice && <div className="success-message global-error">{notice}</div>}
    {error && <div className="dashboard-error global-error">{error}</div>}

    <div className="account-security-grid">
      <section className="settings-card account-security-card">
        <div className="account-security-card-heading"><div><h2>Email address</h2><p>Used to sign in and receive account recovery messages.</p></div></div>
        <div className="account-current-value"><span>Current email</span><strong>{email || "—"}</strong></div>
        <form className="account-security-form" onSubmit={changeEmail}>
          <label>New email address<input type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" /></label>
          <label>Current password<input type="password" autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Verify your password" /></label>
          <p className="account-security-help">Supabase may require confirmation from your current and/or new email address before the change takes effect.</p>
          <button className="primary-button" type="submit" disabled={busy === "email"}>{busy === "email" ? "Updating…" : "Change email"}</button>
        </form>
      </section>

      <section className="settings-card account-security-card">
        <div className="account-security-card-heading"><div><h2>Password</h2><p>Choose a strong password that you do not use elsewhere.</p></div></div>
        <form className="account-security-form" onSubmit={changePassword}>
          <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" /></label>
          <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" /></label>
          <button className="primary-button" type="submit" disabled={busy === "password"}>{busy === "password" ? "Updating…" : "Change password"}</button>
        </form>
      </section>

      <section className="settings-card account-security-card account-security-wide">
        <div className="account-security-card-heading"><div><h2>Authenticator</h2><p>Two-step verification protects this account after the password is accepted.</p></div><span className={`security-status ${verifiedTotp.length ? "ok" : "warn"}`}>{verifiedTotp.length ? "Enabled" : "Not enrolled"}</span></div>
        <div className="security-summary-row"><span>Two-step verification</span><strong>{verifiedTotp.length ? "Active" : "Not active"}</strong></div>
        <p className="account-security-help">Authenticator secrets and internal security details are intentionally not displayed.</p>
      </section>
    </div>
  </>;
}
