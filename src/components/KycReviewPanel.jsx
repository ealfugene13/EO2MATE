import { useEffect, useState } from "react";
import { supabase } from "../supabase";

const label = (value) => String(value || "—").replaceAll("_", " ");
const date = (value) => value ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "—";

export default function KycReviewPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [links, setLinks] = useState({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase
      .from("eo2mate_kyc_submissions")
      .select("submission_id,client_id,submitted_by,legal_business_name,business_type,government_id_type,government_id_name,status,submitted_at,reviewed_at,reviewed_by,reviewer_notes,created_at,master_clients(name,contact_email)")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (queryError) setError(queryError.message || "Unable to load KYC submissions.");
    else setRows(data || []);
    setLoading(false);
  }

  async function openReview(row) {
    setSelected(row); setDocuments([]); setLinks({}); setNotes(row.reviewer_notes || ""); setNotice("");
    const { data, error: docError } = await supabase
      .from("eo2mate_kyc_documents")
      .select("document_id,document_type,object_path,content_type,file_size_bytes,created_at")
      .eq("client_id", row.client_id)
      .order("document_type");
    if (docError) { setError(docError.message || "Unable to load verification documents."); return; }
    setDocuments(data || []);
    const nextLinks = {};
    for (const doc of data || []) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("eo2mate-kyc-private").createSignedUrl(doc.object_path, 120);
      if (!signedError && signed?.signedUrl) nextLinks[doc.document_type] = signed.signedUrl;
    }
    setLinks(nextLinks);
  }

  async function review(status) {
    if (!selected || busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("review_eo2mate_kyc", {
        p_submission_id: selected.submission_id,
        p_status: status,
        p_reviewer_notes: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setNotice(`Verification marked ${label(data?.status || status)}.`);
      setSelected(null);
      await load();
    } catch (e) { setError(e.message || "Unable to save review."); }
    finally { setBusy(false); }
  }

  return <section className="dashboard-panel" style={{ marginBottom: 18 }}>
    <div className="panel-header"><div><h2>KYC / KYB review</h2><p>Private identity and business documents submitted during onboarding.</p></div><button type="button" className="secondary-button" onClick={load} disabled={loading}>Refresh</button></div>
    {notice && <div className="success-message" role="status">{notice}</div>}
    {error && <div className="dashboard-error" role="alert">{error}</div>}
    {loading ? <div className="loading-card">Loading KYC submissions…</div> : <div className="table-wrapper"><table><thead><tr><th>Business</th><th>Applicant</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.map(row => <tr key={row.submission_id}><td><strong>{row.legal_business_name}</strong><small className="table-muted">{row.master_clients?.name || row.client_id} · {label(row.business_type)}</small></td><td>{row.master_clients?.contact_email || "—"}</td><td>{date(row.submitted_at)}</td><td><span className="status-badge status-warning">{label(row.status)}</span></td><td><button type="button" className="table-action-button" onClick={() => openReview(row)}>Review</button></td></tr>)}
      {!rows.length && <tr><td colSpan="5" className="empty-table-cell">No KYC/KYB submissions yet.</td></tr>}
    </tbody></table></div>}
    {selected && <div className="manual-order-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setSelected(null); }}><section className="manual-order-dialog" role="dialog" aria-modal="true" aria-labelledby="kyc-review-title">
      <header><div><p className="eyebrow">PRIVATE DOCUMENT REVIEW</p><h2 id="kyc-review-title">{selected.legal_business_name}</h2><p>{selected.master_clients?.name || selected.client_id} · {label(selected.business_type)}</p></div><button type="button" aria-label="Close" onClick={() => setSelected(null)} disabled={busy}>×</button></header>
      <div className="manual-order-grid"><div><strong>Government ID type</strong><p>{label(selected.government_id_type)}</p></div><div><strong>Name supplied by applicant</strong><p>{selected.government_id_name || "—"}</p></div><div><strong>Submitted</strong><p>{date(selected.submitted_at)}</p></div><div><strong>Status</strong><p>{label(selected.status)}</p></div></div>
      <section className="manual-order-section"><h3>Documents</h3><p>Links expire after two minutes. Do not download or share these files outside the review.</p><div className="manual-order-grid">{documents.map(doc => <div key={doc.document_id} className="kyc-document-link"><strong>{label(doc.document_type)}</strong><small>{Math.ceil(doc.file_size_bytes / 1024)} KB · {label(doc.content_type)}</small>{links[doc.document_type] ? <a href={links[doc.document_type]} target="_blank" rel="noreferrer">Open private document</a> : <span>Private link unavailable</span>}</div>)}{!documents.length && <p>No documents attached.</p>}</div></section>
      <label className="manual-order-field"><span>Review notes (visible to applicant)</span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows="4" maxLength="2000" placeholder="Add a concise reason or any document corrections needed." /></label>
      <footer className="manual-order-actions"><button type="button" className="secondary-button" onClick={() => review("IN_REVIEW")} disabled={busy}>{busy ? "Saving…" : "Mark in review"}</button><button type="button" className="secondary-button" onClick={() => review("NEEDS_MORE_INFO")} disabled={busy}>Request more information</button><button type="button" className="secondary-button danger-action" onClick={() => review("REJECTED")} disabled={busy}>Reject</button><button type="button" className="primary-button" onClick={() => review("APPROVED")} disabled={busy}>Approve</button></footer>
    </section></div>}
  </section>;
}
