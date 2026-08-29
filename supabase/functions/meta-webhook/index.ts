import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
/* =========================================================
   ENVIRONMENT
   ========================================================= */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || "";
const AUCTION_FINALIZER_SECRET = Deno.env.get("AUCTION_FINALIZER_SECRET") || "";
const META_GRAPH_VERSION = "v23.0";
const CREATE_PAYMENT_URL = `${SUPABASE_URL}/functions/v1/create-payment`;
const DEFAULT_ORDER_GROUP_WINDOW_HOURS = 24;
const DEFAULT_WINNER_LINK_EXPIRY_HOURS = 24;
const DEFAULT_ANNOUNCEMENT_INTERVAL_HOURS = 2;
function normalizeAuctionEnvironment(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "TEST") {
    return "TEST";
  }
  if (normalized === "PROD") {
    return "PROD";
  }
  if (normalized === "CLNT") {
    return "CLNT";
  }
  return null;
}
function getAuctionEnvironmentFromCaption(caption) {
  const text = String(caption ?? "").toUpperCase();
  const hasProd = /(^|[^A-Z0-9])EO2MATE-PROD([^A-Z0-9]|$)/i.test(text);
  const hasTest = /(^|[^A-Z0-9])EO2MATE-TEST([^A-Z0-9]|$)/i.test(text);
  const hasClnt = /(^|[^A-Z0-9])EO2MATE-CLNT([^A-Z0-9]|$)/i.test(text);
  const requested = [
    hasProd ? "PROD" : null,
    hasTest ? "TEST" : null,
    hasClnt ? "CLNT" : null
  ].filter(Boolean);
  /*
   * Exactly one EO2MATE environment code is allowed.
   * Missing or ambiguous environment = ignore/reject.
   */ if (requested.length !== 1) {
    return null;
  }
  return requested[0];
}
function getAuctionEnvironment(auctionPost) {
  return normalizeAuctionEnvironment(auctionPost?.environment) || getAuctionEnvironmentFromCaption(auctionPost?.caption);
}
/* =========================================================
   SUPABASE
   ========================================================= */ const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
/* =========================================================
   EO2MATE RUNTIME SETTINGS
   ========================================================= */ async function getClientSetting(clientId, settingKey) {
  if (clientId) {
    const { data: clientSetting, error: clientError } = await supabase.from("eo2mate_settings").select("setting_value").eq("client_id", clientId).eq("setting_key", settingKey).eq("is_active", true).maybeSingle();
    if (clientError) {
      throw new Error(`EO2MATE client setting lookup failed (${settingKey}): ${clientError.message}`);
    }
    if (clientSetting?.setting_value !== undefined) {
      return String(clientSetting.setting_value);
    }
  }
  const { data: globalSetting, error: globalError } = await supabase.from("eo2mate_settings").select("setting_value").is("client_id", null).eq("setting_key", settingKey).eq("is_active", true).maybeSingle();
  if (globalError) {
    throw new Error(`EO2MATE global setting lookup failed (${settingKey}): ${globalError.message}`);
  }
  return globalSetting?.setting_value !== undefined ? String(globalSetting.setting_value) : null;
}
async function getClientNumberSetting(clientId, settingKey, fallback) {
  const raw = await getClientSetting(clientId, settingKey);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
async function getClientBooleanSetting(clientId, settingKey, fallback) {
  const raw = await getClientSetting(clientId, settingKey);
  if (raw === null) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if ([
    "true",
    "1",
    "yes",
    "y",
    "on"
  ].includes(normalized)) {
    return true;
  }
  if ([
    "false",
    "0",
    "no",
    "n",
    "off"
  ].includes(normalized)) {
    return false;
  }
  return fallback;
}
function normalizeMessengerCommand(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}
async function getMessengerCommandDefinitions(clientId) {
  const { data: globalRows, error: globalError } = await supabase.from("eo2mate_command_aliases").select("command_text, action_code, description, is_active").is("client_id", null);
  if (globalError) {
    throw new Error(`EO2MATE global command lookup failed: ${globalError.message}`);
  }
  let clientRows = [];
  if (clientId) {
    const { data, error } = await supabase.from("eo2mate_command_aliases").select("command_text, action_code, description, is_active").eq("client_id", clientId);
    if (error) {
      throw new Error(`EO2MATE client command lookup failed: ${error.message}`);
    }
    clientRows = data || [];
  }
  const merged = new Map();
  for (const row of globalRows || []){
    const commandText = normalizeMessengerCommand(row?.command_text);
    if (!commandText) {
      continue;
    }
    merged.set(commandText, {
      commandText,
      actionCode: String(row?.action_code || "").trim().toUpperCase(),
      description: row?.description ? String(row.description) : null,
      isActive: row?.is_active === true,
      senderScope: "BUYER"
    });
  }
  /*
   * Client rows override the same global command.
   * A client can therefore disable a global alias by creating
   * an inactive row with the same command_text.
   */ for (const row of clientRows){
    const commandText = normalizeMessengerCommand(row?.command_text);
    if (!commandText) {
      continue;
    }
    merged.set(commandText, {
      commandText,
      actionCode: String(row?.action_code || "").trim().toUpperCase(),
      description: row?.description ? String(row.description) : null,
      isActive: row?.is_active === true,
      senderScope: "BUYER"
    });
  }
  return Array.from(merged.values());
}
function buildAvailableCommandMessage(definitions) {
  const active = definitions.filter((definition)=>definition.isActive && definition.actionCode && [
      "BUYER",
      "BOTH"
    ].includes(definition.senderScope)).sort((first, second)=>first.commandText.localeCompare(second.commandText));
  if (active.length === 0) {
    return "No EO2MATE Messenger commands are currently enabled for this transaction.";
  }
  const lines = [
    "Available EO2MATE commands:",
    ""
  ];
  for (const definition of active){
    lines.push(definition.description ? `${definition.commandText} Ã¢ÂÂ ${definition.description}` : definition.commandText);
  }
  return lines.join("\n");
}
/* =========================================================
   CLIENT SUBSCRIPTION / ENVIRONMENT ENTITLEMENT
   ========================================================= */ async function findClientSubscription(clientId) {
  const { data, error } = await supabase.from("client_subscriptions").select("*").eq("client_id", clientId).maybeSingle();
  if (error) {
    throw new Error(`client_subscriptions lookup failed: ${error.message}`);
  }
  return data;
}
function environmentRank(environment) {
  if (environment === "PROD") {
    return 3;
  }
  if (environment === "TEST") {
    return 2;
  }
  return 1;
}
async function isClientEnvironmentAllowed(clientId, requestedEnvironment) {
  const subscription = await findClientSubscription(clientId);
  /*
   * Backward compatibility:
   * Legacy clients created before subscription management do not
   * get blocked merely because they have no subscription row.
   * New self-service clients always receive a subscription row.
   */ if (!subscription) {
    return {
      allowed: true,
      subscription: null,
      reason: null
    };
  }
  const subscriptionStatus = String(subscription.subscription_status || "").trim().toUpperCase();
  if (![
    "TRIAL",
    "ACTIVE"
  ].includes(subscriptionStatus)) {
    return {
      allowed: false,
      subscription,
      reason: `Subscription status is ${subscriptionStatus || "UNKNOWN"}.`
    };
  }
  const allowedEnvironment = normalizeAuctionEnvironment(subscription.allowed_environment) || "CLNT";
  const allowed = environmentRank(requestedEnvironment) <= environmentRank(allowedEnvironment);
  return {
    allowed,
    subscription,
    reason: allowed ? null : `Client is entitled up to ${allowedEnvironment}, but the post requested ${requestedEnvironment}.`
  };
}
async function findAutomationControl(clientId, scopeType, scopeId) {
  const { data, error } = await supabase.from("eo2mate_automation_controls").select("*").eq("client_id", clientId).eq("scope_type", scopeType).eq("scope_id", scopeId).maybeSingle();
  if (error) {
    throw new Error(`automation control lookup failed (${scopeType}:${scopeId}): ${error.message}`);
  }
  return data;
}
async function getBaseAutomationState(clientId, fbPageId) {
  const [clientControl, pageControl] = await Promise.all([
    findAutomationControl(clientId, "CLIENT", clientId),
    findAutomationControl(clientId, "PAGE", fbPageId)
  ]);
  if (clientControl && clientControl.is_enabled === false) {
    return {
      enabled: false,
      blockedBy: "CLIENT",
      reason: getString(clientControl.reason),
      control: clientControl
    };
  }
  if (pageControl && pageControl.is_enabled === false) {
    return {
      enabled: false,
      blockedBy: "PAGE",
      reason: getString(pageControl.reason),
      control: pageControl
    };
  }
  return {
    enabled: true,
    blockedBy: null,
    reason: null,
    control: null
  };
}
async function getAuctionAutomationState(auctionPost) {
  const clientId = getString(auctionPost?.client_id);
  const fbPageId = getString(auctionPost?.fb_page_id);
  const postId = getString(auctionPost?.post_id);
  if (!clientId || !fbPageId) {
    return {
      enabled: false,
      blockedBy: "INVALID_CONTEXT",
      reason: "Auction post has no client/Page context.",
      control: null
    };
  }
  const baseState = await getBaseAutomationState(clientId, fbPageId);
  if (!baseState.enabled) {
    return baseState;
  }
  if (postId) {
    const postControl = await findAutomationControl(clientId, "POST", postId);
    if (postControl && postControl.is_enabled === false) {
      return {
        enabled: false,
        blockedBy: "POST",
        reason: getString(postControl.reason),
        control: postControl
      };
    }
  }
  return {
    enabled: true,
    blockedBy: null,
    reason: null,
    control: null
  };
}
async function setPostAutomationControl(auctionPost, enabled, fbPageId, reason) {
  const clientId = getString(auctionPost?.client_id);
  const postId = getString(auctionPost?.post_id);
  if (!clientId || !postId) {
    throw new Error("Cannot change post automation without client_id and post_id.");
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("eo2mate_automation_controls").upsert({
    client_id: clientId,
    scope_type: "POST",
    scope_id: postId,
    is_enabled: enabled,
    reason,
    changed_by_user_id: null,
    changed_by_fb_page_id: fbPageId,
    changed_at: now,
    updated_at: now
  }, {
    onConflict: "client_id,scope_type,scope_id"
  }).select("*").single();
  if (error) {
    throw new Error(`post automation control update failed: ${error.message}`);
  }
  return data;
}
async function getPostCommandDefinitions(clientId) {
  const { data: globalRows, error: globalError } = await supabase.from("eo2mate_post_command_aliases").select("command_text, action_code, description, is_active").is("client_id", null);
  if (globalError) {
    throw new Error(`global post command lookup failed: ${globalError.message}`);
  }
  let clientRows = [];
  if (clientId) {
    const { data, error } = await supabase.from("eo2mate_post_command_aliases").select("command_text, action_code, description, is_active").eq("client_id", clientId);
    if (error) {
      throw new Error(`client post command lookup failed: ${error.message}`);
    }
    clientRows = data || [];
  }
  const merged = new Map();
  for (const row of globalRows || []){
    const commandText = normalizeMessengerCommand(row?.command_text);
    if (!commandText) {
      continue;
    }
    merged.set(commandText, {
      commandText,
      actionCode: String(row?.action_code || "").trim().toUpperCase(),
      description: getString(row?.description),
      isActive: row?.is_active === true
    });
  }
  for (const row of clientRows){
    const commandText = normalizeMessengerCommand(row?.command_text);
    if (!commandText) {
      continue;
    }
    merged.set(commandText, {
      commandText,
      actionCode: String(row?.action_code || "").trim().toUpperCase(),
      description: getString(row?.description),
      isActive: row?.is_active === true
    });
  }
  return Array.from(merged.values());
}
async function processMainPostPageControlCommand(auctionPost, fbPageId, commentId, message) {
  const clientId = getString(auctionPost?.client_id);
  const normalized = normalizeMessengerCommand(message);
  const definitions = await getPostCommandDefinitions(clientId);
  const definition = definitions.find((candidate)=>candidate.isActive && candidate.commandText === normalized);
  if (!definition) {
    return false;
  }
  let enabled;
  if (definition.actionCode === "DISABLE_POST_AUTOMATION") {
    enabled = false;
  } else if (definition.actionCode === "ENABLE_POST_AUTOMATION") {
    enabled = true;
  } else {
    return false;
  }
  await setPostAutomationControl(auctionPost, enabled, fbPageId, enabled ? "Resumed by Facebook Page main-post command." : "Paused by Facebook Page main-post command.");
  const effectiveState = await getAuctionAutomationState(auctionPost);
  const reply = enabled ? effectiveState.enabled ? [
    "Ã¢ÂÂ EO2MATE automation resumed for this auction post.",
    "",
    "New valid auction activity will be processed again."
  ] : [
    "Ã¢ÂÂ¹Ã¯Â¸Â This post is set to ON, but EO2MATE is still suspended at a higher level.",
    "",
    `Blocked by: ${effectiveState.blockedBy || "CLIENT/PAGE"}`,
    effectiveState.reason ? `Reason: ${effectiveState.reason}` : ""
  ].filter(Boolean) : [
    "Ã¢ÂÂ¸Ã¯Â¸Â EO2MATE automation paused for this auction post.",
    "",
    "New bids, announcements and automatic closing/winner processing are paused until EO2MATE ON is posted by the Page."
  ];
  await replyToComment(fbPageId, commentId, reply.join("\n"));
  log("POST AUTOMATION CONTROL UPDATED", {
    auctionPostId: auctionPost?.post_id,
    fbPostId: auctionPost?.fb_post_id,
    fbPageId,
    enabled,
    effectiveState
  });
  return true;
}
/* =========================================================
   LOGGING
   ========================================================= */ function log(message, data) {
  if (data !== undefined) {
    console.log(message, data);
  } else {
    console.log(message);
  }
}
function errorLog(message, data) {
  if (data !== undefined) {
    console.error(message, data);
  } else {
    console.error(message);
  }
}
function getString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const result = String(value).trim();
  return result || null;
}
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error;
    if (typeof obj.message === "string") {
      return obj.message;
    }
    try {
      return JSON.stringify(error);
    } catch  {
      return "Unknown error";
    }
  }
  return String(error);
}
/* =========================================================
   MONEY
   ========================================================= */ function normalizeMoney(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).replace(/,/g, "").replace(/Ã¢ÂÂ±/g, "").trim().toLowerCase();
  if (!text) {
    return null;
  }
  let multiplier = 1;
  let numericText = text;
  if (text.endsWith("k")) {
    multiplier = 1000;
    numericText = text.slice(0, -1);
  } else if (text.endsWith("h")) {
    /*
     * EO2MATE shorthand:
     * 1h   = 100
     * 2.5h = 250
     */ multiplier = 100;
    numericText = text.slice(0, -1);
  }
  const numeric = Number(numericText);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric * multiplier;
}
function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return String(value ?? "");
  }
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
/* =========================================================
   INTEGER
   ========================================================= */ function normalizeInteger(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
/* =========================================================
   PHILIPPINE DATE PARSER
   ========================================================= */ function parsePhilippineDateTime(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const explicit = new Date(text);
    if (!Number.isNaN(explicit.getTime())) {
      return explicit.toISOString();
    }
  }
  const months = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };
  const match = text.match(/^\s*([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})\s*,?\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
  if (!match) {
    errorLog("Unable to parse Philippine auction datetime", {
      value: text
    });
    return null;
  }
  const month = months[match[1].toLowerCase()];
  if (month === undefined) {
    return null;
  }
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5] || "0");
  const ampm = match[6].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }
  if (ampm === "AM" && hour === 12) {
    hour = 0;
  }
  if (ampm === "PM" && hour !== 12) {
    hour += 12;
  }
  const utcDate = new Date(Date.UTC(year, month, day, hour - 8, minute, 0, 0));
  if (Number.isNaN(utcDate.getTime())) {
    return null;
  }
  return utcDate.toISOString();
}
/* =========================================================
   PH DATE DISPLAY
   ========================================================= */ function formatPhilippineDateTime(value) {
  return value.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}
