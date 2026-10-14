function NavIcon({ type }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    clients: (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M17 8h4" />
        <path d="M19 6v4" />
      </svg>
    ),
    back: (
      <svg {...common}>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    ),
    dashboard: (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    facebook: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M13.5 8H12a2 2 0 0 0-2 2v2h3" />
        <path d="M10 21v-9" />
        <path d="M8 12h5" />
      </svg>
    ),
    create: (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    ),
    mining: (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M6 10h12" />
        <path d="M8 14h8" />
        <path d="M10 18h4" />
        <circle cx="12" cy="6" r="1" />
      </svg>
    ),
    auction: (
      <svg {...common}>
        <path d="m14 5 5 5" />
        <path d="m11 8 5 5" />
        <path d="M4 20 14.5 9.5" />
        <path d="M3 21h7" />
      </svg>
    ),
    orders: (
      <svg {...common}>
        <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M9 11h6" />
      </svg>
    ),
    payments: (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h3" />
      </svg>
    ),
    delivery: (
      <svg {...common}>
        <path d="M3 6h11v11H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    ),
    chat: (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    ),
    users: (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2" />
        <path d="M16 14a5 5 0 0 1 5 5" />
      </svg>
    ),
    inventory: (
      <svg {...common}>
        <path d="M4 7 12 3l8 4-8 4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
    sales: (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M3 19h18" />
        <path d="m15 7 3-3 3 3" />
      </svg>
    ),
    purchases: (
      <svg {...common}>
        <path d="M3 4h2l2 11h10l2-7H7" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
        <path d="M12 6v5" />
        <path d="m10 9 2 2 2-2" />
      </svg>
    ),
    automation: (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    ),
    setup: (
      <svg {...common}>
        <path d="M4 21v-7" />
        <path d="M4 10V3" />
        <path d="M12 21v-9" />
        <path d="M12 8V3" />
        <path d="M20 21v-5" />
        <path d="M20 12V3" />
        <path d="M1 14h6" />
        <path d="M9 8h6" />
        <path d="M17 16h6" />
      </svg>
    ),
    reports: (
      <svg {...common}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19V3" />
      </svg>
    ),
  };

  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        minWidth: 20,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icons[type] || icons.dashboard}
    </span>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";


function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function MetricCard({ title, value, subtitle, onClick }) {
  return (
    <button type="button" className="metric-card metric-button" onClick={onClick}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{subtitle}</div>
    </button>
  );
}

import LiveMiningPage from "./LiveMiningPage";

function parseFacebookLiveVideoId(value) {
  const input = String(value || "").trim();
  if (!input) return { id: "", message: "Paste the Facebook Live link or its numeric video ID." };
  if (/^\d{5,40}$/.test(input)) return { id: input, message: "Video ID detected." };
  if (/^\d+$/.test(input)) return { id: "", message: "The numeric video ID must be at least 5 digits." };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { id: "", message: "That does not look like a Facebook Live link or video ID." };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!(host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch")) {
    return { id: "", message: "Paste a link from Facebook, or enter the numeric video ID." };
  }

  const queryId = url.searchParams.get("v") || url.searchParams.get("video_id");
  if (queryId && /^\d{5,40}$/.test(queryId)) return { id: queryId, message: "Video ID detected from the link." };

  const path = decodeURIComponent(url.pathname);
  const match = path.match(/\/(?:videos?|live)\/(\d{5,40})(?:\/|$)/i);
  if (match) return { id: match[1], message: "Video ID detected from the link." };

  if (host === "fb.watch" || /\/share\/v\//i.test(path)) return { id: "", canResolve: true, message: "Facebook short video link detected. EO2MATE will try to resolve its video ID when you create the session." };

  return { id: "", message: "Could not find a video ID in that link. Open the Live video itself and copy its full Facebook URL." };
}

const LIVE_QUEUE_CSV_TEMPLATE = [
  "item_code,title,mode,quantity,unit_price,mine_price,take_price,lock_price,starting_bid,bid_increment",
  "A12,Test sale item,SELLING,2,1,,,,,",
  "B15,Test mining item,MINING,1,,100,200,300,,",
  "C18,Test auction item,AUCTION,1,,,,,100,10",
].join("\n");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) return { rows: [], error: "CSV has an opening quote without a matching closing quote." };
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return { rows, error: "" };
}

