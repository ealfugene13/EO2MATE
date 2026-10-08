import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import "./PurchasesPage.css";

const money = (n) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(n || 0),
  );
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila" }).format(
    new Date(),
  );
const quantityRemaining = (l) =>
  Math.round((Number(l.quantity) - Number(l.received_quantity)) * 10000) /
  10000;
const key = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();
const uuid = () => crypto.randomUUID();
const newLine = () => ({
  key: uuid(),
  item_code: "",
  quantity: "1",
  unit_cost: "0",
});
const newPurchase = () => ({
  purchase_ref: "",
  purchase_date: today(),
  supplier_code: "",
  paid_amount: "0",
  notes: "",
  lines: [newLine()],
});
const newSupplier = () => ({
  supplier_code: "",
  supplier_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
});
const columns = [
  "purchase_ref",
  "purchase_date",
  "supplier_code",
  "item_code",
  "quantity",
  "unit_cost",
  "paid_amount",
  "notes",
];
// Fixed-point arithmetic matches PostgreSQL rounding for purchase line amounts.
function scaledValue(value, scale) {
  const text = String(value ?? "").trim();
  if (!new RegExp(`^\\d{1,18}(\\.\\d{1,${scale}})?$`).test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0"))
  );
}
function lineCents(line) {
  const quantity = scaledValue(line.quantity, 4),
    cost = scaledValue(line.unit_cost, 2);
  return quantity === null || cost === null
    ? 0n
    : (quantity * cost + 5000n) / 10000n;
}
const centsText = (cents) =>
  `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
export const purchaseTotal = (p) =>
  centsText(p.lines.reduce((sum, line) => sum + lineCents(line), 0n));
const total = purchaseTotal;

const newInventoryItem = () => ({
  item_code: "",
  item_name: "",
  description: "",
  default_selling_price: "0",
});

function Icon({ type }) {
  const paths = {
    summary: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    purchases: (
      <>
        <path d="M3 3h2l3 12h10l3-9H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
    suppliers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" />
      </>
    ),
    receiving: (
      <>
        <path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10m-5-5 3 3 6-6" />
      </>
    ),
    add: <path d="M12 5v14M5 12h14" />,
    upload: <path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5" />,
    download: <path d="M12 3v13m-4-4 4 4 4-4M4 16v5h16v-5" />,
    print: (
      <>
        <path d="M6 8V3h12v5M6 17H3V8h18v9h-3" />
        <path d="M6 14h12v7H6zM17 11h1" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 5v6h-6M4 19v-6h6" />
        <path d="M6 8a7 7 0 0 1 12-1l2 4M4 13l2 4a7 7 0 0 0 12-1" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] || paths.purchases}
    </svg>
  );
}
function Action({ icon, children, className = "secondary-button", ...props }) {
  return (
    <button type="button" className={`${className} purchase-action`} {...props}>
      <Icon type={icon} />
      {children}
    </button>
  );
}
function Metric({ title, value, note }) {
  return (
    <div className="metric-card metric-button">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-subtitle">{note}</div>
    </div>
  );
}
function Field({ label, children, wide }) {
  return (
    <label className={`purchase-field${wide ? " purchase-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Badge({ value }) {
  return (
    <span className={`purchase-badge purchase-${key(value)}`}>
      {value || "—"}
    </span>
  );
}

