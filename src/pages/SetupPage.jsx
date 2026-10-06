import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const SETTING_LABELS = {
  PAYMENT_DEADLINE_HOURS: "Payment deadline (hours)", PAYMENT_REOPEN_HOURS: "Default payment reopen (hours)",
  ORDER_GROUP_WINDOW_HOURS: "Order grouping window (hours)", WINNER_LINK_EXPIRY_HOURS: "Winner link expiry (hours)",
  ANNOUNCEMENT_INTERVAL_HOURS: "Auction announcement interval (hours)", INVALID_COMMAND_REPLY_ENABLED: "Reply to invalid Messenger commands",
};
const EDITABLE = new Set(Object.keys(SETTING_LABELS));
const ALLOWED_ACTIONS = new Set(["START_PAYMENT","REFRESH_PAYMENT","HELP"]);
const norm = v => String(v || "").trim().replace(/\s+/g," ").toUpperCase();

function RefreshIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9"/><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15"/></svg>}

export default function SetupPage({ client }) {
  const [settings,setSettings]=useState([]), [commands,setCommands]=useState([]), [loading,setLoading]=useState(false);
  const [message,setMessage]=useState(""), [error,setError]=useState("");
  const [edit,setEdit]=useState(null), [value,setValue]=useState("");
  const [confirm,setConfirm]=useState(null), [password,setPassword]=useState(""), [verifying,setVerifying]=useState(false);
  const isAdmin=["ADMIN","OWNER","CLIENT_ADMIN","SUPER_ADMIN"].includes(String(client?.role||"").toUpperCase());

  async function load(){ if(!client?.client_id)return; setLoading(true);setError(""); try{
    const [s,c]=await Promise.all([
      supabase.from("eo2mate_settings").select("*").or(`client_id.is.null,client_id.eq.${client.client_id}`).order("setting_key"),
      supabase.from("eo2mate_command_aliases").select("*").or(`client_id.is.null,client_id.eq.${client.client_id}`).order("command_text")
    ]); if(s.error)throw s.error;if(c.error)throw c.error;setSettings(s.data||[]);setCommands(c.data||[]);
  }catch(e){setError(e.message||"Unable to load setup.")}finally{setLoading(false)}}
  useEffect(()=>{load()},[client?.client_id]);

  const mergedSettings=useMemo(()=>{const m=new Map();settings.filter(x=>!x.client_id).forEach(x=>m.set(x.setting_key,{global:x,override:null,effective:x}));settings.filter(x=>x.client_id).forEach(x=>{const cur=m.get(x.setting_key)||{};m.set(x.setting_key,{...cur,override:x,effective:x})});return [...m.values()].filter(x=>x.effective&&EDITABLE.has(x.effective.setting_key)).sort((a,b)=>a.effective.setting_key.localeCompare(b.effective.setting_key))},[settings]);
  const mergedCommands=useMemo(()=>{const m=new Map();commands.filter(x=>!x.client_id).forEach(x=>m.set(norm(x.command_text),x));commands.filter(x=>x.client_id).forEach(x=>m.set(norm(x.command_text),x));return [...m.values()].filter(x=>ALLOWED_ACTIONS.has(norm(x.action_code))).sort((a,b)=>norm(a.command_text).localeCompare(norm(b.command_text)))},[commands]);

  function beginEdit(item){setEdit(item);setValue(String(item.effective.setting_value??""));setMessage("");setError("")}
  function requestSave(e){e.preventDefault();if(!isAdmin)return setError("Admin access is required.");if(!edit)return; if(!String(value).trim())return setError("Value is required.");setPassword("");setConfirm({item:edit,value:String(value).trim()})}
  async function verifyAndSave(){if(!password)return setError("Enter your current password.");setVerifying(true);setError("");try{
    const {data:{user}}=await supabase.auth.getUser(); if(!user?.email)throw new Error("Unable to verify the signed-in account.");
    const {error:authError}=await supabase.auth.signInWithPassword({email:user.email,password}); if(authError)throw new Error("Incorrect password. No setup changes were made.");
    const key=confirm.item.effective.setting_key; const existing=confirm.item.override;
    if(existing){const {error:e}=await supabase.from("eo2mate_settings").update({setting_value:confirm.value,updated_at:new Date().toISOString()}).eq("setting_id",existing.setting_id);if(e)throw e;}
    else {const base=confirm.item.global||confirm.item.effective;const {error:e}=await supabase.from("eo2mate_settings").insert({client_id:client.client_id,setting_key:key,setting_value:confirm.value,value_type:base.value_type||"TEXT",description:base.description||null,is_active:base.is_active!==false});if(e)throw e;}
    setMessage(`${SETTING_LABELS[key]||key} updated.`);setEdit(null);setValue("");setConfirm(null);setPassword("");await load();
  }catch(e){setError(e.message||"Unable to update setting.")}finally{setVerifying(false)}}

  return <>
    {confirm&&<div className="setup-modal-backdrop"><div className="setup-modal setup-password-modal" role="dialog" aria-modal="true"><div className="setup-modal-icon">🔒</div><div className="setup-modal-copy"><h3>Verify setup change</h3><p>Enter your current EO2MATE password to change <strong>{SETTING_LABELS[confirm.item.effective.setting_key]||confirm.item.effective.setting_key}</strong>.</p></div><label className="setup-password-field">Current password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();verifyAndSave()}}}/></label><div className="setup-modal-actions"><button className="secondary-button" type="button" onClick={()=>{setConfirm(null);setPassword("")}} disabled={verifying}>Cancel</button><button className="primary-button" type="button" onClick={verifyAndSave} disabled={verifying}>{verifying?"Verifying…":"Verify & Save"}</button></div></div></div>}
    <header className="dashboard-header"><div><p className="eyebrow">EO2MATE CONFIGURATION</p><h1>Setup</h1><p>Configure supported EO2MATE settings. Commands are system-defined and read-only.</p></div><button className="icon-button refresh-icon-button" type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh"><RefreshIcon/></button></header>
    {message&&<div className="success-message global-error">{message}</div>}{error&&<div className="dashboard-error global-error">{error}</div>}
    <section className="dashboard-panel setup-panel"><div className="panel-header"><div><h2>Runtime settings</h2><p>Only the setting value can be changed. Every change requires password verification.</p></div></div>
      {edit&&<form className="setup-inline-form setup-form-editing setup-value-only-form" onSubmit={requestSave}><label>Setting<input value={SETTING_LABELS[edit.effective.setting_key]||edit.effective.setting_key} disabled/></label><label>Value{edit.effective.value_type==="BOOLEAN"?<select value={value} onChange={e=>setValue(e.target.value)}><option value="true">true</option><option value="false">false</option></select>:<input value={value} onChange={e=>setValue(e.target.value)}/>}</label><div className="setup-form-actions"><button className="secondary-button" type="button" onClick={()=>setEdit(null)}>Cancel</button><button className="primary-button" type="submit">Save</button></div></form>}
      <div className="table-wrapper"><table><thead><tr><th>Setting</th><th>Value</th><th>Source</th><th>Action</th></tr></thead><tbody>{mergedSettings.map(item=><tr key={item.effective.setting_key}><td><strong>{SETTING_LABELS[item.effective.setting_key]||item.effective.setting_key}</strong></td><td>{String(item.effective.setting_value)}</td><td>{item.override?"Client override":"EO2MATE default"}</td><td><button className="table-action-button" type="button" onClick={()=>beginEdit(item)} disabled={!isAdmin||loading}>Edit value</button></td></tr>)}{!mergedSettings.length&&<tr><td colSpan="4" className="empty-table-cell">No configurable settings found.</td></tr>}</tbody></table></div>
    </section>
    <section className="dashboard-panel setup-panel"><div className="panel-header"><div><h2>Messenger commands</h2><p>Commands map to implemented EO2MATE processes and cannot be created, edited or deleted by clients.</p></div></div><div className="table-wrapper"><table><thead><tr><th>Command</th><th>Action</th><th>Status</th><th>Description</th></tr></thead><tbody>{mergedCommands.map(row=><tr key={norm(row.command_text)}><td><strong>{norm(row.command_text)}</strong></td><td>{row.action_code}</td><td>{row.is_active===false?"Disabled":"Active"}</td><td>{row.description||"—"}</td></tr>)}{!mergedCommands.length&&<tr><td colSpan="4" className="empty-table-cell">No supported commands found.</td></tr>}</tbody></table></div></section>
  </>;
}
