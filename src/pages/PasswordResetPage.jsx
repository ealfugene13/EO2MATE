import { useState } from "react";
import { supabase } from "../supabase";

export default function PasswordResetPage({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault(); setError("");
    if (password.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      onComplete?.();
    } catch (err) { setError(err.message || "Unable to update your password."); }
    finally { setLoading(false); }
  }

  return <div className="auth-page"><main className="auth-card">
    <div className="auth-brand"><div className="brand-logo">E</div><div><div className="brand-name">EO2MATE</div><div className="brand-subtitle">Account recovery</div></div></div>
    <div className="auth-heading"><h1>Choose a new password</h1><p>Set a new password for your EO2MATE account. Your existing authenticator remains enabled.</p></div>
    <form className="login-form" onSubmit={submit}>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 8 characters" required /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Enter it again" required /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "Updating..." : "Update password"}</button>
    </form>
  </main></div>;
}
