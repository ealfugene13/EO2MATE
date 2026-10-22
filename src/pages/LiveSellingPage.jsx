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
    add: (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
    upload: (
      <svg {...common}>
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
      </svg>
    ),
    download: (
      <svg {...common}>
        <path d="M12 4v12m0 0 5-5m-5 5-5-5" />
        <path d="M5 17v3h14v-3" />
      </svg>
    ),
    play: (
      <svg {...common}>
        <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />
      </svg>
    ),
    stop: (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="2" />
      </svg>
    ),
    refresh: (
      <svg {...common}>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3" />
      </svg>
    ),
    view: (
      <svg {...common}>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
    bell: (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
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
import RecordPagination, { useRecordPagination } from "../components/RecordPagination";


function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

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

function isValidLiveItemCode(value) {
  return /^[A-Z0-9][A-Z0-9-]{0,39}$/.test(String(value || "").trim().toUpperCase());
}

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

function parseLiveQueueCsv(text, existingItems = [], forcedMode = "") {
  const parsed = parseCsv(text);
  if (parsed.error) return { rows: [], errors: [parsed.error] };
  if (parsed.rows.length < 2) return { rows: [], errors: ["Choose a CSV with a header row and at least one product row."] };
  if (parsed.rows.length > 101) return { rows: [], errors: ["Upload no more than 100 products in one batch."] };
  const headers = parsed.rows[0].map((value) => value.replace(/^\uFEFF/, "").toLowerCase().replace(/[\s-]+/g, "_"));
  const index = Object.fromEntries(headers.map((value, i) => [value, i]));
  // Accept older spreadsheet headings while keeping the canonical column in
  // the downloaded template. Excel exports may also include a UTF-8 BOM.
  if (index.mining_duration_minutes === undefined) {
    for (const alias of ["mining_duration", "mining_minutes", "mine_duration_minutes", "mining_time_limit_minutes"]) {
      if (index[alias] !== undefined) { index.mining_duration_minutes = index[alias]; break; }
    }
  }
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
    // A mode supplied by the CSV must win so mixed SELLING/MINING/AUCTION
    // batches keep their per-row mode even when uploaded from a mode tab.
    const mode = (get("mode") || forcedMode || "SELLING").toUpperCase();
    const quantityText = get("quantity");
    const quantity = quantityText ? Number(quantityText.replaceAll(",", "")) : 1;
    const rowErrors = [];
    if (!/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(item_code)) rowErrors.push("item_code must be 1–40 letters, numbers, or hyphens.");
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
      const auctionDurationText = get("auction_duration_minutes");
      const auction_duration_minutes = mode !== "AUCTION"
        ? 0
        : !auctionDurationText || auctionDurationText.toLowerCase() === "null"
          ? 0
          : Number(auctionDurationText);
      const miningDurationText = get("mining_duration_minutes");
      const miningDurationValue = miningDurationText.match(/^\s*(\d+(?:\.0+)?)\s*(?:min|mins|minute|minutes)?\s*$/i);
      const mining_duration_minutes = mode === "MINING" && miningDurationValue ? Number(miningDurationValue[1]) : null;
      if (mode === "AUCTION" && (!Number.isInteger(auction_duration_minutes) || auction_duration_minutes < 1 || auction_duration_minutes > 1440)) {
        errors.push(`Row ${line}: auction_duration_minutes must be a whole number from 1 to 1440.`);
      } else if (mode === "MINING" && (!Number.isInteger(mining_duration_minutes) || mining_duration_minutes < 1 || mining_duration_minutes > 1440)) {
        errors.push(`Row ${line}: mining_duration_minutes must be a whole number from 1 to 1440 (read: ${miningDurationText || "blank"}).`);
      } else {
        rows.push({ item_code, title, mode, quantity, auction_duration_minutes, inventory_item_id: get("inventory_item_id") || null, ...(mode === "MINING" ? { mining_duration_minutes } : {}), ...fields });
      }
    }
  });
  return { rows, errors };
}

