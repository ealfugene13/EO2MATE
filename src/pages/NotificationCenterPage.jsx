import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const MODE_GROUPS = {
  AUCTION: { label: "Auction", order: 1 },
  MINING: { label: "Mining", order: 2 },
  SELLING: { label: "Live Selling", order: 3 },
  REGULAR_SALE: { label: "Regular Sale", order: 4 },
  PREORDER: { label: "Pre-order", order: 5 },
  LIVE_SESSION: { label: "Live Session", order: 6 },
  MIXED: { label: "Mixed Live", order: 7 },
  OTHER: { label: "Other", order: 99 },
};

function modeInfo(value) {
  const code = String(value || "OTHER").toUpperCase();
  return MODE_GROUPS[code] || { label: code.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()), order: 90 };
}

function BellIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationCenterPage({ client, selectedFbPageId, selectedFbPageName, focusNotificationId = "" }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clientId = client?.client_id;
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const refresh = useCallback(async () => {
    if (!clientId) { setNotifications([]); setLoading(false); return; }
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "live-admin" },
        body: { action: "notifications", client_id: clientId, ...(selectedFbPageId ? { fb_page_id: selectedFbPageId } : {}) },
      });
      if (invokeError || data?.error) throw new Error(data?.detail || data?.message || data?.error || invokeError?.message || "Unable to load notifications.");
      setNotifications(data?.notifications || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedFbPageId]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = window.setInterval(refresh, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  useEffect(() => {
    if (!focusNotificationId || loading) return;
    const target = document.getElementById(`notification-center-item-${encodeURIComponent(String(focusNotificationId))}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusNotificationId, loading, notifications]);

  async function markRead(id) {
    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: readAt } : item));
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "live-admin" },
        body: { action: "mark-notification-read", client_id: clientId, notification_id: id, ...(selectedFbPageId ? { fb_page_id: selectedFbPageId } : {}) },
      });
      if (invokeError || data?.error) throw new Error(data?.detail || data?.error || invokeError?.message || "Unable to update notification.");
      if (data?.notification) setNotifications((items) => items.map((item) => item.id === id ? data.notification : item));
    } catch (markError) {
      setNotifications(previous);
      setError(markError.message || "Unable to update notification.");
    }
  }

  async function markAllRead() {
    if (!unreadCount || busy) return;
    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("eo2mate", {
        headers: { "x-eo2mate-route": "live-admin" },
        body: { action: "mark-all-notifications-read", client_id: clientId, ...(selectedFbPageId ? { fb_page_id: selectedFbPageId } : {}) },
      });
      if (invokeError || data?.error) throw new Error(data?.detail || data?.error || invokeError?.message || "Unable to update notifications.");
    } catch (markError) {
      setNotifications(previous);
      setError(markError.message || "Unable to update notifications.");
    } finally {
      setBusy(false);
    }
  }

  const visibleNotifications = filter === "UNREAD" ? notifications.filter((item) => !item.read_at) : notifications;
  const grouped = useMemo(() => {
    const groups = new Map();
    visibleNotifications.forEach((item) => {
      const key = String(item.mode_code || (item.notification_type === "SESSION_ENDED" ? "LIVE_SESSION" : "OTHER")).toUpperCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()].sort(([a], [b]) => modeInfo(a).order - modeInfo(b).order || modeInfo(a).label.localeCompare(modeInfo(b).label));
  }, [visibleNotifications]);

  return <main className="notification-center-page">
    <header className="notification-center-hero">
      <div className="notification-center-title-wrap">
        <span className="notification-center-hero-icon"><BellIcon /></span>
        <div><span className="notification-center-eyebrow">ACTIVITY INBOX</span><h1>Notification Center</h1><p>{selectedFbPageName ? `Updates for ${selectedFbPageName}` : "Saved activity from your connected Pages"}</p></div>
      </div>
      <div className="notification-center-actions">
        <span className="notification-center-unread"><b>{unreadCount}</b> unread</span>
        <button type="button" className="notification-center-mark-all" onClick={markAllRead} disabled={!unreadCount || busy}><CheckIcon />Mark all read</button>
      </div>
    </header>

    <section className="notification-center-content">
      <div className="notification-center-toolbar">
        <div><h2>Updates by post mode</h2><p>Notifications are grouped by the mode of the post or Live product.</p></div>
        <div className="notification-center-filters" role="group" aria-label="Notification filter">
          <button type="button" className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>All <span>{notifications.length}</span></button>
          <button type="button" className={filter === "UNREAD" ? "active" : ""} onClick={() => setFilter("UNREAD")}>Unread <span>{unreadCount}</span></button>
        </div>
      </div>

      {error && <div className="notification-center-error" role="status">{error}<button type="button" onClick={refresh}>Try again</button></div>}
      {loading ? <div className="notification-center-state">Loading notifications…</div> : !visibleNotifications.length ? <div className="notification-center-empty"><span><BellIcon /></span><strong>{filter === "UNREAD" ? "You’re all caught up" : "No notifications yet"}</strong><p>{filter === "UNREAD" ? "There are no unread updates for this Page." : "Accepted Live claims and ended sessions will appear here."}</p></div> : <div className="notification-center-groups">
        {grouped.map(([mode, items]) => <section className="notification-mode-group" key={mode}>
          <header><div className={`notification-mode-badge mode-${mode.toLowerCase()}`}><span /><h3>{modeInfo(mode).label}</h3></div><span>{items.length} {items.length === 1 ? "update" : "updates"}</span></header>
          <div className="notification-mode-list">
            {items.map((item) => <article id={`notification-center-item-${encodeURIComponent(String(item.id))}`} className={`notification-center-item${item.read_at ? " is-read" : " is-unread"}${String(item.id) === String(focusNotificationId) ? " is-focused" : ""}`} key={item.id}>
              <span className="notification-center-item-dot" aria-hidden="true" />
              <div className="notification-center-item-copy"><div><h4>{item.title}</h4>{!item.read_at && <span className="notification-new-label">NEW</span>}</div><p>{item.message}</p><time>{formatDate(item.created_at)}</time></div>
              {!item.read_at && <button type="button" className="notification-mark-read" aria-label={`Mark ${item.title} as read`} title="Mark as read" onClick={() => markRead(item.id)}><CheckIcon /></button>}
            </article>)}
          </div>
        </section>)}
      </div>}
    </section>
  </main>;
}
