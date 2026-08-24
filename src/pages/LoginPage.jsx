import {useState} from "react";
import {supabase} from "../supabase";
export default function LoginPage(){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState("");
 async function submit(e){e.preventDefault();setError("");setLoading(true);const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)setError(error.message);setLoading(false)}
 return <div className="auth-page"><main className="auth-card"><div className="auth-brand"><div className="brand-logo">A</div><div><div className="brand-name">Auction Automation</div><div className="brand-subtitle">Client Portal</div></div></div><div className="auth-heading"><h1>Welcome back</h1><p>Sign in to monitor your auctions, winners and payments.</p></div><form onSubmit={submit} className="login-form"><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading?"Signing in...":"Sign in"}</button></form></main></div>
}
