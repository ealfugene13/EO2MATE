import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginPage() {
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
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
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
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo });
      if (error) throw error;
      setInfoMessage("If an EO2MATE account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.");
    } catch (error) { setErrorMessage(error.message || "Unable to send the password-reset email."); }
    finally { setLoading(false); }
  }

  const recovery = mode === "recovery";
  return (
    <div className="auth-page">
      <main className="auth-card">
        <div className="auth-brand">
          <div className="brand-logo">E</div>
          <div><div className="brand-name">EO2MATE</div><div className="brand-subtitle">Secure account access</div></div>
        </div>
        <div className="auth-heading">
          <h1>{recovery ? "Reset your password" : mode === "signup" ? "Create your EO2MATE account" : "Welcome back"}</h1>
          <p>{recovery ? "Enter your account email and we'll send you a secure password-reset link." : mode === "signup" ? "Create your account, then complete security and workspace setup." : "Sign in to your EO2MATE account."}</p>
        </div>

        {recovery ? (
          <form onSubmit={sendRecovery} className="login-form">
            <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            {infoMessage && <div className="success-message">{infoMessage}</div>}
            {errorMessage && <div className="form-error">{errorMessage}</div>}
            <button type="submit" className="primary-button" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
            <button type="button" className="auth-mode-button" onClick={()=>{clearMessages();setMode("signin");}} disabled={loading}>Back to sign in</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label>Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>
            {mode === "signin" && <button type="button" className="forgot-password-button" onClick={()=>{clearMessages();setMode("recovery");}}>Forgot password?</button>}
            {infoMessage && <div className="success-message">{infoMessage}</div>}
            {errorMessage && <div className="form-error">{errorMessage}</div>}
            <button type="submit" className="primary-button" disabled={loading}>{loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}</button>
            <button type="button" className="auth-mode-button" onClick={()=>{clearMessages();setMode(c=>c === "signin" ? "signup" : "signin");}} disabled={loading}>{mode === "signup" ? "Already have an account? Sign in" : "New client? Create an account"}</button>
          </form>
        )}
      </main>
    </div>
  );
}