function parseLiveQueueCsv(text, existingItems = []) {
  const parsed = parseCsv(text);
  if (parsed.error) return { rows: [], errors: [parsed.error] };
  if (parsed.rows.length < 2) return { rows: [], errors: ["Choose a CSV with a header row and at least one product row."] };
  if (parsed.rows.length > 101) return { rows: [], errors: ["Upload no more than 100 products in one batch."] };
  const headers = parsed.rows[0].map((value) => value.toLowerCase().replace(/[\s-]+/g, "_"));
  const index = Object.fromEntries(headers.map((value, i) => [value, i]));
  const missing = ["item_code", "title"].filter((name) => index[name] === undefined);
  if (missing.length) return { rows: [], errors: [`Missing required CSV column(s): ${missing.join(", ")}.`] };

  const errors = [];
  const rows = [];
  const codes = new Set((existingItems || []).map((entry) => String(entry.item_code || "").toUpperCase()));
  parsed.rows.slice(1).forEach((cells, rowIndex) => {
    const line = rowIndex + 2;
    const get = (name) => index[name] === undefined ? "" : String(cells[index[name]] || "").trim();
    const item_code = get("item_code").toUpperCase();
    const title = get("title");
    const mode = (get("mode") || "SELLING").toUpperCase();
    const quantityText = get("quantity");
    const quantity = quantityText ? Number(quantityText.replaceAll(",", "")) : 1;
    const rowErrors = [];
    if (!/^[A-Z0-9]{2,12}$/.test(item_code)) rowErrors.push("item_code must be 2–12 letters or numbers.");
    if (!title || title.length > 160) rowErrors.push("title is required and must be 160 characters or fewer.");
    if (!["SELLING", "MINING", "AUCTION"].includes(mode)) rowErrors.push("mode must be SELLING, MINING, or AUCTION.");
    if (!Number.isInteger(quantity) || quantity < 1) rowErrors.push("quantity must be a whole number greater than 0.");
    if (codes.has(item_code)) rowErrors.push(`item_code ${item_code || "(blank)"} is duplicated in this file or already queued.`);

    const amount = (name) => {
      const raw = get(name).replace(/[₱,\s]/g, "");
      return raw === "" ? null : Number(raw);
    };
    const fields = {};
    const needed = mode === "SELLING" ? ["unit_price"] : mode === "MINING" ? ["mine_price", "take_price", "lock_price"] : mode === "AUCTION" ? ["starting_bid", "bid_increment"] : [];
    needed.forEach((name) => {
      const value = amount(name);
      if (value === null || !Number.isFinite(value) || value < 0) rowErrors.push(`${name} must be a valid non-negative amount.`);
      else fields[name] = value;
    });
    if (mode === "SELLING" && fields.unit_price === 0) rowErrors.push("unit_price must be greater than 0.");
    if (mode === "MINING" && needed.every((name) => fields[name] !== undefined) && !(fields.mine_price < fields.take_price && fields.take_price < fields.lock_price)) rowErrors.push("Mining prices must follow Mine < Take < Lock.");
    if (mode === "AUCTION" && fields.bid_increment === 0) rowErrors.push("bid_increment must be greater than 0.");

    if (rowErrors.length) errors.push(`Row ${line}: ${rowErrors.join(" ")}`);
    else {
      codes.add(item_code);
      rows.push({ item_code, title, mode, quantity, ...fields });
    }
  });
  return { rows, errors };
}

