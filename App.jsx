import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import LoginPage from "./pages/LoginPage";
import PortalPage from "./pages/PortalPage";

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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginPage />;
  return <PortalPage session={session} />;
}
