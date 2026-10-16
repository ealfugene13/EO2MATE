import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import LoginPage from "./pages/LoginPage";
import PortalPage from "./pages/PortalPage";
import MfaGate from "./pages/MfaGate";
import PasswordResetPage from "./pages/PasswordResetPage";
import PublicHomePage from "./pages/PublicHomePage";
import PublicShowroomPage from "./pages/PublicShowroomPage";

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="brand-logo">A</div>
        <h2>Loading portal</h2>
        <p>Checking your session...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState(null);
  const showroomPageId = new URLSearchParams(window.location.search).get("showroom") || "";

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setVerifiedEmail(data.session?.user?.email_confirmed_at || data.session?.user?.confirmed_at || null);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (mounted) {
          if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
          setSession(newSession);
          setVerifiedEmail(newSession?.user?.email_confirmed_at || newSession?.user?.confirmed_at || null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (/^\d{5,30}$/.test(showroomPageId)) return <PublicShowroomPage fbPageId={showroomPageId} />;
  if (loading) return <LoadingScreen />;
  if (passwordRecovery && session) return <PasswordResetPage onComplete={() => setPasswordRecovery(false)} />;
  if (!session) return showLogin ? <LoginPage onBack={() => setShowLogin(false)} /> : <PublicHomePage onLogin={() => setShowLogin(true)} />;
  if (!verifiedEmail) return (
    <div className="auth-page"><main className="auth-card"><h1>Verify your email</h1><p>Your account email must be confirmed before you can access EO2MATE.</p><p>Check your inbox for the confirmation link, then sign in again.</p><button className="primary-button" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button></main></div>
  );
  return (
    <MfaGate>
      <PortalPage session={session} />
    </MfaGate>
  );
}