function downloadLiveQueueTemplate() {
  const blob = new Blob([LIVE_QUEUE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "eo2mate-live-product-queue-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function MixedLiveManager({ client, selectedFbPageId }) {
  const clientId = client?.client_id;
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState("");
  const pageId = selectedFbPageId || "";
  const [videoInput, setVideoInput] = useState("");
  const [item, setItem] = useState({ item_code: "", title: "", mode: "SELLING", quantity: 1, unit_price: "", mine_price: "", take_price: "", lock_price: "", starting_bid: "", bid_increment: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [queueCsv, setQueueCsv] = useState("");
  const [queueCsvName, setQueueCsvName] = useState("");
  const [queueFileKey, setQueueFileKey] = useState(0);
  const current = sessions.find((s) => s.id === selected);
  const parsedVideo = useMemo(() => parseFacebookLiveVideoId(videoInput), [videoInput]);
  const parsedQueue = useMemo(() => parseLiveQueueCsv(queueCsv, current?.eo2mate_live_items || []), [queueCsv, current]);
  const request = async (action, extra = {}) => {
    if (!clientId) throw new Error("Select a client workspace first.");
    const { data, error } = await supabase.functions.invoke("eo2mate", { headers: { "x-eo2mate-route": "live-admin" }, body: { action, client_id: clientId, ...extra } });
    if (error || data?.error) throw new Error(data?.detail || data?.error || error?.message || "Request failed");
    return data;
  };
  const refresh = async () => { const result = await request("list"); setSessions(result.sessions || []); };
  useEffect(() => { if (clientId) refresh().catch((e) => setMessage(e.message)); }, [clientId]);
  const run = async (action, extra = {}) => {
    setBusy(true); setMessage("");
    try { await request(action, extra); await refresh(); setMessage(`${action} completed.`); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const uploadQueueCsv = async () => {
    if (!current || current.status !== "DRAFT" || !parsedQueue.rows.length || parsedQueue.errors.length) return;
    setBusy(true); setMessage("Uploading products to the queue…");
    try {
      const result = await request("add-items", { session_id: selected, items: parsedQueue.rows });
      await refresh();
      setMessage(`${result.inserted || parsedQueue.rows.length} products added to the queue.`);
      setQueueCsv(""); setQueueCsvName(""); setQueueFileKey((key) => key + 1);
    } catch (e) {
      setMessage(e.message || "Bulk upload failed. No products were added; review the file and try again.");
    } finally { setBusy(false); }
  };
  return <section className="dashboard-panel" style={{ padding: 20 }}>
    <div className="panel-header"><div><h2>Mixed Live Control Center</h2><p>One Facebook Live video. Item-coded commands: <strong>A12 +2</strong>, <strong>B15 LOCK</strong>, <strong>C18 600</strong>.</p></div><button className="secondary-button" type="button" onClick={() => run("list")} disabled={busy}>↻ Refresh</button></div>
    <p>This module records claims and bids; automatic order creation is not enabled in this phase.</p>

    <section aria-labelledby="live-session-setup-title" style={{ padding: 16, margin: "16px 0", border: "1px solid #dbe4ee", borderRadius: 12, background: "#f8fafc" }}>
      <h3 id="live-session-setup-title" style={{ marginTop: 0 }}>1. Connect the Facebook Live video</h3>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>Facebook Page ID<input aria-label="Facebook Page ID" value={pageId} readOnly title="Use the global Facebook Page switcher to change Pages" /></label>
        <label style={{ display: "grid", gap: 6, flex: "1 1 320px" }}>Facebook Live URL or video ID<input aria-label="Facebook Live URL or video ID" placeholder="Paste the Live video link or numeric ID" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} aria-describedby="live-video-id-help" /></label>
        <button className="primary-button" type="button" disabled={busy || !pageId || !(parsedVideo.id || parsedVideo.canResolve)} onClick={async () => { setBusy(true); setMessage(""); try { const payload = { fb_page_id: pageId, ...(parsedVideo.id ? { fb_video_id: parsedVideo.id } : { fb_video_url: videoInput.trim() }) }; const d = await request("create", payload); await refresh(); setSelected(d.session.id); setVideoInput(d.session.fb_video_id); setMessage("Session created in DRAFT. Add products in the queue below."); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }}>＋ Create Session</button>
      </div>
      <p id="live-video-id-help" role="status" style={{ marginBottom: 0, color: parsedVideo.id ? "#087443" : "#58677a" }}>{parsedVideo.message}{parsedVideo.id && <> Detected ID: <strong>{parsedVideo.id}</strong></>}</p>
    </section>

    <section aria-labelledby="live-product-queue-title" style={{ padding: 16, margin: "16px 0", border: "1px solid #dbe4ee", borderRadius: 12 }}>
      <h3 id="live-product-queue-title" style={{ marginTop: 0 }}>2. Product queue</h3>
      {!current ? <p style={{ marginBottom: 0 }}>Create a Live session above, or select an existing session below. The product queue and Add Item form will appear here.</p> : <>
        <label style={{ display: "grid", gap: 6, maxWidth: 480 }}>Live session<select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select a session</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.fb_video_id} — {s.status}</option>)}</select></label>
        <p><strong>Session status:</strong> {current.status} · <strong>Video ID:</strong> {current.fb_video_id}</p>
        {current.status === "DRAFT" && <>
          <h4 style={{ marginBottom: 8 }}>Add product to queue</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <input placeholder="Item code e.g. A12" aria-label="Item code" value={item.item_code} onChange={(e) => setItem({ ...item, item_code: e.target.value.toUpperCase() })} />
            <input placeholder="Product name" aria-label="Product name" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />
            <select aria-label="Selling mode" value={item.mode} onChange={(e) => setItem({ ...item, mode: e.target.value })}><option value="SELLING">Selling</option><option value="MINING">Mining</option><option value="AUCTION">Auction</option></select>
            <input type="number" min="1" aria-label="Quantity" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
            {(item.mode === "SELLING" ? ["unit_price"] : item.mode === "MINING" ? ["mine_price", "take_price", "lock_price"] : ["starting_bid", "bid_increment"]).map((field) => <input key={field} type="number" min="0" step="0.01" aria-label={field.replaceAll("_", " ")} placeholder={field.replaceAll("_", " ")} value={item[field]} onChange={(e) => setItem({ ...item, [field]: e.target.value })} />)}
            <button type="button" className="secondary-button" disabled={busy || !item.title || !item.item_code} onClick={() => run("add-item", { session_id: selected, ...item })}>＋ Add Item to Queue</button>
          </div>
          <section aria-labelledby="bulk-live-queue-title" style={{ marginTop: 18, padding: 14, border: "1px dashed #94a3b8", borderRadius: 10, background: "#f8fafc" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div><h4 id="bulk-live-queue-title" style={{ margin: "0 0 4px" }}>Bulk upload products</h4><p style={{ margin: 0 }}>Queue many products at once from a CSV. Do this while the session is DRAFT, then activate each queued item during the livestream.</p></div>
              <button type="button" className="secondary-button" onClick={downloadLiveQueueTemplate} disabled={busy}>Download CSV template</button>
            </div>
            <label style={{ display: "grid", gap: 6, maxWidth: 520, marginTop: 12 }}>Choose product queue CSV<input key={queueFileKey} type="file" accept=".csv,text/csv" disabled={busy} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setQueueCsvName(file.name); setMessage(""); try { setQueueCsv(await file.text()); } catch { setQueueCsv(""); setMessage("Could not read that CSV file."); } }} /></label>
            <p style={{ margin: "8px 0", fontSize: 13 }}>Required columns: <code>item_code</code>, <code>title</code>. Also use <code>mode</code>, <code>quantity</code>, and the price columns for that mode. Save the spreadsheet as CSV before uploading. Upload up to 100 products per batch.</p>
            {queueCsv && <>
              <p><strong>{queueCsvName || "CSV"}</strong> · {parsedQueue.rows.length} valid product row(s) detected.</p>
              {parsedQueue.errors.length > 0 && <div role="alert" style={{ color: "#9f1239", background: "#fff1f2", padding: 10, borderRadius: 8, marginBottom: 10 }}><strong>Fix these CSV issues before uploading:</strong><ul style={{ marginBottom: 0 }}>{parsedQueue.errors.map((error, i) => <li key={`${i}-${error}`}>{error}</li>)}</ul></div>}
              {parsedQueue.rows.length > 0 && <div className="table-wrapper"><table><thead><tr><th>Code</th><th>Product</th><th>Mode</th><th>Qty</th><th>Mode prices</th></tr></thead><tbody>{parsedQueue.rows.slice(0, 5).map((row) => <tr key={row.item_code}><td>{row.item_code}</td><td>{row.title}</td><td>{row.mode}</td><td>{row.quantity}</td><td>{row.mode === "SELLING" ? formatCurrency(row.unit_price) : row.mode === "MINING" ? `${formatCurrency(row.mine_price)} / ${formatCurrency(row.take_price)} / ${formatCurrency(row.lock_price)}` : `${formatCurrency(row.starting_bid)} / +${formatCurrency(row.bid_increment)}`}</td></tr>)}</tbody></table>{parsedQueue.rows.length > 5 && <p>Showing the first 5 of {parsedQueue.rows.length} products.</p>}</div>}
              <button type="button" className="primary-button" disabled={busy || !parsedQueue.rows.length || parsedQueue.errors.length > 0} onClick={uploadQueueCsv}>＋ Add {parsedQueue.rows.length} Products to Queue</button>
            </>}
          </section>
          <p><button className="primary-button" type="button" disabled={busy || !(current.eo2mate_live_items || []).length} onClick={() => run("start", { session_id: selected })}>▶ Start Session</button></p>
        </>}
        <div className="table-wrapper"><table><thead><tr><th>Code</th><th>Product</th><th>Mode</th><th>Status</th><th>Accepted / Stock</th><th>Action</th></tr></thead><tbody>{(current.eo2mate_live_items || []).map((it) => <tr key={it.id}><td>{it.item_code}</td><td>{it.title}</td><td>{it.mode}</td><td>{it.status}</td><td>{it.claimed} / {it.quantity}</td><td>{current.status === "ACTIVE" && it.status === "QUEUED" && <button className="secondary-button" type="button" disabled={busy} onClick={() => run("activate-item", { session_id: selected, item_id: it.id })}>▶ Activate</button>}</td></tr>)}</tbody></table>{!(current.eo2mate_live_items || []).length && <p>No products queued yet. Add your first product above.</p>}</div>
        {current.status === "ACTIVE" && <button type="button" className="secondary-button" disabled={busy} onClick={() => { if (window.confirm("Close this live session?")) run("close", { session_id: selected }); }}>■ Close Session</button>}
      </>}
    </section>
    {message && <p role="status">{message}</p>}
  </section>;
}

const LIVE_MODES = [
  { key: "SELLING", label: "Live Selling", icon: "sales", command: "+1 / +2", description: "Quantity-based claims during Facebook Live." },
  { key: "MINING", label: "Live Mining", icon: "mining", command: "MINE / TAKE / LOCK", description: "Priority-based claims during Facebook Live." },
  { key: "AUCTION", label: "Live Auction", icon: "auction", command: "Numeric bids", description: "Increment-validated bidding during Facebook Live." },
  { key: "MIXED", label: "Mixed Live", icon: "sales", command: "A12 +2 / B15 LOCK / C18 600", description: "Multiple selling modes in one Facebook Live video using item codes." },
];

export default function LiveSellingPage({ metaConnected, page, client, selectedFbPageId }) {
  const [mode, setMode] = useState("SELLING");
  const [section, setSection] = useState("SUMMARY");
  if (page !== "live-selling") return null;
  const current = LIVE_MODES.find((entry) => entry.key === mode);
  return <>
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">FACEBOOK LIVE OPERATIONS</p>
        <h1>Live Selling</h1>
        <p>Manage Live Selling, Live Mining and Live Auction in one workspace.</p>
      </div>
    </header>
    <section className="selling-workspace-tabs" style={{ marginBottom: 18 }}>
      <div className="selling-workspace-tablist selling-workspace-nav" role="tablist" aria-label="Live selling modes">
        {LIVE_MODES.map((entry) => <button key={entry.key} type="button" role="tab" aria-selected={mode === entry.key} className={`selling-workspace-tab${mode === entry.key ? " active" : ""}`} onClick={() => { setMode(entry.key); setSection("SUMMARY"); }}>
          <span className="selling-nav-icon"><NavIcon type={entry.icon} /></span><span>{entry.label}</span>
        </button>)}
      </div>
    </section>
    <section className="dashboard-panel" style={{ marginBottom: 18 }}>
      <div className="panel-header"><div><h2>{current.label}</h2><p>{current.description} Buyer command: <strong>{current.command}</strong>.</p></div></div>
      <div className="selling-workspace-tablist selling-workspace-nav" role="tablist" aria-label={`${current.label} sections`} style={{ margin: 14 }}>
        {[
          { key: "SUMMARY", label: "Summary", icon: "dashboard" },
          { key: "SESSIONS", label: "Sessions", icon: "reports" },
          { key: "ACTIVITY", label: mode === "AUCTION" ? "Bids" : "Claims", icon: "orders" },
          { key: "BUYERS", label: "Buyers", icon: "users" },
          { key: "REPORTS", label: "Reports", icon: "reports" },
        ].map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={section === tab.key} className={`selling-workspace-tab${section === tab.key ? " active" : ""}`} onClick={() => setSection(tab.key)}><span className="selling-nav-icon"><NavIcon type={tab.icon} /></span><span>{tab.label}</span></button>)}
      </div>
    </section>
    {mode === "MIXED" ? <MixedLiveManager client={client} selectedFbPageId={selectedFbPageId} /> : mode === "MINING" && (section === "SUMMARY" || section === "SESSIONS") ? <LiveMiningPage /> : <>
      {section === "SUMMARY" && <section className="metrics-grid">
        <MetricCard title="Live sessions" value="—" subtitle="Awaiting live integration" />
        <MetricCard title="Active sessions" value="—" subtitle="Awaiting live integration" />
        <MetricCard title={mode === "AUCTION" ? "Bids" : "Claims"} value="—" subtitle="Awaiting live integration" />
        <MetricCard title="Buyers" value="—" subtitle="Awaiting live integration" />
        <MetricCard title="Sales value" value="—" subtitle="Awaiting live integration" />
      </section>}
      <section className="dashboard-panel">
        <div className="panel-header"><div><h2>{current.label} — {section.toLowerCase()}</h2><p>Facebook Live session processing and live activity retrieval are not connected yet.</p></div>
          {section === "SESSIONS" && <button type="button" className="secondary-button" disabled title="Requires live session backend and Meta permissions">Create Live Session · Soon</button>}
        </div>
        <div className="table-wrapper"><table><thead><tr><th>Session</th><th>Facebook Page</th><th>Status</th><th>{mode === "AUCTION" ? "Bids" : "Claims"}</th><th>Buyers</th><th>Sales</th></tr></thead><tbody><tr><td colSpan="6">No verified live session data available. Backend integration pending.</td></tr></tbody></table></div>
      </section>
    </>}
    {!metaConnected && <section className="dashboard-panel"><div className="panel-header"><div><h2>Facebook Page required</h2><p>Connect an authorized Facebook Page before starting a real livestream. Simulated Pages cannot publish to Meta.</p></div></div></section>}
  </>;
}
