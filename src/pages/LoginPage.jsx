import { useState } from "react";
import { supabase } from "../supabase";

function AuthIcon({ name }) {
  const paths = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    back: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-2 2 2 2-3 3-2-2-2 2"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    swap: <><path d="M7 7h13l-3-3"/><path d="m20 7-3 3"/><path d="M17 17H4l3 3"/><path d="m4 17 3-3"/></>,
  };
  return <svg className="auth-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}

export default function LoginPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [mode, setMode] = useState("signin");

  function clearMessages() { setErrorMessage(""); setInfoMessage(""); }

  async function handleSubmit(event) {
    event.preventDefault(); clearMessages(); setLoading(true);
    try {
      if (mode === "signup") {
        const emailRedirectTo = new URL("./", window.location.href).href;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        if (!data?.session) {
          setInfoMessage("Account created. Confirm your email, then sign in to continue onboarding.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) { setErrorMessage(error.message || "Unable to continue."); }
    finally { setLoading(false); }
  }

  async function sendRecovery(event) {
    event.preventDefault(); clearMessages();
    const address = email.trim();
    if (!address) { setErrorMessage("Enter the email address for your EO2MATE account."); return; }
    setLoading(true);
    try {
      const redirectTo = new URL("./", window.location.href).href;
      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo });
      if (error) throw error;
      setInfoMessage("If an EO2MATE account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.");
    } catch (error) { setErrorMessage(error.message || "Unable to send the password-reset email."); }
    finally { setLoading(false); }
  }

  const recovery = mode === "recovery";
  return (
    <div className="auth-page auth-page-enhanced">
      <div className="auth-backdrop" aria-hidden="true"><span/><span/><span/></div>
      <button className="auth-back-home" type="button" onClick={onBack || (() => { window.location.href = "/"; })}><AuthIcon name="back"/><span>Back to EO2MATE</span></button>
      <main className="auth-card auth-card-enhanced">
        <div className="auth-brand">
          <div className="brand-logo">E</div>
          <div><div className="brand-name">EO2MATE</div><div className="brand-subtitle">Social selling operations</div></div>
        </div>
        <div className="auth-heading">
          <h1>{recovery ? "Reset your password" : mode === "signup" ? "Create your EO2MATE account" : "Welcome to EO2MATE"}</h1>
          <p>{recovery ? "Enter your account email and we'll send you a secure password-reset link." : mode === "signup" ? "Create your account, then complete security and workspace setup." : "Sign in to your EO2MATE account."}</p>
        </div>

        {recovery ? (
          <form onSubmit={sendRecovery} className="login-form">
            <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            {infoMessage && <div className="success-message">{infoMessage}</div>}
            {errorMessage && <div className="form-error">{errorMessage}</div>}
            <button type="submit" className="primary-button" disabled={loading}><AuthIcon name="mail"/>{loading ? "Sending..." : "Send reset link"}</button>
            <button type="button" className="auth-mode-button" onClick={()=>{clearMessages();setMode("signin");}} disabled={loading}><AuthIcon name="back"/>Back to sign in</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>
            {mode === "signin" && <button type="button" className="forgot-password-button" onClick={()=>{clearMessages();setMode("recovery");}}><AuthIcon name="key"/>Forgot password?</button>}
            {infoMessage && <div className="success-message">{infoMessage}</div>}
            {errorMessage && <div className="form-error">{errorMessage}</div>}
            <button type="submit" className="primary-button" disabled={loading}><AuthIcon name={mode === "signup" ? "user" : "key"}/>{loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in securely"}</button>
            <button type="button" className="auth-mode-button" onClick={()=>{clearMessages();setMode(c=>c === "signin" ? "signup" : "signin");}} disabled={loading}><AuthIcon name="swap"/>{mode === "signup" ? "Already have an account? Sign in" : "New client? Create an account"}</button>
          </form>
        )}
      </main>
    </div>
  );
}