export function parsePurchaseCSV(text) {
  const records = [];
  let row = [],
    value = "",
    quoted = false,
    afterQuote = false;
  const cell = () => {
    row.push(value.trim());
    value = "";
    afterQuote = false;
  };
  const record = () => {
    cell();
    if (row.some((c) => c !== "")) records.push(row);
    row = [];
  };
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else value += c;
    } else if (c === "," || c === "\n" || c === "\r") {
      if (c === ",") cell();
      else {
        if (c === "\r" && text[i + 1] === "\n") i++;
        record();
      }
    } else if (c === '"' && !value.trim() && !afterQuote) {
      value = "";
      quoted = true;
    } else if (afterQuote && !/\s/.test(c))
      throw new Error("Unexpected text after a quoted CSV field.");
    else if (c === '"')
      throw new Error("Escape quotes inside fields as two quotes.");
    else if (!afterQuote) value += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  if (value || row.length || afterQuote) record();
  if (records.length < 2)
    throw new Error("Add at least one purchase item below the CSV headers.");
  const headers = records.shift().map(key);
  if (new Set(headers).size !== headers.length)
    throw new Error("Duplicate column names.");
  for (const c of columns.slice(0, 6))
    if (!headers.includes(c)) throw new Error(`Missing column: ${c}.`);
  if (headers.some((h) => !columns.includes(h)))
    throw new Error("Use the purchase template column names.");
  if (records.length > 1000)
    throw new Error("Maximum 1,000 item rows per upload.");
  return records.map((cells, i) => {
    if (cells.length !== headers.length)
      throw new Error(`Record ${i + 2}: field count differs from the headers.`);
    return Object.fromEntries(headers.map((h, j) => [h, cells[j]]));
  });
}
export function groupPurchaseRows(rows) {
  const map = new Map();
  rows.forEach((r, i) => {
    const id = key(r.purchase_ref),
      p = map.get(id);
    if (p) {
      if (
        p.purchase_date !== r.purchase_date ||
        key(p.supplier_code) !== key(r.supplier_code) ||
        Number(p.paid_amount) !== Number(r.paid_amount || 0) ||
        p.notes !== (r.notes || "")
      )
        throw new Error(
          `Record ${i + 2}: date, supplier, paid amount and notes must match other rows of this purchase.`,
        );
      p.lines.push({
        item_code: r.item_code,
        quantity: r.quantity,
        unit_cost: r.unit_cost,
      });
    } else
      map.set(id, {
        purchase_ref: r.purchase_ref,
        purchase_date: r.purchase_date,
        supplier_code: r.supplier_code,
        paid_amount: r.paid_amount || "0",
        notes: r.notes || "",
        lines: [
          {
            item_code: r.item_code,
            quantity: r.quantity,
            unit_cost: r.unit_cost,
          },
        ],
      });
  });
  return [...map.values()];
}
export function validatePurchases(purchases, suppliers, items, existing = []) {
  const errors = [],
    refs = new Set(),
    codes = new Map(),
    knownRefs = new Set(existing.map((p) => key(p.purchase_ref))),
    supplierCodes = new Set(suppliers.map((s) => key(s.supplier_code)));
  items.forEach((i) => {
    const k = key(i.item_code);
    codes.set(k, codes.has(k) ? null : i);
  });
  if (!purchases.length || purchases.length > 100)
    errors.push("Create between 1 and 100 purchases per upload.");
  if (purchases.reduce((n, p) => n + p.lines.length, 0) > 1000)
    errors.push("Maximum 1,000 item rows per upload.");
  purchases.forEach((p, i) => {
    const label = p.purchase_ref || `Purchase ${i + 1}`,
      ref = key(p.purchase_ref),
      seen = new Set();
    if (!ref || p.purchase_ref.length > 100)
      errors.push(`${label}: reference required, maximum 100 characters.`);
    if (refs.has(ref) || knownRefs.has(ref))
      errors.push(
        `${label}: purchase reference already exists or is duplicated.`,
      );
    refs.add(ref);
    const d = new Date(`${p.purchase_date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(p.purchase_date) ||
      Number.isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== p.purchase_date
    )
      errors.push(`${label}: use a valid YYYY-MM-DD date.`);
    if (!supplierCodes.has(key(p.supplier_code)))
      errors.push(`${label}: supplier code is not registered.`);
    if (!p.lines.length) errors.push(`${label}: add an item.`);
    p.lines.forEach((l, j) => {
      const k = key(l.item_code),
        q = String(l.quantity).trim(),
        c = String(l.unit_cost).trim();
      if (!codes.get(k))
        errors.push(
          `${label}, item ${j + 1}: unknown or ambiguous inventory item code.`,
        );
      if (seen.has(k))
        errors.push(
          `${label}: duplicate item ${l.item_code}; combine quantities.`,
        );
      seen.add(k);
      if (
        scaledValue(q, 4) === null ||
        Number(q) <= 0 ||
        scaledValue(q, 4) > 999999999999999999n
      )
        errors.push(
          `${label}, item ${j + 1}: positive quantity required, maximum 4 decimals.`,
        );
      if (scaledValue(c, 2) === null || scaledValue(c, 2) > 999999999999999999n)
        errors.push(
          `${label}, item ${j + 1}: non-negative unit cost required, maximum 2 decimals.`,
        );
    });
    const paid = scaledValue(p.paid_amount || "0", 2),
      amount = p.lines.reduce((sum, line) => sum + lineCents(line), 0n);
    if (amount > 999999999999999999n)
      errors.push(`${label}: total exceeds the supported purchase amount.`);
    if (paid === null || paid > amount)
      errors.push(
        `${label}: paid amount must be between zero and purchase total.`,
      );
  });
  return errors;
}
function downloadTemplate(supplier, item) {
  const rows = [
    columns,
    [
      "PO-001",
      today(),
      supplier?.supplier_code || "SUP-001",
      item?.item_code || "ITEM-001",
      "5",
      "100",
      "0",
      "",
    ],
  ];
  const csv = rows
    .map((r) =>
      r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "EO2MATE-Purchase-Template.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function purchasePrintHTML(detail, supplier, client) {
  const h = escapeHTML,
    p = detail.purchase;
  supplier = p.supplier_snapshot || supplier;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Purchase order ${h(p.purchase_ref)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172235;margin:0}header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #31933c;padding-bottom:18px}h1{font-size:25px;margin:4px 0}h2{font-size:14px;margin:0 0 8px}p{margin:4px 0;line-height:1.6}.brand{font-size:19px;font-weight:bold}.meta{text-align:right}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:10px 8px;border-bottom:1px solid #dfe5ed;text-align:left;overflow-wrap:anywhere}th{background:#f0f4f8;font-size:10px;text-transform:uppercase}thead{display:table-header-group}tr{break-inside:avoid}.number{text-align:right}.totals{margin:20px 0 24px auto;width:260px}.totals p{display:flex;justify-content:space-between;border-bottom:1px solid #e5eaf0;padding:8px 0}.notes{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:#f6f8fb}.signatures{display:flex;justify-content:space-between;margin-top:48px;gap:40px}.signatures span{border-top:1px solid #8793a5;padding-top:8px;flex:1;color:#64748b}footer{margin-top:24px;color:#64748b;font-size:10px}</style></head><body><header><div><div class="brand">${h(client?.name || client?.client_name || "EO2MATE")}</div><h1>Purchase Order</h1></div><div class="meta"><p><b>${h(p.purchase_ref)}</b></p><p>Date: ${h(p.purchase_date)}</p><p>Status: ${h(p.status)}</p></div></header><section class="parties"><div><h2>Supplier</h2><p><b>${h(supplier?.supplier_name || "—")}</b></p><p>${h(supplier?.supplier_code)}</p><p>${h(supplier?.contact_name)}</p><p>${h(supplier?.address)}</p><p>${h([supplier?.email, supplier?.phone].filter(Boolean).join(" · "))}</p></div><div><h2>Ordered by</h2><p>${h(client?.name || client?.client_name || "EO2MATE client")}</p><p>Currency: PHP</p><p>${detail.lines.length} item lines</p></div></section><table><colgroup><col style="width:18%"><col style="width:36%"><col style="width:12%"><col style="width:16%"><col style="width:18%"></colgroup><thead><tr><th>Item code</th><th>Description</th><th class="number">Quantity</th><th class="number">Unit cost</th><th class="number">Amount</th></tr></thead><tbody>${detail.lines.map((l) => `<tr><td>${h(l.item_code)}</td><td>${h(l.item_name)}</td><td class="number">${h(l.quantity)}</td><td class="number">${h(money(l.unit_cost))}</td><td class="number">${h(money(l.line_total))}</td></tr>`).join("")}</tbody></table><div class="totals"><p><b>Purchase total</b><b>${h(money(p.total_cost))}</b></p><p><span>Recorded payment</span><span>${h(money(p.paid_amount))}</span></p><p><span>Balance</span><span>${h(money(Number(p.total_cost) - Number(p.paid_amount)))}</span></p></div>${p.notes ? `<h2>Notes</h2><div class="notes">${h(p.notes)}</div>` : ""}<div class="signatures"><span>Prepared by</span><span>Approved by</span><span>Supplier acknowledgement</span></div><footer>Generated by EO2MATE</footer></body></html>`;
}

export default function PurchasesPage({ client }) {
  const [tab, setTab] = useState("SUMMARY"),
    [purchases, setPurchases] = useState([]),
    [suppliers, setSuppliers] = useState([]),
    [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true),
    [saving, setSaving] = useState(false),
    [canWrite, setCanWrite] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1);
  const [modal, setModal] = useState(null),
    [modalError, setModalError] = useState(""),
    [form, setForm] = useState(newPurchase),
    [supplierForm, setSupplierForm] = useState(newSupplier);
  const [preview, setPreview] = useState([]),
    [fileName, setFileName] = useState(""),
    [detail, setDetail] = useState(null),
    [receipt, setReceipt] = useState({}),
    [receiptNotes, setReceiptNotes] = useState(""),
    [payment, setPayment] = useState(""),
    [reason, setReason] = useState("");
  const [itemForm, setItemForm] = useState(newInventoryItem);
  const itemReturn = useRef({ type: null, lineKey: null });
  const dialog = useRef(null),
    focus = useRef(null),
    version = useRef(0),
    request = useRef({ id: uuid(), signature: "" }),
    clientId = client?.client_id;
  const activeClient = useRef(clientId),
    fileVersion = useRef(0);
  activeClient.current = clientId;
  async function api(action, payload = {}) {
    if (!clientId) throw new Error("A client workspace is required.");
    if (activeClient.current !== clientId)
      throw new Error("Workspace changed. Refresh Purchases.");
    const { data, error: e } = await supabase.rpc("eo2mate_purchase_admin", {
      p_client: clientId,
      p_action: action,
      p_payload: payload,
    });
    if (activeClient.current !== clientId)
      throw new Error("Workspace changed. Refresh Purchases.");
    if (e)
      throw new Error(
        ["PGRST202", "42883"].includes(e.code)
          ? "Apply the purchase database migration before using Purchases."
          : e.message,
      );
    return data;
  }
  async function load() {
    const v = ++version.current;
    setBusy(true);
    setError("");
    try {
      const all = [],
        stock = [];
      let lookup;
      for (let offset = 0; ; offset += 500) {
        const d = await api("LIST", { offset });
        all.push(...d.purchases);
        if (d.purchases.length < 500) break;
      }
      for (let offset = 0; ; offset += 500) {
        const d = await api("LOOKUPS", { offset });
        lookup = d;
        stock.push(...d.items);
        if (d.items.length < 500) break;
      }
      if (v === version.current) {
        setPurchases(all);
        setItems(stock);
        setSuppliers(lookup.suppliers);
        setCanWrite(lookup.can_write);
      }
    } catch (e) {
      if (v === version.current) {
        setError(e.message);
        setCanWrite(false);
        setPurchases([]);
        setSuppliers([]);
        setItems([]);
      }
    } finally {
      if (v === version.current) setBusy(false);
    }
  }
  useEffect(() => {
    fileVersion.current++;
    setModal(null);
    setDetail(null);
    setPreview([]);
    setMessage("");
    setSearch("");
    setStatus("ALL");
    setFrom("");
    setTo("");
    load();
    return () => {
      version.current++;
    };
  }, [clientId]);
  useEffect(() => setPage(1), [search, status, from, to, tab]);
  useEffect(() => {
    if (!modal) return;
    focus.current = document.activeElement;
    const el = dialog.current;
    el?.showModal();
    return () => {
      el?.close();
      focus.current?.focus?.();
    };
  }, [!!modal]);
  const filtered = useMemo(
    () =>
      purchases.filter(
        (p) =>
          (!search ||
            [p.purchase_ref, p.supplier_name, p.supplier_code]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (status === "ALL" || p.status === status) &&
          (!from || p.purchase_date >= from) &&
          (!to || p.purchase_date <= to) &&
          (tab !== "RECEIVING" || ["OPEN", "PARTIAL"].includes(p.status)),
      ),
    [purchases, search, status, from, to, tab],
  );
  const active = filtered.filter((p) => p.status !== "CANCELLED"),
    pages = Math.max(1, Math.ceil(filtered.length / 25)),
    current = Math.min(page, pages),
    shown = filtered.slice((current - 1) * 25, current * 25);
  const previewErrors = useMemo(
      () => validatePurchases(preview, suppliers, items, purchases),
      [preview, suppliers, items, purchases],
    ),
    supplier =
      detail &&
      (detail.purchase.supplier_snapshot ||
        suppliers.find((s) => s.supplier_id === detail.purchase.supplier_id)),
    remaining =
      detail?.lines.filter(
        (l) => Number(l.quantity) > Number(l.received_quantity),
      ) || [];
  function openModal(type) {
    setModalError("");
    setReason("");
    setModal(type);
    request.current = { id: uuid(), signature: "" };
  }
  function closeModal() {
    if (!saving) {
      fileVersion.current++;
      setModal(modal === "ITEM" ? itemReturn.current.type : null);
      setModalError("");
    }
  }
  function startNewInventoryItem(lineKey = null) {
    itemReturn.current = { type: modal, lineKey };
    setItemForm(newInventoryItem());
    openModal("ITEM");
  }
  async function saveInventoryItem() {
    if (saving || !canWrite) return;
    const code = itemForm.item_code.trim().toUpperCase(),
      name = itemForm.item_name.trim(),
      price = scaledValue(itemForm.default_selling_price, 2);
    if (!code || !name) {
      setModalError("Item code and name are required.");
      return;
    }
    if (items.some((item) => key(item.item_code) === key(code))) {
      setModalError(
        "This item code already exists. Select the existing item, or use a different code.",
      );
      return;
    }
    if (price === null || price > 999999999999999999n) {
      setModalError(
        "Enter a non-negative selling price with at most 2 decimals.",
      );
      return;
    }
    const workspace = clientId,
      destination = { ...itemReturn.current };
    setSaving(true);
    setModalError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "inventory-admin",
        {
          body: {
            action: "SAVE_ITEM",
            client_id: workspace,
            item_code: code,
            item_name: name,
            description: itemForm.description.trim(),
            default_selling_price: itemForm.default_selling_price,
            opening_quantity: 0,
            status: "ACTIVE",
            source_type: "MANUAL",
            created_from_post: false,
          },
        },
      );
      if (activeClient.current !== workspace) return;
      if (invokeError) {
        let message = invokeError.message;
        try {
          const body = await invokeError.context?.json();
          message = body?.error || body?.message || message;
        } catch {}
        throw new Error(message || "Unable to create the inventory item.");
      }
      if (!data?.success || !data.item?.inventory_item_id)
        throw new Error(data?.error || "The inventory item was not saved.");
      const item = data.item;
      if (item.client_id !== workspace)
        throw new Error("Inventory item does not belong to this workspace.");
      setItems((previous) =>
        [
          ...previous.filter(
            (row) => row.inventory_item_id !== item.inventory_item_id,
          ),
          item,
        ].sort((a, b) => a.item_code.localeCompare(b.item_code)),
      );
      if (destination.lineKey)
        setForm((previous) => ({
          ...previous,
          lines: previous.lines.map((line) =>
            line.key === destination.lineKey
              ? { ...line, item_code: item.item_code }
              : line,
          ),
        }));
      setModal(destination.type);
      setMessage(
        `${item.item_code} created in Inventory with zero stock. Receive the purchase to add stock.`,
      );
    } catch (e) {
      if (activeClient.current === workspace) setModalError(e.message);
    } finally {
      setSaving(false);
    }
  }
  function requestId(payload) {
    const signature = JSON.stringify(payload);
    if (request.current.signature && request.current.signature !== signature)
      request.current.id = uuid();
    request.current.signature = signature;
    return request.current.id;
  }
  async function mutation(task, success) {
    if (saving) return;
    setSaving(true);
    setModalError("");
    setMessage("");
    try {
      await task();
      setModal(null);
      setMessage(success);
      await load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function openDetail(id) {
    setError("");
    try {
      const d = await api("DETAIL", { purchase_id: id });
      setDetail(d);
      setPayment(String(d.purchase.paid_amount));
      openModal("DETAIL");
    } catch (e) {
      setError(e.message);
    }
  }
  function editLine(id, field, value) {
    setForm((p) => ({
      ...p,
      lines: p.lines.map((l) => (l.key === id ? { ...l, [field]: value } : l)),
    }));
  }
  async function create(headers) {
    const errors = validatePurchases(headers, suppliers, items, purchases);
    if (errors.length) {
      setModalError(errors.join("\n"));
      return;
    }
    const payload = {
      purchases: headers.map((p) => ({
        ...p,
        lines: p.lines.map(({ item_code, quantity, unit_cost }) => ({
          item_code,
          quantity,
          unit_cost,
        })),
      })),
    };
    payload.request_id = requestId(payload);
    await mutation(
      () => api("CREATE", payload),
      `${headers.length} purchase${headers.length === 1 ? "" : "s"} created. Stock updates after receiving.`,
    );
  }
  async function previewFile(file) {
    const selected = ++fileVersion.current;
    setPreview([]);
    setModalError("");
    setFileName(file?.name || "");
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new Error(
          "Choose CSV. Save an Excel sheet as CSV UTF-8 before uploading.",
        );
      if (file.size > 2097152) throw new Error("Maximum file size: 2 MB.");
      const text = await file.text();
      if (selected === fileVersion.current)
        setPreview(groupPurchaseRows(parsePurchaseCSV(text)));
    } catch (e) {
      if (selected === fileVersion.current) setModalError(e.message);
    }
  }
  async function startReceipt() {
    if (saving) return;
    setSaving(true);
    setModalError("");
    try {
      const fresh = await api("DETAIL", {
        purchase_id: detail.purchase.purchase_id,
      });
      setDetail(fresh);
      if (!["OPEN", "PARTIAL"].includes(fresh.purchase.status))
        throw new Error("This purchase is already received or cancelled.");
      const pending = fresh.lines.filter((l) => quantityRemaining(l) > 0);
      setReceipt(
        Object.fromEntries(
          pending.map((l) => [
            l.purchase_line_id,
            String(quantityRemaining(l)),
          ]),
        ),
      );
      setReceiptNotes("");
      openModal("RECEIVE");
    } catch (e) {
      setModalError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function receive() {
    const lines = remaining
      .map((l) => ({
        purchase_line_id: l.purchase_line_id,
        quantity: String(receipt[l.purchase_line_id] || "0").trim(),
      }))
      .filter((l) => Number(l.quantity) !== 0);
    if (
      !lines.length ||
      lines.some((l) => {
        const item = detail.lines.find(
          (x) => x.purchase_line_id === l.purchase_line_id,
        );
        return (
          !/^\d+(\.\d{1,4})?$/.test(l.quantity) ||
          Number(l.quantity) <= 0 ||
          Number(l.quantity) > quantityRemaining(item)
        );
      })
    ) {
      setModalError(
        "Enter positive quantities within the remaining quantities (maximum 4 decimals).",
      );
      return;
    }
    const payload = {
      purchase_id: detail.purchase.purchase_id,
      items: lines,
      notes: receiptNotes,
    };
    payload.request_id = requestId(payload);
    await mutation(
      () => api("RECEIVE", payload),
      "Receipt confirmed. Inventory stock has been updated.",
    );
  }
  function printPurchase() {
    const popup = window.open("", "_blank");
    if (!popup) {
      setModalError("Allow pop-ups to print the purchase order.");
      return;
    }
    popup.opener = null;
    popup.document.open();
    popup.document.write(purchasePrintHTML(detail, supplier, client));
    popup.document.close();
    popup.focus();
    popup.print();
  }
  const table = (
    <div className="table-wrapper">
      <table className="purchase-table">
        <thead>
          <tr>
            <th>Purchase / date</th>
            <th>Supplier</th>
            <th>Items / received</th>
            <th>Total / balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.purchase_id}>
              <td data-label="Purchase / date">
                <button
                  type="button"
                  className="purchase-reference"
                  onClick={() => openDetail(p.purchase_id)}
                >
                  {p.purchase_ref}
                </button>
                <small>{p.purchase_date}</small>
              </td>
              <td data-label="Supplier">
                {p.supplier_name}
                <small>{p.supplier_code}</small>
              </td>
              <td data-label="Items / received">
                {p.item_count} item lines
                <small>
                  {Number(p.received_quantity || 0)} /{" "}
                  {Number(p.ordered_quantity || 0)} received
                </small>
              </td>
              <td data-label="Total / balance">
                {money(p.total_cost)}
                <small>
                  Balance {money(Number(p.total_cost) - Number(p.paid_amount))}
                </small>
              </td>
              <td data-label="Status">
                <Badge value={p.status} />
              </td>
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan="5" className="empty-table-cell">
                No purchases match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="purchase-pagination">
        <span>
          Page {current} of {pages}
        </span>
        <div className="purchase-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="purchase-workspace">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PURCHASING</p>
          <h1>Purchases</h1>
          <p>
            Create purchase orders, manage suppliers and receive stock into
            Inventory.
          </p>
        </div>
        <div className="purchase-actions">
          <Action
            icon="add"
            className="primary-button"
            disabled={!canWrite || busy}
            onClick={() => {
              setForm(newPurchase());
              openModal("CREATE");
            }}
          >
            New purchase
          </Action>
          <Action
            icon="add"
            disabled={!canWrite || busy}
            onClick={() => startNewInventoryItem()}
          >
            New inventory item
          </Action>
          <Action
            icon="upload"
            disabled={!canWrite || busy}
            onClick={() => {
              setPreview([]);
              setFileName("");
              openModal("UPLOAD");
            }}
          >
            Bulk upload
          </Action>
          <Action
            icon="refresh"
            className="icon-button refresh-icon-button"
            disabled={busy}
            onClick={load}
            title="Refresh Purchases"
            aria-label="Refresh Purchases"
          />
        </div>
      </header>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}
      {!busy && !error && !canWrite && (
        <p className="purchase-note">
          Purchases is in view-only mode. Changes require an active STAFF role,
          or OWNER / ADMIN access with two-factor authentication completed.
        </p>
      )}
      {busy ? (
        <div className="loading-card" role="status">
          Loading Purchases…
        </div>
      ) : (
        !error && (
          <>
            <section className="metrics-grid">
              <Metric
                title="Purchases"
                value={money(
                  active.reduce((n, p) => n + Number(p.total_cost), 0),
                )}
                note="Matching purchases"
              />
              <Metric
                title="Open POs"
                value={
                  active.filter((p) => ["OPEN", "PARTIAL"].includes(p.status))
                    .length
                }
                note="Awaiting full receipt"
              />
              <Metric
                title="Received"
                value={active.filter((p) => p.status === "RECEIVED").length}
                note="Completed receipts"
              />
              <Metric
                title="Suppliers"
                value={suppliers.length}
                note="Registered suppliers"
              />
              <Metric
                title="Items received"
                value={active.reduce(
                  (n, p) => n + Number(p.received_quantity || 0),
                  0,
                )}
                note="Received quantity"
              />
              <Metric
                title="Outstanding"
                value={money(
                  active.reduce(
                    (n, p) => n + Number(p.total_cost) - Number(p.paid_amount),
                    0,
                  ),
                )}
                note="Recorded supplier balance"
              />
            </section>
            <section
              className="dashboard-panel selling-workspace-nav-panel"
              style={{ marginBottom: 18 }}
            >
              <div
                className="selling-workspace-nav"
                role="tablist"
                aria-label="Purchase sections"
              >
                {[
                  ["SUMMARY", "Summary", "summary"],
                  ["PURCHASES", "Purchases", "purchases"],
                  ["SUPPLIERS", "Suppliers", "suppliers"],
                  ["RECEIVING", "Receiving", "receiving"],
                ].map(([k, label, icon]) => (
                  <button
                    type="button"
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    aria-controls="purchase-panel"
                    className={
                      tab === k ? "primary-button" : "secondary-button"
                    }
                    onClick={() => setTab(k)}
                  >
                    <span className="selling-nav-icon">
                      <Icon type={icon} />
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
            {tab !== "SUPPLIERS" && (
              <section className="toolbar-card purchase-filters">
                <Field label="Search">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Purchase reference or supplier…"
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ALL">All statuses</option>
                    {["OPEN", "PARTIAL", "RECEIVED", "CANCELLED"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="From">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSearch("");
                    setStatus("ALL");
                    setFrom("");
                    setTo("");
                  }}
                >
                  Reset
                </button>
              </section>
            )}
            {from && to && from > to && (
              <p role="alert" className="error-message">
                The end date must be on or after the start date.
              </p>
            )}
            <section
              className="dashboard-panel"
              id="purchase-panel"
              role="tabpanel"
            >
              <div className="panel-header">
                <div>
                  <h2>
                    {tab === "SUMMARY"
                      ? "Purchase summary"
                      : tab === "RECEIVING"
                        ? "Awaiting receipt"
                        : tab === "SUPPLIERS"
                          ? "Suppliers"
                          : "Purchase orders"}
                  </h2>
                  <p>
                    {tab === "SUPPLIERS"
                      ? `${suppliers.length} registered suppliers`
                      : tab === "RECEIVING"
                        ? "Confirm received quantities to update stock."
                        : `${filtered.length} matching purchases`}
                  </p>
                </div>
                {tab === "SUPPLIERS" && (
                  <Action
                    icon="add"
                    className="primary-button"
                    disabled={!canWrite}
                    onClick={() => {
                      setSupplierForm(newSupplier());
                      openModal("SUPPLIER");
                    }}
                  >
                    New supplier
                  </Action>
                )}
              </div>
              {tab === "SUPPLIERS" ? (
                <div className="table-wrapper">
                  <table className="purchase-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Supplier</th>
                        <th>Contact</th>
                        <th>Email / phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => (
                        <tr key={s.supplier_id}>
                          <td data-label="Code">
                            <button
                              type="button"
                              className="purchase-reference"
                              disabled={!canWrite}
                              onClick={() => {
                                setSupplierForm(s);
                                openModal("SUPPLIER");
                              }}
                            >
                              {s.supplier_code}
                            </button>
                          </td>
                          <td data-label="Supplier">
                            {s.supplier_name}
                            <small>{s.address}</small>
                          </td>
                          <td data-label="Contact">{s.contact_name || "—"}</td>
                          <td data-label="Email / phone">
                            {s.email || "—"}
                            <small>{s.phone}</small>
                          </td>
                        </tr>
                      ))}
                      {!suppliers.length && (
                        <tr>
                          <td colSpan="4" className="empty-table-cell">
                            Add a supplier before creating or uploading
                            purchases.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                table
              )}
            </section>
          </>
        )
      )}
      {modal && (
        <dialog
          ref={dialog}
          className="purchase-dialog"
          aria-labelledby="purchase-dialog-title"
          onCancel={(e) => {
            e.preventDefault();
            if (!saving) closeModal();
          }}
        >
          <header className="panel-header">
            <div>
              <p className="eyebrow">PURCHASING</p>
              <h2 id="purchase-dialog-title">
                {modal === "ITEM"
                  ? "New inventory item"
                  : modal === "CREATE"
                    ? "New purchase"
                    : modal === "UPLOAD"
                      ? "Bulk purchase upload"
                      : modal === "SUPPLIER"
                        ? supplierForm.supplier_id
                          ? "Edit supplier"
                          : "New supplier"
                        : modal === "RECEIVE"
                          ? "Receive stock"
                          : modal === "PAYMENT"
                            ? "Record supplier payment"
                            : modal === "CANCEL"
                              ? "Cancel purchase"
                              : detail?.purchase.purchase_ref}
              </h2>
            </div>
            <Action
              icon="close"
              className="icon-button"
              aria-label="Close purchase dialog"
              disabled={saving}
              onClick={closeModal}
            />
          </header>
          {modalError && (
            <div className="error-message purchase-errors" role="alert">
              {modalError}
            </div>
          )}
          {modal === "ITEM" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveInventoryItem();
              }}
            >
              <p className="purchase-note">
                Create the item in Inventory without leaving Purchases. It
                starts with zero stock and uses your default inventory owner.
                Confirm a purchase receipt to add stock.
              </p>
              <fieldset className="purchase-item-fields" disabled={saving}>
                <div className="purchase-form-grid">
                  <Field label="New item code *">
                    <input
                      required
                      maxLength="100"
                      value={itemForm.item_code}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          item_code: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="New item name *">
                    <input
                      required
                      maxLength="200"
                      value={itemForm.item_name}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          item_name: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Default selling price (PHP)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.default_selling_price}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          default_selling_price: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Description" wide>
                    <textarea
                      maxLength="4000"
                      value={itemForm.description}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          description: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </fieldset>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={closeModal}
                >
                  Back
                </button>
                <Action
                  type="submit"
                  icon="add"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Create inventory item"}
                </Action>
              </footer>
            </form>
          )}
          {modal === "CREATE" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create([form]);
              }}
            >
              <div className="purchase-form-grid">
                <Field label="Purchase reference *">
                  <input
                    required
                    maxLength="100"
                    value={form.purchase_ref}
                    onChange={(e) =>
                      setForm({ ...form, purchase_ref: e.target.value })
                    }
                  />
                </Field>
                <Field label="Purchase date *">
                  <input
                    required
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) =>
                      setForm({ ...form, purchase_date: e.target.value })
                    }
                  />
                </Field>
                <Field label="Supplier *">
                  <select
                    required
                    value={form.supplier_code}
                    onChange={(e) =>
                      setForm({ ...form, supplier_code: e.target.value })
                    }
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.supplier_id} value={s.supplier_code}>
                        {s.supplier_code} — {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Already paid (PHP)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.paid_amount}
                    onChange={(e) =>
                      setForm({ ...form, paid_amount: e.target.value })
                    }
                  />
                </Field>
                <Field label="Notes" wide>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="purchase-section-title">
                <h3>Items</h3>
                <div className="purchase-actions">
                  <Action
                    icon="add"
                    onClick={() =>
                      startNewInventoryItem(
                        form.lines.find((line) => !line.item_code)?.key,
                      )
                    }
                  >
                    New inventory item
                  </Action>
                  <Action
                    icon="add"
                    disabled={form.lines.length >= 1000}
                    onClick={() =>
                      setForm({ ...form, lines: [...form.lines, newLine()] })
                    }
                  >
                    Add item
                  </Action>
                </div>
              </div>
              {form.lines.map((l, i) => (
                <div className="purchase-line-form" key={l.key}>
                  <Field label={`Item ${i + 1} *`}>
                    <select
                      required
                      value={l.item_code}
                      onChange={(e) =>
                        e.target.value === "__CREATE_NEW_ITEM__"
                          ? startNewInventoryItem(l.key)
                          : editLine(l.key, "item_code", e.target.value)
                      }
                    >
                      <option value="">Select inventory item</option>
                      <option value="__CREATE_NEW_ITEM__">
                        + Create new inventory item
                      </option>
                      {items.map((item) => (
                        <option
                          key={item.inventory_item_id}
                          value={item.item_code}
                        >
                          {item.item_code} — {item.item_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Quantity *">
                    <input
                      required
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={l.quantity}
                      onChange={(e) =>
                        editLine(l.key, "quantity", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Unit cost (PHP) *">
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unit_cost}
                      onChange={(e) =>
                        editLine(l.key, "unit_cost", e.target.value)
                      }
                    />
                  </Field>
                  <div className="purchase-line-total">
                    <span>Amount</span>
                    <strong>{money(centsText(lineCents(l)))}</strong>
                  </div>
                  <Action
                    icon="close"
                    className="icon-button"
                    aria-label={`Remove item ${i + 1}`}
                    disabled={form.lines.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        lines: form.lines.filter((x) => x.key !== l.key),
                      })
                    }
                  />
                </div>
              ))}
              <div className="purchase-total">
                <span>Purchase total</span>
                <strong>{money(total(form))}</strong>
              </div>
              <p className="purchase-note">
                Stock updates only after receiving. Use existing Inventory item
                codes.
              </p>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <Action
                  type="submit"
                  icon="add"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Create purchase"}
                </Action>
              </footer>
            </form>
          )}
          {modal === "SUPPLIER" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation(
                  () => api("SAVE_SUPPLIER", supplierForm),
                  "Supplier saved.",
                );
              }}
            >
              <div className="purchase-form-grid">
                {[
                  ["supplier_code", "Supplier code *"],
                  ["supplier_name", "Supplier name *"],
                  ["contact_name", "Contact name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["address", "Address"],
                ].map(([field, label]) => (
                  <Field key={field} label={label}>
                    <input
                      type={field === "email" ? "email" : "text"}
                      required={
                        field === "supplier_code" || field === "supplier_name"
                      }
                      maxLength={
                        field === "supplier_code"
                          ? 80
                          : field === "supplier_name"
                            ? 200
                            : 1000
                      }
                      value={supplierForm[field] || ""}
                      onChange={(e) =>
                        setSupplierForm({
                          ...supplierForm,
                          [field]: e.target.value,
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <Action
                  type="submit"
                  icon="add"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save supplier"}
                </Action>
              </footer>
            </form>
          )}
          {modal === "UPLOAD" && (
            <>
              <div className="purchase-upload-intro">
                <h3>Create multiple purchase orders</h3>
                <p>
                  One row per item. Repeat the purchase reference to group items
                  into one order. Supplier and inventory item codes must already
                  exist. You can create missing inventory items here before
                  submitting the upload.
                </p>
                <p>
                  Maximum 1,000 rows / 100 purchases / 2 MB. Use YYYY-MM-DD
                  dates and PHP unit costs. Repeat the paid amount and notes on
                  every row of the same purchase.
                </p>
                <div className="purchase-actions">
                  <Action icon="add" onClick={() => startNewInventoryItem()}>
                    New inventory item
                  </Action>
                  <Action
                    icon="download"
                    onClick={() => downloadTemplate(suppliers[0], items[0])}
                  >
                    Download CSV template
                  </Action>
                  <Field label="Upload CSV">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      disabled={saving}
                      onChange={(e) => previewFile(e.target.files?.[0])}
                    />
                  </Field>
                </div>
              </div>
              {preview.length > 0 && (
                <>
                  <div className="purchase-section-title">
                    <h3>Preview · {fileName}</h3>
                    <span>
                      {preview.length} purchases ·{" "}
                      {preview.reduce((n, p) => n + p.lines.length, 0)} item
                      rows
                    </span>
                  </div>
                  {previewErrors.length ? (
                    <div className="error-message purchase-errors" role="alert">
                      {previewErrors.join("\n")}
                    </div>
                  ) : (
                    <div className="success-message">
                      Validation passed. Review before creating the purchase
                      orders.
                    </div>
                  )}
                  <div className="purchase-preview">
                    {preview.map((p, i) => (
                      <section className="purchase-preview-order" key={i}>
                        <h3>{p.purchase_ref || "Missing reference"}</h3>
                        <p>
                          {p.purchase_date} · {p.supplier_code} · Total{" "}
                          {money(total(p))} · Paid {money(p.paid_amount)}
                        </p>
                        <table className="purchase-table">
                          <thead>
                            <tr>
                              <th>Item code</th>
                              <th>Quantity</th>
                              <th>Unit cost</th>
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.lines.map((l, j) => (
                              <tr key={j}>
                                <td>
                                  {l.item_code}
                                  <small>
                                    {
                                      items.find(
                                        (item) =>
                                          key(item.item_code) ===
                                          key(l.item_code),
                                      )?.item_name
                                    }
                                  </small>
                                </td>
                                <td>{l.quantity}</td>
                                <td>{money(l.unit_cost)}</td>
                                <td>{money(centsText(lineCents(l)))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {p.notes && <p className="purchase-notes">{p.notes}</p>}
                      </section>
                    ))}
                  </div>
                </>
              )}
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={closeModal}
                >
                  Close
                </button>
                <Action
                  icon="upload"
                  className="primary-button"
                  disabled={
                    saving || !preview.length || previewErrors.length > 0
                  }
                  onClick={() => create(preview)}
                >
                  {saving
                    ? "Creating…"
                    : `Create ${preview.length || ""} purchase${preview.length === 1 ? "" : "s"}`}
                </Action>
              </footer>
            </>
          )}
          {modal === "DETAIL" && detail && (
            <>
              <div className="purchase-detail-toolbar">
                <Badge value={detail.purchase.status} />
                <div className="purchase-actions">
                  <Action icon="print" onClick={printPurchase}>
                    Print purchase order
                  </Action>
                  {canWrite &&
                    ["OPEN", "PARTIAL"].includes(detail.purchase.status) && (
                      <Action
                        icon="receiving"
                        className="primary-button"
                        disabled={saving}
                        onClick={startReceipt}
                      >
                        Receive stock
                      </Action>
                    )}
                </div>
              </div>
              <div className="purchase-detail-grid">
                <section className="purchase-detail-card">
                  <h3>Supplier & purchase</h3>
                  <p>
                    <strong>{supplier?.supplier_name || "—"}</strong>
                  </p>
                  <p>{supplier?.contact_name}</p>
                  <p>{supplier?.address}</p>
                  <p>
                    {[supplier?.email, supplier?.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p>Purchase date: {detail.purchase.purchase_date}</p>
                </section>
                <section className="purchase-detail-card">
                  <h3>Amounts</h3>
                  <div className="purchase-amount">
                    <span>Total</span>
                    <strong>{money(detail.purchase.total_cost)}</strong>
                  </div>
                  <div className="purchase-amount">
                    <span>Recorded paid</span>
                    <strong>{money(detail.purchase.paid_amount)}</strong>
                  </div>
                  <div className="purchase-amount">
                    <span>Balance</span>
                    <strong>
                      {money(
                        Number(detail.purchase.total_cost) -
                          Number(detail.purchase.paid_amount),
                      )}
                    </strong>
                  </div>
                  {canWrite && detail.purchase.status !== "CANCELLED" && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openModal("PAYMENT")}
                    >
                      Update recorded payment
                    </button>
                  )}
                </section>
              </div>
              <div className="purchase-preview-order">
                <h3>Purchase items</h3>
                <table className="purchase-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Ordered / received</th>
                      <th>Unit cost</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((l) => (
                      <tr key={l.purchase_line_id}>
                        <td>
                          {l.item_code}
                          <small>{l.item_name}</small>
                        </td>
                        <td>
                          {Number(l.quantity)} / {Number(l.received_quantity)}
                        </td>
                        <td>{money(l.unit_cost)}</td>
                        <td>{money(l.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.purchase.notes && (
                <p className="purchase-note purchase-errors">
                  {detail.purchase.notes}
                </p>
              )}
              <section className="purchase-preview-order">
                <h3>Receipt history</h3>
                {detail.receipts.length ? (
                  detail.receipts.map((r) => (
                    <div
                      className="purchase-receipt-history"
                      key={r.receipt_id}
                    >
                      <strong>
                        {new Date(r.received_at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}
                      </strong>
                      <p>
                        {r.items
                          .map(
                            (item) =>
                              `${detail.lines.find((l) => l.purchase_line_id === item.purchase_line_id)?.item_code || "Item"}: ${item.quantity}`,
                          )
                          .join(" · ")}
                      </p>
                      <p>{r.notes}</p>
                    </div>
                  ))
                ) : (
                  <p>No stock received yet.</p>
                )}
              </section>
              <footer>
                {canWrite &&
                  detail.purchase.status === "OPEN" &&
                  Number(detail.purchase.paid_amount) === 0 && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openModal("CANCEL")}
                    >
                      Cancel purchase
                    </button>
                  )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                >
                  Close
                </button>
              </footer>
            </>
          )}
          {modal === "RECEIVE" && detail && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                receive();
              }}
            >
              <p className="purchase-note">
                Confirm actual received quantities for{" "}
                {detail.purchase.purchase_ref}. This adds stock to Inventory.
                Leave zero for items to receive later.
              </p>
              {remaining.map((l) => (
                <div className="purchase-receive-line" key={l.purchase_line_id}>
                  <div>
                    <strong>{l.item_code}</strong>
                    <p>{l.item_name}</p>
                    <small>
                      Ordered {Number(l.quantity)} · Received{" "}
                      {Number(l.received_quantity)} · Remaining{" "}
                      {quantityRemaining(l)}
                    </small>
                  </div>
                  <Field label="Receive now">
                    <input
                      type="number"
                      min="0"
                      max={quantityRemaining(l)}
                      step="0.0001"
                      value={receipt[l.purchase_line_id] || ""}
                      onChange={(e) =>
                        setReceipt({
                          ...receipt,
                          [l.purchase_line_id]: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
              <Field label="Receipt notes">
                <textarea
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                />
              </Field>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => openModal("DETAIL")}
                >
                  Back
                </button>
                <Action
                  type="submit"
                  icon="add"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Receiving…" : "Confirm receipt & update stock"}
                </Action>
              </footer>
            </form>
          )}
          {(modal === "PAYMENT" || modal === "CANCEL") && detail && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation(
                  () =>
                    api(modal === "PAYMENT" ? "SET_PAYMENT" : "CANCEL", {
                      purchase_id: detail.purchase.purchase_id,
                      paid_amount: payment,
                      reason,
                    }),
                  modal === "PAYMENT"
                    ? "Supplier payment record updated."
                    : "Purchase cancelled.",
                );
              }}
            >
              {modal === "PAYMENT" && (
                <Field
                  label={`Total paid to supplier (PHP), maximum ${money(detail.purchase.total_cost)}`}
                >
                  <input
                    required
                    type="number"
                    min="0"
                    max={detail.purchase.total_cost}
                    step="0.01"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                  />
                </Field>
              )}
              <Field
                label={
                  modal === "PAYMENT"
                    ? "Payment / refund note *"
                    : "Cancellation reason *"
                }
              >
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <p className="purchase-note">
                {modal === "PAYMENT"
                  ? "Records the total amount already paid, not an additional payment. This does not send money."
                  : "Only unreceived, unpaid purchases can be cancelled."}
              </p>
              <footer>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => openModal("DETAIL")}
                >
                  Back
                </button>
                <Action
                  type="submit"
                  icon="add"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : modal === "PAYMENT"
                      ? "Save payment record"
                      : "Confirm cancellation"}
                </Action>
              </footer>
            </form>
          )}
        </dialog>
      )}
    </div>
  );
}
