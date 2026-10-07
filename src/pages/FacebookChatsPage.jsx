import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";


async function getEdgeFunctionErrorMessage(error, fallbackMessage) {
  let message = error?.message || fallbackMessage;
  const context = error?.context;

  if (context && typeof context.clone === "function") {
    try {
      const response = context.clone();
      const contentType = response.headers?.get?.("content-type") || "";

      if (contentType.includes("application/json")) {
        const body = await response.json();
        const metaCode = body?.facebook_error?.code;
        const metaSubcode = body?.facebook_error?.error_subcode;
        const suffix = [
          metaCode ? `Meta code ${metaCode}` : "",
          metaSubcode ? `subcode ${metaSubcode}` : "",
        ].filter(Boolean).join(", ");

        message = body?.message || body?.error || message;
        if (suffix) message = `${message} (${suffix})`;
      } else {
        const text = await response.text();
        if (text?.trim()) message = text.trim();
      }
    } catch {
      // Preserve the original FunctionsHttpError message.
    }
  }

  return message || fallbackMessage;
}

function statusLabel(value) {
  return String(value || "-").replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  let className = "status-badge";

  if (
    ["ACTIVE", "PAID", "READY_FOR_DELIVERY", "READY_FOR_BOOKING", "DELIVERED", "COMPLETED", "VALID"].includes(normalized)
  ) {
    className += " status-active";
  } else if (normalized === "COMPLETED_WITH_WINNER") {
    className += " status-success";
  } else if (
    ["PAYMENT_PENDING", "PAYMENT_REOPENED", "PENDING", "AWAITING_FINALIZER", "BOOKED", "PICKED_UP", "DROPPED_OFF", "IN_TRANSIT", "SHIPPED"].includes(normalized)
  ) {
    className += " status-warning";
  } else if (
    ["CANCELLED", "PAYMENT_EXPIRED", "FAILED", "EXPIRED", "REFUNDED", "INVALID"].includes(normalized)
  ) {
    className += " status-danger";
  } else {
    className += " status-muted";
  }

  return <span className={className}>{statusLabel(normalized)}</span>;
}

