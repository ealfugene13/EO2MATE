import { useState } from "react";
import { supabase } from "../supabase";

function AuthIcon({ name }) {
  const paths = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    back: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-2 2 2 2-3 3-2-2-2 2"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7 10a16 16 0 0 0 7 7l1.6-2a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2Z"/></>,
    swap: <><path d="M7 7h13l-3-3"/><path d="m20 7-3 3"/><path d="M17 17H4l3 3"/><path d="m4 17 3-3"/></>,
  };
  return <svg className="auth-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}

export default function LoginPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [mode, setMode] = useState("signin");

  const signup = mode === "signup";
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail) && normalizedEmail.length <= 254;
  const allowedSymbols = "!@#$%^&*()_-+=?";
  const phoneValid = /^09[0-9]{9}$/.test(contactPhone);
  const nameValid = (value) => /^[\p{L}][\p{L}\p{M} .\x27-]{0,98}[\p{L}\p{M}.]$/u.test(value.trim()) && value.trim().length >= 2 && value.trim().length <= 100;
  const passwordRules = [
    { label: "At least 10 characters", ok: password.length >= 10 },
    { label: "Uppercase and lowercase letters", ok: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: "At least one number", ok: /\d/.test(password) },
    { label: `At least one allowed symbol (${allowedSymbols})`, ok: /[!@#$%^&*()_\-+=?]/.test(password) },
    { label: "Only supported letters, numbers and symbols", ok: password.length > 0 && /^[A-Za-z0-9!@#$%^&*()_\-+=?]+$/.test(password) },
  ];
  const passwordScore = passwordRules.filter((rule) => rule.ok).length;
  function clearMessages() { setErrorMessage(""); setInfoMessage(""); }

  async function handleSubmit(event) {
    event.preventDefault(); clearMessages(); setLoading(true);
    try {
      if (mode === "signup") {
        if (!emailValid) throw new Error("Enter a valid email address.");
        if (!nameValid(firstName)) throw new Error("Enter a valid first name (2–100 characters).");
        if (!nameValid(lastName)) throw new Error("Enter a valid last name (2–100 characters).");
        if (!phoneValid) throw new Error("Contact number must be exactly 11 digits starting with 09.");
        if (passwordScore !== passwordRules.length) throw new Error("Your password must meet all security requirements. Use only the symbols shown.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        if (!acceptedPolicies) throw new Error("Please accept the Terms of Service and Privacy Policy.");
        const emailRedirectTo = new URL("./", window.location.href).href;
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo, data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: `${firstName.trim()} ${lastName.trim()}`, contact_phone: contactPhone } },
        });
        if (error) throw error;
        if (!data?.session) {
          setInfoMessage("Account created. Confirm your email, then sign in to continue onboarding.");
          setMode("signin");
        }
      } else {
        if (!emailValid) throw new Error("Enter a valid email address.");
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error) { setErrorMessage(error.message || "Unable to continue."); }
    finally { setLoading(false); }
  }

  async function sendRecovery(event) {
    event.preventDefault(); clearMessages();
    const address = email.trim();
    if (!emailValid) { setErrorMessage("Enter the email address for your EO2MATE account."); return; }
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
          <form onSubmit={handleSubmit} className="login-form eo2-auth-form" noValidate>
            {signup && <div className="eo2-signup-group">
              <div className="eo2-name-row">
                <label>First name <span className="eo2-required">*</span><input type="text" value={firstName} onChange={(e)=>setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" maxLength={100} required /></label>
                <label>Last name <span className="eo2-required">*</span><input type="text" value={lastName} onChange={(e)=>setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" maxLength={100} required /></label>
              </div>
              <div className="eo2-phone-field"><label htmlFor="eo2-contact-phone">Contact number <span className="eo2-required">*</span></label><div className="eo2-phone-input"><span className="eo2-phone-icon" aria-hidden="true"><AuthIcon name="phone"/></span><input id="eo2-contact-phone" type="tel" inputMode="numeric" value={contactPhone} onChange={(e)=>setContactPhone(e.target.value.replace(/\D/g, "").slice(0,11))} placeholder="09XXXXXXXXX" autoComplete="tel-national" maxLength={11} pattern="09[0-9]{9}" aria-describedby="eo2-phone-help" aria-invalid={!!contactPhone && !phoneValid} required /></div><div className="eo2-phone-meta"><small id="eo2-phone-help" className={contactPhone && !phoneValid ? "eo2-field-error" : "eo2-auth-hint"}>{contactPhone && !phoneValid ? "Enter exactly 11 digits starting with 09." : "Philippine mobile number · e.g. 09171234567"}</small><small className="eo2-phone-count">{contactPhone.length}/11</small></div></div>
            </div>}
            <label>Email address <span className="eo2-required">*</span><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required aria-invalid={!!email && !emailValid}/></label>
            {email && !emailValid && <small className="eo2-field-error">Enter a valid email address.</small>}
            <label>Password <span className="eo2-required">*</span><span className="eo2-password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder={signup ? "Create a strong password" : "Enter password"} autoComplete={signup ? "new-password" : "current-password"} required/><button type="button" className="eo2-visibility" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}><AuthIcon name="eye"/></button></span></label>
            {signup && <>
              <div className="eo2-password-guidance" aria-live="polite">
                <div className="eo2-strength-header"><strong>Password security</strong><span>{passwordScore === passwordRules.length ? "Requirements met" : `${passwordScore} of ${passwordRules.length} requirements`}</span></div>
                <div className="eo2-strength-track"><span style={{width:`${passwordScore / passwordRules.length * 100}%`, background:passwordScore===passwordRules.length ? "#26805a" : "#cf8b32"}}/></div>
                <div className="eo2-password-rules">{passwordRules.map((rule, index)=><small key={rule.label} className={rule.ok ? "met" : ""}>{rule.ok ? "✓" : "○"} {rule.label}</small>)}</div>
              </div>
              <label>Confirm password <span className="eo2-required">*</span><input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" required/></label>
              {confirmPassword && password !== confirmPassword && <small className="eo2-field-error">Passwords do not match.</small>}
              <label className="eo2-policy"><input type="checkbox" checked={acceptedPolicies} onChange={e=>setAcceptedPolicies(e.target.checked)} required/><span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
              <p className="eo2-auth-hint">After registration, verify your email and complete your secure workspace setup.</p>
            </>}
            {mode === "signin" && <button type="button" className="forgot-password-button" onClick={()=>{clearMessages();setMode("recovery");}}><AuthIcon name="key"/>Forgot password?</button>}
            {infoMessage && <div className="success-message" role="status">{infoMessage}</div>}
            {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}
            <button type="submit" className="primary-button" disabled={loading}><AuthIcon name={signup ? "user" : "key"}/>{loading ? "Please wait..." : signup ? "Create secure account" : "Sign in securely"}</button>
            <button type="button" className="auth-mode-button" onClick={()=>{clearMessages();setMode(c=>c === "signin" ? "signup" : "signin");}} disabled={loading}><AuthIcon name="swap"/>{signup ? "Already have an account? Sign in" : "New client? Create an account"}</button>
          </form>
        )}
      </main>
    </div>
  );
}
