import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [mode, setMode] = useState("signin");

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        if (!data?.session) {
          setInfoMessage("Account created. Confirm your email, then sign in to continue onboarding.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setErrorMessage(error.message || "Unable to continue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <main className="auth-card">
        <div className="auth-brand">
          <div className="brand-logo">A</div>
          <div>
            <div className="brand-name">Auction Automation</div>
            <div className="brand-subtitle">Client Portal</div>
          </div>
        </div>

        <div className="auth-heading">
          <h1>{mode === "signup" ? "Create your EO2MATE account" : "Welcome back"}</h1>
          <p>{mode === "signup" ? "Start with a CLNT manual-payment trial and connect your Facebook Page." : "Sign in to manage auctions, orders, payments and deliveries."}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
          </label>

          {infoMessage && <div className="success-message">{infoMessage}</div>}
          {errorMessage && <div className="form-error">{errorMessage}</div>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign in"}
          </button>

          <button type="button" className="auth-mode-button" onClick={() => {
            setErrorMessage("");
            setInfoMessage("");
            setMode((current) => current === "signin" ? "signup" : "signin");
          }} disabled={loading}>
            {mode === "signup" ? "Already have an account? Sign in" : "New client? Create an account"}
          </button>
        </form>
      </main>
    </div>
  );
}