export default function FacebookChatsPage({ client, metaConnected, page }) {
  const [chatSearch, setChatSearch] = useState("");

  const [chatPageFilter, setChatPageFilter] = useState("");

  const [chatPages, setChatPages] = useState([]);

  const [chatConversations, setChatConversations] = useState([]);

  const [chatSelectedConversation, setChatSelectedConversation] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);

  const [chatDraft, setChatDraft] = useState("");

  const [chatLoading, setChatLoading] = useState(false);

  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);

  const [chatSending, setChatSending] = useState(false);

  const [chatMessage, setChatMessage] = useState("");

  const [chatMetaWindowBlocked, setChatMetaWindowBlocked] = useState(false);

  const filteredChatConversations = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();

    if (!query) return chatConversations;

    return chatConversations.filter((conversation) =>
      String(conversation?.participant?.name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [chatConversations, chatSearch]);

  const chatReplyWindow = useMemo(() => {
    if (!chatSelectedConversation) {
      return { status: "NONE", label: "Select a conversation", lastInboundAt: null };
    }

    const inboundMessages = chatMessages
      .filter((message) => message?.direction === "INBOUND" && message?.created_time)
      .map((message) => ({ ...message, timestamp: Date.parse(message.created_time) }))
      .filter((message) => Number.isFinite(message.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp);

    const lastInboundAt = inboundMessages[0]?.created_time || null;
    const lastInboundMs = inboundMessages[0]?.timestamp || 0;
    const withinStandardWindow = lastInboundMs > 0 && Date.now() - lastInboundMs <= 24 * 60 * 60 * 1000;

    if (withinStandardWindow) {
      return {
        status: "AVAILABLE",
        label: "Reply available",
        lastInboundAt,
      };
    }

    if (chatMetaWindowBlocked || lastInboundMs > 0) {
      return {
        status: "EXPIRED",
        label: "Reply window expired",
        lastInboundAt,
      };
    }

    return {
      status: "UNKNOWN",
      label: "Reply availability will be confirmed by Meta",
      lastInboundAt: null,
    };
  }, [chatSelectedConversation, chatMessages, chatMetaWindowBlocked]);

  async function loadFacebookChats(fbPageId = "") {
    if (!client?.client_id) return;

    setChatLoading(true);
    setChatMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "meta",
        {
          method: "POST",
          headers: {
              "x-eo2mate-meta-route": "chat-conversations",
            },
          body: {
            client_id: client.client_id,
            fb_page_id: fbPageId || undefined,
            limit: 12,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to load Facebook conversations.");
      }

      const pages = data.pages || [];
      const selectedPageId = data.selected_page?.fb_page_id || fbPageId || pages[0]?.fb_page_id || "";

      setChatPages(pages);
      setChatPageFilter(selectedPageId);
      setChatConversations(
        [...(data.conversations || [])].sort((a, b) => {
          const aTime = Number(a?.last_activity_ms) || 0;
          const bTime = Number(b?.last_activity_ms) || 0;
          return bTime - aTime;
        })
      );
      setChatSelectedConversation(null);
      setChatMessages([]);
      setChatDraft("");
      setChatMetaWindowBlocked(false);
    } catch (error) {
      setChatConversations([]);
      setChatSelectedConversation(null);
      setChatMessages([]);
      setChatMessage(
        await getEdgeFunctionErrorMessage(
          error,
          "Unable to load Facebook conversations."
        )
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function selectFacebookConversation(conversation) {
    if (!client?.client_id || !chatPageFilter || !conversation?.conversation_id) return;

    setChatSelectedConversation(conversation);
    setChatMessagesLoading(true);
    setChatMessage("");
    setChatMetaWindowBlocked(false);

    try {
      const { data, error } = await supabase.functions.invoke(
        "meta",
        {
          method: "POST",
          headers: {
            "x-eo2mate-meta-route": "chat-messages",
          },
          body: {
            client_id: client.client_id,
            fb_page_id: chatPageFilter,
            conversation_id: conversation.conversation_id,
            limit: 50,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to load Messenger messages.");
      }

      setChatMessages((data.messages || []).slice().reverse());
    } catch (error) {
      setChatMessages([]);
      setChatMessage(
        await getEdgeFunctionErrorMessage(
          error,
          "Unable to load Messenger messages."
        )
      );
    } finally {
      setChatMessagesLoading(false);
    }
  }

  async function sendFacebookChatMessage() {
    const recipientPsid = chatSelectedConversation?.participant?.id;
    const messageText = chatDraft.trim();

    if (!client?.client_id || !chatPageFilter || !recipientPsid || !messageText || chatSending) {
      return;
    }

    if (chatReplyWindow.status === "EXPIRED") {
      setChatMessage(
        "Reply unavailable. Meta's standard messaging window for this conversation has expired. Ask the customer to message the Page again or continue in Meta Inbox."
      );
      return;
    }

    setChatSending(true);
    setChatMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "meta",
        {
          method: "POST",
          headers: {
            "x-eo2mate-meta-route": "chat-send",
          },
          body: {
            client_id: client.client_id,
            fb_page_id: chatPageFilter,
            recipient_psid: recipientPsid,
            message: messageText,
          },
        },
      );

      if (error) {
        throw error;
      }
      if (!data?.success) {
        throw new Error(data?.message || "Unable to send Messenger message.");
      }

      const now = data?.sent_at || new Date().toISOString();
      const optimisticMessage = {
        id: data?.message_id || `local-${Date.now()}`,
        text: messageText,
        created_time: now,
        direction: "OUTBOUND",
        attachments: [],
        local_echo: true,
      };

      setChatDraft("");
      setChatMessages((current) => [...current, optimisticMessage]);
      setChatSelectedConversation((current) =>
        current
          ? {
              ...current,
              updated_time: now,
              last_activity_at: now,
              last_activity_ms: Date.parse(now) || Date.now(),
              latest_message: {
                id: data?.message_id || null,
                text: messageText,
                created_time: now,
              },
            }
          : current
      );
      setChatConversations((current) => {
        const selectedId = chatSelectedConversation?.conversation_id;
        if (!selectedId) return current;

        const updated = current.map((conversation) =>
          conversation.conversation_id === selectedId
            ? {
                ...conversation,
                updated_time: now,
                last_activity_at: now,
                last_activity_ms: Date.parse(now) || Date.now(),
                latest_message: {
                  id: data?.message_id || null,
                  text: messageText,
                  created_time: now,
                },
              }
            : conversation
        );

        const selected = updated.find((row) => row.conversation_id === selectedId);
        return selected
          ? [selected, ...updated.filter((row) => row.conversation_id !== selectedId)]
          : updated;
      });
    } catch (error) {
      const message = await getEdgeFunctionErrorMessage(
        error,
        "Unable to send Messenger message."
      );

      const outsideWindow =
        /outside of allowed window/i.test(message) ||
        /subcode\s*2018278/i.test(message) ||
        /2018278/.test(message);

      if (outsideWindow) {
        setChatMetaWindowBlocked(true);
        setChatMessage(
          "Reply unavailable. Meta has closed the standard messaging window for this conversation. Ask the customer to message the Page again or use Meta Inbox for any Meta-supported options."
        );
      } else {
        setChatMessage(message);
      }
    } finally {
      setChatSending(false);
    }
  }


  useEffect(() => { loadFacebookChats(); }, [client?.client_id]);
  return (<>
    {metaConnected && page === "facebook-chats" && (
          <>
            <header className="dashboard-header">
              <div>
                <p className="eyebrow">FACEBOOK · LIVE INBOX</p>
                <h1>Facebook Chats</h1>
                <p>View and reply to Messenger conversations live from Meta. Conversation content is not stored in EO2MATE.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => loadFacebookChats(chatPageFilter)}
                disabled={chatLoading || !client?.client_id}
              >
                {chatLoading ? "Refreshing..." : "Refresh Inbox"}
              </button>
            </header>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h2>Page Inbox</h2>
                  <p>Facebook remains the source of truth. Messages are fetched only while this screen is in use.</p>
                </div>
                <StatusBadge status={chatPages.length ? "CONNECTED" : "NOT_CONNECTED"} />
              </div>

              {chatMessage && (
                <div className="form-error" style={{ marginTop: 14 }}>
                  {chatMessage}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)", gap: 18, marginTop: 18 }}>
                <div style={{ border: "1px solid #e5eaf0", borderRadius: 14, overflow: "hidden", background: "#fff", height: 620, display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: 14, borderBottom: "1px solid #e5eaf0", display: "grid", gap: 10 }}>
                    <select
                      value={chatPageFilter}
                      onChange={async (event) => {
                        const nextPage = event.target.value;
                        setChatPageFilter(nextPage);
                        await loadFacebookChats(nextPage);
                      }}
                      disabled={chatLoading || !chatPages.length}
                    >
                      {!chatPages.length && <option value="">No connected Page</option>}
                      {chatPages.map((fbPage) => (
                        <option key={fbPage.fb_page_id} value={fbPage.fb_page_id}>
                          {fbPage.page_name || fbPage.fb_page_id}
                        </option>
                      ))}
                    </select>

                    <input
                      type="search"
                      value={chatSearch}
                      onChange={(event) => setChatSearch(event.target.value)}
                      placeholder="Search buyer"
                    />
                  </div>

                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {chatLoading ? (
                      <div style={{ padding: 28, textAlign: "center", color: "#718096" }}>Loading live Messenger inbox...</div>
                    ) : filteredChatConversations.length === 0 ? (
                      <div style={{ padding: 28, textAlign: "center", color: "#718096" }}>
                        <strong style={{ display: "block", color: "#263548", marginBottom: 6 }}>No conversations found</strong>
                        <span style={{ fontSize: 13 }}>If this Page has Messenger conversations, check the Page token and Meta permissions.</span>
                      </div>
                    ) : (
                      filteredChatConversations.map((conversation) => {
                          const selected = chatSelectedConversation?.conversation_id === conversation.conversation_id;
                          return (
                            <button
                              key={conversation.conversation_id}
                              type="button"
                              onClick={() => selectFacebookConversation(conversation)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "14px 16px",
                                border: 0,
                                borderBottom: "1px solid #edf1f5",
                                background: selected ? "#f1f8f3" : "#fff",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <strong style={{ color: "#263548" }}>{conversation?.participant?.name || "Facebook User"}</strong>
                                <span style={{ fontSize: 11, color: "#718096", whiteSpace: "nowrap" }}>
                                  {conversation?.last_activity_at ? new Date(conversation.last_activity_at).toLocaleString() : ""}
                                </span>
                              </div>
                              <div style={{ marginTop: 5, color: "#718096", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {conversation?.latest_message?.text || "Messenger conversation"}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>

                <div style={{ height: 620, minHeight: 620, maxHeight: 620, border: "1px solid #e5eaf0", borderRadius: 14, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5eaf0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{chatSelectedConversation?.participant?.name || "Select a conversation"}</strong>
                      <div style={{ fontSize: 12, color: "#718096", marginTop: 3 }}>
                        {chatSelectedConversation
                          ? `Messenger · ${chatPages.find((row) => row.fb_page_id === chatPageFilter)?.page_name || chatPageFilter}`
                          : "Choose a Messenger conversation from the live Page inbox."}
                      </div>
                      {chatSelectedConversation && (
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                              background:
                                chatReplyWindow.status === "AVAILABLE"
                                  ? "#e9f7ee"
                                  : chatReplyWindow.status === "EXPIRED"
                                    ? "#fff1f1"
                                    : "#f2f4f7",
                              color:
                                chatReplyWindow.status === "AVAILABLE"
                                  ? "#247a3c"
                                  : chatReplyWindow.status === "EXPIRED"
                                    ? "#b43d3d"
                                    : "#667085",
                            }}
                          >
                            {chatReplyWindow.label}
                          </span>
                          {chatReplyWindow.lastInboundAt && (
                            <span style={{ fontSize: 11, color: "#8a98a8" }}>
                              Last buyer message: {new Date(chatReplyWindow.lastInboundAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {chatPageFilter && (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() =>
                          window.open(
                            `https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(chatPageFilter)}`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        Open Meta Inbox
                      </button>
                    )}
                  </div>

                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 18, background: "#f8fafc" }}>
                    {!chatSelectedConversation ? (
                      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#718096", textAlign: "center" }}>
                        Choose a Messenger conversation from the inbox to view its current message history.
                      </div>
                    ) : chatMessagesLoading ? (
                      <div style={{ textAlign: "center", color: "#718096", padding: 30 }}>Loading messages from Meta...</div>
                    ) : chatMessages.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#718096", padding: 30 }}>No messages returned for this conversation.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {chatMessages.map((message) => {
                          const outbound = message.direction === "OUTBOUND";
                          return (
                            <div key={message.id || `${message.created_time}-${message.text}`} style={{ display: "flex", justifyContent: outbound ? "flex-end" : "flex-start" }}>
                              <div style={{
                                maxWidth: "78%",
                                padding: "10px 12px",
                                borderRadius: 14,
                                background: outbound ? "#dff3e4" : "#fff",
                                border: "1px solid #e2e8f0",
                                color: "#263548",
                              }}>
                                {message.text && <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message.text}</div>}
                                {message.attachments?.length > 0 && (
                                  <div style={{ marginTop: message.text ? 8 : 0, fontSize: 12, color: "#718096" }}>
                                    {message.attachments.length} attachment{message.attachments.length === 1 ? "" : "s"}
                                  </div>
                                )}
                                <div style={{ marginTop: 5, fontSize: 10, color: "#8a98a8", textAlign: outbound ? "right" : "left" }}>
                                  {message.created_time ? new Date(message.created_time).toLocaleString() : ""}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 14, borderTop: "1px solid #e5eaf0", flex: "0 0 auto", background: "#fff" }}>
                    {chatSelectedConversation && chatReplyWindow.status === "EXPIRED" && (
                      <div style={{ marginBottom: 10, padding: "9px 11px", borderRadius: 9, background: "#fff7ed", color: "#9a5412", fontSize: 12, lineHeight: 1.45 }}>
                        Meta's standard reply window has expired. The conversation can still be viewed here, but normal API replies are disabled until the customer messages the Page again.
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            sendFacebookChatMessage();
                          }
                        }}
                        placeholder={
                          chatReplyWindow.status === "EXPIRED"
                            ? "Reply window expired — open Meta Inbox or wait for a new buyer message"
                            : "Write a Messenger reply..."
                        }
                        disabled={!chatSelectedConversation || chatSending || chatReplyWindow.status === "EXPIRED"}
                        maxLength={2000}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="primary-button"
                        type="button"
                        onClick={sendFacebookChatMessage}
                        disabled={
                          !chatSelectedConversation ||
                          !chatDraft.trim() ||
                          chatSending ||
                          chatReplyWindow.status === "EXPIRED"
                        }
                      >
                        {chatSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
  </>);
}
