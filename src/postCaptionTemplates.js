export const POST_CAPTION_TEMPLATE_PREFIX = "META_POST_CAPTION_TEMPLATE_";

export const POST_CAPTION_TEMPLATE_MODES = [
  { code: "AUCTION", label: "Auction" },
  { code: "MINING", label: "Mining" },
  { code: "PREORDER", label: "Pre-Order" },
  { code: "REGULAR_SALE", label: "Regular Sale" },
];

export const POST_CAPTION_TEMPLATE_CONTEXTS = [
  { code: "MAIN_SINGLE", label: "Single · Main post" },
  { code: "MAIN_MULTIPLE", label: "Multiple · Main post" },
  { code: "PHOTO_MULTIPLE", label: "Multiple · Photo caption" },
];

// Visual labels are applied only to generated content; custom seller text stays untouched.
const CAPTION_LINE_ICONS = [
  [/^Item:/i, "📦"], [/^Original Price:/i, "🏷️"], [/^Promo Price:/i, "🔥"],
  [/^(Price|Minimum Bid|Increment|Buyout):/i, "💰"],
  [/^(MINE|TAKE|LOCK):/i, "💎"],
  [/^(Sale Ends|Mining Ends|Pre-Order Until|Auction Ends|Ends):/i, "⏰"],
  [/^Payment Deadline:/i, "💳"], [/^(Available Qty|Quantity):/i, "📦"],
  [/^Max Qty \/ Buyer:/i, "👤"], [/^Required Down Payment:/i, "💳"],
  [/^Minimum Bidders:/i, "👥"], [/^Bid Cutoff:/i, "⏳"],
  [/^Comment /i, "💬"], [/^(To buy|To order|To bid|For this item),/i, "💬"],
];
export function decorateGeneratedCaption(text) {
  return String(text || "").split("\n").map(line => {
    if (!line.trim() || /^[\p{Extended_Pictographic}]/u.test(line.trim())) return line;
    const rule = CAPTION_LINE_ICONS.find(([pattern]) => pattern.test(line.trim()));
    return rule ? `${rule[1]} ${line}` : line;
  }).join("\n");
}

const DEFAULT_TEMPLATE = {
  MAIN_SINGLE: "{{seller_caption}}\n\n{{caption_marker}}\n{{details}}\n{{instructions}}\n\n{{follow_text}}",
  MAIN_MULTIPLE: "{{seller_caption}}\n\n{{caption_marker}}\n{{details}}\n{{instructions}}\n\n{{follow_text}}",
  PHOTO_MULTIPLE: "{{details}}\n{{instructions}}",
};

export const DEFAULT_POST_CAPTION_TEMPLATES = Object.fromEntries(
  POST_CAPTION_TEMPLATE_MODES.map(({ code }) => [code, { ...DEFAULT_TEMPLATE }]),
);

export function captionTemplateSettingKey(mode, context) {
  return `${POST_CAPTION_TEMPLATE_PREFIX}${String(mode).toUpperCase()}_${String(context).toUpperCase()}`;
}

export function renderPostCaptionTemplate(template, values = {}) {
  return String(template || "")
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, name) => String(values[name.toLowerCase()] ?? ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const POST_CAPTION_TEMPLATE_TOKENS = [
  { token: "{{seller_caption}}", description: "Caption text entered by the seller." },
  { token: "{{caption_marker}}", description: "Configured post type marker; blank when none is set." },
  { token: "{{details}}", description: "Generated item, price, quantity, and auction/mining/pre-order details." },
  { token: "{{instructions}}", description: "Generated buyer instructions, including comment commands." },
  { token: "{{follow_text}}", description: "Follow-page closing line." },
];

