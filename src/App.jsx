import {useEffect,useState} from "react";
import {supabase} from "./supabase";
import LoginPage from "./pages/LoginPage";
import PortalPage from "./pages/PortalPage";
export default function App(){
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let mounted=true; supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false)}}); const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>{if(mounted){setSession(s);setLoading(false)}}); return()=>{mounted=false;l.subscription.unsubscribe()};},[]);
 if(loading) return <div className="loading-screen"><div className="loading-card"><h2>Loading portal</h2><p>Checking your session...</p></div></div>;
 return session?<PortalPage session={session}/>:<LoginPage/>;
}