function downloadLiveQueueTemplate(mode = "MIXED") {
  const rows = {
    SELLING: ["A12,Test sale item,SELLING,2,1,,,,,,0,"],
    MINING: ["B15,Test mining item,MINING,1,,100,200,300,,,0,1"],
    AUCTION: ["C18,Test auction item,AUCTION,1,,,,,100,10,1,"],
  };
  const examples = mode === "MIXED" ? [rows.SELLING[0], rows.MINING[0], rows.AUCTION[0]] : rows[mode] || rows.SELLING;
  const csv = ["item_code,title,mode,quantity,unit_price,mine_price,take_price,lock_price,starting_bid,bid_increment,auction_duration_minutes,mining_duration_minutes,inventory_item_id", ...examples].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "eo2mate-live-product-queue-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadLiveReport(sessions, activeMode) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [["session_id", "facebook_video_id", "session_status", "item_code", "product", "mode", "item_status", "claimed", "quantity", "unit_price"]];
  for (const session of sessions || []) {
    for (const item of session.eo2mate_live_items || []) {
      if (activeMode !== "MIXED" && String(item.mode || "").toUpperCase() !== activeMode) continue;
      lines.push([session.id, session.fb_video_id, session.status, item.item_code, item.title, item.mode, item.status, item.claimed, item.quantity, item.unit_price]);
    }
  }
  const csv = lines.map((row) => row.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `eo2mate-live-${activeMode.toLowerCase()}-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function LivePopupNotifications({ notifications, onDismiss }) {
  if (!notifications.length) return null;
  return <div aria-live="polite" aria-atomic="false" style={{ position: "fixed", top: 20, right: 20, zIndex: 10020, display: "grid", gap: 10, width: "min(420px, calc(100vw - 32px))" }}>
    {notifications.map((notification) => <div key={notification.id} role="status" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 15px", border: `1px solid ${notification.kind === "ended" ? "#fecaca" : "#a7f3d0"}`, borderLeft: `5px solid ${notification.kind === "ended" ? "#dc2626" : "#059669"}`, borderRadius: 12, background: "#fff", boxShadow: "0 12px 32px rgba(15, 23, 42, .18)" }}>
      <span style={{ color: notification.kind === "ended" ? "#dc2626" : "#047857", paddingTop: 1 }}><NavIcon type={notification.kind === "ended" ? "facebook" : "inventory"} /></span>
      <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", marginBottom: 3, color: "#172b4d" }}>{notification.title}</strong><span style={{ color: "#475569", fontSize: 13, lineHeight: 1.45 }}>{notification.detail}</span></span>
      <button type="button" onClick={() => onDismiss(notification.id)} aria-label="Dismiss notification" style={{ border: 0, background: "transparent", color: "#64748b", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}>×</button>
    </div>)}
  </div>;
}

function MixedLiveManager({ client, selectedFbPageId, activeMode = "MIXED", section = "SESSIONS", setSection, refreshActionRef }) {
  const clientId = client?.client_id;
  const [sessions, setSessions] = useState([]);
  const [auctionBids, setAuctionBids] = useState([]);
  const [selected, setSelected] = useState("");
  const [postCaptions, setPostCaptions] = useState({});
  const captionRequests = useRef(new Set());
  const manualCloseRequests = useRef(new Set());
  const liveSnapshots = useRef({ clientId: "", pageId: "", initialized: false, sessions: new Map() });
  const [popupNotifications, setPopupNotifications] = useState([]);
  const pageId = selectedFbPageId || "";
  const [videoInput, setVideoInput] = useState("");
  const [item, setItem] = useState({ inventory_item_id: "", item_code: "", title: "", mode: activeMode === "MIXED" ? "SELLING" : activeMode, quantity: 1, unit_price: "", mine_price: "", take_price: "", lock_price: "", starting_bid: "", bid_increment: "", auction_duration_minutes: 1, mining_duration_minutes: "" });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("success");
  const [historyItem, setHistoryItem] = useState(null);
  const [historyComments, setHistoryComments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [queueCsv, setQueueCsv] = useState("");
  const [queueCsvName, setQueueCsvName] = useState("");
  const [queueFileKey, setQueueFileKey] = useState(0);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const current = sessions.find((s) => s.id === selected);
  const selectedInventoryItem = inventoryItems.find((entry) => String(entry.inventory_item_id) === String(item.inventory_item_id));
  const queuedItemCodes = new Set((current?.eo2mate_live_items || []).map((entry) => String(entry.item_code || "").trim().toUpperCase()));
  const itemCodeAlreadyQueued = Boolean(item.item_code && queuedItemCodes.has(String(item.item_code).trim().toUpperCase()));
  const visibleSessions = sessions.filter((session) => activeMode === "MIXED" || !(session.eo2mate_live_items || []).length || (session.eo2mate_live_items || []).some((entry) => String(entry.mode || "").toUpperCase() === activeMode));
  const visibleItems = (current?.eo2mate_live_items || []).filter((entry) => activeMode === "MIXED" || String(entry.mode || "").toUpperCase() === activeMode);
  const reportItems = visibleSessions.flatMap((session) => (session.eo2mate_live_items || [])
    .filter((entry) => activeMode === "MIXED" || String(entry.mode || "").toUpperCase() === activeMode)
    .map((entry) => ({ ...entry, session_status: session.status, fb_video_id: session.fb_video_id })));
  const activityRows = activeMode === "AUCTION"
    ? auctionBids.filter((bid) => visibleSessions.some((session) => session.id === bid.session_id))
    : reportItems;
  const sessionsPagination = useRecordPagination(visibleSessions, activeMode);
  const activityPagination = useRecordPagination(activityRows, `${activeMode}|activity`);
  const reportPagination = useRecordPagination(reportItems, `${activeMode}|report`);
  const queuePagination = useRecordPagination(visibleItems, `${selected || ""}|${activeMode}`);
  const totals = {
    sessions: visibleSessions.length,
    active: visibleSessions.filter((session) => session.status === "ACTIVE").length,
    products: reportItems.length,
    claimed: reportItems.reduce((sum, entry) => sum + (Number(entry.claimed) || 0), 0),
  };
  const parsedVideo = useMemo(() => parseFacebookLiveVideoId(videoInput), [videoInput]);
  const parsedQueue = useMemo(() => parseLiveQueueCsv(queueCsv, current?.eo2mate_live_items || [], activeMode === "MIXED" ? "" : activeMode), [queueCsv, current, activeMode]);
  useEffect(() => {
    setItem((previous) => ({ ...previous, mode: activeMode === "MIXED" ? "SELLING" : activeMode }));
  }, [activeMode]);
  const showPopup = (title, detail, kind = "inventory") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPopupNotifications((previous) => [...previous, { id, title, detail, kind }].slice(-4));
    window.setTimeout(() => setPopupNotifications((previous) => previous.filter((entry) => entry.id !== id)), 9000);
  };
  const request = async (action, extra = {}) => {
    if (!clientId) throw new Error("Select a client workspace first.");
    const { data, error } = await supabase.functions.invoke("eo2mate", { headers: { "x-eo2mate-route": "live-admin" }, body: { action, client_id: clientId, ...extra } });
    if (error) {
      let serverMessage = data?.detail || data?.message || data?.error;
      if (!serverMessage && error.context && typeof error.context.clone === "function") {
        const payload = await error.context.clone().json().catch(() => null);
        serverMessage = payload?.detail || payload?.message || payload?.error;
      }
      throw new Error(serverMessage || error.message || "Request failed");
    }
    if (data?.error) throw new Error(data?.detail || data?.message || data.error);
    return data;
  };
  const loadInventoryItems = async () => {
    if (!clientId) return;
    setInventoryLoading(true);
    setInventoryError("");
    try {
      const { data, error } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "inventory-admin" },
        body: { action: "LIST_ITEMS", client_id: clientId, search: "", status: "ACTIVE", fb_page_id: pageId || null },
      });
      if (error || data?.error || data?.success === false) throw new Error(data?.detail || data?.message || data?.error || error?.message || "Unable to load inventory items.");
      const availableItems = (data?.items || []).filter((entry) => String(entry.status || "ACTIVE").toUpperCase() === "ACTIVE" && Math.floor(Number(entry.qty_available ?? 0)) > 0);
      setInventoryItems(availableItems);
      setItem((previous) => previous.inventory_item_id && !availableItems.some((entry) => String(entry.inventory_item_id) === String(previous.inventory_item_id))
        ? { ...previous, inventory_item_id: "" }
        : previous);
    } catch (error) {
      setInventoryItems([]);
      setInventoryError(error.message || "Unable to load inventory items.");
    } finally {
      setInventoryLoading(false);
    }
  };
  const refresh = async () => {
    const result = await request("list", pageId ? { fb_page_id: pageId } : {});
    const nextSessions = result.sessions || [];
    setAuctionBids(result.auction_bids || []);
    const previousSnapshot = liveSnapshots.current;
    const sameScope = previousSnapshot.clientId === clientId && previousSnapshot.pageId === pageId;
    const nextSnapshot = new Map();
    for (const session of nextSessions) {
      const previousSession = sameScope && previousSnapshot.initialized ? previousSnapshot.sessions.get(session.id) : null;
      const nextItems = new Map();
      for (const entry of session.eo2mate_live_items || []) {
        const claimed = Number(entry.claimed) || 0;
        const previousItem = previousSession?.items.get(entry.id);
        const previousClaimed = Number(previousItem?.claimed) || 0;
        if (previousItem && claimed > previousClaimed) {
          showPopup("Live inventory updated", `${entry.item_code}: ${claimed - previousClaimed} unit(s) accepted. Claimed stock is now ${claimed}/${entry.quantity}.`);
        }
        nextItems.set(entry.id, { claimed });
      }
      if (previousSession?.status === "ACTIVE" && String(session.status).toUpperCase() === "CLOSED") {
        const wasManuallyClosed = manualCloseRequests.current.delete(session.id);
        if (!wasManuallyClosed && String(session.closed_reason || "").toUpperCase() === "FACEBOOK_ENDED") {
          showPopup("Facebook Live ended", "The EO2MATE session and its product queue have been closed automatically.", "ended");
        }
      }
      nextSnapshot.set(session.id, { status: String(session.status || "").toUpperCase(), items: nextItems });
    }
    liveSnapshots.current = { clientId, pageId, initialized: true, sessions: nextSnapshot };
    setSessions(nextSessions);
    setPostCaptions((previous) => ({ ...previous, ...Object.fromEntries(nextSessions.filter((session) => session.fb_caption).map((session) => [session.id, session.fb_caption])) }));
    if (selected && !nextSessions.some((session) => session.id === selected)) setSelected("");
    const missingCaptions = nextSessions.filter((session) => !captionRequests.current.has(session.id));
    if (missingCaptions.length) {
      missingCaptions.forEach((session) => captionRequests.current.add(session.id));
      let captionTimeout;
      try {
        const captionResult = await Promise.race([
          request("captions", { session_ids: missingCaptions.map((session) => session.id) }),
          new Promise((_, reject) => { captionTimeout = window.setTimeout(() => reject(new Error("Caption lookup timed out.")), 12000); }),
        ]);
        const received = Object.fromEntries((captionResult.captions || []).map((entry) => [entry.session_id, entry.caption || ""]));
        setPostCaptions((previous) => ({ ...previous, ...received }));
      } catch {
        setPostCaptions((previous) => ({ ...previous, ...Object.fromEntries(missingCaptions.map((session) => [session.id, ""])) }));
      } finally {
        window.clearTimeout(captionTimeout);
      }
    }
  };
  const refreshSessions = async () => {
    setBusy(true); setMessage(""); setMessageKind("success");
    try { await refresh(); setMessage("Live sessions refreshed."); }
    catch (error) { setMessage(error.message || "Unable to refresh Live sessions."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!refreshActionRef) return undefined;
    refreshActionRef.current = refreshSessions;
    return () => { if (refreshActionRef.current === refreshSessions) refreshActionRef.current = null; };
  }, [refreshActionRef, refreshSessions]);
  useEffect(() => {
    liveSnapshots.current = { clientId, pageId, initialized: false, sessions: new Map() };
    setPopupNotifications([]);
  }, [clientId, pageId]);
  useEffect(() => {
    if (clientId) {
      refresh().catch((e) => setMessage(e.message));
      loadInventoryItems();
    }
  }, [clientId, pageId]);
  useEffect(() => {
    if (!clientId) return undefined;
    let lastRealtimeUpdate = Date.now();
    let refreshInFlight = false;
    const refreshQueue = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        await refresh();
      } catch (error) {
        setMessage(error.message || "Unable to refresh the Live queue.");
      } finally {
        refreshInFlight = false;
      }
    };
    let channel = supabase.channel(`live-queue-${selected || pageId || clientId}`);
    if (selected) channel = channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "eo2mate_live_items",
        filter: `session_id=eq.${selected}`,
      }, () => {
        lastRealtimeUpdate = Date.now();
        refreshQueue();
      });
    if (pageId) channel = channel.on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "eo2mate_live_sessions",
        filter: `fb_page_id=eq.${pageId}`,
      }, () => {
        lastRealtimeUpdate = Date.now();
        refreshQueue();
      });
    if (pageId) channel = channel.on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "eo2mate_live_notifications",
        filter: `fb_page_id=eq.${pageId}`,
      }, () => {
        lastRealtimeUpdate = Date.now();
        refreshQueue();
      });
    channel.subscribe();
    // Realtime may report SUBSCRIBED even when this table is not enabled for
    // Postgres Changes. Keep a light fallback so claimed stock/status updates
    // still appear promptly after Meta processes a valid Live comment.
    const fallbackRefresh = window.setInterval(() => {
      if (sessionsRef.current.some((session) => session.status === "ACTIVE") && Date.now() - lastRealtimeUpdate >= 5000) refreshQueue();
    }, 5000);
    return () => {
      window.clearInterval(fallbackRefresh);
      supabase.removeChannel(channel);
    };
  }, [clientId, selected, pageId]);
  const run = async (action, extra = {}) => {
    setBusy(true); setMessage("");
    try {
      const result = await request(action, extra);
      await refresh();
      if (action === "activate-item" && result?.activation_comment_posted === false) { setMessageKind("warning"); setMessage("Product activated, but Facebook could not post its opening comment. Check the Page token and function logs."); }
      else if (action === "activate-item" && result?.activation_comment_posted === true) setMessage(result.activation_comment_mode === "MINING" ? "Product activated. The Mining opening and time limit were posted to Facebook." : "Product activated. The auction opening details and closing time were posted to Facebook.");
      else { setMessageKind("success"); setMessage(`${action} completed.`); }
    }
    catch (e) { setMessageKind("error"); setMessage(e.message); }
    finally { setBusy(false); }
  };
  const addItemToQueue = async () => {
    if (!current || !["DRAFT", "ACTIVE"].includes(current.status)) return;
    if (!isValidLiveItemCode(item.item_code)) {
      setMessageKind("error"); setMessage("Item code must be 1–40 letters, numbers, or hyphens.");
      return;
    }
    if (item.mode === "MINING" && (!Number.isInteger(Number(item.mining_duration_minutes)) || Number(item.mining_duration_minutes) < 1 || Number(item.mining_duration_minutes) > 1440)) {
      setMessageKind("error"); setMessage("Mining duration must be a whole number from 1 to 1440 minutes.");
      return;
    }
    setBusy(true); setMessage(""); setMessageKind("success");
    try {
      await request("add-item", { session_id: selected, ...item, mining_duration_minutes: item.mode === "MINING" ? Number(item.mining_duration_minutes) : null });
      setItem({ inventory_item_id: "", item_code: "", title: "", mode: item.mode, quantity: 1, unit_price: "", mine_price: "", take_price: "", lock_price: "", starting_bid: "", bid_increment: "", auction_duration_minutes: 1, mining_duration_minutes: "" });
      setMessage("Product added to queue. Select the next inventory item when ready.");
      showPopup("Product added successfully", `${item.item_code} · ${item.title} was added to the Live queue.`);
      try { await refresh(); } catch { setMessageKind("warning"); setMessage("Product was added, but the queue could not refresh. Use Refresh to reload it."); }
    } catch (e) {
      setMessageKind("error");
      setMessage(e.message || "Unable to add this product to the queue.");
    } finally { setBusy(false); }
  };
  const uploadQueueCsv = async () => {
    if (!current || !["DRAFT", "ACTIVE"].includes(current.status) || !parsedQueue.rows.length || parsedQueue.errors.length) return;
    setBusy(true); setMessage("Uploading products to the queue…"); setMessageKind("success");
    try {
      const result = await request("add-items", { session_id: selected, items: parsedQueue.rows });
      setMessage(`${result.inserted || parsedQueue.rows.length} products added to the queue.`);
      showPopup("Products added successfully", `${result.inserted || parsedQueue.rows.length} product(s) were added to the Live queue.`);
      setQueueCsv(""); setQueueCsvName(""); setQueueFileKey((key) => key + 1);
      try { await refresh(); } catch { setMessageKind("warning"); setMessage("Products were added, but the queue could not refresh. Use Refresh to reload it."); }
    } catch (e) {
      setMessageKind("error");
      setMessage(e.message || "Bulk upload failed; review the file and try again.");
    } finally { setBusy(false); }
  };
  const loadProductHistory = async (product) => {
    setHistoryItem(product); setHistoryComments([]); setHistoryError(""); setHistoryLoading(true);
    try {
      const result = await request("item-history", { session_id: selected, item_id: product.id });
      setHistoryItem(result.item || product);
      setHistoryComments(result.comments || []);
    } catch (error) {
      setHistoryError(error.message || "Unable to load product history.");
    } finally { setHistoryLoading(false); }
  };
  const removeQueuedProduct = async (product) => {
    if (product.status !== "QUEUED" || !window.confirm(`Remove queued product ${product.item_code} from this session?`)) return;
    setBusy(true); setMessage(""); setMessageKind("success");
    try {
      await request("remove-queued-item", { session_id: selected, item_id: product.id });
      setMessage(`${product.item_code} was removed from the queue.`);
      await refresh();
    } catch (error) {
      setMessageKind("error"); setMessage(error.message || "Unable to remove this queued product.");
    } finally { setBusy(false); }
  };
  const resetQueuedProducts = async () => {
    const queuedCount = (current?.eo2mate_live_items || []).filter((entry) => entry.status === "QUEUED").length;
    if (!queuedCount || !window.confirm(`Remove all ${queuedCount} queued product(s) from this session? Active and closed products will remain.`)) return;
    setBusy(true); setMessage(""); setMessageKind("success");
    try {
      const result = await request("reset-queued-items", { session_id: selected });
      setMessage(`${result.removed || 0} queued product(s) removed.`);
      await refresh();
    } catch (error) {
      setMessageKind("error"); setMessage(error.message || "Unable to reset queued products.");
    } finally { setBusy(false); }
  };
  if (section !== "SESSIONS") return <section className="dashboard-panel" style={{ padding: 20 }}>
    {section === "SUMMARY" && <>
      <div className="panel-header"><div><h2>Live Selling Summary</h2><p>Live-session and product-queue totals for the selected Facebook Page.</p></div><button type="button" className="primary-button" onClick={() => setSection?.("SESSIONS")}><NavIcon type="facebook" />Manage sessions</button></div>
      <section className="metrics-grid">
        <button type="button" className="metric-card metric-button" onClick={() => setSection?.("SESSIONS")}><div className="metric-title">Live sessions</div><div className="metric-value">{totals.sessions}</div><div className="metric-subtitle">For this Page</div></button>
        <button type="button" className="metric-card metric-button" onClick={() => setSection?.("SESSIONS")}><div className="metric-title">Active sessions</div><div className="metric-value">{totals.active}</div><div className="metric-subtitle">Currently processing</div></button>
        <button type="button" className="metric-card metric-button" onClick={() => setSection?.("ACTIVITY")}><div className="metric-title">Products</div><div className="metric-value">{totals.products}</div><div className="metric-subtitle">Queued in this mode</div></button>
        <button type="button" className="metric-card metric-button" onClick={() => setSection?.("ACTIVITY")}><div className="metric-title">Claimed units</div><div className="metric-value">{totals.claimed}</div><div className="metric-subtitle">Across queued products</div></button>
      </section>
    </>}
    {section === "ACTIVITY" && <>
      <div className="panel-header"><div><h2>{activeMode === "AUCTION" ? "Bid Activity & Buyer Totals" : "Activity & Buyer Claims"}</h2><p>Current item status, accepted quantities, and stock limits across the selected Page.</p></div><button type="button" className="secondary-button" onClick={() => refresh().catch((e) => setMessage(e.message))} disabled={busy}><NavIcon type="refresh" />Refresh</button></div>
      {activeMode === "AUCTION" ? <>
        <p>Each accepted bid is listed below. The table shows Facebook user IDs because the Live bid record does not include buyer display names.</p>
        <div className="table-wrapper" style={{ overflowX: "auto" }}><table><thead><tr><th>Time</th><th>Item</th><th>Bidder ID</th><th>Bid</th><th>Comment</th></tr></thead><tbody>{activityPagination.visibleRecords.map((entry) => <tr key={entry.fb_comment_id}><td>{entry.created_time ? new Date(entry.created_time).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Manila" }) : "-"}</td><td>{entry.item_code} · {entry.title}</td><td>{entry.fb_user_id || "-"}</td><td>{formatCurrency(entry.amount)}</td><td>{entry.message || "-"}</td></tr>)}</tbody></table>{!activityRows.length && <p>No accepted Live Auction bids are available for this Page.</p>}<RecordPagination pagination={activityPagination} label="accepted bids" /></div>
      </> : <>
        <p>Claimed quantities are shown for each product.</p>
        <div className="table-wrapper"><table><thead><tr><th>Session</th><th>Code</th><th>Product</th><th>Status</th><th>Claimed units</th><th>Stock limit</th></tr></thead><tbody>{activityPagination.visibleRecords.map((entry) => <tr key={entry.id}><td>{entry.fb_video_id} · {entry.session_status}</td><td>{entry.item_code}</td><td>{entry.title}</td><td>{entry.status}</td><td>{entry.claimed}</td><td>{entry.quantity}</td></tr>)}</tbody></table>{!activityRows.length && <p>No live activity or buyer claim totals are available for this mode.</p>}<RecordPagination pagination={activityPagination} label="activity records" /></div>
      </>}
    </>}
    {section === "REPORTS" && <>
      <div className="panel-header"><div><h2>Live Report</h2><p>Export session and product totals for the selected Page.</p></div><button type="button" className="primary-button" onClick={() => downloadLiveReport(visibleSessions, activeMode)} disabled={!reportItems.length}><NavIcon type="download" />Download CSV</button></div>
      <div className="table-wrapper"><table><thead><tr><th>Session</th><th>Code</th><th>Product</th><th>Mode</th><th>Status</th><th>Claimed / Stock</th></tr></thead><tbody>{reportPagination.visibleRecords.map((entry) => <tr key={entry.id}><td>{entry.fb_video_id} · {entry.session_status}</td><td>{entry.item_code}</td><td>{entry.title}</td><td>{entry.mode}</td><td>{entry.status}</td><td>{entry.claimed} / {entry.quantity}</td></tr>)}</tbody></table>{!reportItems.length && <p>No report data is available yet.</p>}<RecordPagination pagination={reportPagination} label="report records" /></div>
    </>}
    {message && <p role={messageKind === "error" ? "alert" : "status"} style={{ color: messageKind === "error" ? "#b42318" : messageKind === "warning" ? "#8a5b00" : "#147a53" }}>{message}</p>}
    <LivePopupNotifications notifications={popupNotifications} onDismiss={(id) => setPopupNotifications((previous) => previous.filter((entry) => entry.id !== id))} />
  </section>;
  return <section className="dashboard-panel" style={{ padding: 20 }}>
    <div className="panel-header"><div><h2>Live Selling Control Center</h2><p>Connect the current Facebook Live video, queue products, activate each item, and end the EO2MATE session when the broadcast is over.</p></div><button className="icon-button refresh-icon-button" type="button" onClick={refreshSessions} disabled={busy} title="Refresh Live sessions and queues" aria-label="Refresh Live sessions and queues"><NavIcon type="refresh" /></button></div>
    <p>{activeMode === "MIXED" ? <>Use item-coded commands such as <strong>A12 +2</strong>, <strong>B15 LOCK</strong>, or <strong>C18 600</strong>.</> : <>Queue products in {activeMode} mode. Include the item code with each Facebook Live comment.</>}</p>

      <section aria-labelledby="live-session-setup-title" style={{ boxSizing: "border-box", padding: 24, margin: "20px 0 24px", border: "1px solid #e1e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 5px 16px rgba(15, 23, 42, 0.035)" }}>
      <h3 id="live-session-setup-title" style={{ marginTop: 0 }}>Connect the Facebook Live video</h3>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>Facebook Page ID<input aria-label="Facebook Page ID" value={pageId} readOnly title="Use the global Facebook Page switcher to change Pages" /></label>
        <label style={{ display: "grid", gap: 6, flex: "1 1 320px" }}>Facebook Live URL or video ID<input aria-label="Facebook Live URL or video ID" placeholder="Paste the Live video link or numeric ID" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} aria-describedby="live-video-id-help" /></label>
        <button className="primary-button" type="button" disabled={busy || !pageId || !(parsedVideo.id || parsedVideo.canResolve)} onClick={async () => { setBusy(true); setMessage(""); try { const payload = { fb_page_id: pageId, ...(parsedVideo.id ? { fb_video_id: parsedVideo.id } : { fb_video_url: videoInput.trim() }) }; const d = await request("create", payload); await refresh(); setVideoInput(d.session.fb_video_id); setMessage("Session created in DRAFT. Select it from Previous Live posts to manage its queue."); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }}><NavIcon type="add" />Create Session</button>
      </div>
      <p id="live-video-id-help" role="status" style={{ marginBottom: 0, color: parsedVideo.id ? "#087443" : "#58677a" }}>{parsedVideo.message}{parsedVideo.id && <> Detected ID: <strong>{parsedVideo.id}</strong></>}</p>
    </section>

    <div style={{ display: "grid", gridTemplateColumns: current ? "repeat(auto-fit, minmax(min(100%, 450px), 1fr))" : "minmax(0, 1fr)", alignItems: "start", gap: 20, margin: "20px 0 24px" }}>
    <section aria-labelledby="live-previous-posts-title" style={{ boxSizing: "border-box", minWidth: 0, padding: 26, margin: 0, border: "1px solid #e1e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 5px 16px rgba(15, 23, 42, 0.035)" }}>
      <div className="panel-header" style={{ padding: "0 0 18px", margin: "0 0 20px", borderBottom: "1px solid #e7edf3" }}><div><h3 id="live-previous-posts-title" style={{ margin: 0 }}>Previous Live posts</h3><p style={{ margin: "6px 0 0" }}>Select a post to view its product queue beside this list.</p></div></div>
      <div className="table-wrapper" style={{ marginTop: 18, borderRadius: 14, overflow: "auto" }}><table style={{ width: "100%", minWidth: 500, tableLayout: "fixed", fontSize: 12 }}><colgroup><col style={{ width: "30%" }} /><col style={{ width: "24%" }} /><col style={{ width: "14%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} /></colgroup><thead><tr><th style={{ padding: "9px 6px" }}>Post caption</th><th style={{ padding: "9px 6px" }}>Created</th><th style={{ padding: "9px 6px" }}>Status</th><th style={{ padding: "9px 6px" }}>Products</th><th style={{ padding: "9px 6px" }}>Claimed</th><th aria-label="Actions" style={{ padding: "9px 4px" }}></th></tr></thead><tbody>
        {sessionsPagination.visibleRecords.map((session) => {
          const items = (session.eo2mate_live_items || []).filter((entry) => activeMode === "MIXED" || String(entry.mode || "").toUpperCase() === activeMode);
          const claimed = items.reduce((sum, entry) => sum + (Number(entry.claimed) || 0), 0);
          return <tr key={session.id} className={selected === session.id ? "selected-table-row" : "clickable-row"} onClick={() => setSelected(session.id)}>
            <td title={postCaptions[session.id] || "Caption unavailable"} style={{ maxWidth: 0, padding: "10px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><button type="button" className="table-link-button" aria-label={`View product queue for Facebook Live post ${session.fb_video_id}`} onClick={(event) => { event.stopPropagation(); setSelected(session.id); }} style={{ display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{postCaptions[session.id] || "Caption unavailable"}</button></td>
            <td>{session.created_at ? new Date(session.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
            <td>{session.status}</td><td>{items.length}</td><td>{claimed}</td>
            <td><button type="button" className="table-action-button" aria-label={`View queue for Live post ${session.fb_video_id}`} title={selected === session.id ? "Currently viewing this queue" : "View product queue"} aria-pressed={selected === session.id} onClick={(event) => { event.stopPropagation(); setSelected(session.id); }}><NavIcon type="view" /></button></td>
          </tr>;
        })}
        {!visibleSessions.length && <tr><td colSpan="6" className="empty-table-cell">No previous Live posts for this Facebook Page yet. Connect a Live video above to create the first session.</td></tr>}
      </tbody></table></div><RecordPagination pagination={sessionsPagination} label="Live sessions" />
    </section>

    {current && <section aria-labelledby="live-product-queue-title" style={{ boxSizing: "border-box", minWidth: 0, padding: 26, margin: 0, border: "1px solid #e1e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 5px 16px rgba(15, 23, 42, 0.035)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, paddingBottom: 18, marginBottom: 20, borderBottom: "1px solid #e7edf3" }}>
          <div><p className="eyebrow" style={{ margin: "0 0 5px" }}>LIVE SESSION</p><h3 id="live-product-queue-title" style={{ margin: 0 }}>Product queue</h3><p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>Facebook video ID · {current.fb_video_id}</p></div>
          <span className="status-badge">{current.status}</span>
        </div>
        {["DRAFT", "ACTIVE"].includes(current.status) && <>
          <h4 style={{ marginBottom: 8 }}>{current.status === "ACTIVE" ? "Add products to the live queue" : "Add one product"}</h4>
          {current.status === "ACTIVE" && <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 13 }}>You can keep adding products while this EO2MATE session is active. Queue additions close when you end the session.</p>}
          <div style={{ marginBottom: 16, padding: 14, border: "1px solid #dbe4ee", borderRadius: 12, background: "#f8fafc" }}>
          <label style={{ display: "grid", gap: 7, width: "100%", minWidth: 0, maxWidth: 680, fontWeight: 600 }}>Choose inventory product (optional)
            <select aria-label="Select product from inventory" value={item.inventory_item_id} disabled={busy || inventoryLoading} style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }} onChange={(event) => {
              const inventory = inventoryItems.find((entry) => String(entry.inventory_item_id) === event.target.value);
              if (!inventory) {
                setItem((previous) => ({ ...previous, inventory_item_id: "" }));
                return;
              }
              setItem((previous) => ({
                ...previous,
                inventory_item_id: String(inventory.inventory_item_id),
                item_code: String(inventory.item_code || "").trim().toUpperCase(),
                title: inventory.item_name || "",
                quantity: String(Math.floor(Number(inventory.qty_available) || 0)),
                unit_price: inventory.default_selling_price == null ? "" : String(inventory.default_selling_price),
              }));
            }}>
              <option value="">{inventoryLoading ? "Loading inventory…" : "Choose an available inventory product"}</option>
              {inventoryItems.map((entry) => {
                const alreadyQueued = queuedItemCodes.has(String(entry.item_code || "").trim().toUpperCase());
                return <option key={entry.inventory_item_id} value={entry.inventory_item_id} disabled={alreadyQueued}>{entry.item_code} · {entry.item_name} · {alreadyQueued ? "Already queued" : `${Math.floor(Number(entry.qty_available) || 0)} available · ${formatCurrency(entry.default_selling_price)}`}</option>;
              })}
            </select>
          </label>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>Select a product to fill its details, or enter them below. Choose the Live mode for this item.</p>
          {inventoryError && <p role="alert" style={{ margin: "8px 0 0", color: "#b42318" }}>Inventory could not be loaded: {inventoryError}</p>}
          {!inventoryLoading && !inventoryError && !inventoryItems.length && <p style={{ margin: "8px 0 0", color: "#64748b" }}>No active inventory products with whole units available were found for this Facebook Page. You can still enter the product details below.</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", alignItems: "end", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>Item code
              <input placeholder="e.g. EO2MATE-REGTEST-002" aria-label="Item code" maxLength={40} value={item.item_code} onChange={(e) => setItem({ ...item, item_code: e.target.value.toUpperCase() })} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }} />
            </label>
            <label style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>Product name
              <input placeholder="Product name" aria-label="Product name" value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }} />
            </label>
            <label style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>Live selling mode
              {activeMode === "MIXED" ? <select aria-label="Live selling mode" value={item.mode} onChange={(e) => setItem((previous) => ({ ...previous, mode: e.target.value, mining_duration_minutes: e.target.value === "MINING" ? previous.mining_duration_minutes : "" }))} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }}><option value="SELLING">Selling</option><option value="MINING">Mining</option><option value="AUCTION">Auction</option></select> : <span className="status-badge" style={{ display: "flex", alignItems: "center", height: 42, boxSizing: "border-box" }}>{activeMode}</span>}
            </label>
            <label style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>Quantity
              <input type="number" min="1" aria-label="Quantity" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }} />
            </label>
            {(item.mode === "SELLING" ? ["unit_price"] : item.mode === "MINING" ? ["mine_price", "take_price", "lock_price"] : ["starting_bid", "bid_increment"]).map((field) => <label key={field} style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>{field.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())}
              <input type="number" min="0" step="0.01" aria-label={field.replaceAll("_", " ")} placeholder="0.00" value={item[field]} onChange={(e) => setItem({ ...item, [field]: e.target.value })} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }} />
            </label>)}
            {item.mode === "AUCTION" && <label style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>Auction duration (minutes)
              <input type="number" min="1" max="1440" step="1" aria-label="Auction duration in minutes" value={item.auction_duration_minutes} onChange={(e) => setItem({ ...item, auction_duration_minutes: e.target.value })} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }} />
            </label>}
            {item.mode === "MINING" && <label style={{ display: "grid", gap: 6, minWidth: 0, color: "#344054", fontSize: 13, fontWeight: 600 }}>Mining time limit (minutes)
              <input type="number" min="1" max="1440" step="1" aria-label="Mining time limit in minutes" value={item.mining_duration_minutes} onChange={(e) => setItem({ ...item, mining_duration_minutes: e.target.value })} style={{ width: "100%", minWidth: 0, height: 42, boxSizing: "border-box" }} />
            </label>}
            <button type="button" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 145, height: 42, boxSizing: "border-box", whiteSpace: "nowrap" }} disabled={busy || !["DRAFT", "ACTIVE"].includes(current.status) || !item.title || !isValidLiveItemCode(item.item_code) || itemCodeAlreadyQueued} onClick={addItemToQueue}><NavIcon type="add" />Add product</button>
          </div>
          {itemCodeAlreadyQueued && <p role="status" style={{ margin: "8px 0 0", color: "#b54708", fontSize: 13 }}>This item code is already in the selected Live queue. Choose another inventory product or use a new code.</p>}
          {item.inventory_item_id && item.mode !== "SELLING" && <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>The inventory record supplies the default selling price, but not Mining price levels or Auction bid increments. Enter the pricing fields shown for the selected mode.</p>}
          <section aria-labelledby="bulk-live-queue-title" style={{ marginTop: 18, padding: 16, border: "1px solid #d7e2ee", borderRadius: 12, background: "linear-gradient(135deg, #f8fbff 0%, #f1f6fc 100%)", boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label title="Choose a CSV file with up to 100 products" style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, flex: "1 1 260px", minWidth: 240, padding: 5, margin: -5, borderRadius: 10, cursor: busy ? "not-allowed" : "pointer" }}>
                <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 11, color: "#176b55", background: "#e2f3ed" }}><NavIcon type="upload" /></span>
                <span style={{ display: "grid", gap: 3 }}><strong id="bulk-live-queue-title">Import multiple products</strong><span style={{ color: "#64748b", fontSize: 13 }}>CSV file · up to 100 products</span></span>
                <input aria-label="Import multiple products from CSV" key={queueFileKey} type="file" accept=".csv,text/csv" disabled={busy || !["DRAFT", "ACTIVE"].includes(current.status)} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setQueueCsvName(file.name); setMessage(""); try { setQueueCsv(await file.text()); } catch { setQueueCsv(""); setMessage("Could not read that CSV file."); } }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "inherit" }} />
              </label>
              <button type="button" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => downloadLiveQueueTemplate(activeMode)} disabled={busy}><NavIcon type="download" />CSV template</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 13, borderTop: "1px solid #dbe5ef" }}>
              <span style={{ color: queueCsvName ? "#243b53" : "#718096", fontSize: 13, fontWeight: queueCsvName ? 600 : 400 }}>{queueCsvName ? `Selected: ${queueCsvName}` : "Click the import area above to choose a CSV."}</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>Required: <code>item_code</code>, <code>title</code>. Add mode, quantity, and mode prices as needed.</span>
            </div>
            {queueCsv && <>
              <p><strong>{queueCsvName || "CSV"}</strong> · {parsedQueue.rows.length} valid product row(s) detected.</p>
              {parsedQueue.errors.length > 0 && <div role="alert" style={{ color: "#9f1239", background: "#fff1f2", padding: 10, borderRadius: 8, marginBottom: 10 }}><strong>Fix these CSV issues before uploading:</strong><ul style={{ marginBottom: 0 }}>{parsedQueue.errors.map((error, i) => <li key={`${i}-${error}`}>{error}</li>)}</ul></div>}
            {parsedQueue.rows.length > 0 && <div className="table-wrapper"><table><thead><tr><th>Code</th><th>Product</th><th>Mode</th><th>Qty</th><th>Mode prices / time</th></tr></thead><tbody>{parsedQueue.rows.slice(0, 5).map((row) => <tr key={row.item_code}><td>{row.item_code}</td><td>{row.title}</td><td>{row.mode}</td><td>{row.quantity}</td><td>{row.mode === "SELLING" ? formatCurrency(row.unit_price) : row.mode === "MINING" ? `${formatCurrency(row.mine_price)} / ${formatCurrency(row.take_price)} / ${formatCurrency(row.lock_price)} · ${row.mining_duration_minutes} min` : `${formatCurrency(row.starting_bid)} / +${formatCurrency(row.bid_increment)} · ${row.auction_duration_minutes} min`}</td></tr>)}</tbody></table>{parsedQueue.rows.length > 5 && <p>Showing the first 5 of {parsedQueue.rows.length} products.</p>}</div>}
              <button type="button" className="primary-button" style={{ display: "inline-flex", alignItems: "center", gap: 7 }} disabled={busy || !["DRAFT", "ACTIVE"].includes(current.status) || !parsedQueue.rows.length || parsedQueue.errors.length > 0} onClick={uploadQueueCsv}><NavIcon type="upload" />Add {parsedQueue.rows.length} Products</button>
            </>}
          </section>
          {current.status === "DRAFT" && <p><button className="primary-button" type="button" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fff", background: "#138a5e", borderColor: "#138a5e" }} disabled={busy || !(current.eo2mate_live_items || []).length} onClick={() => run("start", { session_id: selected })}><NavIcon type="play" />Start Session</button></p>}
        </>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "18px 0 8px" }}><h3 style={{ margin: 0 }}>Product queue</h3>{(current.eo2mate_live_items || []).some((entry) => entry.status === "QUEUED") && ["DRAFT", "ACTIVE"].includes(current.status) && <button type="button" className="secondary-button" disabled={busy} onClick={resetQueuedProducts}>Remove all queued products</button>}</div>
        <div className="table-wrapper" style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1020, fontSize: 13 }}><thead><tr><th>Code</th><th>Product</th><th>Mode</th><th>Status</th><th>Stock</th><th>Price</th><th>Highest bidder</th><th>Actions</th></tr></thead><tbody>{queuePagination.visibleRecords.map((it) => { const duration = it.mode === "AUCTION" ? it.auction_duration_minutes : it.mode === "MINING" ? it.mining_duration_minutes : null; const endsAt = it.mode === "AUCTION" ? it.auction_end_at : it.mode === "MINING" ? it.mining_end_at : null; const price = it.mode === "AUCTION" ? formatCurrency(it.highest_bid ?? it.starting_bid) : it.mode === "MINING" ? `Mine ${formatCurrency(it.mine_price)} · Take ${formatCurrency(it.take_price)} · Lock ${formatCurrency(it.lock_price)}` : formatCurrency(it.unit_price); return <tr key={it.id}><td style={{ padding: "10px 8px" }}>{it.item_code}</td><td title={it.title} style={{ padding: "10px 8px", minWidth: 160 }}>{it.title}{duration != null && <div style={{ color: "#64748b", fontSize: 11 }}>{Number(duration) > 0 ? `${duration} min` : "Duration missing"}{endsAt ? ` · closes ${new Date(endsAt).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Manila" })}` : Number(duration) > 0 ? " · starts when activated" : ""}</div>}</td><td>{it.mode}</td><td>{it.status}</td><td>{it.claimed ?? 0} / {it.quantity}</td><td style={{ minWidth: 160 }}>{price}</td><td>{it.mode === "AUCTION" ? (it.highest_bidder || "—") : "—"}</td><td style={{ minWidth: 260, whiteSpace: "nowrap" }}><button className="secondary-button" type="button" style={{ padding: "7px 9px", fontSize: 12 }} disabled={busy} onClick={() => loadProductHistory(it)}>History</button>{current.status === "ACTIVE" && it.status === "QUEUED" && <button className="secondary-button" type="button" style={{ padding: "7px 9px", marginLeft: 6, fontSize: 12 }} disabled={busy} onClick={() => run("activate-item", { session_id: selected, item_id: it.id })}><NavIcon type="play" />Activate</button>}{it.status === "QUEUED" && ["DRAFT", "ACTIVE"].includes(current.status) && <button className="secondary-button" type="button" style={{ padding: "7px 9px", marginLeft: 6, fontSize: 12, color: "#b42318" }} disabled={busy} onClick={() => removeQueuedProduct(it)}>Remove</button>}</td></tr>; })}</tbody></table>{!visibleItems.length && <p>No {activeMode === "MIXED" ? "products" : `${activeMode.toLowerCase()} products`} queued yet. Add a product above.</p>}<RecordPagination pagination={queuePagination} label="queued products" /></div>
        {current.status === "ACTIVE" && <div style={{ marginTop: 14 }}><button type="button" className="secondary-button" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#fff", background: "#d92d20", borderColor: "#d92d20" }} disabled={busy} onClick={() => { if (window.confirm("End this EO2MATE session now? This closes the product queue and stops accepting or processing new comments. Your Facebook Live broadcast will remain live.")) { manualCloseRequests.current.add(selected); run("close", { session_id: selected }).finally(() => manualCloseRequests.current.delete(selected)); } }}><NavIcon type="stop" />End Session</button><p style={{ fontSize: 13, marginBottom: 0 }}>EO2MATE also checks Facebook Live status and closes this session automatically after the broadcast ends.</p></div>}
    </section>}
    </div>
    {message && <p role={messageKind === "error" ? "alert" : "status"} style={{ color: messageKind === "error" ? "#b42318" : messageKind === "warning" ? "#8a5b00" : "#147a53" }}>{message}</p>}
    {historyItem && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryItem(null); }} style={{ position: "fixed", inset: 0, zIndex: 10010, display: "grid", placeItems: "center", padding: 16, background: "rgba(15, 23, 42, .55)" }}><section role="dialog" aria-modal="true" aria-labelledby="live-item-history-title" style={{ width: "min(900px, 100%)", maxHeight: "min(85vh, 760px)", overflow: "auto", padding: 22, borderRadius: 16, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}><div><h2 id="live-item-history-title" style={{ margin: "0 0 4px" }}>Product history · {historyItem.item_code}</h2><p style={{ marginTop: 0, color: "#64748b" }}>{historyItem.title} · {historyItem.mode} · {historyItem.status}</p></div><button type="button" className="secondary-button" onClick={() => setHistoryItem(null)}>Close</button></div>{historyItem.mode === "AUCTION" && <p><strong>{historyItem.highest_bidder ? (historyItem.status === "CLOSED" ? "Winner" : "Current highest bidder") : "Winner"}:</strong> {historyItem.highest_bidder || "No accepted bids"}{historyItem.highest_bid != null && <> · {formatCurrency(historyItem.highest_bid)}</>}</p>}{historyLoading ? <p>Loading product history…</p> : historyError ? <p role="alert" style={{ color: "#b42318" }}>{historyError}</p> : <div className="table-wrapper" style={{ overflowX: "auto" }}><table style={{ minWidth: 780 }}><thead><tr><th>Time</th><th>Facebook user</th><th>Comment</th><th>Status</th><th>Reason</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{historyComments.map((entry) => <tr key={entry.fb_comment_id}><td>{entry.created_time ? new Date(entry.created_time).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Manila" }) : "—"}</td><td>{entry.fb_user_id || "—"}</td><td>{entry.message || "—"}</td><td>{entry.status || "—"}</td><td>{entry.reason || "—"}</td><td>{entry.quantity ?? "—"}</td><td>{entry.amount == null ? "—" : formatCurrency(entry.amount)}</td></tr>)}</tbody></table>{!historyComments.length && <p>No comments or bids are recorded for this product yet.</p>}</div>}</section></div>}
    <LivePopupNotifications notifications={popupNotifications} onDismiss={(id) => setPopupNotifications((previous) => previous.filter((entry) => entry.id !== id))} />
  </section>;
}

const LIVE_PAGE = {
  key: "MIXED",
  label: "Live Selling",
  command: "A12 +2 / B15 LOCK / C18 600",
  description: "Choose Selling, Mining, or Auction for each product in the queue.",
};

export default function LiveSellingPage({ metaConnected, page, client, selectedFbPageId }) {
  const [section, setSection] = useState("SUMMARY");
  const refreshActionRef = useRef(null);
  if (page !== "live-selling") return null;
  const current = LIVE_PAGE;
  const sections = [
    { key: "SUMMARY", label: "Summary", icon: "dashboard" },
    { key: "SESSIONS", label: "Sessions", icon: "facebook" },
    { key: "ACTIVITY", label: "Activity & Buyers", icon: "users" },
    { key: "REPORTS", label: "Reports", icon: "reports" },
  ];
  return <>
    <header className="dashboard-header">
      <div>
        <p className="eyebrow">FACEBOOK LIVE OPERATIONS</p>
        <h1>Live Selling</h1>
        <p>Manage Live Selling in one workspace. Choose Selling, Mining, or Auction for each queued product.</p>
      </div>
      <button type="button" className="icon-button refresh-icon-button" onClick={() => refreshActionRef.current?.()} title="Refresh" aria-label="Refresh">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5" /><path d="M4 18v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" /><path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" /></svg>
      </button>
    </header>
    <section className="selling-workspace-tabs" style={{ marginBottom: 18 }}>
      <div className="selling-workspace-tablist selling-workspace-nav" role="tablist" aria-label="Live selling sections">
        {sections.map((entry) => <button key={entry.key} type="button" role="tab" aria-selected={section === entry.key} className={`selling-workspace-tab${section === entry.key ? " active" : ""}`} onClick={() => setSection(entry.key)}>
          <span className="selling-nav-icon"><NavIcon type={entry.icon} /></span><span>{entry.label}</span>
        </button>)}
      </div>
    </section>
    <section className="dashboard-panel" style={{ marginBottom: 18 }}>
      <div className="panel-header"><div><h2>{current.label}</h2><p>{current.description} Buyer command: <strong>{current.command}</strong>.</p></div></div>
      <MixedLiveManager key={current.key} activeMode={current.key} client={client} selectedFbPageId={selectedFbPageId} section={section} setSection={setSection} refreshActionRef={refreshActionRef} />
    </section>
    {!metaConnected && <section className="dashboard-panel"><div className="panel-header"><div><h2>Facebook Page required</h2><p>Connect an authorized Facebook Page before starting a real livestream. Simulated Pages cannot publish to Meta.</p></div></div></section>}
  </>;
}