/* =========================================================
   FACEBOOK COMMENT TIME
   ========================================================= */ function getCommentCreatedTime(value) {
  const raw = value?.created_time || value?.createdTime || value?.comment_created_time;
  if (raw !== null && raw !== undefined && raw !== "") {
    if (typeof raw === "number" || /^\d+$/.test(String(raw).trim())) {
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        const milliseconds = numeric < 100000000000 ? numeric * 1000 : numeric;
        const parsed = new Date(milliseconds);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}
async function listActiveAuctionPostTypeConfigs() {
  const { data, error } = await supabase.from("eo2mate_post_mode_types").select(`
        mode_code,
        post_type_code,
        display_name,
        caption_marker,
        description,
        is_active,
        sort_order,
        eo2mate_post_types!inner(
          post_type_name,
          is_multiple,
          min_images,
          is_active,
          sort_order
        ),
        eo2mate_post_modes!inner(
          mode_name,
          is_active
        )
        `).eq("mode_code", "AUCTION").eq("is_active", true).eq("eo2mate_post_types.is_active", true).eq("eo2mate_post_modes.is_active", true).order("sort_order", {
    ascending: true
  });
  if (error) {
    throw new Error(`Auction post type reference lookup failed: ${error.message}`);
  }
  return (data || []).map((row)=>({
      mode_code: String(row.mode_code),
      post_type_code: String(row.post_type_code).trim().toUpperCase(),
      display_name: String(row.display_name),
      caption_marker: String(row.caption_marker).trim(),
      description: getString(row.description),
      is_multiple: row?.eo2mate_post_types?.is_multiple === true,
      min_images: Math.max(1, Number(row?.eo2mate_post_types?.min_images || 1))
    }));
}
async function getAuctionPostTypeConfig(postTypeCode) {
  const code = String(postTypeCode ?? "").trim().toUpperCase();
  if (!code) {
    return null;
  }
  const configs = await listActiveAuctionPostTypeConfigs();
  return configs.find((config)=>config.post_type_code === code) || null;
}
async function getAuctionPostTypeConfigFromCaption(caption) {
  const text = String(caption ?? "");
  const configs = await listActiveAuctionPostTypeConfigs();
  const matches = configs.filter((config)=>text.toUpperCase().includes(config.caption_marker.toUpperCase()));
  if (matches.length !== 1) {
    return null;
  }
  return matches[0];
}
async function isMultipleAuctionPostType(postTypeCode) {
  const config = await getAuctionPostTypeConfig(postTypeCode);
  return config?.is_multiple === true;
}
/* =========================================================
   AUCTION CAPTION PARSER
   ========================================================= */ function parseAuctionCaption(caption) {
  const result = {
    postType: "UNKNOWN",
    item: null,
    minBid: null,
    increment: null,
    minBidderCount: null,
    buyout: null,
    buyoutUntil: null,
    auctionEnds: null,
    bidCutoffMinutes: null,
    antiSniperMinutes: null
  };
  const text = caption || "";
  const typeMatch = text.match(/\[([^\]]+)\]/i);
  if (typeMatch) {
    result.postType = typeMatch[1].trim().toUpperCase();
  }
  const itemMatch = text.match(/^\s*Item\s*:\s*(.+?)\s*$/im);
  if (itemMatch) {
    result.item = itemMatch[1].trim();
  }
  const minBidMatch = text.match(/^\s*Minimum\s+Bid\s*:\s*(.+?)\s*$/im);
  if (minBidMatch) {
    result.minBid = normalizeMoney(minBidMatch[1]);
  }
  const incrementMatch = text.match(/^\s*Increment\s*:\s*(.+?)\s*$/im);
  if (incrementMatch) {
    result.increment = normalizeMoney(incrementMatch[1]);
  }
  const minimumBidderMatch = text.match(/^\s*Minimum\s+Bidders?\s*:\s*(.+?)\s*$/im);
  if (minimumBidderMatch) {
    result.minBidderCount = normalizeInteger(minimumBidderMatch[1]);
  }
  const buyoutMatch = text.match(/^\s*Buyout\s*:\s*(.+?)\s*$/im);
  if (buyoutMatch) {
    result.buyout = normalizeMoney(buyoutMatch[1]);
  }
  const buyoutUntilMatch = text.match(/^\s*Buyout\s+Until\s*:\s*(.+?)\s*$/im);
  if (buyoutUntilMatch) {
    result.buyoutUntil = parsePhilippineDateTime(buyoutUntilMatch[1]);
  }
  const auctionEndMatch = text.match(/^\s*Auction\s+Ends\s*:\s*(.+?)\s*$/im);
  if (auctionEndMatch) {
    result.auctionEnds = parsePhilippineDateTime(auctionEndMatch[1]);
  }
  const cutoffMatch = text.match(/^\s*Bid\s+Cutoff\s*:\s*(.+?)\s*$/im);
  if (cutoffMatch) {
    result.bidCutoffMinutes = normalizeInteger(cutoffMatch[1]);
  }
  const antiSniperMatch = text.match(/^\s*Anti[\s-]*Sniper\s*:\s*(.+?)\s*$/im);
  if (antiSniperMatch) {
    result.antiSniperMinutes = normalizeInteger(antiSniperMatch[1]);
  }
  return result;
}
function mergeAuctionRules(mainRules, photoRules, itemNo) {
  return {
    postType: mainRules.postType,
    item: photoRules.item || mainRules.item || `Item ${itemNo}`,
    minBid: photoRules.minBid ?? mainRules.minBid,
    increment: photoRules.increment ?? mainRules.increment,
    minBidderCount: photoRules.minBidderCount ?? mainRules.minBidderCount,
    buyout: photoRules.buyout ?? mainRules.buyout,
    buyoutUntil: photoRules.buyoutUntil ?? mainRules.buyoutUntil,
    auctionEnds: photoRules.auctionEnds ?? mainRules.auctionEnds,
    bidCutoffMinutes: photoRules.bidCutoffMinutes ?? mainRules.bidCutoffMinutes,
    antiSniperMinutes: photoRules.antiSniperMinutes ?? mainRules.antiSniperMinutes
  };
}
function validateEffectiveMultipleRules(parsed, itemNo) {
  if (parsed.minBid === null) {
    throw new Error(`Multiple auction Item ${itemNo} has no Minimum Bid in either the photo or main caption.`);
  }
  if (parsed.increment === null) {
    throw new Error(`Multiple auction Item ${itemNo} has no Increment in either the photo or main caption.`);
  }
  if (!parsed.auctionEnds) {
    throw new Error(`Multiple auction Item ${itemNo} has no Auction Ends value in either the photo or main caption.`);
  }
}
/* =========================================================
   PAGE ACCESS TOKEN
   ========================================================= */ async function getPageAccessToken(fbPageId) {
  const { data, error } = await supabase.from("fb_pages").select("access_token").eq("fb_page_id", fbPageId).maybeSingle();
  if (error) {
    throw new Error(`fb_pages token lookup failed: ${error.message}`);
  }
  if (!data?.access_token) {
    throw new Error(`Facebook Page ${fbPageId} has no access token.`);
  }
  return String(data.access_token);
}
/* =========================================================
   META JSON POST
   ========================================================= */ async function metaJsonPost(endpoint, accessToken, body) {
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : {};
  } catch  {
    result = {
      raw: text
    };
  }
  if (!response.ok || result?.error) {
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(result)}`);
  }
  return result;
}
/* =========================================================
   META JSON GET
   ========================================================= */ async function metaJsonGet(endpoint, accessToken) {
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : {};
  } catch  {
    result = {
      raw: text
    };
  }
  if (!response.ok || result?.error) {
    throw new Error(`Meta API GET error ${response.status}: ${JSON.stringify(result)}`);
  }
  return result;
}
async function getFacebookPostPhotos(fbPageId, fbPostId) {
  const token = await getPageAccessToken(fbPageId);
  /*
   * IMPORTANT:
   *
   * For a multi-photo Page post, Meta can expose per-photo
   * text on the subattachment itself. We therefore request
   * description/title together with the target photo ID.
   *
   * We still fetch the Photo object's own "name" later.
   */ const result = await metaJsonGet(`${encodeURIComponent(fbPostId)}?fields=attachments{description,title,type,target{id},subattachments{description,title,type,target{id}}}`, token);
  log("MULTIPLE AUCTION PARENT ATTACHMENTS", {
    fbPostId,
    attachments: result?.attachments?.data || []
  });
  const attachments = Array.isArray(result?.attachments?.data) ? result.attachments.data : [];
  const photos = [];
  const seen = new Set();
  const addPhoto = (objectIdValue, captionCandidates)=>{
    const objectId = objectIdValue ? String(objectIdValue).trim() : "";
    if (!objectId || seen.has(objectId)) {
      return;
    }
    let attachmentCaption = "";
    for (const candidate of captionCandidates){
      const value = candidate ? String(candidate).trim() : "";
      if (value) {
        attachmentCaption = value;
        break;
      }
    }
    seen.add(objectId);
    photos.push({
      objectId,
      attachmentCaption
    });
  };
  for (const attachment of attachments){
    const subattachments = Array.isArray(attachment?.subattachments?.data) ? attachment.subattachments.data : [];
    if (subattachments.length > 0) {
      for (const subattachment of subattachments){
        addPhoto(subattachment?.target?.id, [
          subattachment?.description,
          subattachment?.title,
          /*
             * Parent attachment text is only a fallback.
             */ attachment?.description,
          attachment?.title
        ]);
      }
      continue;
    }
    addPhoto(attachment?.target?.id, [
      attachment?.description,
      attachment?.title
    ]);
  }
  return photos;
}
/* =========================================================
   FACEBOOK PHOTO CAPTION / OVERRIDES
   ========================================================= */ async function getFacebookPhotoCaption(fbPageId, photoObjectId) {
  const token = await getPageAccessToken(fbPageId);
  /*
   * FIX:
   *
   * A Facebook Photo object uses "name" for its caption /
   * description. Do NOT request "message" here.
   *
   * Requesting an unsupported field can cause Meta to reject
   * the entire GET, which was causing EO2MATE to silently
   * fall back to the main caption for every image.
   */ const result = await metaJsonGet(`${encodeURIComponent(photoObjectId)}?fields=id,name`, token);
  const caption = String(result?.name || "").trim();
  log("MULTIPLE AUCTION PHOTO METADATA", {
    fbObjectId: photoObjectId,
    metaResult: result,
    resolvedObjectCaption: caption || null
  });
  return caption;
}
/* =========================================================
   RESOLVE FACEBOOK PHOTO CAPTION
   ========================================================= */ async function resolveFacebookPhotoCaption(fbPageId, photo, itemNo, fbPostId) {
  let objectCaption = "";
  try {
    objectCaption = await getFacebookPhotoCaption(fbPageId, photo.objectId);
  } catch (error) {
    errorLog("Facebook Photo object caption lookup failed", {
      fbPostId: fbPostId || null,
      itemNo,
      fbObjectId: photo.objectId,
      attachmentCaption: photo.attachmentCaption || null,
      error: getErrorMessage(error)
    });
  }
  /*
   * Precedence for the PHOTO'S OWN TEXT:
   *
   * 1. Photo object "name"
   * 2. Multi-photo subattachment description/title
   *
   * Main-post inheritance is applied later by mergeAuctionRules().
   */ const resolved = objectCaption || photo.attachmentCaption || "";
  log("MULTIPLE AUCTION PHOTO CAPTION RESOLVED", {
    fbPostId: fbPostId || null,
    itemNo,
    fbObjectId: photo.objectId,
    objectCaption: objectCaption || null,
    attachmentCaption: photo.attachmentCaption || null,
    resolvedCaption: resolved || null
  });
  return resolved;
}
/* =========================================================
   EFFECTIVE MULTIPLE-AUCTION RULES
   ========================================================= */ async function getEffectiveMultipleAuctionRules(auctionPost, auctionItem) {
  const mainRules = parseAuctionCaption(String(auctionPost?.caption || ""));
  const itemNo = Number(auctionItem?.item_no || 0);
  const fbPageId = String(auctionPost?.fb_page_id || "");
  const fbObjectId = String(auctionItem?.fb_object_id || "");
  let photoCaption = "";
  if (fbPageId && fbObjectId) {
    try {
      photoCaption = await getFacebookPhotoCaption(fbPageId, fbObjectId);
    } catch (error) {
      /*
       * A photo with no readable caption should still be able
       * to inherit all rules from the main post.
       */ errorLog("Unable to read photo caption - using main auction rules", {
        itemNo,
        fbObjectId,
        error: getErrorMessage(error)
      });
    }
  }
  const photoRules = parseAuctionCaption(photoCaption);
  const effective = mergeAuctionRules(mainRules, photoRules, itemNo);
  validateEffectiveMultipleRules(effective, itemNo);
  return {
    effective,
    photoCaption
  };
}
/* =========================================================
   AUCTION ANNOUNCEMENT TARGET
   ========================================================= */ /*
 * SINGLE  -> main Facebook post
 * MULTIPLE -> the Facebook photo/object for that auction item
 *
 * This helper is only for TOP-LEVEL automated announcements.
 * Bid validation replies and winner payment-link messages
 * remain direct replies to the bidder's comment.
 */ async function getAuctionAnnouncementTarget(auctionPost, auctionItem) {
  const isMultiple = await isMultipleAuctionPostType(auctionPost?.post_type);
  if (isMultiple) {
    const fbObjectId = String(auctionItem?.fb_object_id || "").trim();
    if (fbObjectId) {
      return fbObjectId;
    }
  }
  return String(auctionPost?.fb_post_id || "").trim();
}
/* =========================================================
   FACEBOOK COMMENT / REPLY
   ========================================================= */ async function postFacebookComment(fbPageId, objectId, message) {
  if (!fbPageId || !objectId || !message) {
    return false;
  }
  try {
    const token = await getPageAccessToken(fbPageId);
    log("Facebook comment attempt", {
      fbPageId,
      objectId,
      message
    });
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(objectId)}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message
      })
    });
    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch  {
      result = {
        raw: text
      };
    }
    if (!response.ok || result?.error) {
      errorLog("Facebook comment rejected by Meta", {
        fbPageId,
        objectId,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        result
      });
      return false;
    }
    log("Facebook comment successful", {
      objectId,
      createdCommentId: result?.id || null
    });
    return true;
  } catch (error) {
    errorLog("Facebook comment failed", {
      fbPageId,
      objectId,
      error: getErrorMessage(error)
    });
    return false;
  }
}
async function replyToComment(fbPageId, commentId, message) {
  return await postFacebookComment(fbPageId, commentId, message);
}
/* =========================================================
   MESSENGER
   ========================================================= */ async function sendMessengerMessage(fbPageId, psid, messageText) {
  try {
    const token = await getPageAccessToken(fbPageId);
    await metaJsonPost(`${fbPageId}/messages`, token, {
      recipient: {
        id: psid
      },
      messaging_type: "RESPONSE",
      message: {
        text: messageText
      }
    });
    log("Messenger message sent", {
      fbPageId,
      psid
    });
    return true;
  } catch (error) {
    errorLog("Messenger message failed", {
      fbPageId,
      psid,
      error: getErrorMessage(error)
    });
    return false;
  }
}
/* =========================================================
   RANDOM CLAIM TOKEN
   ========================================================= */ function generateClaimToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte)=>byte.toString(16).padStart(2, "0")).join("");
}
/* =========================================================
   AUCTION LOOKUPS
   ========================================================= */ async function findAuctionPost(fbPostId) {
  const { data, error } = await supabase.from("auction_posts").select("*").eq("fb_post_id", fbPostId).maybeSingle();
  if (error) {
    throw new Error(`auction_posts lookup failed: ${error.message}`);
  }
  return data;
}
async function findAuctionPostByInternalId(postId) {
  const { data, error } = await supabase.from("auction_posts").select("*").eq("post_id", postId).maybeSingle();
  if (error) {
    throw new Error(`auction_posts lookup failed: ${error.message}`);
  }
  return data;
}
async function findAuctionItem(auctionPostId) {
  const { data, error } = await supabase.from("auction_items").select("*").eq("auction_post_id", auctionPostId).order("item_no", {
    ascending: true,
    nullsFirst: true
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`auction_items lookup failed: ${error.message}`);
  }
  return data;
}
async function findAuctionItemsByPost(auctionPostId) {
  const { data, error } = await supabase.from("auction_items").select("*").eq("auction_post_id", auctionPostId).order("item_no", {
    ascending: true,
    nullsFirst: true
  });
  if (error) {
    throw new Error(`auction_items list lookup failed: ${error.message}`);
  }
  return data || [];
}
async function findAuctionItemByNumber(auctionPostId, itemNo) {
  const { data, error } = await supabase.from("auction_items").select("*").eq("auction_post_id", auctionPostId).eq("item_no", itemNo).maybeSingle();
  if (error) {
    throw new Error(`auction item number lookup failed: ${error.message}`);
  }
  return data;
}
async function findAuctionItemByFacebookObjectId(objectId) {
  const raw = String(objectId || "").trim();
  if (!raw) {
    return null;
  }
  const suffix = raw.includes("_") ? raw.split("_").pop() || raw : raw;
  const candidates = Array.from(new Set([
    raw,
    suffix
  ]));
  const { data, error } = await supabase.from("auction_items").select("*").in("fb_object_id", candidates).limit(1).maybeSingle();
  if (error) {
    throw new Error(`auction item Facebook-object lookup failed: ${error.message}`);
  }
  return data;
}
async function findAuctionItemById(auctionItemId) {
  const { data, error } = await supabase.from("auction_items").select("*").eq("auction_item_id", auctionItemId).maybeSingle();
  if (error) {
    throw new Error(`auction_items lookup failed: ${error.message}`);
  }
  return data;
}
async function findAuctionRule(auctionItemId) {
  const { data, error } = await supabase.from("auction_rules").select("*").eq("auction_item_id", auctionItemId).maybeSingle();
  if (error) {
    throw new Error(`auction_rules lookup failed: ${error.message}`);
  }
  return data;
}
async function findHighestValidBid(auctionItemId) {
  const { data, error } = await supabase.from("auction_bids").select("*").eq("auction_item_id", auctionItemId).eq("is_valid", true).order("bid_amt", {
    ascending: false
  }).order("commented_at", {
    ascending: true
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`highest valid bid lookup failed: ${error.message}`);
  }
  return data;
}
async function findSameValidBidByBidder(auctionItemId, fbUserId, bidAmount) {
  if (!fbUserId) {
    return null;
  }
  const { data, error } = await supabase.from("auction_bids").select("*").eq("auction_item_id", auctionItemId).eq("fb_user_id", fbUserId).eq("is_valid", true).eq("bid_amt", bidAmount).order("commented_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`same bidder bid lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   BID LOOKUP
   ========================================================= */ async function findBidById(bidId) {
  const { data, error } = await supabase.from("auction_bids").select("*").eq("bid_id", bidId).maybeSingle();
  if (error) {
    throw new Error(`auction_bids lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   EXISTING WINNER
   ========================================================= */ async function findExistingWinner(auctionItemId) {
  const { data, error } = await supabase.from("auction_winners").select("*").eq("auction_item_id", auctionItemId).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`auction_winners lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   PAYMENT LOOKUP
   ========================================================= */ async function findPaymentByWinnerId(bidWinnerId) {
  const { data, error } = await supabase.from("payments").select("*").eq("bid_winner_id", bidWinnerId).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`payments lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   WINNER CONTEXT
   ========================================================= */ async function findWinnerWithContext(bidWinnerId) {
  const { data: winner, error: winnerError } = await supabase.from("auction_winners").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (winnerError) {
    throw new Error(`auction_winners lookup failed: ${winnerError.message}`);
  }
  if (!winner) {
    return null;
  }
  const item = await findAuctionItemById(winner.auction_item_id);
  if (!item) {
    return null;
  }
  const post = await findAuctionPostByInternalId(item.auction_post_id);
  if (!post) {
    return null;
  }
  return {
    winner,
    item,
    post
  };
}
/* =========================================================
   ORDER LOOKUP / CREATE
   ========================================================= */ async function findOrderByWinnerId(bidWinnerId) {
  const { data, error } = await supabase.from("orders").select("*").eq("bid_winner_id", bidWinnerId).maybeSingle();
  if (error) {
    throw new Error(`orders lookup failed: ${error.message}`);
  }
  return data;
}
async function createOrGetOrderForWinner(auctionPost, auctionItem, winningBid, winner) {
  const existing = await findOrderByWinnerId(winner.bid_winner_id);
  if (existing) {
    return existing;
  }
  const amount = Number(winner.winning_amt ?? winningBid?.bid_amt);
  if (!Number.isFinite(amount)) {
    throw new Error(`Cannot create order for winner ${winner.bid_winner_id}: invalid winning amount.`);
  }
  const { data, error } = await supabase.from("orders").insert({
    client_id: auctionPost.client_id,
    bid_winner_id: winner.bid_winner_id,
    auction_item_id: auctionItem.auction_item_id,
    source_type: "AUCTION",
    order_status: "PAYMENT_PENDING",
    payment_status: "PENDING",
    subtotal: amount,
    shipping_fee: 0,
    total_amount: amount,
    currency: "PHP",
    buyer_fb_user_id: winningBid?.fb_user_id || null,
    buyer_name: winningBid?.fb_user_name || null
  }).select("*").single();
  if (error) {
    const retry = await findOrderByWinnerId(winner.bid_winner_id);
    if (retry) {
      return retry;
    }
    throw new Error(`orders insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   OPEN ORDER GROUP
   ========================================================= */ async function findOpenOrderGroup(clientId, fbPageId, buyerFbUserId, environment) {
  const orderGroupWindowHours = await getClientNumberSetting(clientId, "ORDER_GROUP_WINDOW_HOURS", DEFAULT_ORDER_GROUP_WINDOW_HOURS);
  const cutoff = new Date(Date.now() - orderGroupWindowHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("order_groups").select("*").eq("client_id", clientId).eq("fb_page_id", fbPageId).eq("buyer_fb_user_id", buyerFbUserId).eq("environment", environment).eq("group_status", "OPEN").is("locked_at", null).gte("created_at", cutoff).order("created_at", {
    ascending: true
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`open order group lookup failed: ${error.message}`);
  }
  return data;
}
async function lockExpiredOpenGroupsForBuyer(clientId, fbPageId, buyerFbUserId, environment) {
  const orderGroupWindowHours = await getClientNumberSetting(clientId, "ORDER_GROUP_WINDOW_HOURS", DEFAULT_ORDER_GROUP_WINDOW_HOURS);
  const cutoff = new Date(Date.now() - orderGroupWindowHours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("order_groups").update({
    locked_at: now,
    updated_at: now
  }).eq("client_id", clientId).eq("fb_page_id", fbPageId).eq("buyer_fb_user_id", buyerFbUserId).eq("environment", environment).eq("group_status", "OPEN").is("locked_at", null).lt("created_at", cutoff).select("order_group_id, group_number, created_at, locked_at");
  if (error) {
    throw new Error(`expired buyer group lock failed: ${error.message}`);
  }
  for (const group of data || []){
    log("ORDER GROUP EXPIRED AND LOCKED", {
      orderGroupId: group.order_group_id,
      groupNumber: group.group_number,
      createdAt: group.created_at,
      lockedAt: group.locked_at,
      windowHours: orderGroupWindowHours
    });
  }
  return data || [];
}
async function createOrGetOpenOrderGroup(auctionPost, winningBid) {
  const clientId = String(auctionPost?.client_id || "");
  const fbPageId = String(auctionPost?.fb_page_id || "");
  const buyerFbUserId = String(winningBid?.fb_user_id || "");
  const environment = getAuctionEnvironment(auctionPost);
  if (!clientId || !fbPageId || !buyerFbUserId || !environment) {
    throw new Error("Cannot group auction winner: missing client, page, buyer, or environment.");
  }
  const existing = await findOpenOrderGroup(clientId, fbPageId, buyerFbUserId, environment);
  if (existing) {
    return {
      group: existing,
      created: false
    };
  }
  /*
   * If the buyer has an OPEN group older than the 24-hour
   * grouping window, lock it first. This is required because
   * the partial unique index intentionally allows only one
   * OPEN + unlocked group for this buyer/page/environment.
   */ await lockExpiredOpenGroupsForBuyer(clientId, fbPageId, buyerFbUserId, environment);
  const { data, error } = await supabase.from("order_groups").insert({
    client_id: clientId,
    fb_page_id: fbPageId,
    buyer_fb_user_id: buyerFbUserId,
    buyer_name: winningBid?.fb_user_name || null,
    environment,
    group_status: "OPEN",
    subtotal: 0,
    shipping_fee: 0,
    total_amount: 0
  }).select("*").single();
  if (error) {
    const retry = await findOpenOrderGroup(clientId, fbPageId, buyerFbUserId, environment);
    if (retry) {
      return {
        group: retry,
        created: false
      };
    }
    throw new Error(`order_groups insert failed: ${error.message}`);
  }
  return {
    group: data,
    created: true
  };
}
async function findOrderGroupById(orderGroupId) {
  const { data, error } = await supabase.from("order_groups").select("*").eq("order_group_id", orderGroupId).maybeSingle();
  if (error) {
    throw new Error(`order group lookup failed: ${error.message}`);
  }
  return data;
}
async function attachOrderToGroup(order, orderGroupId) {
  if (order?.order_group_id) {
    return order;
  }
  const { data, error } = await supabase.from("orders").update({
    order_group_id: orderGroupId
  }).eq("order_id", order.order_id).is("order_group_id", null).select("*").maybeSingle();
  if (error) {
    throw new Error(`order group attachment failed: ${error.message}`);
  }
  return data || await findOrderByWinnerId(order.bid_winner_id);
}
async function getOrdersForGroup(orderGroupId) {
  const { data, error } = await supabase.from("orders").select("*").eq("order_group_id", orderGroupId).order("created_at", {
    ascending: true
  });
  if (error) {
    throw new Error(`group orders lookup failed: ${error.message}`);
  }
  return data || [];
}
async function recalculateOrderGroupTotals(orderGroupId) {
  const orders = await getOrdersForGroup(orderGroupId);
  let subtotal = 0;
  let shippingFee = 0;
  for (const order of orders){
    const orderSubtotal = Number(order.subtotal || 0);
    const orderShipping = Number(order.shipping_fee || 0);
    if (Number.isFinite(orderSubtotal)) {
      subtotal += orderSubtotal;
    }
    if (Number.isFinite(orderShipping)) {
      shippingFee += orderShipping;
    }
  }
  const totalAmount = subtotal + shippingFee;
  const { data, error } = await supabase.from("order_groups").update({
    subtotal,
    shipping_fee: shippingFee,
    total_amount: totalAmount,
    updated_at: new Date().toISOString()
  }).eq("order_group_id", orderGroupId).select("*").single();
  if (error) {
    throw new Error(`order group total update failed: ${error.message}`);
  }
  return {
    group: data,
    orders
  };
}
async function lockOrderGroupForCheckout(orderGroupId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("order_groups").update({
    locked_at: now,
    updated_at: now
  }).eq("order_group_id", orderGroupId).is("locked_at", null).select("*").maybeSingle();
  if (error) {
    throw new Error(`order group checkout lock failed: ${error.message}`);
  }
  if (data) {
    return data;
  }
  return await findOrderGroupById(orderGroupId);
}
async function buildOrderGroupItemLines(orders) {
  const lines = [];
  for (const order of orders){
    const item = await findAuctionItemById(String(order.auction_item_id));
    const label = String(item?.item_label || order?.order_number || "Auction Item");
    const amount = Number(order.total_amount || order.subtotal || 0);
    lines.push(`${label} Ã¢ÂÂ PHP ${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`);
  }
  return lines;
}
/* =========================================================
   CREATE BID
   ========================================================= */ async function createBid(params) {
  const { data: existing, error: duplicateError } = await supabase.from("auction_bids").select("bid_id").eq("fb_comment_id", params.commentId).maybeSingle();
  if (duplicateError) {
    throw new Error(`auction_bids duplicate lookup failed: ${duplicateError.message}`);
  }
  if (existing) {
    log("Duplicate Facebook bid ignored", {
      commentId: params.commentId
    });
    return null;
  }
  const { data, error } = await supabase.from("auction_bids").insert({
    auction_item_id: params.auctionItemId,
    fb_comment_id: params.commentId,
    fb_user_id: params.fbUserId,
    fb_user_name: params.fbUserName,
    comment_text: params.commentText,
    bid_amt: params.valid ? params.bidAmount : null,
    is_valid: params.valid,
    invalid_reason: params.invalidReason,
    commented_at: params.commentedAt
  }).select("*").single();
  if (error) {
    if (String(error?.code || "") === "23505") {
      return null;
    }
    throw new Error(`auction_bids insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   DISTINCT VALID BIDDERS
   ========================================================= */ async function countDistinctValidBidders(auctionItemId) {
  const { data, error } = await supabase.from("auction_bids").select("fb_user_id").eq("auction_item_id", auctionItemId).eq("is_valid", true);
  if (error) {
    throw new Error(`valid bidder count failed: ${error.message}`);
  }
  const bidders = new Set();
  for (const row of data || []){
    if (row.fb_user_id) {
      bidders.add(String(row.fb_user_id));
    }
  }
  return bidders.size;
}
/* =========================================================
   BIDDER CUTOFF ELIGIBILITY
   ========================================================= */ async function hasBidderValidBidBeforeCutoff(auctionItemId, fbUserId, cutoffStart) {
  if (!fbUserId) {
    return false;
  }
  const { data, error } = await supabase.from("auction_bids").select("bid_id").eq("auction_item_id", auctionItemId).eq("fb_user_id", fbUserId).eq("is_valid", true).lt("commented_at", cutoffStart.toISOString()).limit(1).maybeSingle();
  if (error) {
    throw new Error(`cutoff bidder lookup failed: ${error.message}`);
  }
  return Boolean(data);
}
/* =========================================================
   AUCTION RULE CREATE
   ========================================================= */ async function createAuctionRule(auctionItemId, parsed) {
  const { data, error } = await supabase.from("auction_rules").insert({
    auction_item_id: auctionItemId,
    rule_name: "DEFAULT",
    min_bid: parsed.minBid,
    bid_increment: parsed.increment,
    min_bidder_count: parsed.minBidderCount ?? 1,
    /*
           * EO2MATE standard:
           * NULL / missing Buyout -> 0
           * 0 = Buyout disabled
           * > 0 = Buyout enabled
           */ bid_buyout_amt: parsed.buyout ?? 0,
    buyout_dt_limit: (parsed.buyout ?? 0) > 0 ? parsed.buyoutUntil : null,
    auction_end_dt: parsed.auctionEnds,
    anti_sniper_minutes: parsed.antiSniperMinutes ?? 0
  }).select("*").single();
  if (error) {
    throw new Error(`auction_rules insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   AUCTION RULE SYNC
   ========================================================= */ async function syncAuctionRule(auctionItemId, parsed) {
  const { data, error } = await supabase.from("auction_rules").update({
    min_bid: parsed.minBid,
    bid_increment: parsed.increment,
    min_bidder_count: parsed.minBidderCount ?? 1,
    /*
           * EO2MATE standard:
           * NULL / missing Buyout -> 0
           * 0 = Buyout disabled
           * > 0 = Buyout enabled
           */ bid_buyout_amt: parsed.buyout ?? 0,
    buyout_dt_limit: (parsed.buyout ?? 0) > 0 ? parsed.buyoutUntil : null,
    auction_end_dt: parsed.auctionEnds,
    anti_sniper_minutes: parsed.antiSniperMinutes ?? 0
  }).eq("auction_item_id", auctionItemId).select("*").maybeSingle();
  if (error) {
    throw new Error(`auction_rules sync failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   STRUCTURE RECOVERY
   ========================================================= */ async function ensureAuctionStructureForComment(auctionPost, postId) {
  const parsed = parseAuctionCaption(String(auctionPost?.caption || ""));
  if (!parsed.item || parsed.minBid === null || parsed.increment === null || !parsed.auctionEnds) {
    throw new Error(`Cannot recover auction structure for ${postId}: invalid auction caption.`);
  }
  let auctionItem = await findAuctionItem(auctionPost.post_id);
  if (!auctionItem) {
    log("Recovering missing auction item", {
      postId
    });
    const { data, error } = await supabase.from("auction_items").insert({
      auction_post_id: auctionPost.post_id,
      item_no: 1,
      fb_object_id: postId,
      item_label: parsed.item,
      status: "ACTIVE",
      min_bidder_reached_at: null,
      last_status_comment_at: null,
      one_hour_warning_sent_at: null,
      five_min_warning_sent_at: null,
      buyout_window_ended_announced_at: null
    }).select("*").maybeSingle();
    if (error) {
      auctionItem = await findAuctionItem(auctionPost.post_id);
      if (!auctionItem) {
        throw new Error(`auction item recovery failed: ${error.message}`);
      }
    } else {
      auctionItem = data;
    }
  }
  if (!auctionItem) {
    throw new Error("Auction item recovery failed.");
  }
  let auctionRule = await findAuctionRule(auctionItem.auction_item_id);
  if (!auctionRule) {
    log("Recovering missing auction rule", {
      auctionItemId: auctionItem.auction_item_id
    });
    try {
      auctionRule = await createAuctionRule(auctionItem.auction_item_id, parsed);
    } catch (error) {
      auctionRule = await findAuctionRule(auctionItem.auction_item_id);
      if (!auctionRule) {
        throw error;
      }
    }
  }
  return {
    auctionItem,
    auctionRule,
    parsed
  };
}
/* =========================================================
   BUYOUT WINDOW
   ========================================================= */ function isBuyoutWindowOpen(commentTime, buyoutUntilRaw) {
  if (!buyoutUntilRaw) {
    return false;
  }
  const buyoutUntil = new Date(String(buyoutUntilRaw));
  if (Number.isNaN(buyoutUntil.getTime())) {
    return false;
  }
  return commentTime.getTime() <= buyoutUntil.getTime();
}
/* =========================================================
   INCREMENT VALIDATION
   ========================================================= */ function isValidIncrement(bidAmount, minimumBid, increment) {
  if (increment <= 0) {
    return true;
  }
  const steps = (bidAmount - minimumBid) / increment;
  return Math.abs(steps - Math.round(steps)) < 0.000001;
}
/* =========================================================
   MINIMUM BIDDER MILESTONE
   ========================================================= */ /*
 * Trigger:
 *
 * The valid bid that causes the number of DISTINCT VALID
 * bidders to reach min_bidder_count.
 *
 * Behavior:
 *
 * 1. The triggering bidder already receives:
 *
 *    "Valid bid accepted..."
 *
 * 2. This function then marks min_bidder_reached_at.
 *
 * 3. It creates ONE NEW TOP-LEVEL COMMENT on the
 *    Facebook auction post.
 *
 * It does NOT reply to the triggering bidder with the
 * minimum-bidder advisory.
 */ async function handleMinimumBidderReached(auctionPost, auctionItem, auctionRule, fbPageId) {
  const minimumRequired = normalizeInteger(auctionRule.min_bidder_count) ?? 1;
  const bidderCount = await countDistinctValidBidders(auctionItem.auction_item_id);
  if (bidderCount < minimumRequired) {
    return;
  }
  /*
   * Atomic milestone update.
   *
   * Only the first valid bid that reaches the
   * requirement can change NULL Ã¢ÂÂ timestamp.
   *
   * Later valid bids will return no row and
   * therefore will not create another advisory.
   */ const { data: updatedItem, error: milestoneError } = await supabase.from("auction_items").update({
    min_bidder_reached_at: new Date().toISOString()
  }).eq("auction_item_id", auctionItem.auction_item_id).is("min_bidder_reached_at", null).select("*").maybeSingle();
  if (milestoneError) {
    throw new Error(`minimum bidder milestone update failed: ${milestoneError.message}`);
  }
  /*
   * Milestone was already announced.
   */ if (!updatedItem) {
    return;
  }
  const announcementTarget = await getAuctionAnnouncementTarget(auctionPost, auctionItem);
  if (!announcementTarget) {
    throw new Error("Cannot post minimum bidder advisory: auction item has no Facebook object ID.");
  }
  /*
   * NEW TOP-LEVEL FACEBOOK COMMENT.
   *
   * This is intentionally NOT replyToComment().
   */ await postFacebookComment(fbPageId, announcementTarget, [
    "Ã¢ÂÂ MINIMUM BIDDER REQUIREMENT REACHED",
    "",
    `Item: ${String(auctionItem.item_label || "Auction Item")}`,
    `Valid Bidders: ${bidderCount}`,
    `Minimum Required: ${minimumRequired}`,
    "",
    "The auction is now qualified."
  ].join("\n"));
  log("MINIMUM VALID BIDDER REQUIREMENT REACHED", {
    auctionItemId: auctionItem.auction_item_id,
    announcementTarget,
    bidderCount,
    minimumRequired,
    minBidderReachedAt: updatedItem.min_bidder_reached_at
  });
}
/* =========================================================
   ANTI-SNIPER
   ========================================================= */ async function applyAntiSniper(auctionItemId, auctionRule, fbPageId, commentId, commentTime) {
  const minutes = normalizeInteger(auctionRule.anti_sniper_minutes) ?? 0;
  if (minutes <= 0 || !auctionRule.auction_end_dt) {
    return;
  }
  const currentEnd = new Date(auctionRule.auction_end_dt);
  if (Number.isNaN(currentEnd.getTime())) {
    return;
  }
  const triggerStart = new Date(currentEnd.getTime() - minutes * 60 * 1000);
  if (commentTime.getTime() < triggerStart.getTime() || commentTime.getTime() >= currentEnd.getTime()) {
    return;
  }
  const newEnd = new Date(commentTime.getTime() + minutes * 60 * 1000);
  if (newEnd.getTime() <= currentEnd.getTime()) {
    return;
  }
  const { data, error } = await supabase.from("auction_rules").update({
    auction_end_dt: newEnd.toISOString()
  }).eq("auction_item_id", auctionItemId).eq("auction_end_dt", auctionRule.auction_end_dt).select("*").maybeSingle();
  if (error) {
    throw new Error(`anti-sniper update failed: ${error.message}`);
  }
  if (!data) {
    return;
  }
  await replyToComment(fbPageId, commentId, `Anti-sniper activated. Auction extended until ${formatPhilippineDateTime(newEnd)}.`);
  log("ANTI-SNIPER ACTIVATED", {
    auctionItemId,
    oldEnd: currentEnd.toISOString(),
    newEnd: newEnd.toISOString(),
    minutes
  });
}
/* =========================================================
   WINNER CREATE / GET
   ========================================================= */ async function createOrGetWinner(auctionItemId, winningBid) {
  const existing = await findExistingWinner(auctionItemId);
  if (existing) {
    return existing;
  }
  const bidWinnerId = crypto.randomUUID();
  const { data, error } = await supabase.from("auction_winners").insert({
    bid_winner_id: bidWinnerId,
    auction_item_id: auctionItemId,
    bid_id: winningBid.bid_id,
    winning_amt: Number(winningBid.bid_amt),
    status: "PENDING",
    won_at: new Date().toISOString()
  }).select("*").single();
  if (error) {
    const retry = await findExistingWinner(auctionItemId);
    if (retry) {
      return retry;
    }
    throw new Error(`auction_winners insert failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   CREATE PAYMENT
   ========================================================= */ async function createPaymentForWinner(bidWinnerId) {
  const response = await fetch(CREATE_PAYMENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      bid_winner_id: bidWinnerId
    })
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch  {
    throw new Error(`create-payment returned invalid JSON: ${text}`);
  }
  if (!response.ok || result?.success !== true) {
    throw new Error(`create-payment failed: ${JSON.stringify(result)}`);
  }
  return result;
}
async function createPaymentForOrderGroup(orderGroupId, forceRefresh = false) {
  const response = await fetch(CREATE_PAYMENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      order_group_id: orderGroupId,
      force_refresh: forceRefresh
    })
  });
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : {};
  } catch  {
    throw new Error(`create-payment returned invalid JSON: ${text}`);
  }
  if (!response.ok || result?.success !== true) {
    throw new Error(`group create-payment failed: ${JSON.stringify(result)}`);
  }
  return result;
}
function getCheckoutUrlFromPaymentResult(result) {
  const candidates = [
    result?.checkout_url,
    result?.checkoutUrl,
    result?.payment?.checkout_url,
    result?.payment?.checkoutUrl,
    result?.data?.checkout_url,
    result?.data?.checkoutUrl
  ];
  for (const candidate of candidates){
    if (candidate) {
      return String(candidate);
    }
  }
  return null;
}
/* =========================================================
   LEGACY MESSENGER CLAIM CREATE
   ========================================================= */ async function createMessengerClaim(bidWinnerId, fbPageId) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase.from("messenger_payment_claims").select("*").eq("bid_winner_id", bidWinnerId).is("order_group_id", null).gt("expires_at", now).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (existingError) {
    throw new Error(`Messenger claim lookup failed: ${existingError.message}`);
  }
  if (existing) {
    return existing;
  }
  const claimToken = generateClaimToken();
  const winnerContext = await findWinnerWithContext(bidWinnerId);
  const claimExpiryHours = await getClientNumberSetting(getString(winnerContext?.post?.client_id), "WINNER_LINK_EXPIRY_HOURS", DEFAULT_WINNER_LINK_EXPIRY_HOURS);
  const expiresAt = new Date(Date.now() + claimExpiryHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("messenger_payment_claims").insert({
    claim_token: claimToken,
    bid_winner_id: bidWinnerId,
    order_group_id: null,
    fb_page_id: fbPageId,
    expires_at: expiresAt
  }).select("*").single();
  if (error) {
    throw new Error(`Messenger claim insert failed: ${error.message}`);
  }
  return data;
}
async function createOrReuseGroupMessengerClaim(orderGroupId, fbPageId) {
  const orderGroup = await findOrderGroupById(orderGroupId);
  const claimExpiryHours = await getClientNumberSetting(getString(orderGroup?.client_id), "WINNER_LINK_EXPIRY_HOURS", DEFAULT_WINNER_LINK_EXPIRY_HOURS);
  const { data: existing, error: existingError } = await supabase.from("messenger_payment_claims").select("*").eq("order_group_id", orderGroupId).maybeSingle();
  if (existingError) {
    throw new Error(`group Messenger claim lookup failed: ${existingError.message}`);
  }
  if (existing) {
    const expiresAt = new Date(existing.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return {
        claim: existing,
        created: false
      };
    }
    const claimToken = generateClaimToken();
    const refreshedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: refreshed, error: refreshError } = await supabase.from("messenger_payment_claims").update({
      claim_token: claimToken,
      bid_winner_id: null,
      fb_page_id: fbPageId,
      claimed_psid: null,
      claimed_at: null,
      expires_at: refreshedExpiry
    }).eq("claim_id", existing.claim_id).select("*").single();
    if (refreshError) {
      throw new Error(`group Messenger claim refresh failed: ${refreshError.message}`);
    }
    return {
      claim: refreshed,
      created: true
    };
  }
  const claimToken = generateClaimToken();
  const expiresAt = new Date(Date.now() + claimExpiryHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("messenger_payment_claims").insert({
    claim_token: claimToken,
    bid_winner_id: null,
    order_group_id: orderGroupId,
    fb_page_id: fbPageId,
    expires_at: expiresAt
  }).select("*").single();
  if (error) {
    const { data: retry, error: retryError } = await supabase.from("messenger_payment_claims").select("*").eq("order_group_id", orderGroupId).maybeSingle();
    if (retryError) {
      throw new Error(`group Messenger claim retry failed: ${retryError.message}`);
    }
    if (retry) {
      return {
        claim: retry,
        created: false
      };
    }
    throw new Error(`group Messenger claim insert failed: ${error.message}`);
  }
  return {
    claim: data,
    created: true
  };
}
/* =========================================================
   FIND MESSENGER CLAIM
   ========================================================= */ async function findMessengerClaim(claimToken) {
  const { data, error } = await supabase.from("messenger_payment_claims").select("*").eq("claim_token", claimToken).maybeSingle();
  if (error) {
    throw new Error(`Messenger claim lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   CLAIM PSID BIND
   ========================================================= */ async function bindClaimToPsid(claimId, psid) {
  const { data, error } = await supabase.from("messenger_payment_claims").update({
    claimed_psid: psid,
    claimed_at: new Date().toISOString()
  }).eq("claim_id", claimId).is("claimed_psid", null).is("claimed_at", null).select("*").maybeSingle();
  if (error) {
    throw new Error(`Messenger claim bind failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   PREPARE WINNER PAYMENT
   ========================================================= */ async function prepareWinnerPayment(fbPageId, winningBid, winner) {
  try {
    const context = await findWinnerWithContext(winner.bid_winner_id);
    if (!context) {
      throw new Error(`Winner context not found for ${winner.bid_winner_id}.`);
    }
    const environment = getAuctionEnvironment(context.post);
    const buyerFbUserId = String(winningBid?.fb_user_id || "");
    const orderGroupWindowHours = await getClientNumberSetting(getString(context.post?.client_id), "ORDER_GROUP_WINDOW_HOURS", DEFAULT_ORDER_GROUP_WINDOW_HOURS);
    if (!buyerFbUserId) {
      const claim = await createMessengerClaim(winner.bid_winner_id, fbPageId);
      const messengerUrl = `https://m.me/${encodeURIComponent(fbPageId)}?ref=${encodeURIComponent(claim.claim_token)}`;
      await replyToComment(fbPageId, winningBid.fb_comment_id, [
        "Ã°ÂÂÂ Congratulations! You won the auction.",
        "",
        `Winning Bid: Ã¢ÂÂ±${formatMoney(winningBid.bid_amt)}`,
        "",
        "Tap the link below to receive your secure payment link in Messenger:",
        "",
        messengerUrl
      ].join("\n"));
      return;
    }
    const order = await createOrGetOrderForWinner(context.post, context.item, winningBid, winner);
    let orderGroup;
    let groupCreated = false;
    if (order.order_group_id) {
      orderGroup = await findOrderGroupById(String(order.order_group_id));
    } else {
      const groupResult = await createOrGetOpenOrderGroup(context.post, winningBid);
      orderGroup = groupResult.group;
      groupCreated = groupResult.created;
      const attachedOrder = await attachOrderToGroup(order, orderGroup.order_group_id);
      if (attachedOrder?.order_group_id && String(attachedOrder.order_group_id) !== String(orderGroup.order_group_id)) {
        orderGroup = await findOrderGroupById(String(attachedOrder.order_group_id));
      }
    }
    if (!orderGroup) {
      throw new Error("Unable to resolve order group.");
    }
    const groupTotals = await recalculateOrderGroupTotals(orderGroup.order_group_id);
    orderGroup = groupTotals.group;
    const claimResult = await createOrReuseGroupMessengerClaim(orderGroup.order_group_id, fbPageId);
    const claim = claimResult.claim;
    const messengerUrl = `https://m.me/${encodeURIComponent(fbPageId)}?ref=${encodeURIComponent(claim.claim_token)}`;
    if (claimResult.created) {
      await replyToComment(fbPageId, winningBid.fb_comment_id, (environment === "CLNT" ? [
        "Ã°ÂÂÂ Congratulations! You won the auction.",
        "",
        `Winning Bid: Ã¢ÂÂ±${formatMoney(winningBid.bid_amt)}`,
        "",
        `Your wins from this Page can be combined for up to ${orderGroupWindowHours} hours from the first win.`,
        "",
        "Tap the link below to review your won item(s) in Messenger.",
        "Payment will be coordinated manually with the Page:",
        "",
        messengerUrl
      ] : [
        "Ã°ÂÂÂ Congratulations! You won the auction.",
        "",
        `Winning Bid: Ã¢ÂÂ±${formatMoney(winningBid.bid_amt)}`,
        "",
        `Your unpaid wins from this Page can be combined for up to ${orderGroupWindowHours} hours from the first win.`,
        "",
        "Tap the link below to review your grouped wins in Messenger.",
        "Opening the link will NOT start payment:",
        "",
        messengerUrl
      ]).join("\n"));
    } else {
      /*
       * Existing OPEN group:
       *
       * Reuse the SAME claim token / Messenger URL and resend
       * it for convenience every time another win is added.
       *
       * This does NOT create a new claim, new group, or
       * PayMongo checkout.
       */ await replyToComment(fbPageId, winningBid.fb_comment_id, (environment === "CLNT" ? [
        "Ã°ÂÂÂ Congratulations! You won this item.",
        "",
        `Winning Bid: Ã¢ÂÂ±${formatMoney(winningBid.bid_amt)}`,
        "",
        "This item was added to your existing EO2MATE manual-payment group.",
        "",
        `Grouped Items: ${groupTotals.orders.length}`,
        `Current Group Total: Ã¢ÂÂ±${formatMoney(orderGroup.total_amount)}`,
        "",
        `The group stays open for up to ${orderGroupWindowHours} hours from the first win.`,
        "",
        "Review your grouped wins here:",
        "",
        messengerUrl,
        "",
        "Payment will be coordinated manually with the Page."
      ] : [
        "Ã°ÂÂÂ Congratulations! You won this item.",
        "",
        `Winning Bid: Ã¢ÂÂ±${formatMoney(winningBid.bid_amt)}`,
        "",
        "This item was added to your existing unpaid EO2MATE checkout group.",
        "",
        `Grouped Items: ${groupTotals.orders.length}`,
        `Current Group Total: Ã¢ÂÂ±${formatMoney(orderGroup.total_amount)}`,
        "",
        `The group stays open for up to ${orderGroupWindowHours} hours from the first win unless you choose to pay earlier.`,
        "",
        "Review your grouped wins here:",
        "",
        messengerUrl,
        "",
        "Opening the link will NOT start payment. Reply PAY in Messenger only when you are ready to finalize the group."
      ]).join("\n"));
    }
    log("WINNER ATTACHED TO ORDER GROUP", {
      bidWinnerId: winner.bid_winner_id,
      orderId: order.order_id,
      orderGroupId: orderGroup.order_group_id,
      groupNumber: orderGroup.group_number,
      groupCreated,
      claimCreated: claimResult.created,
      groupTotal: orderGroup.total_amount,
      itemCount: groupTotals.orders.length
    });
  } catch (error) {
    errorLog("Winner order-group preparation failed", {
      bidWinnerId: winner?.bid_winner_id,
      error: getErrorMessage(error)
    });
  }
}
/* =========================================================
   RECOVER WINNERS WITH MISSING ORDERS
   ========================================================= */ /*
 * Recovery purpose:
 *
 * A winner row can already exist even if a previous
 * prepareWinnerPayment() attempt failed before creating
 * its orders / order_groups records.
 *
 * This recovery replays ONLY the post-winner fulfillment
 * step. It does NOT recreate winners, rebid, or reopen an
 * auction.
 *
 * Default behavior:
 *   - status = PENDING
 *   - no existing orders row
 *   - maximum 100 candidates per invocation
 *
 * Optional:
 *   pass specific bid_winner_ids so a manual recovery can
 *   target only known winners.
 */ async function recoverMissingWinnerOrders(targetWinnerIds = null) {
  let query = supabase.from("auction_winners").select("*").eq("status", "PENDING").order("created_at", {
    ascending: true
  }).limit(100);
  if (targetWinnerIds && targetWinnerIds.length > 0) {
    query = query.in("bid_winner_id", targetWinnerIds);
  }
  const { data: winners, error } = await query;
  if (error) {
    throw new Error(`winner recovery lookup failed: ${error.message}`);
  }
  let candidates = 0;
  let recovered = 0;
  let alreadyHadOrder = 0;
  let skipped = 0;
  let failed = 0;
  const details = [];
  for (const winner of winners || []){
    const bidWinnerId = String(winner?.bid_winner_id || "");
    if (!bidWinnerId) {
      skipped += 1;
      continue;
    }
    try {
      const existingOrder = await findOrderByWinnerId(bidWinnerId);
      if (existingOrder) {
        alreadyHadOrder += 1;
        details.push({
          bid_winner_id: bidWinnerId,
          result: "ALREADY_HAS_ORDER",
          order_id: existingOrder.order_id,
          order_group_id: existingOrder.order_group_id
        });
        continue;
      }
      candidates += 1;
      const bidId = String(winner?.bid_id || "");
      if (!bidId) {
        skipped += 1;
        details.push({
          bid_winner_id: bidWinnerId,
          result: "SKIPPED",
          reason: "WINNER_HAS_NO_BID_ID"
        });
        continue;
      }
      const winningBid = await findBidById(bidId);
      if (!winningBid) {
        skipped += 1;
        details.push({
          bid_winner_id: bidWinnerId,
          result: "SKIPPED",
          reason: "WINNING_BID_NOT_FOUND"
        });
        continue;
      }
      const context = await findWinnerWithContext(bidWinnerId);
      if (!context) {
        skipped += 1;
        details.push({
          bid_winner_id: bidWinnerId,
          result: "SKIPPED",
          reason: "WINNER_CONTEXT_NOT_FOUND"
        });
        continue;
      }
      const fbPageId = String(context.post.fb_page_id || "");
      if (!fbPageId) {
        skipped += 1;
        details.push({
          bid_winner_id: bidWinnerId,
          result: "SKIPPED",
          reason: "FACEBOOK_PAGE_ID_MISSING"
        });
        continue;
      }
      /*
       * Reuse the exact normal winner fulfillment path.
       *
       * prepareWinnerPayment() is deliberately idempotent:
       * orders.bid_winner_id is unique and the OPEN group /
       * group claim are reused.
       */ await prepareWinnerPayment(fbPageId, winningBid, winner);
      /*
       * prepareWinnerPayment() logs its own internal failure
       * instead of throwing, so verify persistence afterward.
       */ const recoveredOrder = await findOrderByWinnerId(bidWinnerId);
      if (!recoveredOrder) {
        failed += 1;
        details.push({
          bid_winner_id: bidWinnerId,
          result: "FAILED",
          reason: "ORDER_STILL_MISSING_AFTER_RECOVERY"
        });
        continue;
      }
      recovered += 1;
      details.push({
        bid_winner_id: bidWinnerId,
        result: "RECOVERED",
        order_id: recoveredOrder.order_id,
        order_group_id: recoveredOrder.order_group_id,
        amount: winner.winning_amt
      });
      log("WINNER ORDER RECOVERED", {
        bidWinnerId,
        orderId: recoveredOrder.order_id,
        orderGroupId: recoveredOrder.order_group_id
      });
    } catch (recoveryError) {
      failed += 1;
      const message = getErrorMessage(recoveryError);
      details.push({
        bid_winner_id: bidWinnerId,
        result: "FAILED",
        reason: message
      });
      errorLog("Winner order recovery error", {
        bidWinnerId,
        error: message
      });
    }
  }
  return {
    requested_winner_ids: targetWinnerIds,
    scanned: winners?.length || 0,
    candidates,
    recovered,
    already_had_order: alreadyHadOrder,
    skipped,
    failed,
    details,
    checked_at: new Date().toISOString()
  };
}
/* =========================================================
   LOCK EXPIRED OPEN ORDER GROUPS
   ========================================================= */ async function lockExpiredOpenOrderGroups() {
  const now = new Date();
  const { data: openGroups, error } = await supabase.from("order_groups").select("*").eq("group_status", "OPEN").is("locked_at", null);
  if (error) {
    throw new Error(`open order group lookup failed: ${error.message}`);
  }
  let locked = 0;
  for (const group of openGroups || []){
    const orderGroupWindowHours = await getClientNumberSetting(getString(group?.client_id), "ORDER_GROUP_WINDOW_HOURS", DEFAULT_ORDER_GROUP_WINDOW_HOURS);
    const createdAt = new Date(String(group?.created_at || ""));
    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }
    const expiresAt = new Date(createdAt.getTime() + orderGroupWindowHours * 60 * 60 * 1000);
    if (expiresAt.getTime() > now.getTime()) {
      continue;
    }
    const lockedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase.from("order_groups").update({
      locked_at: lockedAt,
      updated_at: lockedAt
    }).eq("order_group_id", group.order_group_id).eq("group_status", "OPEN").is("locked_at", null).select("order_group_id, group_number, buyer_fb_user_id, fb_page_id, environment, created_at, locked_at").maybeSingle();
    if (updateError) {
      throw new Error(`expired order group lock failed: ${updateError.message}`);
    }
    if (!updated) {
      continue;
    }
    locked += 1;
    log("ORDER GROUP WINDOW EXPIRED", {
      orderGroupId: updated.order_group_id,
      groupNumber: updated.group_number,
      buyerFbUserId: updated.buyer_fb_user_id,
      fbPageId: updated.fb_page_id,
      environment: updated.environment,
      createdAt: updated.created_at,
      lockedAt: updated.locked_at,
      windowHours: orderGroupWindowHours
    });
  }
  return {
    locked,
    checked_at: now.toISOString()
  };
}
/* =========================================================
   DELIVER GROUP PAYMENT CLAIM
   ========================================================= */ async function deliverOrderGroupPaymentClaim(claim, fbPageId, psid) {
  const orderGroupId = String(claim?.order_group_id || "");
  let group = await findOrderGroupById(orderGroupId);
  if (!group) {
    await sendMessengerMessage(fbPageId, psid, "This grouped auction checkout could not be found.");
    return;
  }
  if (String(group.fb_page_id || "") !== fbPageId) {
    return;
  }
  const totals = await recalculateOrderGroupTotals(orderGroupId);
  group = totals.group;
  const orders = totals.orders;
  if (orders.length === 0) {
    await sendMessengerMessage(fbPageId, psid, "There are no auction items in this checkout group.");
    return;
  }
  const itemLines = await buildOrderGroupItemLines(orders);
  const totalAmount = Number(group.total_amount || 0);
  const orderGroupWindowHours = await getClientNumberSetting(getString(group?.client_id), "orderGroupWindowHours", DEFAULT_ORDER_GROUP_WINDOW_HOURS);
  const createdAt = new Date(String(group.created_at || ""));
  const groupingEndsAt = Number.isNaN(createdAt.getTime()) ? null : new Date(createdAt.getTime() + orderGroupWindowHours * 60 * 60 * 1000);
  const groupLocked = Boolean(group.locked_at);
  const status = String(group.group_status || "").trim().toUpperCase();
  /*
   * Opening the Messenger link is REVIEW ONLY.
   *
   * It no longer locks the order group and no longer creates
   * PayMongo checkout automatically.
   *
   * The buyer must explicitly reply PAY.
   */ if (normalizeAuctionEnvironment(group?.environment) === "CLNT") {
    await sendMessengerMessage(fbPageId, psid, [
      "Ã°ÂÂÂ EO2MATE AUCTION SUMMARY",
      "",
      `Group: ${String(group.group_number || orderGroupId)}`,
      "",
      "Your won item(s):",
      ...itemLines,
      "",
      `Total: PHP ${totalAmount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      "",
      "Ã°ÂÂÂ¬ MANUAL PAYMENT MODE",
      "",
      "Online payment is not enabled for this auction.",
      "Please coordinate directly with the Page seller for payment instructions.",
      "",
      "Once the Page confirms your payment, EO2MATE will send you a payment-confirmed message here."
    ].join("\n"));
    log("CLNT MANUAL PAYMENT SUMMARY DELIVERED", {
      orderGroupId,
      groupNumber: group.group_number,
      itemCount: orders.length,
      totalAmount
    });
    return;
  }
  const lines = [
    "Ã°ÂÂÂ EO2MATE AUCTION CHECKOUT",
    "",
    `Group: ${String(group.group_number || orderGroupId)}`,
    "",
    "Your grouped auction wins:",
    ...itemLines,
    "",
    `Total: PHP ${totalAmount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  ];
  if (groupingEndsAt && !groupLocked) {
    lines.push("", `Grouping window ends: ${formatPhilippineDateTime(groupingEndsAt)}`, "", `You can keep winning more items from this Page for up to ${orderGroupWindowHours} hours from the first win.`);
  }
  if (status === "PAID") {
    lines.push("", "Ã¢ÂÂ This group is already paid.");
  } else if (status === "PAYMENT_PENDING") {
    lines.push("", "A payment checkout has already been created for this group.", "Reply PAY to receive the existing checkout link again.");
  } else {
    lines.push("", groupLocked ? `The ${orderGroupWindowHours}-hour grouping window has ended.` : "Opening this message does NOT lock your group.", "", "When you are ready to finalize this group and pay, reply:", "", "PAY", "", "After you reply PAY, this group will be locked and later wins will go to a new group.");
  }
  await sendMessengerMessage(fbPageId, psid, lines.join("\n"));
  log("GROUP PAYMENT CLAIM REVIEWED", {
    orderGroupId,
    groupNumber: group.group_number,
    itemCount: orders.length,
    totalAmount,
    locked: groupLocked,
    groupStatus: status,
    groupingEndsAt: groupingEndsAt?.toISOString() || null
  });
}
/* =========================================================
   DELIVER LEGACY WINNER CLAIM
   ========================================================= */ async function deliverLegacyWinnerPaymentClaim(claim, fbPageId, psid) {
  const bidWinnerId = String(claim?.bid_winner_id || "");
  const context = await findWinnerWithContext(bidWinnerId);
  if (!context) {
    await sendMessengerMessage(fbPageId, psid, "The auction winner could not be found.");
    return;
  }
  let payment = await findPaymentByWinnerId(bidWinnerId);
  if (!payment) {
    await createPaymentForWinner(bidWinnerId);
    payment = await findPaymentByWinnerId(bidWinnerId);
  }
  if (!payment) {
    throw new Error("Unable to retrieve payment.");
  }
  if (String(payment.status).toLowerCase() === "paid") {
    await sendMessengerMessage(fbPageId, psid, "Your auction payment is already confirmed. Thank you!");
    return;
  }
  await sendMessengerMessage(fbPageId, psid, [
    "Congratulations! Ã°ÂÂÂ",
    "",
    `You won the auction for ${context.item.item_label || "Auction Item"}.`,
    "",
    `Winning amount: PHP ${Number(payment.amount).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`,
    "",
    "Please complete your payment through the secure PayMongo / QRPh checkout link:",
    "",
    String(payment.checkout_url)
  ].join("\n"));
}
/* =========================================================
   EXPECTED FACEBOOK WINNER FOR CLAIM
   ========================================================= */ async function getExpectedClaimWinnerFbUserId(claim) {
  /* ---------------------------------------------------------
     GROUPED ORDER CLAIM
     --------------------------------------------------------- */ const orderGroupId = getString(claim?.order_group_id);
  if (orderGroupId) {
    const group = await findOrderGroupById(orderGroupId);
    if (!group) {
      return null;
    }
    return getString(group?.buyer_fb_user_id);
  }
  /* ---------------------------------------------------------
     LEGACY / SINGLE WINNER CLAIM
     --------------------------------------------------------- */ const bidWinnerId = getString(claim?.bid_winner_id);
  if (!bidWinnerId) {
    return null;
  }
  const context = await findWinnerWithContext(bidWinnerId);
  if (!context) {
    return null;
  }
  const winningBidId = getString(context?.winner?.bid_id);
  if (!winningBidId) {
    return null;
  }
  const winningBid = await findBidById(winningBidId);
  if (!winningBid) {
    return null;
  }
  return getString(winningBid?.fb_user_id);
}
/* =========================================================
   VERIFY MESSENGER CLAIM OWNER
   ========================================================= */ async function verifyMessengerClaimOwner(claim, fbPageId, psid) {
  const expectedWinnerFbUserId = await getExpectedClaimWinnerFbUserId(claim);
  if (!expectedWinnerFbUserId) {
    errorLog("MESSENGER CLAIM WINNER COULD NOT BE RESOLVED", {
      claimId: claim?.claim_id,
      orderGroupId: claim?.order_group_id || null,
      bidWinnerId: claim?.bid_winner_id || null,
      fbPageId,
      psid
    });
    await sendMessengerMessage(fbPageId, psid, [
      "EO2MATE could not verify the auction winner for this payment link.",
      "",
      "The payment claim has not been used.",
      "",
      "Please contact the Page for assistance."
    ].join("\\n"));
    return false;
  }
  /*
   * SECURITY RULE:
   *
   * Never let the first Messenger user who opens a referral
   * become the owner automatically. The Messenger sender must
   * match the Facebook user stored for the auction winner.
   *
   * If Meta ever returns different ID namespaces for a real
   * winner, this check fails CLOSED: no claim fields are
   * changed and the token remains reusable after identity
   * mapping is corrected.
   */ if (String(expectedWinnerFbUserId) !== String(psid)) {
    log("MESSENGER CLAIM REJECTED - USER IS NOT WINNER", {
      claimId: claim?.claim_id,
      orderGroupId: claim?.order_group_id || null,
      bidWinnerId: claim?.bid_winner_id || null,
      expectedWinnerFbUserId,
      attemptedPsid: psid,
      fbPageId
    });
    await sendMessengerMessage(fbPageId, psid, [
      "This payment link is reserved for the auction winner.",
      "",
      "This Messenger account is not the winner of this auction.",
      "",
      "The winner can still use the original payment link."
    ].join("\\n"));
    return false;
  }
  return true;
}
/* =========================================================
   DELIVER PAYMENT CLAIM
   ========================================================= */ async function deliverPaymentClaim(claimToken, fbPageId, psid) {
  let claim = await findMessengerClaim(claimToken);
  if (!claim) {
    await sendMessengerMessage(fbPageId, psid, "This payment link is invalid or no longer available.");
    return;
  }
  if (String(claim.fb_page_id || "") !== String(fbPageId)) {
    errorLog("MESSENGER CLAIM PAGE MISMATCH", {
      claimId: claim?.claim_id,
      claimPageId: claim?.fb_page_id,
      requestPageId: fbPageId,
      psid
    });
    return;
  }
  const expiresAt = claim?.expires_at ? new Date(claim.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    await sendMessengerMessage(fbPageId, psid, "This payment link has expired. Please contact the Page for assistance.");
    return;
  }
  /* ---------------------------------------------------------
     VERIFY WINNER BEFORE CHANGING THE CLAIM
     --------------------------------------------------------- */ const authorized = await verifyMessengerClaimOwner(claim, fbPageId, psid);
  if (!authorized) {
    /*
     * Critical security behavior:
     * no claimed_psid / claimed_at update occurs here.
     */ return;
  }
  /* ---------------------------------------------------------
     EXISTING CLAIM OWNER
     --------------------------------------------------------- */ if (claim.claimed_psid) {
    if (String(claim.claimed_psid) === String(psid)) {
      log("MESSENGER CLAIM REOPENED BY WINNER", {
        claimId: claim?.claim_id,
        orderGroupId: claim?.order_group_id || null,
        bidWinnerId: claim?.bid_winner_id || null,
        psid
      });
    /* Same verified winner may reuse the original link. */ } else {
      /* Defense in depth. */ errorLog("MESSENGER CLAIM OWNER CONFLICT", {
        claimId: claim?.claim_id,
        existingClaimedPsid: claim?.claimed_psid,
        attemptedPsid: psid
      });
      await sendMessengerMessage(fbPageId, psid, "This payment claim is linked to another Messenger account. Please contact the Page for assistance.");
      return;
    }
  } else {
    /* -------------------------------------------------------
       FIRST VALID CLAIM BY THE VERIFIED WINNER
       ------------------------------------------------------- */ const bound = await bindClaimToPsid(String(claim.claim_id), psid);
    if (bound) {
      claim = bound;
      log("MESSENGER CLAIM BOUND TO VERIFIED WINNER", {
        claimId: claim?.claim_id,
        orderGroupId: claim?.order_group_id || null,
        bidWinnerId: claim?.bid_winner_id || null,
        psid
      });
    } else {
      /*
       * Race protection: another webhook delivery may have
       * reached the same token at the same time.
       */ const latest = await findMessengerClaim(claimToken);
      if (!latest) {
        await sendMessengerMessage(fbPageId, psid, "This payment claim is no longer available.");
        return;
      }
      const latestAuthorized = await verifyMessengerClaimOwner(latest, fbPageId, psid);
      if (!latestAuthorized) {
        return;
      }
      if (String(latest?.claimed_psid || "") !== String(psid)) {
        errorLog("MESSENGER CLAIM RACE CONFLICT", {
          claimId: latest?.claim_id,
          attemptedPsid: psid,
          storedPsid: latest?.claimed_psid || null
        });
        await sendMessengerMessage(fbPageId, psid, "EO2MATE could not complete the payment claim. Please tap the winner link again.");
        return;
      }
      claim = latest;
    }
  }
  /* ---------------------------------------------------------
     GROUPED AUCTION PAYMENT
     --------------------------------------------------------- */ if (claim.order_group_id) {
    await deliverOrderGroupPaymentClaim(claim, fbPageId, psid);
    return;
  }
  /* ---------------------------------------------------------
     LEGACY / SINGLE WINNER PAYMENT
     --------------------------------------------------------- */ await deliverLegacyWinnerPaymentClaim(claim, fbPageId, psid);
}
/* =========================================================
   FIND LATEST GROUP CLAIM BY PSID
   ========================================================= */ async function findLatestGroupClaimByPsid(fbPageId, psid) {
  const { data, error } = await supabase.from("messenger_payment_claims").select("*").eq("fb_page_id", fbPageId).eq("claimed_psid", psid).not("order_group_id", "is", null).order("claimed_at", {
    ascending: false
  }).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`group claim by PSID lookup failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   PROCEED GROUP TO PAYMENT
   ========================================================= */ async function proceedOrderGroupToPayment(claim, fbPageId, psid, forceRefresh = false) {
  const orderGroupId = String(claim?.order_group_id || "");
  if (!orderGroupId) {
    await sendMessengerMessage(fbPageId, psid, "No EO2MATE order group is linked to this conversation.");
    return;
  }
  let group = await findOrderGroupById(orderGroupId);
  if (!group) {
    await sendMessengerMessage(fbPageId, psid, "Your EO2MATE order group could not be found.");
    return;
  }
  if (String(group.fb_page_id || "") !== fbPageId) {
    return;
  }
  const status = String(group.group_status || "").trim().toUpperCase();
  if (normalizeAuctionEnvironment(group?.environment) === "CLNT") {
    await sendMessengerMessage(fbPageId, psid, [
      "Ã°ÂÂÂ¬ Manual payment mode",
      "",
      "This auction does not use the online payment gateway.",
      "Please coordinate directly with the Page seller for payment instructions.",
      "",
      "EO2MATE will notify you here once the Page confirms your payment."
    ].join("\n"));
    return;
  }
  if (status === "PAID") {
    await sendMessengerMessage(fbPageId, psid, "Ã¢ÂÂ This grouped auction order is already paid. Thank you!");
    return;
  }
  /*
   * Recalculate immediately before checkout so the amount
   * includes every win added before PAY was received.
   */ const totals = await recalculateOrderGroupTotals(orderGroupId);
  group = totals.group;
  if (totals.orders.length === 0) {
    await sendMessengerMessage(fbPageId, psid, "This order group has no payable auction items.");
    return;
  }
  /*
   * If not already locked by 24-hour expiry, PAY locks it now.
   */ if (!group.locked_at) {
    group = await lockOrderGroupForCheckout(orderGroupId);
  }
  if (!group) {
    throw new Error("Unable to lock order group for payment.");
  }
  const paymentResult = await createPaymentForOrderGroup(orderGroupId, forceRefresh);
  const checkoutUrl = getCheckoutUrlFromPaymentResult(paymentResult);
  if (!checkoutUrl) {
    throw new Error(`Grouped create-payment did not return checkout URL: ${JSON.stringify(paymentResult)}`);
  }
  const finalGroup = await findOrderGroupById(orderGroupId);
  const itemLines = await buildOrderGroupItemLines(totals.orders);
  const totalAmount = Number(finalGroup?.total_amount ?? group.total_amount ?? 0);
  await sendMessengerMessage(fbPageId, psid, [
    forceRefresh ? "Ã°ÂÂÂ NEW PAYMENT QR READY" : "Ã°ÂÂÂ³ EO2MATE PAYMENT READY",
    "",
    `Group: ${String(group.group_number || orderGroupId)}`,
    "",
    "Items:",
    ...itemLines,
    "",
    `Total: PHP ${totalAmount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`,
    "",
    forceRefresh ? "Your previous checkout was replaced. Use this new secure PayMongo / QRPh link:" : "Complete payment using the secure PayMongo / QRPh checkout link:",
    "",
    checkoutUrl,
    "",
    "This group is locked. Any later auction wins will be placed in a new group."
  ].join("\n"));
  log("ORDER GROUP PAYMENT STARTED BY BUYER", {
    orderGroupId,
    groupNumber: group.group_number,
    itemCount: totals.orders.length,
    totalAmount,
    lockedAt: group.locked_at
  });
}
/* =========================================================
   MESSENGER REFERRAL TOKEN
   ========================================================= */ function getReferralToken(event) {
  const values = [
    event?.referral?.ref,
    event?.postback?.referral?.ref,
    event?.message?.referral?.ref
  ];
  for (const value of values){
    if (value) {
      return String(value);
    }
  }
  return null;
}
/* =========================================================
   CLNT MANUAL PAYMENT
   ========================================================= */ async function findLatestGroupClaimForBuyer(fbPageId, buyerPsid) {
  const { data, error } = await supabase.from("messenger_payment_claims").select("*").eq("fb_page_id", fbPageId).eq("claimed_psid", buyerPsid).not("order_group_id", "is", null).order("claimed_at", {
    ascending: false
  }).order("created_at", {
    ascending: false
  }).limit(1).maybeSingle();
  if (error) {
    throw new Error(`buyer group claim lookup failed: ${error.message}`);
  }
  return data;
}
async function findOrderGroupByReference(fbPageId, reference, buyerPsid) {
  if (reference) {
    const normalized = String(reference).trim();
    let query = supabase.from("order_groups").select("*").eq("fb_page_id", fbPageId);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
      query = query.eq("order_group_id", normalized);
    } else {
      query = query.eq("group_number", normalized);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`manual payment group lookup failed: ${error.message}`);
    }
    return data;
  }
  if (buyerPsid) {
    const claim = await findLatestGroupClaimForBuyer(fbPageId, buyerPsid);
    if (claim?.order_group_id) {
      return await findOrderGroupById(String(claim.order_group_id));
    }
  }
  return null;
}
async function findGroupOrdersIncludingCancelled(orderGroupId) {
  const { data, error } = await supabase.from("orders").select("*").eq("order_group_id", orderGroupId);
  if (error) {
    throw new Error(`manual payment group orders lookup failed: ${error.message}`);
  }
  return data || [];
}
async function markClntGroupPaid(group, fbPageId) {
  const environment = normalizeAuctionEnvironment(group?.environment);
  if (environment !== "CLNT") {
    throw new Error("Manual PAID is allowed only for EO2MATE-CLNT groups.");
  }
  const status = String(group?.group_status || "").trim().toUpperCase();
  if (status === "PAID") {
    return {
      group,
      alreadyPaid: true
    };
  }
  if ([
    "CANCELLED",
    "READY_FOR_DELIVERY"
  ].includes(status)) {
    throw new Error(`Group cannot be manually marked paid from status ${status}.`);
  }
  const now = new Date().toISOString();
  const { data: updatedGroup, error: groupError } = await supabase.from("order_groups").update({
    group_status: "PAID",
    locked_at: group?.locked_at || now,
    manual_paid_at: now,
    manual_paid_by_fb_page_id: fbPageId,
    manual_payment_note: "Confirmed by PAGE_ONLY Messenger command",
    updated_at: now
  }).eq("order_group_id", group.order_group_id).select("*").single();
  if (groupError) {
    throw new Error(`CLNT group PAID update failed: ${groupError.message}`);
  }
  const orders = await findGroupOrdersIncludingCancelled(group.order_group_id);
  const activeOrders = orders.filter((order)=>String(order?.order_status || "").trim().toUpperCase() !== "CANCELLED");
  if (activeOrders.length > 0) {
    const { error: orderError } = await supabase.from("orders").update({
      payment_status: "PAID",
      paid_at: now,
      updated_at: now
    }).eq("order_group_id", group.order_group_id).neq("order_status", "CANCELLED");
    if (orderError) {
      throw new Error(`CLNT order payment update failed: ${orderError.message}`);
    }
  }
  const winnerIds = Array.from(new Set(activeOrders.map((order)=>getString(order?.bid_winner_id)).filter((value)=>Boolean(value))));
  if (winnerIds.length > 0) {
    const { error: winnerError } = await supabase.from("auction_winners").update({
      status: "CONFIRMED"
    }).in("bid_winner_id", winnerIds).neq("status", "CANCELLED");
    if (winnerError) {
      throw new Error(`CLNT winners confirmation failed: ${winnerError.message}`);
    }
  }
  await supabase.from("payment_admin_actions").insert({
    client_id: group.client_id,
    order_group_id: group.order_group_id,
    action: "MARK_MANUAL_PAID",
    reason: "PAGE_ONLY Messenger command",
    performed_by_fb_page_id: fbPageId,
    action_source: "MESSENGER_PAGE_COMMAND"
  });
  return {
    group: updatedGroup,
    alreadyPaid: false
  };
}
async function reverseClntGroupPaid(group, fbPageId) {
  const environment = normalizeAuctionEnvironment(group?.environment);
  if (environment !== "CLNT") {
    throw new Error("Manual UNPAID is allowed only for EO2MATE-CLNT groups.");
  }
  const status = String(group?.group_status || "").trim().toUpperCase();
  if (status !== "PAID") {
    throw new Error("Only a manually paid CLNT group can be reversed.");
  }
  const { data: delivery, error: deliveryError } = await supabase.from("deliveries").select("delivery_id, delivery_status").eq("order_group_id", group.order_group_id).limit(1).maybeSingle();
  if (deliveryError) {
    throw new Error(`delivery safety lookup failed: ${deliveryError.message}`);
  }
  if (delivery) {
    throw new Error("Manual payment cannot be reversed after a delivery record exists.");
  }
  const now = new Date().toISOString();
  const { data: updatedGroup, error: groupError } = await supabase.from("order_groups").update({
    group_status: "PAYMENT_PENDING",
    manual_paid_at: null,
    manual_paid_by_fb_page_id: null,
    manual_payment_note: "Manual payment reversed by PAGE_ONLY Messenger command",
    updated_at: now
  }).eq("order_group_id", group.order_group_id).select("*").single();
  if (groupError) {
    throw new Error(`CLNT group UNPAID update failed: ${groupError.message}`);
  }
  const { error: orderError } = await supabase.from("orders").update({
    payment_status: "PENDING",
    paid_at: null,
    updated_at: now
  }).eq("order_group_id", group.order_group_id).neq("order_status", "CANCELLED");
  if (orderError) {
    throw new Error(`CLNT order UNPAID update failed: ${orderError.message}`);
  }
  const orders = await findGroupOrdersIncludingCancelled(group.order_group_id);
  const winnerIds = Array.from(new Set(orders.filter((order)=>String(order?.order_status || "").trim().toUpperCase() !== "CANCELLED").map((order)=>getString(order?.bid_winner_id)).filter((value)=>Boolean(value))));
  if (winnerIds.length > 0) {
    const { error: winnerError } = await supabase.from("auction_winners").update({
      status: "PENDING"
    }).in("bid_winner_id", winnerIds).eq("status", "CONFIRMED");
    if (winnerError) {
      throw new Error(`CLNT winners UNPAID update failed: ${winnerError.message}`);
    }
  }
  await supabase.from("payment_admin_actions").insert({
    client_id: group.client_id,
    order_group_id: group.order_group_id,
    action: "REVERSE_MANUAL_PAID",
    reason: "PAGE_ONLY Messenger command",
    performed_by_fb_page_id: fbPageId,
    action_source: "MESSENGER_PAGE_COMMAND"
  });
  return {
    group: updatedGroup
  };
}
function findCommandDefinitionWithArgument(definitions, text, allowedScopes) {
  const normalized = normalizeMessengerCommand(text);
  const candidates = definitions.filter((definition)=>definition.isActive && allowedScopes.includes(definition.senderScope)).sort((first, second)=>second.commandText.length - first.commandText.length);
  for (const definition of candidates){
    if (normalized === definition.commandText) {
      return {
        definition,
        argument: null
      };
    }
    if (normalized.startsWith(`${definition.commandText} `)) {
      return {
        definition,
        argument: normalized.slice(definition.commandText.length).trim() || null
      };
    }
  }
  return null;
}
async function processPageOnlyMessagingCommand(entryId, event) {
  const fbPageId = String(entryId || "");
  const senderId = String(event?.sender?.id || "");
  const buyerPsid = String(event?.recipient?.id || "");
  const text = String(event?.message?.text || "").trim();
  if (!fbPageId || senderId !== fbPageId || !buyerPsid || !text) {
    return false;
  }
  const claim = await findLatestGroupClaimForBuyer(fbPageId, buyerPsid);
  if (!claim?.order_group_id) {
    return false;
  }
  const group = await findOrderGroupById(String(claim.order_group_id));
  if (!group || normalizeAuctionEnvironment(group?.environment) !== "CLNT") {
    return false;
  }
  const definitions = await getMessengerCommandDefinitions(getString(group?.client_id));
  const resolved = findCommandDefinitionWithArgument(definitions, text, [
    "PAGE_ONLY",
    "BOTH"
  ]);
  if (!resolved) {
    return false;
  }
  const actionCode = resolved.definition.actionCode;
  let targetGroup = group;
  if (resolved.argument) {
    const explicitGroup = await findOrderGroupByReference(fbPageId, resolved.argument, buyerPsid);
    if (!explicitGroup) {
      await sendMessengerMessage(fbPageId, buyerPsid, `Unable to find EO2MATE order group ${resolved.argument}.`);
      return true;
    }
    targetGroup = explicitGroup;
  }
  if (normalizeAuctionEnvironment(targetGroup?.environment) !== "CLNT") {
    await sendMessengerMessage(fbPageId, buyerPsid, "This Page-only manual payment command can only be used for EO2MATE-CLNT auctions.");
    return true;
  }
  if (actionCode === "MARK_MANUAL_PAID") {
    const result = await markClntGroupPaid(targetGroup, fbPageId);
    await sendMessengerMessage(fbPageId, buyerPsid, [
      "Payment confirmed Ã¢ÂÂ",
      "",
      result.alreadyPaid ? "This manual-payment order was already marked as paid." : "The Page has confirmed receipt of your manual payment.",
      "",
      `Order Group: ${String(targetGroup.group_number || targetGroup.order_group_id)}`,
      "",
      "Thank you!"
    ].join("\n"));
    log("CLNT MANUAL PAYMENT MARKED PAID", {
      orderGroupId: targetGroup.order_group_id,
      groupNumber: targetGroup.group_number,
      fbPageId,
      buyerPsid
    });
    return true;
  }
  if (actionCode === "REVERSE_MANUAL_PAID") {
    await reverseClntGroupPaid(targetGroup, fbPageId);
    await sendMessengerMessage(fbPageId, buyerPsid, [
      "Payment status updated.",
      "",
      "The Page has reversed the manual payment confirmation for this order.",
      "",
      `Order Group: ${String(targetGroup.group_number || targetGroup.order_group_id)}`,
      "",
      "Please coordinate with the Page if you need assistance."
    ].join("\n"));
    log("CLNT MANUAL PAYMENT REVERSED", {
      orderGroupId: targetGroup.order_group_id,
      groupNumber: targetGroup.group_number,
      fbPageId,
      buyerPsid
    });
    return true;
  }
  return false;
}
/* =========================================================
   MESSENGER EVENT
   ========================================================= */ async function processMessagingEvent(entryId, event) {
  const isEcho = event?.message?.is_echo === true;
  /*
   * Incoming buyer message:
   *   entry.id = Page
   *   sender.id = buyer
   *   recipient.id = Page
   *
   * Page-sent echo:
   *   entry.id = Page
   *   sender.id = Page
   *   recipient.id = buyer
   */ if (isEcho) {
    await processPageOnlyMessagingCommand(entryId, event);
    return;
  }
  const fbPageId = event?.recipient?.id ? String(event.recipient.id) : String(entryId || "");
  const psid = event?.sender?.id ? String(event.sender.id) : "";
  if (!fbPageId || !psid) {
    return;
  }
  const referralToken = getReferralToken(event);
  if (referralToken) {
    log("Messenger referral received", {
      fbPageId,
      psid
    });
    await deliverPaymentClaim(referralToken, fbPageId, psid);
    return;
  }
  const text = String(event?.message?.text || "").trim();
  if (text) {
    log("Incoming Messenger message", {
      fbPageId,
      psid,
      text
    });
    /*
     * Strict setup-driven command handling only applies when
     * this Messenger user is already bound to an EO2MATE
     * grouped-payment claim.
     *
     * Ordinary Page conversations with no active EO2MATE
     * transaction are ignored by this command router.
     */ const groupClaim = await findLatestGroupClaimByPsid(fbPageId, psid);
    if (!groupClaim) {
      return;
    }
    const orderGroupId = getString(groupClaim?.order_group_id);
    if (!orderGroupId) {
      return;
    }
    const orderGroup = await findOrderGroupById(orderGroupId);
    if (!orderGroup) {
      return;
    }
    const clientId = getString(orderGroup?.client_id);
    const definitions = await getMessengerCommandDefinitions(clientId);
    const normalizedCommand = normalizeMessengerCommand(text);
    const definition = definitions.find((candidate)=>candidate.commandText === normalizedCommand && [
        "BUYER",
        "BOTH"
      ].includes(candidate.senderScope));
    if (!definition || !definition.isActive) {
      const replyEnabled = await getClientBooleanSetting(clientId, "INVALID_COMMAND_REPLY_ENABLED", true);
      if (replyEnabled) {
        await sendMessengerMessage(fbPageId, psid, [
          "Ã¢ÂÂ Command not recognized.",
          "",
          buildAvailableCommandMessage(definitions)
        ].join("\n"));
      }
      log("Messenger command rejected - not configured", {
        fbPageId,
        psid,
        clientId,
        command: normalizedCommand
      });
      return;
    }
    const actionCode = definition.actionCode;
    if (actionCode === "START_PAYMENT") {
      await proceedOrderGroupToPayment(groupClaim, fbPageId, psid, false);
      return;
    }
    if (actionCode === "REFRESH_PAYMENT") {
      await proceedOrderGroupToPayment(groupClaim, fbPageId, psid, true);
      return;
    }
    if (actionCode === "HELP") {
      await sendMessengerMessage(fbPageId, psid, buildAvailableCommandMessage(definitions));
      return;
    }
    errorLog("Configured Messenger command has unsupported action", {
      clientId,
      command: normalizedCommand,
      actionCode
    });
    await sendMessengerMessage(fbPageId, psid, "This EO2MATE command is configured but is not currently available.");
    return;
  }
}
async function facebookGetJson(path, accessToken) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://graph.facebook.com/v23.0/${path}${separator}access_token=${encodeURIComponent(accessToken)}`, {
    method: "GET"
  });
  const responseText = await response.text();
  let result = {};
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch  {
    result = {
      raw: responseText
    };
  }
  if (!response.ok || result?.error) {
    throw new Error(`Meta Graph GET failed (${response.status}): ${JSON.stringify(result)}`);
  }
  return result;
}
/* =========================================================
   FACEBOOK FEED POST HYDRATION
   ========================================================= */ async function hydrateFacebookFeedPost(entryPageId, value) {
  const fbPostId = getString(value?.post_id) || getString(value?.parent_id);
  if (!fbPostId) {
    return {
      ...value,
      from: value?.from || {
        id: entryPageId
      }
    };
  }
  /*
   * Meta feed webhooks do not always include the full main-post
   * message for API-created multi-photo posts. In particular,
   * the feed item may be reported as "photo" even though the
   * parent object is the auction Page post.
   *
   * Hydrate the final Page post from Graph before parsing it.
   */ const { data: page, error: pageError } = await supabase.from("fb_pages").select("*").eq("fb_page_id", entryPageId).maybeSingle();
  if (pageError) {
    throw new Error(`Facebook Page hydration lookup failed: ${pageError.message}`);
  }
  const pageAccessToken = getString(page?.access_token);
  if (!pageAccessToken) {
    log("Feed post hydration skipped - Page token unavailable", {
      entryPageId,
      fbPostId,
      item: value?.item,
      verb: value?.verb
    });
    return {
      ...value,
      from: value?.from || {
        id: entryPageId
      }
    };
  }
  try {
    const hydrated = await facebookGetJson(`${encodeURIComponent(fbPostId)}?fields=id,message,from{id,name},permalink_url,created_time`, pageAccessToken);
    return {
      ...value,
      post_id: getString(hydrated?.id) || fbPostId,
      message: getString(hydrated?.message) || getString(value?.message) || "",
      from: hydrated?.from || value?.from || {
        id: entryPageId
      },
      permalink_url: hydrated?.permalink_url || value?.permalink_url,
      created_time: hydrated?.created_time || value?.created_time
    };
  } catch (error) {
    errorLog("Feed post hydration failed", {
      entryPageId,
      fbPostId,
      item: value?.item,
      verb: value?.verb,
      error: getErrorMessage(error)
    });
    /*
     * Fall back to the webhook payload. This keeps manually-created
     * posts working even if Graph hydration temporarily fails.
     */ return {
      ...value,
      from: value?.from || {
        id: entryPageId
      }
    };
  }
}
/* =========================================================
   PROCESS AUCTION POST
   ========================================================= */ async function processPost(value) {
  const fbPostId = value?.post_id ? String(value.post_id) : "";
  const message = String(value?.message || "");
  if (!fbPostId) {
    return;
  }
  const environment = getAuctionEnvironmentFromCaption(message);
  if (!environment) {
    log("Facebook post ignored - missing or ambiguous EO2MATE environment code", {
      fbPostId
    });
    return;
  }
  const postTypeConfig = await getAuctionPostTypeConfigFromCaption(message);
  if (!postTypeConfig) {
    return;
  }
  const parsed = parseAuctionCaption(message);
  parsed.postType = postTypeConfig.post_type_code;
  const isMultiplePost = postTypeConfig.is_multiple;
  const fbPageId = String(value?.from?.id || "");
  if (!fbPageId) {
    throw new Error("Cannot determine Facebook Page ID.");
  }
  const { data: fbPage, error: pageError } = await supabase.from("fb_pages").select("*").eq("fb_page_id", fbPageId).maybeSingle();
  if (pageError) {
    throw new Error(`fb_pages lookup failed: ${pageError.message}`);
  }
  if (!fbPage) {
    throw new Error(`Facebook Page ${fbPageId} is not registered.`);
  }
  const baseAutomationState = await getBaseAutomationState(String(fbPage.client_id), fbPageId);
  if (!baseAutomationState.enabled) {
    log("Facebook auction post ignored - automation suspended", {
      fbPostId,
      fbPageId,
      clientId: fbPage.client_id,
      blockedBy: baseAutomationState.blockedBy,
      reason: baseAutomationState.reason
    });
    return;
  }
  const entitlement = await isClientEnvironmentAllowed(String(fbPage.client_id), environment);
  if (!entitlement.allowed) {
    errorLog("Facebook auction post rejected - environment not allowed", {
      fbPostId,
      fbPageId,
      clientId: fbPage.client_id,
      requestedEnvironment: environment,
      allowedEnvironment: entitlement.subscription?.allowed_environment || null,
      subscriptionStatus: entitlement.subscription?.subscription_status || null,
      reason: entitlement.reason
    });
    /*
     * Page-generated post; give a visible Page-side explanation
     * without creating an auction row.
     */ await postFacebookComment(fbPageId, fbPostId, [
      "EO2MATE auction was not activated.",
      "",
      entitlement.reason || "This environment is not enabled for the client account.",
      "",
      "Please contact the EO2MATE administrator if you need a different plan/mode."
    ].join("\n"));
    return;
  }
  let auctionPost = await findAuctionPost(fbPostId);
  if (auctionPost) {
    const existingAutomationState = await getAuctionAutomationState(auctionPost);
    if (!existingAutomationState.enabled) {
      log("Existing auction post sync ignored - automation suspended", {
        fbPostId,
        blockedBy: existingAutomationState.blockedBy,
        reason: existingAutomationState.reason
      });
      return;
    }
  }
  if (!auctionPost) {
    const { data, error } = await supabase.from("auction_posts").insert({
      client_id: fbPage.client_id,
      fb_page_id: fbPageId,
      fb_post_id: fbPostId,
      post_type: parsed.postType,
      caption: message,
      environment: environment,
      status: "ACTIVE"
    }).select("*").single();
    if (error) {
      throw new Error(`auction_posts insert failed: ${error.message}`);
    }
    auctionPost = data;
  } else {
    const storedEnvironment = normalizeAuctionEnvironment(auctionPost.environment);
    if (storedEnvironment && storedEnvironment !== environment) {
      errorLog("Auction environment change rejected", {
        fbPostId,
        storedEnvironment,
        requestedEnvironment: environment
      });
      return;
    }
    const storedPostType = String(auctionPost.post_type || "").trim().toUpperCase();
    if (storedPostType && storedPostType !== parsed.postType && String(auctionPost.status || "").toUpperCase() === "ACTIVE") {
      throw new Error("Auction type cannot be changed while the auction is active.");
    }
    const { data, error } = await supabase.from("auction_posts").update({
      caption: message,
      post_type: parsed.postType,
      environment: storedEnvironment || environment
    }).eq("post_id", auctionPost.post_id).select("*").maybeSingle();
    if (error) {
      throw new Error(`auction_posts sync failed: ${error.message}`);
    }
    if (data) {
      auctionPost = data;
    }
  }
  /* =======================================================
     SINGLE AUCTION
     ======================================================= */ if (!isMultiplePost) {
    if (!parsed.item) {
      throw new Error("Auction post has no Item field.");
    }
    if (parsed.minBid === null) {
      throw new Error("Auction post has no valid Minimum Bid.");
    }
    if (parsed.increment === null) {
      throw new Error("Auction post has no valid Increment.");
    }
    if (!parsed.auctionEnds) {
      throw new Error("Auction post has no valid Auction Ends date/time.");
    }
    let auctionItem = await findAuctionItemByNumber(auctionPost.post_id, 1);
    if (!auctionItem) {
      /*
       * Backward compatibility for existing single-auction
       * rows created before item_no was introduced.
       */ auctionItem = await findAuctionItem(auctionPost.post_id);
    }
    if (!auctionItem) {
      const { data, error } = await supabase.from("auction_items").insert({
        auction_post_id: auctionPost.post_id,
        item_no: 1,
        fb_object_id: fbPostId,
        item_label: parsed.item,
        status: "ACTIVE",
        min_bidder_reached_at: null,
        last_status_comment_at: null,
        one_hour_warning_sent_at: null,
        five_min_warning_sent_at: null,
        buyout_window_ended_announced_at: null
      }).select("*").single();
      if (error) {
        throw new Error(`auction_items insert failed: ${error.message}`);
      }
      auctionItem = data;
    } else {
      const { data, error } = await supabase.from("auction_items").update({
        item_no: 1,
        fb_object_id: fbPostId,
        item_label: parsed.item
      }).eq("auction_item_id", auctionItem.auction_item_id).select("*").maybeSingle();
      if (error) {
        throw new Error(`auction_items sync failed: ${error.message}`);
      }
      if (data) {
        auctionItem = data;
      }
    }
    let auctionRule = await findAuctionRule(auctionItem.auction_item_id);
    if (!auctionRule) {
      auctionRule = await createAuctionRule(auctionItem.auction_item_id, parsed);
    } else if (auctionItem.status === "ACTIVE") {
      auctionRule = await syncAuctionRule(auctionItem.auction_item_id, parsed);
    }
    log("SINGLE AUCTION CREATED / SYNCHRONIZED", {
      fbPostId,
      environment: getAuctionEnvironment(auctionPost),
      auctionItemId: auctionItem.auction_item_id,
      item: parsed.item,
      minBid: parsed.minBid,
      increment: parsed.increment,
      auctionEndsUtc: parsed.auctionEnds
    });
    return;
  }
  /* =======================================================
     MULTIPLE AUCTION
     ======================================================= */ /*
   * The main post contains the shared/default rules.
   *
   * The number of auction items comes directly from the
   * number of Facebook photo objects attached to the post.
   */ const mainRules = parsed;
  /*
   * Main rules themselves do not need to contain every field
   * as long as a missing required field is supplied by a
   * specific photo override.
   */ const facebookPhotos = await getFacebookPostPhotos(fbPageId, fbPostId);
  if (facebookPhotos.length === 0) {
    throw new Error("Multiple auction has no Facebook photo objects.");
  }
  for(let index = 0; index < facebookPhotos.length; index++){
    const itemNo = index + 1;
    const facebookPhoto = facebookPhotos[index];
    const fbObjectId = facebookPhoto.objectId;
    const photoCaption = await resolveFacebookPhotoCaption(fbPageId, facebookPhoto, itemNo, fbPostId);
    const photoRules = parseAuctionCaption(photoCaption);
    const effectiveRules = mergeAuctionRules(mainRules, photoRules, itemNo);
    validateEffectiveMultipleRules(effectiveRules, itemNo);
    let auctionItem = await findAuctionItemByNumber(auctionPost.post_id, itemNo);
    if (!auctionItem) {
      const { data, error } = await supabase.from("auction_items").insert({
        auction_post_id: auctionPost.post_id,
        item_no: itemNo,
        fb_object_id: fbObjectId,
        item_label: effectiveRules.item,
        status: "ACTIVE",
        min_bidder_reached_at: null,
        last_status_comment_at: null,
        one_hour_warning_sent_at: null,
        five_min_warning_sent_at: null,
        buyout_window_ended_announced_at: null
      }).select("*").single();
      if (error) {
        throw new Error(`Multiple auction Item ${itemNo} insert failed: ${error.message}`);
      }
      auctionItem = data;
    } else if (String(auctionItem.status || "").toUpperCase() === "ACTIVE") {
      const { data, error } = await supabase.from("auction_items").update({
        fb_object_id: fbObjectId,
        item_label: effectiveRules.item
      }).eq("auction_item_id", auctionItem.auction_item_id).select("*").maybeSingle();
      if (error) {
        throw new Error(`Multiple auction Item ${itemNo} sync failed: ${error.message}`);
      }
      if (data) {
        auctionItem = data;
      }
    }
    let auctionRule = await findAuctionRule(auctionItem.auction_item_id);
    if (!auctionRule) {
      auctionRule = await createAuctionRule(auctionItem.auction_item_id, effectiveRules);
    } else if (String(auctionItem.status || "").toUpperCase() === "ACTIVE") {
      auctionRule = await syncAuctionRule(auctionItem.auction_item_id, effectiveRules);
    }
    log("MULTIPLE AUCTION ITEM CREATED / SYNCHRONIZED", {
      fbPostId,
      itemNo,
      auctionItemId: auctionItem.auction_item_id,
      fbObjectId,
      item: effectiveRules.item,
      photoCaption: photoCaption || null,
      parsedPhotoOverrides: {
        item: photoRules.item,
        minBid: photoRules.minBid,
        increment: photoRules.increment,
        minimumBidders: photoRules.minBidderCount,
        buyout: photoRules.buyout,
        buyoutUntil: photoRules.buyoutUntil,
        auctionEnds: photoRules.auctionEnds,
        bidCutoffMinutes: photoRules.bidCutoffMinutes,
        antiSniperMinutes: photoRules.antiSniperMinutes
      },
      inheritedFromMain: !photoCaption,
      minBid: effectiveRules.minBid,
      increment: effectiveRules.increment,
      minimumBidders: effectiveRules.minBidderCount ?? 1,
      buyout: effectiveRules.buyout,
      buyoutUntilUtc: effectiveRules.buyoutUntil,
      auctionEndsUtc: effectiveRules.auctionEnds,
      bidCutoffMinutes: effectiveRules.bidCutoffMinutes ?? 60,
      antiSniperMinutes: effectiveRules.antiSniperMinutes ?? 0
    });
  }
  log("MULTIPLE AUCTION CREATED / SYNCHRONIZED", {
    fbPostId,
    environment: getAuctionEnvironment(auctionPost),
    itemCount: facebookPhotos.length
  });
}
/* =========================================================
   PROCESS COMMENT / BID
   ========================================================= */ async function processComment(value) {
  const commentId = value?.comment_id ? String(value.comment_id) : "";
  const fbPostId = value?.post_id ? String(value.post_id) : "";
  const message = String(value?.message || "").trim();
  if (!commentId || !fbPostId || !message) {
    return;
  }
  const fbUserId = value?.from?.id ? String(value.from.id) : null;
  const fbUserName = value?.from?.name ? String(value.from.name) : null;
  /*
   * First try the webhook's post_id as a parent auction post.
   */ let auctionPost = await findAuctionPost(fbPostId);
  /*
   * PAGE-ONLY MAIN-POST CONTROL COMMANDS
   *
   * This path intentionally runs before the normal Page-comment
   * ignore logic and before MULTIPLE main-post bid rejection.
   */ if (auctionPost) {
    const auctionFbPageId = String(auctionPost?.fb_page_id || "");
    if (fbUserId && auctionFbPageId && fbUserId === auctionFbPageId) {
      const handled = await processMainPostPageControlCommand(auctionPost, auctionFbPageId, commentId, message);
      if (handled) {
        return;
      }
    }
    const automationState = await getAuctionAutomationState(auctionPost);
    if (!automationState.enabled) {
      log("Auction comment ignored - automation suspended", {
        fbPostId,
        commentId,
        blockedBy: automationState.blockedBy,
        reason: automationState.reason
      });
      return;
    }
  }
  let auctionItem = null;
  let auctionRule = null;
  let parsed = null;
  /*
   * MULTIPLE AUCTION MAIN POST:
   *
   * Main-post comments are never bids.
   */ if (auctionPost && await isMultipleAuctionPostType(auctionPost.post_type)) {
    const fbPageId = String(auctionPost.fb_page_id || "");
    if (!fbUserId || fbUserId !== fbPageId) {
      await replyToComment(fbPageId, commentId, [
        "Invalid bid location.",
        "",
        "This is a multiple auction.",
        "Please place your bid on the photo of the specific item you want to bid on."
      ].join("\n"));
    }
    log("Multiple-auction main-post comment rejected", {
      fbPostId,
      commentId
    });
    return;
  }
  /*
   * PHOTO COMMENT:
   *
   * Depending on Meta's event shape, the photo/object ID may
   * appear as post_id, parent_id, photo_id, object_id, or target_id.
   *
   * For SINGLE auctions we also try these values as a possible
   * parent MAIN POST ID. This lets EO2MATE reject bids placed on
   * attached photos even though Single Auction stores only the
   * main post as auction_items.fb_object_id.
   */ if (!auctionPost) {
    const objectCandidates = Array.from(new Set([
      value?.post_id,
      value?.parent_id,
      value?.photo_id,
      value?.object_id,
      value?.target_id
    ].filter(Boolean).map(String)));
    /*
     * FIRST: try to resolve one of Meta's parent/object IDs
     * directly to a registered auction post.
     *
     * This is the key path for SINGLE photo comments when
     * parent_id points back to the main auction post.
     */ for (const candidate of objectCandidates){
      const candidatePost = await findAuctionPost(candidate);
      if (candidatePost) {
        auctionPost = candidatePost;
        break;
      }
    }
    if (auctionPost) {
      const resolvedIsMultiple = await isMultipleAuctionPostType(auctionPost.post_type);
      if (!resolvedIsMultiple) {
        const fbPageId = String(auctionPost.fb_page_id || "");
        if (fbUserId && fbUserId === fbPageId) {
          return;
        }
        const singleItem = await findAuctionItem(auctionPost.post_id);
        if (!singleItem) {
          return;
        }
        const invalidPhotoBid = await createBid({
          auctionItemId: singleItem.auction_item_id,
          commentId,
          fbUserId,
          fbUserName,
          commentText: message,
          bidAmount: null,
          valid: false,
          invalidReason: "INVALID_SINGLE_AUCTION_PHOTO_COMMENT",
          commentedAt: getCommentCreatedTime(value).toISOString()
        });
        if (invalidPhotoBid) {
          await replyToComment(fbPageId, commentId, "Invalid bid. Please place your bid on the main auction post.");
        }
        log("Single-auction photo comment rejected", {
          fbPostId,
          commentId,
          resolvedAuctionPostId: auctionPost.fb_post_id
        });
        return;
      }
    }
    /*
     * SECOND: normal MULTIPLE-auction photo-object resolution.
     */ if (!auctionItem) {
      for (const candidate of objectCandidates){
        auctionItem = await findAuctionItemByFacebookObjectId(candidate);
        if (auctionItem) {
          break;
        }
      }
    }
    if (!auctionItem) {
      return;
    }
    auctionPost = await findAuctionPostByInternalId(auctionItem.auction_post_id);
    if (!auctionPost || !await isMultipleAuctionPostType(auctionPost.post_type)) {
      return;
    }
  }
  const resolvedAutomationState = await getAuctionAutomationState(auctionPost);
  if (!resolvedAutomationState.enabled) {
    log("Resolved auction comment ignored - automation suspended", {
      fbPostId,
      commentId,
      blockedBy: resolvedAutomationState.blockedBy,
      reason: resolvedAutomationState.reason
    });
    return;
  }
  const environment = getAuctionEnvironment(auctionPost);
  if (!environment) {
    log("Auction comment ignored - auction has no EO2MATE environment", {
      fbPostId,
      commentId
    });
    return;
  }
  const fbPageId = String(auctionPost.fb_page_id || "");
  if (fbUserId && fbUserId === fbPageId) {
    return;
  }
  if (await isMultipleAuctionPostType(auctionPost.post_type)) {
    if (!auctionItem) {
      auctionItem = await findAuctionItemByFacebookObjectId(fbPostId);
    }
    if (!auctionItem) {
      return;
    }
    auctionRule = await findAuctionRule(auctionItem.auction_item_id);
    if (!auctionRule) {
      throw new Error(`Auction rule not found for multiple item ${auctionItem.auction_item_id}.`);
    }
    const resolvedRules = await getEffectiveMultipleAuctionRules(auctionPost, auctionItem);
    parsed = resolvedRules.effective;
  } else {
    const structure = await ensureAuctionStructureForComment(auctionPost, fbPostId);
    auctionItem = structure.auctionItem;
    auctionRule = structure.auctionRule;
    parsed = structure.parsed;
  }
  const commentTime = getCommentCreatedTime(value);
  /* =========================================================
     ALREADY CLOSED
     ========================================================= */ if (auctionItem.status !== "ACTIVE") {
    const lateBid = await createBid({
      auctionItemId: auctionItem.auction_item_id,
      commentId,
      fbUserId,
      fbUserName,
      commentText: message,
      bidAmount: null,
      valid: false,
      invalidReason: "AUCTION_CLOSED",
      commentedAt: commentTime.toISOString()
    });
    if (lateBid) {
      await replyToComment(fbPageId, commentId, "Invalid bid. The auction is already closed.");
    }
    return;
  }
  /* =========================================================
     TIME EXPIRED
     ========================================================= */ const auctionEnd = new Date(auctionRule.auction_end_dt);
  if (!Number.isNaN(auctionEnd.getTime()) && commentTime.getTime() >= auctionEnd.getTime()) {
    const lateBid = await createBid({
      auctionItemId: auctionItem.auction_item_id,
      commentId,
      fbUserId,
      fbUserName,
      commentText: message,
      bidAmount: null,
      valid: false,
      invalidReason: "AUCTION_ENDED",
      commentedAt: commentTime.toISOString()
    });
    if (lateBid) {
      await replyToComment(fbPageId, commentId, "Invalid bid. The auction has already ended.");
    }
    return;
  }
  const bidAmount = normalizeMoney(message);
  /* =========================================================
     INVALID AMOUNT
     ========================================================= */ if (bidAmount === null) {
    const bid = await createBid({
      auctionItemId: auctionItem.auction_item_id,
      commentId,
      fbUserId,
      fbUserName,
      commentText: message,
      bidAmount: null,
      valid: false,
      invalidReason: "INVALID_AMOUNT",
      commentedAt: commentTime.toISOString()
    });
    if (bid) {
      await replyToComment(fbPageId, commentId, "Invalid bid. Please comment a valid amount.");
    }
    return;
  }
  const minBid = normalizeMoney(auctionRule.min_bid);
  const increment = normalizeMoney(auctionRule.bid_increment);
  const buyout = normalizeMoney(auctionRule.bid_buyout_amt);
  /* =========================================================
     BELOW MINIMUM
     ========================================================= */ if (minBid !== null && bidAmount < minBid) {
    const bid = await createBid({
      auctionItemId: auctionItem.auction_item_id,
      commentId,
      fbUserId,
      fbUserName,
      commentText: message,
      bidAmount,
      valid: false,
      invalidReason: "BELOW_MINIMUM_BID",
      commentedAt: commentTime.toISOString()
    });
    if (bid) {
      await replyToComment(fbPageId, commentId, `Invalid bid. Minimum bid is Ã¢ÂÂ±${formatMoney(minBid)}.`);
    }
    return;
  }
  /* =========================================================
     BUYOUT
     ========================================================= */ if (buyout !== null && buyout > 0 && bidAmount >= buyout) {
    const buyoutOpen = isBuyoutWindowOpen(commentTime, auctionRule.buyout_dt_limit);
    if (buyoutOpen) {
      const bid = await createBid({
        auctionItemId: auctionItem.auction_item_id,
        commentId,
        fbUserId,
        fbUserName,
        commentText: message,
        bidAmount: buyout,
        valid: true,
        invalidReason: null,
        commentedAt: commentTime.toISOString()
      });
      if (!bid) {
        return;
      }
      const winner = await createOrGetWinner(auctionItem.auction_item_id, bid);
      const { error: closeError } = await supabase.from("auction_items").update({
        status: "CLOSED",
        bid_winner_id: winner.bid_winner_id
      }).eq("auction_item_id", auctionItem.auction_item_id);
      if (closeError) {
        throw new Error(`Buyout close failed: ${closeError.message}`);
      }
      await closeAuctionPostIfComplete(auctionPost.post_id);
      await replyToComment(fbPageId, commentId, `Buyout accepted at Ã¢ÂÂ±${formatMoney(buyout)}. You won the auction.`);
      const announcementTarget = await getAuctionAnnouncementTarget(auctionPost, auctionItem);
      await postFacebookComment(fbPageId, announcementTarget, [
        "Ã°ÂÂÂ AUCTION ENDED Ã¢ÂÂ BUYOUT",
        "",
        `Ã°ÂÂÂ Winner: ${fbUserName || "Winning Bidder"}`,
        `Winning Amount: Ã¢ÂÂ±${formatMoney(buyout)}`,
        "",
        "Congratulations!"
      ].join("\n"));
      await prepareWinnerPayment(fbPageId, bid, winner);
      return;
    }
    log("BUYOUT WINDOW CLOSED - treating amount as normal bid", {
      commentId,
      bidAmount,
      buyout,
      buyoutUntil: auctionRule.buyout_dt_limit,
      commentTime: commentTime.toISOString()
    });
  }
  /* =========================================================
     BID CUTOFF
     ========================================================= */ const bidCutoffMinutes = parsed.bidCutoffMinutes ?? 60;
  if (bidCutoffMinutes > 0) {
    const cutoffStart = new Date(auctionEnd.getTime() - bidCutoffMinutes * 60 * 1000);
    const insideCutoff = commentTime.getTime() >= cutoffStart.getTime() && commentTime.getTime() < auctionEnd.getTime();
    if (insideCutoff) {
      const eligible = await hasBidderValidBidBeforeCutoff(auctionItem.auction_item_id, fbUserId, cutoffStart);
      if (!eligible) {
        const bid = await createBid({
          auctionItemId: auctionItem.auction_item_id,
          commentId,
          fbUserId,
          fbUserName,
          commentText: message,
          bidAmount,
          valid: false,
          invalidReason: "NO_PRIOR_BID_BEFORE_CUTOFF",
          commentedAt: commentTime.toISOString()
        });
        if (bid) {
          await replyToComment(fbPageId, commentId, `Invalid bid. New bidders are not allowed within the final ${bidCutoffMinutes} minutes of the auction. You must have a valid bid before ${formatPhilippineDateTime(cutoffStart)}.`);
        }
        return;
      }
    }
  }
  /* =========================================================
     SAME BID BY SAME BIDDER
     ========================================================= */ const sameBidByBidder = await findSameValidBidByBidder(auctionItem.auction_item_id, fbUserId, bidAmount);
  if (sameBidByBidder) {
    const bid = await createBid({
      auctionItemId: auctionItem.auction_item_id,
      commentId,
      fbUserId,
      fbUserName,
      commentText: message,
      bidAmount,
      valid: false,
      invalidReason: "SAME_BID_BY_BIDDER",
      commentedAt: commentTime.toISOString()
    });
    if (bid) {
      await replyToComment(fbPageId, commentId, `Invalid bid. You already submitted Ã¢ÂÂ±${formatMoney(bidAmount)}. Please place a higher valid bid.`);
    }
    return;
  }
  /* =========================================================
     INCREMENT FROM MINIMUM
     ========================================================= */ if (minBid !== null && increment !== null && increment > 0) {
    if (!isValidIncrement(bidAmount, minBid, increment)) {
      const steps = Math.ceil((bidAmount - minBid) / increment);
      const nextValid = minBid + Math.max(0, steps) * increment;
      const bid = await createBid({
        auctionItemId: auctionItem.auction_item_id,
        commentId,
        fbUserId,
        fbUserName,
        commentText: message,
        bidAmount,
        valid: false,
        invalidReason: "INVALID_INCREMENT",
        commentedAt: commentTime.toISOString()
      });
      if (bid) {
        await replyToComment(fbPageId, commentId, `Invalid bid. Bids must follow the Ã¢ÂÂ±${formatMoney(increment)} increment. Next valid bid is Ã¢ÂÂ±${formatMoney(nextValid)}.`);
      }
      return;
    }
  }
  /* =========================================================
     CURRENT HIGHEST
     ========================================================= */ const highestBid = await findHighestValidBid(auctionItem.auction_item_id);
  if (highestBid?.bid_amt !== null && highestBid?.bid_amt !== undefined) {
    const highestAmount = Number(highestBid.bid_amt);
    const requiredBid = increment !== null && increment > 0 ? highestAmount + increment : highestAmount;
    /* -------------------------------------------------------
       SAME AS CURRENT HIGHEST
       ------------------------------------------------------- */ if (bidAmount === highestAmount) {
      const bid = await createBid({
        auctionItemId: auctionItem.auction_item_id,
        commentId,
        fbUserId,
        fbUserName,
        commentText: message,
        bidAmount,
        valid: false,
        invalidReason: "SAME_AS_HIGHEST_BID",
        commentedAt: commentTime.toISOString()
      });
      if (bid) {
        const nextText = increment !== null && increment > 0 ? ` Next valid bid is Ã¢ÂÂ±${formatMoney(requiredBid)}.` : "";
        await replyToComment(fbPageId, commentId, `Invalid bid. Ã¢ÂÂ±${formatMoney(highestAmount)} is already the current highest bid.${nextText}`);
      }
      return;
    }
    /* -------------------------------------------------------
       BELOW CURRENT HIGHEST
       ------------------------------------------------------- */ if (bidAmount < highestAmount) {
      const bid = await createBid({
        auctionItemId: auctionItem.auction_item_id,
        commentId,
        fbUserId,
        fbUserName,
        commentText: message,
        bidAmount,
        valid: false,
        invalidReason: "BELOW_CURRENT_HIGHEST",
        commentedAt: commentTime.toISOString()
      });
      if (bid) {
        const nextText = increment !== null && increment > 0 ? ` Next valid bid is Ã¢ÂÂ±${formatMoney(requiredBid)}.` : "";
        await replyToComment(fbPageId, commentId, `Invalid bid. Current highest bid is Ã¢ÂÂ±${formatMoney(highestAmount)}.${nextText}`);
      }
      return;
    }
    /* -------------------------------------------------------
       ABOVE HIGHEST BUT BELOW REQUIRED INCREMENT
       ------------------------------------------------------- */ if (increment !== null && increment > 0 && bidAmount < requiredBid) {
      const bid = await createBid({
        auctionItemId: auctionItem.auction_item_id,
        commentId,
        fbUserId,
        fbUserName,
        commentText: message,
        bidAmount,
        valid: false,
        invalidReason: "BELOW_REQUIRED_BID",
        commentedAt: commentTime.toISOString()
      });
      if (bid) {
        await replyToComment(fbPageId, commentId, `Invalid bid. Current highest bid is Ã¢ÂÂ±${formatMoney(highestAmount)}. Next valid bid is Ã¢ÂÂ±${formatMoney(requiredBid)}.`);
      }
      return;
    }
    /* -------------------------------------------------------
       DOES NOT FOLLOW INCREMENT FROM CURRENT HIGHEST
       ------------------------------------------------------- */ if (increment !== null && increment > 0) {
      const difference = bidAmount - highestAmount;
      const steps = difference / increment;
      const exactIncrement = Math.abs(steps - Math.round(steps)) < 0.000001;
      if (!exactIncrement) {
        const nextValid = highestAmount + Math.ceil(difference / increment) * increment;
        const bid = await createBid({
          auctionItemId: auctionItem.auction_item_id,
          commentId,
          fbUserId,
          fbUserName,
          commentText: message,
          bidAmount,
          valid: false,
          invalidReason: "INVALID_INCREMENT",
          commentedAt: commentTime.toISOString()
        });
        if (bid) {
          await replyToComment(fbPageId, commentId, `Invalid bid. Bids must follow the Ã¢ÂÂ±${formatMoney(increment)} increment from the current highest bid. Next valid bid is Ã¢ÂÂ±${formatMoney(nextValid)}.`);
        }
        return;
      }
    }
  }
  /* =========================================================
     VALID NORMAL BID
     ========================================================= */ const bid = await createBid({
    auctionItemId: auctionItem.auction_item_id,
    commentId,
    fbUserId,
    fbUserName,
    commentText: message,
    bidAmount,
    valid: true,
    invalidReason: null,
    commentedAt: commentTime.toISOString()
  });
  if (!bid) {
    return;
  }
  /*
   * The valid bidder gets ONLY the normal
   * bid-validation reply here.
   */ await replyToComment(fbPageId, commentId, `Valid bid accepted: Ã¢ÂÂ±${formatMoney(bidAmount)}.`);
  /*
   * If this bid causes the distinct valid bidder
   * count to reach the minimum, this now creates
   * a separate TOP-LEVEL Facebook post comment.
   */ await handleMinimumBidderReached(auctionPost, auctionItem, auctionRule, fbPageId);
  /*
   * Anti-sniper remains tied to the valid bid itself,
   * so this is still a reply to that bid when triggered.
   */ await applyAntiSniper(auctionItem.auction_item_id, auctionRule, fbPageId, commentId, commentTime);
}
/* =========================================================
   CLOSE POST IF ALL ITEMS CLOSED
   ========================================================= */ async function closeAuctionPostIfComplete(auctionPostId) {
  const { data, error } = await supabase.from("auction_items").select("auction_item_id").eq("auction_post_id", auctionPostId).eq("status", "ACTIVE").limit(1);
  if (error) {
    throw new Error(`active auction item lookup failed: ${error.message}`);
  }
  if (data && data.length > 0) {
    return;
  }
  const { error: closeError } = await supabase.from("auction_posts").update({
    status: "CLOSED"
  }).eq("post_id", auctionPostId);
  if (closeError) {
    throw new Error(`auction_posts close failed: ${closeError.message}`);
  }
}
async function claimAuctionAnnouncement(auctionItemId, field) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("auction_items").update({
    [field]: now
  }).eq("auction_item_id", auctionItemId).eq("status", "ACTIVE").is(field, null).select("*").maybeSingle();
  if (error) {
    throw new Error(`auction announcement claim failed (${field}): ${error.message}`);
  }
  return data;
}
/* =========================================================
   RELEASE TIMED ANNOUNCEMENT CLAIM
   ========================================================= */ async function releaseAuctionAnnouncementClaim(auctionItemId, field, claimedAt) {
  const { error } = await supabase.from("auction_items").update({
    [field]: null
  }).eq("auction_item_id", auctionItemId).eq(field, claimedAt);
  if (error) {
    errorLog("Unable to release auction announcement claim", {
      auctionItemId,
      field,
      error: error.message
    });
  }
}
/* =========================================================
   POST AUCTION ENDING REMINDER
   ========================================================= */ async function postAuctionEndingReminder(auctionItem, auctionRule, reminderType) {
  const auctionItemId = String(auctionItem?.auction_item_id || "");
  if (!auctionItemId || auctionItem.status !== "ACTIVE") {
    return false;
  }
  const auctionPost = await findAuctionPostByInternalId(auctionItem.auction_post_id);
  if (!auctionPost || String(auctionPost.status || "").toUpperCase() !== "ACTIVE") {
    return false;
  }
  const automationState = await getAuctionAutomationState(auctionPost);
  if (!automationState.enabled) {
    return false;
  }
  const fbPageId = String(auctionPost.fb_page_id || "");
  const fbPostId = String(auctionPost.fb_post_id || "");
  const announcementTarget = await getAuctionAnnouncementTarget(auctionPost, auctionItem);
  if (!fbPageId || !announcementTarget || !auctionRule?.auction_end_dt) {
    return false;
  }
  const auctionEnd = new Date(auctionRule.auction_end_dt);
  if (Number.isNaN(auctionEnd.getTime())) {
    return false;
  }
  const remainingMs = auctionEnd.getTime() - Date.now();
  if (remainingMs <= 0) {
    return false;
  }
  const isOneHour = reminderType === "ONE_HOUR";
  const thresholdMs = (isOneHour ? 60 : 5) * 60 * 1000;
  if (remainingMs > thresholdMs) {
    return false;
  }
  const field = isOneHour ? "one_hour_warning_sent_at" : "five_min_warning_sent_at";
  const claimedItem = await claimAuctionAnnouncement(auctionItemId, field);
  if (!claimedItem) {
    return false;
  }
  const claimedAt = String(claimedItem[field]);
  try {
    const highestBid = await findHighestValidBid(auctionItemId);
    const lines = isOneHour ? [
      "Ã¢ÂÂ° AUCTION ENDING SOON Ã¢ÂÂ FINAL 1 HOUR",
      ""
    ] : [
      "Ã°ÂÂÂ¨ AUCTION ENDING SOON Ã¢ÂÂ FINAL 5 MINUTES",
      ""
    ];
    if (highestBid) {
      lines.push(`Current Highest Bid: Ã¢ÂÂ±${formatMoney(highestBid.bid_amt)}`);
      lines.push(`Highest Bidder: ${String(highestBid.fb_user_name || "Current Highest Bidder")}`);
    } else {
      lines.push("No valid bids yet.");
    }
    lines.push("", `Auction Ends: ${formatPhilippineDateTime(auctionEnd)}`, "");
    if (isOneHour) {
      lines.push("The auction is now in its final hour. Place your valid bids before the auction ends.");
    } else {
      lines.push("Only 5 minutes remaining. Place your final valid bids now.");
    }
    const posted = await postFacebookComment(fbPageId, announcementTarget, lines.join("\n"));
    if (!posted) {
      await releaseAuctionAnnouncementClaim(auctionItemId, field, claimedAt);
      return false;
    }
    log("AUCTION ENDING REMINDER POSTED", {
      auctionItemId,
      reminderType,
      fbPostId,
      auctionEnd: auctionEnd.toISOString()
    });
    return true;
  } catch (error) {
    await releaseAuctionAnnouncementClaim(auctionItemId, field, claimedAt);
    throw error;
  }
}
/* =========================================================
   POST BUYOUT WINDOW ENDED ANNOUNCEMENT
   ========================================================= */ async function postBuyoutWindowEndedAnnouncement(auctionItem, auctionRule) {
  const auctionItemId = String(auctionItem?.auction_item_id || "");
  if (!auctionItemId || auctionItem.status !== "ACTIVE" || !auctionRule?.buyout_dt_limit || !auctionRule?.auction_end_dt) {
    return false;
  }
  const buyoutEnd = new Date(auctionRule.buyout_dt_limit);
  const auctionEnd = new Date(auctionRule.auction_end_dt);
  if (Number.isNaN(buyoutEnd.getTime()) || Number.isNaN(auctionEnd.getTime())) {
    return false;
  }
  const nowMs = Date.now();
  /*
   * Announce only after the buyout window has ended,
   * while the auction itself is still active.
   */ if (nowMs < buyoutEnd.getTime() || nowMs >= auctionEnd.getTime()) {
    return false;
  }
  const auctionPost = await findAuctionPostByInternalId(auctionItem.auction_post_id);
  if (!auctionPost || String(auctionPost.status || "").toUpperCase() !== "ACTIVE") {
    return false;
  }
  const automationState = await getAuctionAutomationState(auctionPost);
  if (!automationState.enabled) {
    return false;
  }
  const fbPageId = String(auctionPost.fb_page_id || "");
  const fbPostId = String(auctionPost.fb_post_id || "");
  const announcementTarget = await getAuctionAnnouncementTarget(auctionPost, auctionItem);
  if (!fbPageId || !announcementTarget) {
    return false;
  }
  const field = "buyout_window_ended_announced_at";
  const claimedItem = await claimAuctionAnnouncement(auctionItemId, field);
  if (!claimedItem) {
    return false;
  }
  const claimedAt = String(claimedItem[field]);
  try {
    const highestBid = await findHighestValidBid(auctionItemId);
    const lines = [
      "Ã°ÂÂÂ BUYOUT WINDOW CLOSED",
      "",
      `Item: ${String(auctionItem.item_label || "Auction Item")}`,
      `Buyout option ended at ${formatPhilippineDateTime(buyoutEnd)}.`,
      "",
      "The auction is still ACTIVE and will continue through normal bidding."
    ];
    if (highestBid) {
      lines.push("", `Current Highest Bid: Ã¢ÂÂ±${formatMoney(highestBid.bid_amt)}`, `Highest Bidder: ${String(highestBid.fb_user_name || "Current Highest Bidder")}`);
    }
    lines.push("", `Auction Ends: ${formatPhilippineDateTime(auctionEnd)}`, "", "Buyout is no longer available. Valid bids may still be placed until the auction ends.");
    const posted = await postFacebookComment(fbPageId, announcementTarget, lines.join("\n"));
    if (!posted) {
      await releaseAuctionAnnouncementClaim(auctionItemId, field, claimedAt);
      return false;
    }
    log("BUYOUT WINDOW ENDED ANNOUNCEMENT POSTED", {
      auctionItemId,
      fbPostId,
      buyoutEnd: buyoutEnd.toISOString(),
      auctionEnd: auctionEnd.toISOString()
    });
    return true;
  } catch (error) {
    await releaseAuctionAnnouncementClaim(auctionItemId, field, claimedAt);
    throw error;
  }
}
/* =========================================================
   RUN TIMED AUCTION ANNOUNCEMENTS
   ========================================================= */ async function runTimedAuctionAnnouncements() {
  const now = new Date();
  const { data: activeItems, error } = await supabase.from("auction_items").select("*").eq("status", "ACTIVE");
  if (error) {
    throw new Error(`timed auction announcement lookup failed: ${error.message}`);
  }
  let buyoutEndedPosted = 0;
  let oneHourPosted = 0;
  let fiveMinutePosted = 0;
  let skipped = 0;
  let failed = 0;
  for (const auctionItem of activeItems || []){
    try {
      const auctionRule = await findAuctionRule(auctionItem.auction_item_id);
      if (!auctionRule?.auction_end_dt) {
        skipped += 1;
        continue;
      }
      const auctionEnd = new Date(auctionRule.auction_end_dt);
      if (Number.isNaN(auctionEnd.getTime()) || auctionEnd.getTime() <= Date.now()) {
        skipped += 1;
        continue;
      }
      const buyoutEnded = await postBuyoutWindowEndedAnnouncement(auctionItem, auctionRule);
      if (buyoutEnded) {
        buyoutEndedPosted += 1;
      }
      const remainingMs = auctionEnd.getTime() - Date.now();
      if (remainingMs <= 60 * 60 * 1000) {
        const oneHour = await postAuctionEndingReminder(auctionItem, auctionRule, "ONE_HOUR");
        if (oneHour) {
          oneHourPosted += 1;
        }
      }
      if (remainingMs <= 5 * 60 * 1000) {
        const fiveMinutes = await postAuctionEndingReminder(auctionItem, auctionRule, "FIVE_MINUTES");
        if (fiveMinutes) {
          fiveMinutePosted += 1;
        }
      }
    } catch (error) {
      failed += 1;
      errorLog("Timed auction announcement error", {
        auctionItemId: auctionItem?.auction_item_id,
        error: getErrorMessage(error)
      });
    }
  }
  return {
    candidates: activeItems?.length || 0,
    buyout_ended_posted: buyoutEndedPosted,
    one_hour_posted: oneHourPosted,
    five_minute_posted: fiveMinutePosted,
    skipped,
    failed,
    checked_at: now.toISOString()
  };
}
/* =========================================================
   TIMED FINALIZATION
   ========================================================= */ async function finalizeAuctionByTime(candidateRule) {
  const auctionItemId = String(candidateRule?.auction_item_id || "");
  if (!auctionItemId) {
    return false;
  }
  /*
   * Re-read latest rule because anti-sniper may
   * have extended auction_end_dt.
   */ const auctionRule = await findAuctionRule(auctionItemId);
  if (!auctionRule?.auction_end_dt) {
    return false;
  }
  const latestEnd = new Date(auctionRule.auction_end_dt);
  if (Number.isNaN(latestEnd.getTime())) {
    return false;
  }
  /*
   * Anti-sniper extended it.
   */ if (latestEnd.getTime() > Date.now()) {
    return false;
  }
  const auctionItem = await findAuctionItemById(auctionItemId);
  if (!auctionItem || auctionItem.status !== "ACTIVE") {
    return false;
  }
  const auctionPost = await findAuctionPostByInternalId(auctionItem.auction_post_id);
  if (!auctionPost) {
    throw new Error(`Auction post not found for item ${auctionItemId}`);
  }
  const automationState = await getAuctionAutomationState(auctionPost);
  if (!automationState.enabled) {
    log("Auction finalization skipped - automation suspended", {
      auctionItemId,
      auctionPostId: auctionPost.post_id,
      blockedBy: automationState.blockedBy,
      reason: automationState.reason
    });
    return false;
  }
  const environment = getAuctionEnvironment(auctionPost);
  /*
   * Do not finalize legacy/uncontrolled auctions.
   */ if (!environment) {
    log("Auction finalization skipped - no EO2MATE environment", {
      auctionItemId
    });
    return false;
  }
  const fbPageId = String(auctionPost.fb_page_id || "");
  const fbPostId = String(auctionPost.fb_post_id || "");
  const announcementTarget = await getAuctionAnnouncementTarget(auctionPost, auctionItem);
  if (!fbPageId || !announcementTarget) {
    throw new Error(`Facebook information missing for auction ${auctionItemId}`);
  }
  const minimumRequired = normalizeInteger(auctionRule.min_bidder_count) ?? 1;
  const validBidderCount = await countDistinctValidBidders(auctionItemId);
  /* =========================================================
     MINIMUM BIDDERS NOT REACHED
     ========================================================= */ if (validBidderCount < minimumRequired) {
    const { data: closedItem, error: closeError } = await supabase.from("auction_items").update({
      status: "CLOSED",
      bid_winner_id: null
    }).eq("auction_item_id", auctionItemId).eq("status", "ACTIVE").select("*").maybeSingle();
    if (closeError) {
      throw new Error(`Auction close failed: ${closeError.message}`);
    }
    if (!closedItem) {
      return false;
    }
    await closeAuctionPostIfComplete(auctionPost.post_id);
    await postFacebookComment(fbPageId, announcementTarget, [
      "Ã°ÂÂÂ AUCTION ENDED",
      "",
      "No winner was declared.",
      "",
      `Minimum valid bidder requirement was not reached (${validBidderCount}/${minimumRequired}).`,
      "",
      "Thank you to everyone who participated."
    ].join("\n"));
    log("AUCTION FINALIZED - INSUFFICIENT VALID BIDDERS", {
      auctionItemId,
      validBidderCount,
      minimumRequired,
      finalEnd: auctionRule.auction_end_dt
    });
    return true;
  }
  /* =========================================================
     HIGHEST VALID BID
     ========================================================= */ const highestBid = await findHighestValidBid(auctionItemId);
  if (!highestBid) {
    const { data: closedItem, error: closeError } = await supabase.from("auction_items").update({
      status: "CLOSED",
      bid_winner_id: null
    }).eq("auction_item_id", auctionItemId).eq("status", "ACTIVE").select("*").maybeSingle();
    if (closeError) {
      throw new Error(`Auction close failed: ${closeError.message}`);
    }
    if (!closedItem) {
      return false;
    }
    await closeAuctionPostIfComplete(auctionPost.post_id);
    await postFacebookComment(fbPageId, announcementTarget, [
      "Ã°ÂÂÂ AUCTION ENDED",
      "",
      "No valid winning bid was found.",
      "",
      "No winner was declared."
    ].join("\n"));
    return true;
  }
  /* =========================================================
     CREATE WINNER
     ========================================================= */ const winner = await createOrGetWinner(auctionItemId, highestBid);
  /* =========================================================
     ATOMIC CLOSE
     ========================================================= */ const { data: closedItem, error: closeError } = await supabase.from("auction_items").update({
    status: "CLOSED",
    bid_winner_id: winner.bid_winner_id
  }).eq("auction_item_id", auctionItemId).eq("status", "ACTIVE").select("*").maybeSingle();
  if (closeError) {
    throw new Error(`Winner auction close failed: ${closeError.message}`);
  }
  if (!closedItem) {
    return false;
  }
  await closeAuctionPostIfComplete(auctionPost.post_id);
  const winnerName = String(highestBid.fb_user_name || "Winning Bidder");
  /* =========================================================
     TOP-LEVEL AUCTION END COMMENT
     ========================================================= */ await postFacebookComment(fbPageId, announcementTarget, [
    "Ã°ÂÂÂ AUCTION ENDED",
    "",
    `Ã°ÂÂÂ Winner: ${winnerName}`,
    `Winning Bid: Ã¢ÂÂ±${formatMoney(highestBid.bid_amt)}`,
    "",
    `Valid Bidders: ${validBidderCount}`,
    `Minimum Required: ${minimumRequired}`,
    "",
    "Congratulations to the winner!"
  ].join("\n"));
  /* =========================================================
     PAYMENT FLOW
     ========================================================= */ await prepareWinnerPayment(fbPageId, highestBid, winner);
  log("AUCTION FINALIZED - WINNER DECLARED", {
    auctionItemId,
    bidWinnerId: winner.bid_winner_id,
    winnerName,
    winningAmount: highestBid.bid_amt,
    validBidderCount,
    minimumRequired,
    finalAuctionEnd: auctionRule.auction_end_dt
  });
  return true;
}
/* =========================================================
   TWO-HOUR AUCTION STATUS COMMENT
   ========================================================= */ /*
 * FIX:
 *
 * The 2-hour announcement cadence is now anchored to the
 * auction item's created_at timestamp.
 *
 * Example:
 *
 * Auction item created: 4:03 PM PH
 * First update:         ~6:03 PM PH
 * Second update:        ~8:03 PM PH
 * Third update:         ~10:03 PM PH
 *
 * The every-minute ?action=finalize Cron calls this checker.
 * A separate hourly status Cron is no longer required.
 */ /* =========================================================
   CLAIM TWO-HOUR STATUS COMMENT
   ========================================================= */ async function claimAuctionStatusComment(auctionItemId, expectedLastStatusCommentAt) {
  const claimedAt = new Date().toISOString();
  let query = supabase.from("auction_items").update({
    last_status_comment_at: claimedAt
  }).eq("auction_item_id", auctionItemId).eq("status", "ACTIVE");
  /*
   * Compare-and-set behavior:
   *
   * If last_status_comment_at was NULL when we read the row,
   * only claim it if it is STILL NULL.
   *
   * If it already had a timestamp, only claim it if the
   * timestamp is STILL the same value we originally read.
   *
   * This prevents two overlapping Cron executions from
   * posting the same 2-hour announcement twice.
   */ if (expectedLastStatusCommentAt) {
    query = query.eq("last_status_comment_at", expectedLastStatusCommentAt);
  } else {
    query = query.is("last_status_comment_at", null);
  }
  const { data, error } = await query.select("auction_item_id, last_status_comment_at").maybeSingle();
  if (error) {
    throw new Error(`auction status comment claim failed: ${error.message}`);
  }
  return data;
}
/* =========================================================
   RELEASE TWO-HOUR STATUS CLAIM
   ========================================================= */ async function releaseAuctionStatusCommentClaim(auctionItemId, claimedAt, previousLastStatusCommentAt) {
  const { error } = await supabase.from("auction_items").update({
    /*
           * Restore the previous value instead of always
           * resetting to NULL.
           */ last_status_comment_at: previousLastStatusCommentAt
  }).eq("auction_item_id", auctionItemId).eq("last_status_comment_at", claimedAt);
  if (error) {
    errorLog("Unable to release auction status comment claim", {
      auctionItemId,
      error: error.message
    });
  }
}
/* =========================================================
   POST TWO-HOUR AUCTION STATUS UPDATE
   ========================================================= */ async function postAuctionStatusUpdate(auctionItem, auctionRule) {
  const auctionItemId = String(auctionItem?.auction_item_id || "");
  if (!auctionItemId || String(auctionItem?.status || "").toUpperCase() !== "ACTIVE") {
    return false;
  }
  const auctionPost = await findAuctionPostByInternalId(auctionItem.auction_post_id);
  if (!auctionPost || String(auctionPost.status || "").toUpperCase() !== "ACTIVE") {
    return false;
  }
  const automationState = await getAuctionAutomationState(auctionPost);
  if (!automationState.enabled) {
    return false;
  }
  const fbPageId = String(auctionPost.fb_page_id || "");
  const fbPostId = String(auctionPost.fb_post_id || "");
  const announcementTarget = await getAuctionAnnouncementTarget(auctionPost, auctionItem);
  if (!fbPageId || !announcementTarget) {
    return false;
  }
  const rule = auctionRule || await findAuctionRule(auctionItemId);
  if (!rule?.auction_end_dt) {
    return false;
  }
  const auctionEnd = new Date(rule.auction_end_dt);
  if (Number.isNaN(auctionEnd.getTime())) {
    return false;
  }
  const now = new Date();
  const announcementIntervalHours = await getClientNumberSetting(getString(auctionPost?.client_id), "ANNOUNCEMENT_INTERVAL_HOURS", DEFAULT_ANNOUNCEMENT_INTERVAL_HOURS);
  const remainingMs = auctionEnd.getTime() - now.getTime();
  /*
   * Ended auctions are handled by the finalizer.
   */ if (remainingMs <= 0) {
    return false;
  }
  /*
   * During the final hour, the dedicated final-hour and
   * final-5-minute announcements take over.
   *
   * This prevents a regular "2-hour update" from competing
   * with the ending reminders.
   */ if (remainingMs <= 60 * 60 * 1000) {
    return false;
  }
  /*
   * IMPORTANT:
   *
   * The first 2-hour update must be based on when the
   * auction item was CREATED, not when the Cron happens
   * to run.
   */ const createdAt = new Date(String(auctionItem.created_at || auctionPost.created_at || ""));
  if (Number.isNaN(createdAt.getTime())) {
    errorLog("Auction status update skipped - invalid created_at", {
      auctionItemId,
      itemCreatedAt: auctionItem?.created_at || null,
      postCreatedAt: auctionPost?.created_at || null
    });
    return false;
  }
  const previousLastStatusCommentAt = auctionItem.last_status_comment_at ? String(auctionItem.last_status_comment_at) : null;
  /*
   * If an announcement was already sent, the next one is
   * due two hours after that successful announcement.
   *
   * Otherwise, the first announcement is due two hours
   * after auction_items.created_at.
   */ const cadenceBase = previousLastStatusCommentAt ? new Date(previousLastStatusCommentAt) : createdAt;
  if (Number.isNaN(cadenceBase.getTime())) {
    return false;
  }
  const nextDueAt = new Date(cadenceBase.getTime() + announcementIntervalHours * 60 * 60 * 1000);
  if (now.getTime() < nextDueAt.getTime()) {
    return false;
  }
  const highestBid = await findHighestValidBid(auctionItemId);
  /*
   * No valid bid yet:
   *
   * Do NOT consume the 2-hour status slot.
   * The every-minute checker can try again later once a
   * valid highest bid exists.
   */ if (!highestBid) {
    return false;
  }
  /*
   * Atomically claim this announcement BEFORE posting it
   * to Facebook.
   */ const claimedItem = await claimAuctionStatusComment(auctionItemId, previousLastStatusCommentAt);
  if (!claimedItem) {
    /*
     * Another invocation already claimed it.
     */ return false;
  }
  const claimedAt = String(claimedItem.last_status_comment_at);
  try {
    const bidderName = String(highestBid.fb_user_name || "Current Highest Bidder");
    const highestAmount = Number(highestBid.bid_amt);
    const posted = await postFacebookComment(fbPageId, announcementTarget, [
      "Ã°ÂÂÂ¢ AUCTION UPDATE",
      "",
      `Item: ${String(auctionItem.item_label || "Auction Item")}`,
      `Current Highest Bid: Ã¢ÂÂ±${formatMoney(highestAmount)}`,
      `Highest Bidder: ${bidderName}`,
      "",
      `Auction Ends: ${formatPhilippineDateTime(auctionEnd)}`,
      "",
      "Place your next valid bid in the comments."
    ].join("\n"));
    if (!posted) {
      /*
       * Facebook failed, so restore the previous timestamp
       * and allow a later Cron execution to retry.
       */ await releaseAuctionStatusCommentClaim(auctionItemId, claimedAt, previousLastStatusCommentAt);
      return false;
    }
    log("TWO-HOUR AUCTION STATUS COMMENT POSTED", {
      auctionItemId,
      fbPostId,
      highestBid: highestAmount,
      highestBidder: bidderName,
      createdAt: createdAt.toISOString(),
      previousStatusAt: previousLastStatusCommentAt,
      nextDueWas: nextDueAt.toISOString(),
      postedAt: claimedAt,
      auctionEnd: auctionEnd.toISOString()
    });
    return true;
  } catch (error) {
    await releaseAuctionStatusCommentClaim(auctionItemId, claimedAt, previousLastStatusCommentAt);
    throw error;
  }
}
/* =========================================================
   RUN TWO-HOUR AUCTION STATUS UPDATES
   ========================================================= */ async function runAuctionStatusUpdates() {
  const now = new Date();
  /*
   * Fetch all ACTIVE items.
   *
   * We intentionally do not use:
   *
   * last_status_comment_at IS NULL
   *
   * as proof that the item is immediately due.
   *
   * NULL only means "no update has been posted yet".
   * The actual first due time is:
   *
   * created_at + 2 hours.
   */ const { data: activeItems, error } = await supabase.from("auction_items").select("*").eq("status", "ACTIVE");
  if (error) {
    throw new Error(`auction status update lookup failed: ${error.message}`);
  }
  let posted = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of activeItems || []){
    try {
      const auctionRule = await findAuctionRule(item.auction_item_id);
      const didPost = await postAuctionStatusUpdate(item, auctionRule);
      if (didPost) {
        posted += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      errorLog("Auction status update error", {
        auctionItemId: item?.auction_item_id,
        error: getErrorMessage(error)
      });
    }
  }
  return {
    candidates: activeItems?.length || 0,
    posted,
    skipped,
    failed,
    checked_at: now.toISOString()
  };
}
/* =========================================================
   RUN AUCTION FINALIZER
   ========================================================= */ async function runAuctionFinalizer() {
  const now = new Date().toISOString();
  const { data: expiredRules, error } = await supabase.from("auction_rules").select("*").lte("auction_end_dt", now);
  if (error) {
    throw new Error(`Auction finalizer lookup failed: ${error.message}`);
  }
  let finalized = 0;
  let skipped = 0;
  let failed = 0;
  for (const rule of expiredRules || []){
    try {
      const processed = await finalizeAuctionByTime(rule);
      if (processed) {
        finalized += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      errorLog("Timed auction finalization error", {
        auctionItemId: rule?.auction_item_id,
        error: getErrorMessage(error)
      });
    }
  }
  return {
    candidates: expiredRules?.length || 0,
    finalized,
    skipped,
    failed,
    now
  };
}
/* =========================================================
   FEED EVENT PROCESSING
   ========================================================= */ async function processFeedEvents(payload) {
  const entries = payload?.entry;
  if (!Array.isArray(entries)) {
    return;
  }
  for (const entry of entries){
    const entryPageId = getString(entry?.id) || "";
    const changes = entry?.changes;
    if (!Array.isArray(changes)) {
      continue;
    }
    for (const change of changes){
      if (change?.field !== "feed") {
        continue;
      }
      const value = change?.value;
      if (!value) {
        continue;
      }
      /*
       * Always log the normalized feed discriminator. Previously
       * UI-created Page posts could arrive as item="photo" and were
       * silently ignored because only item="status" was processed.
       */ log("Facebook feed event detail", {
        entryPageId,
        item: value?.item,
        verb: value?.verb,
        postId: value?.post_id,
        parentId: value?.parent_id,
        commentId: value?.comment_id,
        fromId: value?.from?.id,
        hasMessage: Boolean(getString(value?.message)),
        messagePreview: getString(value?.message)?.slice(0, 180) || null
      });
      try {
        const item = String(value?.item || "").trim().toLowerCase();
        const verb = String(value?.verb || "").trim().toLowerCase();
        /*
         * Facebook Page posts may be delivered as:
         *   status - ordinary text/photo Page post
         *   photo  - especially Graph API multi-photo posts
         *   post   - some Page/feed delivery shapes
         *
         * Hydrate the parent Page post so processPost always receives
         * the real caption, Page ID and final post ID.
         */ if ([
          "status",
          "photo",
          "post"
        ].includes(item) && [
          "add",
          "edited"
        ].includes(verb)) {
          const hydratedValue = await hydrateFacebookFeedPost(entryPageId, value);
          log("Facebook feed post candidate hydrated", {
            entryPageId,
            sourceItem: item,
            sourceVerb: verb,
            fbPostId: hydratedValue?.post_id,
            fromId: hydratedValue?.from?.id,
            environment: getAuctionEnvironmentFromCaption(hydratedValue?.message),
            hasAuctionMarker: String(hydratedValue?.message || "").toLowerCase().includes("auction"),
            messagePreview: getString(hydratedValue?.message)?.slice(0, 300) || null
          });
          await processPost(hydratedValue);
          continue;
        }
        if (item === "comment" && verb === "add") {
          await processComment(value);
          continue;
        }
        log("Facebook feed event ignored - unsupported item/verb", {
          entryPageId,
          item,
          verb,
          postId: value?.post_id,
          commentId: value?.comment_id
        });
      } catch (error) {
        errorLog("Feed event processing error", {
          entryPageId,
          item: value?.item,
          verb: value?.verb,
          postId: value?.post_id,
          parentId: value?.parent_id,
          commentId: value?.comment_id,
          error: getErrorMessage(error)
        });
      }
    }
  }
}
/* =========================================================
   MESSENGER EVENTS
   ========================================================= */ async function processMessengerEvents(payload) {
  const entries = payload?.entry;
  if (!Array.isArray(entries)) {
    return;
  }
  for (const entry of entries){
    const messaging = entry?.messaging;
    if (!Array.isArray(messaging)) {
      continue;
    }
    for (const event of messaging){
      try {
        await processMessagingEvent(String(entry?.id || ""), event);
      } catch (error) {
        errorLog("Messenger event processing error", {
          sender: event?.sender?.id,
          error: getErrorMessage(error)
        });
      }
    }
  }
}
/* =========================================================
   HTTP
   ========================================================= */ Deno.serve(async (req)=>{
  try {
    const url = new URL(req.url);
    /* =====================================================
         WINNER ORDER RECOVERY ENDPOINT
         ===================================================== */ if (url.searchParams.get("action") === "recover-winner-orders") {
      if (!AUCTION_FINALIZER_SECRET) {
        return Response.json({
          success: false,
          error: "FINALIZER_SECRET_NOT_CONFIGURED"
        }, {
          status: 500
        });
      }
      const authorization = req.headers.get("Authorization") || "";
      if (authorization !== `Bearer ${AUCTION_FINALIZER_SECRET}`) {
        return Response.json({
          success: false,
          error: "UNAUTHORIZED"
        }, {
          status: 401
        });
      }
      let targetWinnerIds = null;
      /*
         * Body is optional.
         *
         * Targeted manual recovery:
         *
         * {
         *   "bid_winner_ids": [
         *     "<uuid>",
         *     "<uuid>"
         *   ]
         * }
         *
         * With no body / no IDs, the endpoint checks up to
         * 100 PENDING winners and repairs only those without
         * an orders row.
         */ if (req.method === "POST") {
        const rawBody = await req.text();
        if (rawBody) {
          try {
            const parsedBody = JSON.parse(rawBody);
            if (Array.isArray(parsedBody?.bid_winner_ids)) {
              targetWinnerIds = Array.from(new Set(parsedBody.bid_winner_ids.map((value)=>String(value || "").trim()).filter(Boolean)));
            }
          } catch  {
            return Response.json({
              success: false,
              error: "INVALID_JSON"
            }, {
              status: 400
            });
          }
        }
      }
      const result = await recoverMissingWinnerOrders(targetWinnerIds);
      return Response.json({
        success: true,
        recovery: result
      }, {
        status: 200
      });
    }
    /* =====================================================
         TWO-HOUR STATUS UPDATE ENDPOINT
         ===================================================== */ if (url.searchParams.get("action") === "status-update") {
      if (!AUCTION_FINALIZER_SECRET) {
        errorLog("AUCTION_FINALIZER_SECRET is missing.");
        return Response.json({
          success: false,
          error: "FINALIZER_SECRET_NOT_CONFIGURED"
        }, {
          status: 500
        });
      }
      const authorization = req.headers.get("Authorization") || "";
      const expectedAuthorization = `Bearer ${AUCTION_FINALIZER_SECRET}`;
      if (authorization !== expectedAuthorization) {
        return Response.json({
          success: false,
          error: "UNAUTHORIZED"
        }, {
          status: 401
        });
      }
      const result = await runAuctionStatusUpdates();
      return Response.json({
        success: true,
        ...result
      }, {
        status: 200
      });
    }
    /* =====================================================
         TIMED FINALIZER ENDPOINT
         ===================================================== */ if (url.searchParams.get("action") === "finalize") {
      if (!AUCTION_FINALIZER_SECRET) {
        errorLog("AUCTION_FINALIZER_SECRET is missing.");
        return Response.json({
          success: false,
          error: "FINALIZER_SECRET_NOT_CONFIGURED"
        }, {
          status: 500
        });
      }
      const authorization = req.headers.get("Authorization") || "";
      const expectedAuthorization = `Bearer ${AUCTION_FINALIZER_SECRET}`;
      if (authorization !== expectedAuthorization) {
        errorLog("Auction finalizer authorization failed", {
          authHeaderPresent: Boolean(authorization),
          configuredSecretPresent: Boolean(AUCTION_FINALIZER_SECRET)
        });
        return Response.json({
          success: false,
          error: "UNAUTHORIZED"
        }, {
          status: 401
        });
      }
      log("Auction finalizer authorization successful");
      /*
         * ONE every-minute Cron now drives the complete
         * time-based auction engine:
         *
         * 1. Two-hour highest-bid status update
         * 2. Buyout-window-ended announcement
         * 3. Final-hour warning
         * 4. Final-5-minute warning
         * 5. Auction finalization
         *
         * This keeps all timing checks on the same
         * every-minute schedule.
         */ const expiredOrderGroups = await lockExpiredOpenOrderGroups();
      const statusUpdates = await runAuctionStatusUpdates();
      const announcements = await runTimedAuctionAnnouncements();
      const result = await runAuctionFinalizer();
      return Response.json({
        success: true,
        expired_order_groups: expiredOrderGroups,
        status_updates: statusUpdates,
        announcements,
        ...result
      }, {
        status: 200
      });
    }
    /* =====================================================
         EO2MATE INTERNAL UI-PUBLISH REGISTRATION
         ===================================================== */ if (url.searchParams.get("action") === "register-published-auction") {
      if (req.method !== "POST") {
        return Response.json({
          success: false,
          error: "METHOD_NOT_ALLOWED"
        }, {
          status: 405
        });
      }
      if (!AUCTION_FINALIZER_SECRET) {
        return Response.json({
          success: false,
          error: "INTERNAL_REGISTRATION_SECRET_NOT_CONFIGURED"
        }, {
          status: 500
        });
      }
      const authorization = req.headers.get("Authorization") || "";
      if (authorization !== `Bearer ${AUCTION_FINALIZER_SECRET}`) {
        return Response.json({
          success: false,
          error: "UNAUTHORIZED"
        }, {
          status: 401
        });
      }
      let internalBody = {};
      try {
        internalBody = await req.json();
      } catch  {
        return Response.json({
          success: false,
          error: "INVALID_JSON"
        }, {
          status: 400
        });
      }
      const fbPageId = getString(internalBody?.fb_page_id);
      const fbPostId = getString(internalBody?.fb_post_id);
      const message = getString(internalBody?.message);
      if (!fbPageId || !fbPostId || !message) {
        return Response.json({
          success: false,
          error: "REQUIRED_FIELDS_MISSING",
          required: [
            "fb_page_id",
            "fb_post_id",
            "message"
          ]
        }, {
          status: 400
        });
      }
      /*
         * UI-PUBLISHED AUCTION REGISTRATION
         *
         * facebook-auction-publish already knows the exact:
         *   - Facebook Page ID
         *   - Facebook post ID
         *   - final EO2MATE caption
         *
         * Do NOT route this internal registration back through
         * processFeedEvents(), because that path hydrates the post
         * from Graph and catches/swallow errors internally.
         *
         * Calling processPost() directly:
         *   1. removes the unnecessary Graph hydration dependency;
         *   2. preserves the exact caption generated by the UI;
         *   3. lets the real processing error reach this endpoint;
         *   4. remains idempotent when Meta later sends its normal
         *      Page feed webhook for the same post.
         */ try {
        await processPost({
          post_id: fbPostId,
          message,
          from: {
            id: fbPageId
          }
        });
      } catch (registrationError) {
        const registrationMessage = getErrorMessage(registrationError);
        errorLog("EO2MATE UI-PUBLISHED AUCTION REGISTRATION ERROR", {
          fbPageId,
          fbPostId,
          error: registrationMessage
        });
        return Response.json({
          success: false,
          error: "AUCTION_REGISTRATION_FAILED",
          message: registrationMessage,
          fb_page_id: fbPageId,
          fb_post_id: fbPostId
        }, {
          status: 500
        });
      }
      const registeredPost = await findAuctionPost(fbPostId);
      if (!registeredPost) {
        return Response.json({
          success: false,
          error: "AUCTION_REGISTRATION_FAILED",
          message: "processPost completed without creating an auction_posts row. Check environment entitlement, automation controls, and auction caption validation.",
          fb_page_id: fbPageId,
          fb_post_id: fbPostId
        }, {
          status: 500
        });
      }
      log("EO2MATE UI-PUBLISHED AUCTION REGISTERED", {
        fbPageId,
        fbPostId,
        auctionPostId: registeredPost.post_id,
        postType: registeredPost.post_type,
        environment: registeredPost.environment
      });
      return Response.json({
        success: true,
        registered: true,
        fb_page_id: fbPageId,
        fb_post_id: fbPostId,
        auction_post_id: registeredPost.post_id,
        post_type: registeredPost.post_type,
        environment: registeredPost.environment
      }, {
        status: 200
      });
    }
    /* =====================================================
         META WEBHOOK VERIFICATION
         ===================================================== */ if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        log("Meta webhook verification successful");
        return new Response(challenge || "", {
          status: 200,
          headers: {
            "Content-Type": "text/plain"
          }
        });
      }
      return new Response("Forbidden", {
        status: 403
      });
    }
    /* =====================================================
         POST ONLY
         ===================================================== */ if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const bodyText = await req.text();
    if (!bodyText) {
      return Response.json({
        success: false,
        error: "EMPTY_BODY"
      }, {
        status: 400
      });
    }
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch  {
      return Response.json({
        success: false,
        error: "INVALID_JSON"
      }, {
        status: 400
      });
    }
    log("Webhook received", payload);
    await processFeedEvents(payload);
    await processMessengerEvents(payload);
    return Response.json({
      success: true
    }, {
      status: 200
    });
  } catch (error) {
    errorLog("UNHANDLED META WEBHOOK ERROR", {
      error: getErrorMessage(error)
    });
    return Response.json({
      success: false,
      error: getErrorMessage(error)
    }, {
      status: 200
    });
  }
});
