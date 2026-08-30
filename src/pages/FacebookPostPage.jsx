import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const DEFAULT_RULES = {
  minBid: "500",
  increment: "100",
  minimumBidders: "1",
  buyout: "",
  buyoutUntil: "",
  auctionEnds: "",
  bidCutoff: "60",
};

const REQUIRED_ENVIRONMENTS = [
  {
    environment_code: "CLNT",
    environment_name: "Client",
    is_active: true,
  },
  {
    environment_code: "TEST",
    environment_name: "Test",
    is_active: true,
  },
  {
    environment_code: "PROD",
    environment_name: "Production",
    is_active: true,
  },
];

function normalizeMoney(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(",", "")
    .replaceAll("₱", "")
    .replaceAll("php", "")
    .replace(/\s+/g, "");

  if (!raw) return null;

  let multiplier = 1;
  let numeric = raw;

  if (raw.endsWith("k")) {
    multiplier = 1000;
    numeric = raw.slice(0, -1);
  } else if (raw.endsWith("h")) {
    multiplier = 100;
    numeric = raw.slice(0, -1);
  }

  const parsed = Number(numeric);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * multiplier);
}

function getBuyoutAmount(value) {
  const raw = String(value ?? "").trim();

  if (raw === "") {
    return 0;
  }

  return normalizeMoney(raw);
}

function formatMoneyForCaption(value) {
  const parsed = normalizeMoney(value);

  if (parsed === null) {
    return "";
  }

  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  }).format(parsed);
}

function phDateFromLocalInput(value) {
  if (!value) return null;

  const raw = String(value).trim();

  if (!raw.includes("T")) {
    return null;
  }

  const date = new Date(`${raw}:00+08:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatFacebookAuctionDate(value) {
  const date = phDateFromLocalInput(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s+at\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPhilippineNowInput() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const values = {};

  parts.forEach((part) => {
    values[part.type] = part.value;
  });

  return (
    `${values.year}-${values.month}-${values.day}` +
    `T${values.hour}:${values.minute}`
  );
}

function splitDateTimeLocal(value) {
  const raw = String(value || "").trim();

  if (!raw || !raw.includes("T")) {
    return {
      date: "",
      hour12: "12",
      minute: "00",
      period: "AM",
    };
  }

  const [date, time = "00:00"] = raw.split("T");
  const [hourRaw = "0", minuteRaw = "00"] = time.split(":");

  let hour24 = Number(hourRaw);
  const minute = String(minuteRaw || "00").padStart(2, "0");

  if (!Number.isFinite(hour24)) hour24 = 0;

  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;

  if (hour12 === 0) hour12 = 12;

  return {
    date,
    hour12: String(hour12).padStart(2, "0"),
    minute,
    period,
  };
}

function combineDateTimeLocal({
  date,
  hour12,
  minute,
  period,
}) {
  if (!date) return "";

  let hour = Number(hour12);

  if (!Number.isFinite(hour) || hour < 1 || hour > 12) {
    hour = 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  } else if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  const safeMinute = String(minute || "00").padStart(2, "0");

  return `${date}T${String(hour).padStart(2, "0")}:${safeMinute}`;
}

function ScrollDateTimePicker({
  value,
  onChange,
  disabled = false,
  hasError = false,
  inputRef,
  minDate = getPhilippineNowInput().slice(0, 10),
}) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value || "");

  const committedParts = splitDateTimeLocal(value);
  const draftParts = splitDateTimeLocal(draftValue);

  useEffect(() => {
    if (!open) {
      setDraftValue(value || "");
    }
  }, [value, open]);

  const updateDraft = (patch) => {
    setDraftValue(
      combineDateTimeLocal({
        ...draftParts,
        ...patch,
      })
    );
  };

  const hours = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0")
  );

  const minutes = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, "0")
  );

  const displayValue = value
    ? formatFacebookAuctionDate(value)
    : "Select date & time";

  return (
    <div
      className={`eo2-datetime-control ${
        hasError ? "eo2-datetime-error" : ""
      }`}
      ref={inputRef}
      tabIndex={-1}
    >
      <button
        type="button"
        className="eo2-datetime-trigger"
        onClick={() => {
          if (disabled) return;
          setDraftValue(value || "");
          setOpen(true);
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "eo2-datetime-placeholder"}>
          {displayValue}
        </span>
        <span className="eo2-datetime-calendar" aria-hidden="true">
          ▣
        </span>
      </button>

      {open && (
        <div
          className="eo2-datetime-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
              setDraftValue(value || "");
            }
          }}
        >
          <div
            className="eo2-datetime-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Choose date and time"
          >
            <div className="eo2-datetime-dialog-header">
              <strong>Select date & time</strong>
              <button
                type="button"
                className="eo2-datetime-close"
                onClick={() => {
                  setOpen(false);
                  setDraftValue(value || "");
                }}
                aria-label="Close date and time picker"
              >
                ×
              </button>
            </div>

            <div className="eo2-datetime-dialog-body">
              <div className="eo2-date-part">
                <span className="eo2-datetime-label">Date</span>
                <input
                  type="date"
                  min={minDate}
                  value={draftParts.date}
                  onChange={(e) =>
                    updateDraft({ date: e.target.value })
                  }
                  disabled={disabled}
                />
              </div>

              <div className="eo2-time-part">
                <span className="eo2-datetime-label">Time</span>

                <div className="eo2-time-row">
                  <select
                    value={draftParts.hour12}
                    onChange={(e) =>
                      updateDraft({ hour12: e.target.value })
                    }
                    disabled={disabled}
                    aria-label="Hour"
                  >
                    {hours.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>

                  <span className="eo2-time-colon">:</span>

                  <select
                    value={draftParts.minute}
                    onChange={(e) =>
                      updateDraft({ minute: e.target.value })
                    }
                    disabled={disabled}
                    aria-label="Minute"
                  >
                    {minutes.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>

                  <select
                    value={draftParts.period}
                    onChange={(e) =>
                      updateDraft({ period: e.target.value })
                    }
                    disabled={disabled}
                    aria-label="AM or PM"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="eo2-datetime-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setOpen(false);
                  setDraftValue(value || "");
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={!draftParts.date}
                onClick={() => {
                  onChange(draftValue);
                  setOpen(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPageLabel(page) {
  return (
    page?.page_name ||
    page?.fb_page_name ||
    page?.name ||
    page?.page_title ||
    page?.display_name ||
    "Facebook Page"
  );
}

function normalizeEnvironmentRows(rows) {
  const source = Array.isArray(rows) ? rows : [];

  return REQUIRED_ENVIRONMENTS.map((required) => {
    const existing = source.find(
      (row) =>
        String(row?.environment_code || "").toUpperCase() ===
        required.environment_code
    );

    return {
      ...required,
      ...(existing || {}),
      environment_code: required.environment_code,
      environment_name:
        existing?.environment_name ||
        required.environment_name,
      is_active: true,
    };
  });
}

function buildRuleLines(
  rules,
  {
    includeItem = false,
    item = "",
  } = {}
) {
  const lines = [];

  if (includeItem && item.trim()) {
    lines.push(`Item: ${item.trim()}`);
  }

  const minBid = formatMoneyForCaption(rules.minBid);
  const increment = formatMoneyForCaption(rules.increment);

  const buyoutAmount = getBuyoutAmount(rules.buyout);

  const buyout =
    buyoutAmount !== null
      ? formatMoneyForCaption(rules.buyout)
      : "";

  if (minBid) {
    lines.push(`Minimum Bid: ${minBid}`);
  }

  if (increment) {
    lines.push(`Increment: ${increment}`);
  }

  const minimumBidders = Number(rules.minimumBidders || 1);

  if (
    Number.isFinite(minimumBidders) &&
    minimumBidders > 0
  ) {
    lines.push(
      `Minimum Bidders: ${Math.trunc(minimumBidders)}`
    );
  }

  if (
    buyoutAmount !== null &&
    buyoutAmount > 0 &&
    buyout
  ) {
    lines.push(`Buyout: ${buyout}`);

    if (rules.buyoutUntil) {
      lines.push(
        `Buyout Until: ${formatFacebookAuctionDate(
          rules.buyoutUntil
        )}`
      );
    }
  }

  if (rules.auctionEnds) {
    lines.push(
      `Auction Ends: ${formatFacebookAuctionDate(
        rules.auctionEnds
      )}`
    );
  }

  const bidCutoff = Number(rules.bidCutoff);

  if (
    Number.isFinite(bidCutoff) &&
    bidCutoff >= 0
  ) {
    lines.push(
      `Bid Cutoff: ${Math.trunc(bidCutoff)}`
    );
  }


  return lines;
}

function mergeRules(shared, item) {
  return {
    minBid: item.minBid || shared.minBid,
    increment: item.increment || shared.increment,
    minimumBidders:
      item.minimumBidders || shared.minimumBidders,
    buyout:
      item.buyout !== ""
        ? item.buyout
        : shared.buyout,
    buyoutUntil:
      item.buyoutUntil || shared.buyoutUntil,
    auctionEnds:
      item.auctionEnds || shared.auctionEnds,
    bidCutoff:
      item.bidCutoff !== ""
        ? item.bidCutoff
        : shared.bidCutoff,
  };
}

function createItem(file, index) {
  return {
    id: `${Date.now()}-${index}-${Math.random()
      .toString(36)
      .slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    item: "",
    minBid: "",
    increment: "",
    minimumBidders: "",
    buyout: "",
    buyoutUntil: "",
    auctionEnds: "",
    bidCutoff: "",
    itemSource: "MANUAL",
    inventoryItemId: "",
  };
}

function fieldClass(errors, fieldKey) {
  return errors[fieldKey]
    ? "eo2-field-error"
    : "";
}

function RuleFields({
  value,
  onChange,
  shared = false,
  disabled = false,
  fieldPrefix,
  fieldErrors,
  registerField,
}) {
  const set = (key, nextValue) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  const key = (name) =>
    `${fieldPrefix}.${name}`;

  const buyoutAmount =
    getBuyoutAmount(value.buyout);

  const buyoutEnabled =
    buyoutAmount !== null &&
    buyoutAmount > 0;

  return (
    <div
      className={`fb-rule-grid ${
        shared ? "shared" : "item-rules"
      } ${
        buyoutEnabled
          ? "has-buyout"
          : "no-buyout"
      }`}
    >
      <label
        className={`eo2-rule-compact eo2-rule-minbid ${fieldClass(
          fieldErrors,
          key("minBid")
        )}`}
      >
        <span className="eo2-rule-heading">
          Minimum Bid
          <span className="eo2-required">*</span>
        </span>

        <input
          ref={registerField(key("minBid"))}
          inputMode="decimal"
          value={value.minBid}
          onChange={(e) =>
            set("minBid", e.target.value)
          }
          placeholder={
            shared ? "500 or 5h" : "Inherit"
          }
          disabled={disabled}
          aria-invalid={Boolean(
            fieldErrors[key("minBid")]
          )}
        />

        <span className="eo2-rule-help">
          {fieldErrors[key("minBid")] && (
            <small className="eo2-field-error-text">
              {fieldErrors[key("minBid")]}
            </small>
          )}
        </span>
      </label>

      <label
        className={`eo2-rule-compact eo2-rule-increment ${fieldClass(
          fieldErrors,
          key("increment")
        )}`}
      >
        <span className="eo2-rule-heading">
          Increment
          <span className="eo2-required">*</span>
        </span>

        <input
          ref={registerField(key("increment"))}
          inputMode="decimal"
          value={value.increment}
          onChange={(e) =>
            set("increment", e.target.value)
          }
          placeholder={
            shared ? "100 or 1h" : "Inherit"
          }
          disabled={disabled}
          aria-invalid={Boolean(
            fieldErrors[key("increment")]
          )}
        />

        <span className="eo2-rule-help">
          {fieldErrors[key("increment")] && (
            <small className="eo2-field-error-text">
              {fieldErrors[key("increment")]}
            </small>
          )}
        </span>
      </label>

      <label className="eo2-rule-compact eo2-rule-bidders">
        <span className="eo2-rule-heading">
          Minimum Bidders
        </span>

        <input
          type="number"
          min="1"
          step="1"
          value={value.minimumBidders}
          onChange={(e) =>
            set("minimumBidders", e.target.value)
          }
          placeholder={shared ? "1" : "Inherit"}
          disabled={disabled}
        />

        <span className="eo2-rule-help" />
      </label>

      <label
        className={`eo2-rule-compact eo2-rule-buyout ${fieldClass(
          fieldErrors,
          key("buyout")
        )}`}
      >
        <span className="eo2-rule-heading">
          Buyout
        </span>

        <input
          ref={registerField(key("buyout"))}
          inputMode="decimal"
          value={value.buyout}
          onChange={(e) => {
            const nextBuyout = e.target.value;

            const parsedBuyout =
              getBuyoutAmount(nextBuyout);

            const buyoutEnabled =
              parsedBuyout !== null &&
              parsedBuyout > 0;

            onChange({
              ...value,
              buyout: nextBuyout,
              buyoutUntil:
                buyoutEnabled
                  ? value.buyoutUntil
                  : "",
            });
          }}
          placeholder={
            shared
              ? "Optional / 0 = disabled"
              : "Inherit"
          }
          disabled={disabled}
          aria-invalid={Boolean(
            fieldErrors[key("buyout")]
          )}
        />

        <span className="eo2-rule-help">
          {fieldErrors[key("buyout")] ? (
            <small className="eo2-field-error-text">
              {fieldErrors[key("buyout")]}
            </small>
          ) : (
            <small>
              Optional · 0 = No Buyout
            </small>
          )}
        </span>
      </label>

      {buyoutEnabled && (
          <label
            className={`eo2-rule-datetime eo2-rule-buyout-until ${fieldClass(
              fieldErrors,
              key("buyoutUntil")
            )}`}
          >
            <span className="eo2-rule-heading">
              Buyout Until
              <span className="eo2-required">*</span>
            </span>

            <ScrollDateTimePicker
              inputRef={registerField(
                key("buyoutUntil")
              )}
              value={value.buyoutUntil}
              onChange={(nextValue) =>
                set("buyoutUntil", nextValue)
              }
              disabled={disabled}
              hasError={Boolean(
                fieldErrors[key("buyoutUntil")]
              )}
            />

            {fieldErrors[key("buyoutUntil")] && (
              <small className="eo2-field-error-text">
                {fieldErrors[key("buyoutUntil")]}
              </small>
            )}
          </label>
        )}

      <label
        className={`eo2-rule-datetime eo2-rule-auction-ends ${fieldClass(
          fieldErrors,
          key("auctionEnds")
        )}`}
      >
        <span className="eo2-rule-heading">
          Auction Ends
          <span className="eo2-required">*</span>
        </span>

        <ScrollDateTimePicker
          inputRef={registerField(
            key("auctionEnds")
          )}
          value={value.auctionEnds}
          onChange={(nextValue) =>
            set("auctionEnds", nextValue)
          }
          disabled={disabled}
          hasError={Boolean(
            fieldErrors[key("auctionEnds")]
          )}
        />

        {fieldErrors[key("auctionEnds")] && (
          <small className="eo2-field-error-text">
            {fieldErrors[key("auctionEnds")]}
          </small>
        )}
      </label>

      <label className="eo2-rule-compact eo2-rule-short eo2-rule-cutoff">
        <span className="eo2-rule-heading">
          Bid Cutoff (mins)
        </span>

        <input
          type="number"
          min="0"
          step="1"
          value={value.bidCutoff}
          onChange={(e) =>
            set("bidCutoff", e.target.value)
          }
          placeholder={shared ? "60" : "Inherit"}
          disabled={disabled}
        />

        <span className="eo2-rule-help" />
      </label>

    </div>
  );
}

function getFacebookPostUrl(fbPostId) {
  const raw = String(fbPostId || "").trim();

  if (!raw) {
    return null;
  }

  const parts = raw.split("_");

  if (
    parts.length === 2 &&
    parts[0] &&
    parts[1]
  ) {
    return (
      `https://www.facebook.com/` +
      `${encodeURIComponent(parts[0])}/posts/` +
      `${encodeURIComponent(parts[1])}`
    );
  }

  return `https://www.facebook.com/${encodeURIComponent(
    raw
  )}`;
}

function extractFacebookPostId(value) {
  const text = String(value || "");

  const directMatch =
    text.match(
      /"fb_post_id"\s*:\s*"([^"]+)"/i
    );

  if (directMatch?.[1]) {
    return directMatch[1];
  }

  const looseMatch =
    text.match(/\b(\d+_\d+)\b/);

  return looseMatch?.[1] || null;
}

async function getFunctionErrorMessage(error) {
  let message =
    error?.message ||
    "Unable to publish the auction to Facebook.";

  const context = error?.context;

  if (
    context &&
    typeof context.clone === "function"
  ) {
    try {
      const response = context.clone();
      const body = await response.json();

      if (body?.message) {
        message = String(body.message);
      } else if (body?.error) {
        message = String(body.error);
      }
    } catch {
      // Preserve original error.
    }
  }

  return message;
}

export default function FacebookPostPage({
  client,
}) {
  const fileInputRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const fieldRefs = useRef({});
  const itemsRef = useRef([]);

  const [pages, setPages] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [postTypes, setPostTypes] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [postType, setPostType] = useState("");
  const [sellerCaption, setSellerCaption] = useState("");
  const [singleItem, setSingleItem] = useState("");
  const [singleItemSource, setSingleItemSource] = useState("MANUAL");
  const [singleInventoryItemId, setSingleInventoryItemId] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [sharedRules, setSharedRules] = useState({
    ...DEFAULT_RULES,
  });
  const [items, setItems] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [successPopup, setSuccessPopup] = useState(null);
  const [failurePopup, setFailurePopup] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  itemsRef.current = items;

  useEffect(() => {
    loadPostingSetup();

    return () => {
      itemsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl)
      );
    };
  }, [client?.client_id]);

  const selectableEnvironments = useMemo(
    () => normalizeEnvironmentRows(environments),
    [environments]
  );

  useEffect(() => {
    if (!selectableEnvironments.length) return;

    const currentValid =
      selectableEnvironments.some(
        (row) =>
          String(row.environment_code).toUpperCase() ===
          String(environment).toUpperCase()
      );

    if (currentValid) return;

    const preferredCode =
      String(
        client?.default_environment ||
          subscription?.allowed_environment ||
          "CLNT"
      ).toUpperCase();

    const preferred =
      selectableEnvironments.find(
        (row) =>
          String(row.environment_code).toUpperCase() ===
          preferredCode
      ) ||
      selectableEnvironments.find(
        (row) =>
          String(row.environment_code).toUpperCase() ===
          "CLNT"
      ) ||
      selectableEnvironments[0];

    setEnvironment(
      String(preferred.environment_code).toUpperCase()
    );
  }, [
    selectableEnvironments,
    environment,
    client?.default_environment,
    subscription?.allowed_environment,
  ]);

  function registerField(fieldKey) {
    return (node) => {
      if (node) {
        fieldRefs.current[fieldKey] = node;
      } else {
        delete fieldRefs.current[fieldKey];
      }
    };
  }

  function clearFieldError(fieldKey) {
    setFieldErrors((current) => {
      if (!current[fieldKey]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldKey];

      return next;
    });
  }

  async function loadPostingSetup() {
    if (!client?.client_id) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } =
        await supabase.functions.invoke(
          "facebook-auction-publish",
          {
            method: "POST",
            body: {
              action: "LIST_SETUP",
              client_id: client.client_id,
            },
          }
        );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Unable to load Facebook posting setup."
        );
      }

      const pageRows = data.pages || [];
      const environmentRows = data.environments || [];
      const postTypeRows = data.auction_post_types || [];

      setPages(pageRows);
      setSubscription(data.subscription || null);
      setEnvironments(environmentRows);
      setPostTypes(postTypeRows);

      try {
        const {
          data: inventoryData,
          error: inventoryError,
        } =
          await supabase.functions.invoke(
            "inventory-admin",
            {
              method: "POST",
              body: {
                action: "LIST_ITEMS",
                client_id: client.client_id,
                status: "ACTIVE",
                search: "",
              },
            }
          );

        if (inventoryError) throw inventoryError;

        setInventoryItems(
          inventoryData?.success
            ? inventoryData.items || []
            : []
        );
      } catch (inventoryError) {
        console.warn(
          "Inventory list unavailable; manual posting remains enabled.",
          inventoryError
        );
        setInventoryItems([]);
      }

      setPostType((current) => {
        if (
          current &&
          postTypeRows.some(
            (row) =>
              String(row.post_type_code).toUpperCase() ===
              String(current).toUpperCase()
          )
        ) {
          return current;
        }

        return postTypeRows.length
          ? String(
              postTypeRows[0].post_type_code
            ).toUpperCase()
          : "";
      });

      setSelectedPageId((current) => {
        if (
          current &&
          pageRows.some(
            (page) =>
              String(page.fb_page_id) === current
          )
        ) {
          return current;
        }

        return pageRows.length
          ? String(pageRows[0].fb_page_id)
          : "";
      });
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Unable to load Facebook posting setup."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPostType = useMemo(
    () =>
      postTypes.find(
        (row) =>
          String(row.post_type_code).toUpperCase() ===
          String(postType).toUpperCase()
      ) || null,
    [postTypes, postType]
  );

  const isMultiple =
    selectedPostType?.is_multiple === true;

  const selectedPage = useMemo(
    () =>
      pages.find(
        (page) =>
          String(page.fb_page_id) ===
          selectedPageId
      ) || null,
    [pages, selectedPageId]
  );

  const mainCaption = useMemo(() => {
    const lines = [];

    if (sellerCaption.trim()) {
      lines.push(sellerCaption.trim(), "");
    }

    if (environment) {
      lines.push(`EO2MATE-${environment}`);
      lines.push("");
    }

    if (selectedPostType?.caption_marker) {
      lines.push(
        selectedPostType.caption_marker
      );
    }

    if (!isMultiple) {
      lines.push(
        ...buildRuleLines(sharedRules, {
          includeItem: true,
          item: singleItem,
        })
      );
    } else {
      lines.push(
        ...buildRuleLines(sharedRules)
      );
    }

    return lines.join("\n").trim();
  }, [
    sellerCaption,
    environment,
    selectedPostType,
    isMultiple,
    sharedRules,
    singleItem,
  ]);

  const photoCaptions = useMemo(() => {
    if (!isMultiple) {
      return [];
    }

    return items.map((item) => {
      const effective =
        mergeRules(sharedRules, item);

      return buildRuleLines(
        effective,
        {
          includeItem: true,
          item: item.item,
        }
      ).join("\n");
    });
  }, [
    isMultiple,
    items,
    sharedRules,
  ]);

  function changePostType(nextType) {
    setPostType(nextType);
    setMessage("");
    setErrorMessage("");
    setFieldErrors({});
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    setProcessingFiles(true);
    setErrorMessage("");
    clearFieldError("images");

    try {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 0)
      );

      const remaining =
        MAX_IMAGES - items.length;

      const selected =
        files.slice(0, remaining);

      const errors = [];

      const accepted =
        selected.filter((file) => {
          if (
            ![
              "image/jpeg",
              "image/png",
            ].includes(file.type)
          ) {
            errors.push(
              `${file.name}: use JPG or PNG.`
            );
            return false;
          }

          if (
            file.size > MAX_IMAGE_BYTES
          ) {
            errors.push(
              `${file.name}: maximum size is 10 MB.`
            );
            return false;
          }

          return true;
        });

      if (
        files.length > remaining
      ) {
        errors.push(
          `Maximum ${MAX_IMAGES} images per Facebook post.`
        );
      }

      setItems((current) => [
        ...current,
        ...accepted.map(
          (file, index) =>
            createItem(
              file,
              current.length + index
            )
        ),
      ]);

      if (errors.length) {
        setErrorMessage(
          errors.join(" ")
        );
      }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setProcessingFiles(false);
    }
  }

  function removeItem(id) {
    setItems((current) => {
      const target =
        current.find(
          (item) => item.id === id
        );

      if (target) {
        URL.revokeObjectURL(
          target.previewUrl
        );
      }

      return current.filter(
        (item) => item.id !== id
      );
    });
  }

  function updateItem(id, patch) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  }

  function moveItem(
    draggedId,
    targetId
  ) {
    if (
      !draggedId ||
      !targetId ||
      draggedId === targetId
    ) {
      return;
    }

    setItems((current) => {
      const next = [...current];

      const fromIndex =
        next.findIndex(
          (item) =>
            item.id === draggedId
        );

      const toIndex =
        next.findIndex(
          (item) =>
            item.id === targetId
        );

      if (
        fromIndex < 0 ||
        toIndex < 0
      ) {
        return current;
      }

      const [moved] =
        next.splice(fromIndex, 1);

      next.splice(
        toIndex,
        0,
        moved
      );

      return next;
    });
  }

  function validate() {
    const errors = {};

    if (!selectedPageId) {
      errors.page =
        "Select a Facebook Page.";
    }

    if (!environment) {
      errors.environment =
        "Select an operating mode.";
    }

    if (!items.length) {
      errors.images =
        "Upload at least one image.";
    }

    if (!isMultiple) {
      if (
        singleItemSource === "INVENTORY" &&
        !singleInventoryItemId
      ) {
        errors.singleItem =
          "Select an Inventory item.";
      } else if (
        !singleItem.trim()
      ) {
        errors.singleItem =
          "Item name is required.";
      }

      const sharedMinBid =
        normalizeMoney(
          sharedRules.minBid
        );

      if (
        sharedMinBid === null
      ) {
        errors["shared.minBid"] =
          "Minimum Bid is required.";
      } else if (
        sharedMinBid <= 0
      ) {
        errors["shared.minBid"] =
          "Minimum Bid must be greater than 0.";
      }

      const sharedIncrement =
        normalizeMoney(
          sharedRules.increment
        );

      if (
        sharedIncrement === null
      ) {
        errors["shared.increment"] =
          "Increment is required.";
      } else if (
        sharedIncrement <= 0
      ) {
        errors["shared.increment"] =
          "Increment must be greater than 0.";
      }

      const sharedEnd =
        phDateFromLocalInput(
          sharedRules.auctionEnds
        );

      if (!sharedEnd) {
        errors["shared.auctionEnds"] =
          "Auction Ends is required.";
      } else if (
        sharedEnd.getTime() <=
        Date.now()
      ) {
        errors["shared.auctionEnds"] =
          "Auction Ends must be in the future.";
      }

      const buyoutAmount =
        getBuyoutAmount(
          sharedRules.buyout
        );

      if (
        buyoutAmount === null
      ) {
        errors["shared.buyout"] =
          "Buyout amount is invalid.";
      } else if (
        buyoutAmount > 0
      ) {
        const buyoutUntil =
          phDateFromLocalInput(
            sharedRules.buyoutUntil
          );

        if (!buyoutUntil) {
          errors[
            "shared.buyoutUntil"
          ] =
            "Buyout Until is required when Buyout is enabled.";
        } else if (
          buyoutUntil.getTime() <=
          Date.now()
        ) {
          errors[
            "shared.buyoutUntil"
          ] =
            "Buyout Until must be later than the current date/time.";
        } else if (
          sharedEnd &&
          buyoutUntil.getTime() >
            sharedEnd.getTime()
        ) {
          errors[
            "shared.buyoutUntil"
          ] =
            "Buyout Until must be on or before Auction Ends.";
        }
      }
    } else {
      items.forEach(
        (item, index) => {
          const prefix =
            `item.${item.id}`;

          if (
            (item.itemSource ||
              "MANUAL") ===
              "INVENTORY" &&
            !item.inventoryItemId
          ) {
            errors[
              `${prefix}.item`
            ] =
              `Item ${
                index + 1
              }: select an Inventory item.`;
          } else if (
            !item.item.trim()
          ) {
            errors[
              `${prefix}.item`
            ] =
              `Item ${
                index + 1
              } name is required.`;
          }

          const effective =
            mergeRules(
              sharedRules,
              item
            );

          const end =
            phDateFromLocalInput(
              effective.auctionEnds
            );

          const effectiveMinBid =
            normalizeMoney(
              effective.minBid
            );

          const effectiveIncrement =
            normalizeMoney(
              effective.increment
            );

          if (
            effectiveMinBid === null
          ) {
            errors[
              `${prefix}.minBid`
            ] =
              `Item ${
                index + 1
              }: Minimum Bid is required.`;
          } else if (
            effectiveMinBid <= 0
          ) {
            errors[
              `${prefix}.minBid`
            ] =
              `Item ${
                index + 1
              }: Minimum Bid must be greater than 0.`;
          }

          if (
            effectiveIncrement ===
            null
          ) {
            errors[
              `${prefix}.increment`
            ] =
              `Item ${
                index + 1
              }: Increment is required.`;
          } else if (
            effectiveIncrement <= 0
          ) {
            errors[
              `${prefix}.increment`
            ] =
              `Item ${
                index + 1
              }: Increment must be greater than 0.`;
          }

          if (!end) {
            errors[
              `${prefix}.auctionEnds`
            ] =
              `Item ${
                index + 1
              }: Auction Ends is required.`;
          } else if (
            end.getTime() <=
            Date.now()
          ) {
            errors[
              `${prefix}.auctionEnds`
            ] =
              `Item ${
                index + 1
              }: Auction Ends must be in the future.`;
          }

          const buyoutAmount =
            getBuyoutAmount(
              effective.buyout
            );

          if (
            buyoutAmount === null
          ) {
            errors[
              `${prefix}.buyout`
            ] =
              `Item ${
                index + 1
              }: Buyout amount is invalid.`;
          } else if (
            buyoutAmount > 0
          ) {
            const buyoutUntil =
              phDateFromLocalInput(
                effective.buyoutUntil
              );

            if (!buyoutUntil) {
              errors[
                `${prefix}.buyoutUntil`
              ] =
                `Item ${
                  index + 1
                }: Buyout Until is required when Buyout is enabled.`;
            } else if (
              buyoutUntil.getTime() <=
              Date.now()
            ) {
              errors[
                `${prefix}.buyoutUntil`
              ] =
                `Item ${
                  index + 1
                }: Buyout Until must be later than the current date/time.`;
            } else if (
              end &&
              buyoutUntil.getTime() >
                end.getTime()
            ) {
              errors[
                `${prefix}.buyoutUntil`
              ] =
                `Item ${
                  index + 1
                }: Buyout Until must be on or before Auction Ends.`;
            }
          }
        }
      );
    }

    return errors;
  }

  function focusFirstError(errors) {
    const firstKey =
      Object.keys(errors)[0];

    if (!firstKey) return;

    window.requestAnimationFrame(() => {
      let node =
        fieldRefs.current[firstKey];

      if (
        firstKey === "images"
      ) {
        node =
          uploadButtonRef.current;
      }

      if (!node) return;

      node.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        if (
          typeof node.focus ===
          "function"
        ) {
          node.focus({
            preventScroll: true,
          });
        }
      }, 350);
    });
  }

  function resetFormForNewPost({
    keepSuccessPopup = false,
  } = {}) {
    itemsRef.current.forEach(
      (item) => {
        URL.revokeObjectURL(
          item.previewUrl
        );
      }
    );

    setPostType(
      postTypes.length
        ? String(
            postTypes[0]
              .post_type_code
          ).toUpperCase()
        : ""
    );

    setSellerCaption("");
    setSingleItem("");
    setSingleItemSource("MANUAL");
    setSingleInventoryItemId("");

    setSharedRules({
      minBid: "",
      increment: "",
      minimumBidders: "1",
      buyout: "",
      buyoutUntil: "",
      auctionEnds: "",
      bidCutoff: "60",
        });

    setItems([]);
    itemsRef.current = [];

    setDraggingId(null);
    setShowPreview(true);
    setFieldErrors({});
    setErrorMessage("");
    setMessage("");
    setFailurePopup(null);

    if (!keepSuccessPopup) {
      setSuccessPopup(null);
    }

    setFileInputKey(
      (current) => current + 1
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (pages.length) {
      setSelectedPageId(
        String(
          pages[0].fb_page_id
        )
      );
    }
  }

  async function publishAuction() {
    const errors = validate();

    if (
      Object.keys(errors).length
    ) {
      setFieldErrors(errors);

      setErrorMessage(
        "Please correct the highlighted field(s) below."
      );

      setMessage("");
      focusFirstError(errors);
      return;
    }

    setFieldErrors({});

    const confirmed =
      window.confirm(
        `Publish this ${
          selectedPostType?.display_name ||
          "Auction"
        } to Facebook?\n\n` +
          `Page: ${getPageLabel(
            selectedPage
          )}\n` +
          `Images: ${items.length}`
      );

    if (!confirmed) return;

    setPublishing(true);
    setMessage("");
    setErrorMessage("");
    setFailurePopup(null);

    try {
      const payload = {
        client_id:
          client.client_id,

        fb_page_id:
          selectedPageId,

        environment,

        post_type:
          postType,

        main_caption:
          mainCaption,

        inventory_items:
          isMultiple
            ? items.map(
                (
                  item,
                  index
                ) => {
                  const inventory =
                    inventoryItems.find(
                      (row) =>
                        String(
                          row.inventory_item_id
                        ) ===
                        String(
                          item.inventoryItemId ||
                            ""
                        )
                    );

                  return inventory &&
                    item.itemSource ===
                      "INVENTORY"
                    ? {
                        item_no:
                          index + 1,

                        item_source:
                          "INVENTORY",

                        inventory_item_id:
                          inventory.inventory_item_id,

                        inventory_owner_id:
                          inventory.inventory_owner_id ||
                          null,

                        item_code_snapshot:
                          inventory.item_code ||
                          null,

                        item_name_snapshot:
                          inventory.item_name ||
                          item.item,

                        item_price_snapshot:
                          Number(
                            inventory.default_selling_price ||
                              0
                          ),

                        quantity_committed:
                          1,
                      }
                    : {
                        item_no:
                          index + 1,

                        item_source:
                          "MANUAL",

                        quantity_committed:
                          1,
                      };
                }
              )
            : (() => {
                const inventory =
                  inventoryItems.find(
                    (row) =>
                      String(
                        row.inventory_item_id
                      ) ===
                      String(
                        singleInventoryItemId ||
                          ""
                      )
                  );

                return [
                  inventory &&
                  singleItemSource ===
                    "INVENTORY"
                    ? {
                        item_no: 1,
                        item_source:
                          "INVENTORY",

                        inventory_item_id:
                          inventory.inventory_item_id,

                        inventory_owner_id:
                          inventory.inventory_owner_id ||
                          null,

                        item_code_snapshot:
                          inventory.item_code ||
                          null,

                        item_name_snapshot:
                          inventory.item_name ||
                          singleItem,

                        item_price_snapshot:
                          Number(
                            inventory.default_selling_price ||
                              0
                          ),

                        quantity_committed:
                          1,
                      }
                    : {
                        item_no: 1,
                        item_source:
                          "MANUAL",
                        quantity_committed:
                          1,
                      },
                ];
              })(),

        photo_captions:
          isMultiple
            ? photoCaptions
            : items.map(() => ""),
      };

      const formData =
        new FormData();

      formData.append(
        "payload",
        JSON.stringify(payload)
      );

      items.forEach(
        (item, index) => {
          formData.append(
            `image_${index}`,
            item.file,
            item.file.name
          );
        }
      );

      const { data, error } =
        await supabase.functions.invoke(
          "facebook-auction-publish",
          {
            body: formData,
          }
        );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Facebook publishing failed."
        );
      }

      const successData = {
        ...data,

        page_name:
          getPageLabel(
            selectedPage
          ),

        environment,

        post_type_display_name:
          selectedPostType?.display_name ||
          "Auction",
      };

      resetFormForNewPost({
        keepSuccessPopup: true,
      });

      setSuccessPopup(
        successData
      );
    } catch (error) {
      const resolvedMessage =
        await getFunctionErrorMessage(
          error
        );

      const fbPostId =
        extractFacebookPostId(
          `${resolvedMessage} ${
            error?.message || ""
          }`
        );

      const partialPostUrl =
        fbPostId
          ? getFacebookPostUrl(
              fbPostId
            )
          : null;

      setErrorMessage("");

      setFailurePopup({
        message:
          resolvedMessage,

        fb_post_id:
          fbPostId,

        permalink_url:
          partialPostUrl,

        page_name:
          getPageLabel(
            selectedPage
          ),

        environment,

        post_type_display_name:
          selectedPostType?.display_name ||
          "Auction",
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <style>{`
        .eo2-required {
          color: #dc2626;
          font-weight: 700;
        }

        .eo2-ui-version {
          display: inline-block;
          margin-top: 4px;
          font-size: .72rem;
          font-weight: 700;
          opacity: .55;
        }

        .eo2-field-error input,
        .eo2-field-error select,
        input.eo2-field-error,
        select.eo2-field-error,
        textarea.eo2-field-error {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, .12) !important;
          background: rgba(254, 242, 242, .8);
        }

        .eo2-field-error-text {
          display: block;
          color: #b91c1c;
          font-size: .78rem;
          margin-top: .28rem;
          font-weight: 600;
        }

        .eo2-upload-error {
          border: 2px solid #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, .12);
        }

        .eo2-publish-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(15, 23, 42, .58);
          backdrop-filter: blur(3px);
          padding: 20px;
        }

        .eo2-publish-card,
        .eo2-success-card {
          width: min(460px, 94vw);
          background: var(--panel-bg, #fff);
          color: var(--text-color, #111827);
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 24px 70px rgba(0,0,0,.28);
          text-align: center;
        }

        .eo2-spinner {
          width: 44px;
          height: 44px;
          margin: 0 auto 16px;
          border-radius: 50%;
          border: 4px solid rgba(148, 163, 184, .35);
          border-top-color: currentColor;
          animation: eo2Spin .8s linear infinite;
        }

        @keyframes eo2Spin {
          to {
            transform: rotate(360deg);
          }
        }

        .eo2-progress-track {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, .25);
          margin: 18px 0 10px;
        }

        .eo2-progress-bar {
          width: 38%;
          height: 100%;
          border-radius: inherit;
          background: currentColor;
          animation: eo2Progress 1.15s ease-in-out infinite;
        }

        @keyframes eo2Progress {
          0% {
            transform: translateX(-120%);
          }

          100% {
            transform: translateX(360%);
          }
        }

        .eo2-success-icon,
        .eo2-failure-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-size: 30px;
          font-weight: 800;
        }

        .eo2-success-icon {
          background: #dcfce7;
          color: #166534;
        }

        .eo2-failure-icon {
          background: #fee2e2;
          color: #991b1b;
        }

        .eo2-failure-message {
          margin-top: 14px !important;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(220, 38, 38, .08);
          color: #991b1b;
          text-align: left;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .eo2-success-card h2,
        .eo2-publish-card h2 {
          margin: 0 0 8px;
        }

        .eo2-success-card p,
        .eo2-publish-card p {
          margin: 6px 0;
          opacity: .82;
        }

        .eo2-success-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 20px;
          flex-wrap: wrap;
        }

        .eo2-exit-button {
          flex-basis: 100%;
        }

        .fb-posting-panel {
          border: 1px solid rgba(148, 163, 184, .18);
          border-radius: 20px;
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,.035),
              rgba(255,255,255,0)
            );
          overflow: visible;
        }

        .fb-posting-panel .panel-header {
          margin-bottom: 18px;
        }

        .fb-posting-panel label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          font-size: .82rem;
          font-weight: 700;
          color: var(--text-color, #111827);
          min-width: 0;
        }

        .fb-posting-panel label > small:not(.eo2-field-error-text) {
          font-weight: 500;
          line-height: 1.45;
          opacity: .64;
        }

        .fb-posting-panel input,
        .fb-posting-panel select,
        .fb-posting-panel textarea {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(148, 163, 184, .42);
          border-radius: 12px;
          padding: 11px 13px;
          background: rgba(255, 255, 255, .96);
          color: #111827;
          font: inherit;
          font-size: .94rem;
          font-weight: 500;
          outline: none;
          box-sizing: border-box;
        }

        .fb-posting-panel textarea {
          min-height: 118px;
          resize: vertical;
          line-height: 1.55;
        }

        .fb-posting-panel select {
          appearance: none;
          -webkit-appearance: none;
          padding-right: 42px;
        }

        .fb-posting-panel input:focus,
        .fb-posting-panel select:focus,
        .fb-posting-panel textarea:focus {
          border-color: var(--accent-color, #2563eb);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, .12);
          background: #fff;
        }

        .fb-post-setup-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr)) !important;
          gap: 14px !important;
          align-items: start;
        }

        .fb-rule-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(150px, 1fr)) !important;
          gap: 12px 14px !important;
          align-items: start;
        }

        .fb-rule-grid.has-buyout {
          grid-template-areas:
            "minbid increment bidders buyout"
            "buyoutUntil buyoutUntil ends ends"
            "cutoff . . .";
        }

        .fb-rule-grid.no-buyout {
          grid-template-areas:
            "minbid increment bidders buyout"
            "ends ends cutoff cutoff";
        }

        .fb-rule-grid > label {
          min-width: 0;
          margin: 0;
          display: grid;
          grid-template-rows:
            20px 38px 18px;
          gap: 4px;
          align-content: start;
        }

        .eo2-rule-heading {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          color: #111827;
          font-size: .79rem;
          font-weight: 800;
          line-height: 20px;
          white-space: nowrap;
        }

        .eo2-rule-help {
          min-height: 18px;
          display: block;
          overflow: hidden;
        }

        .eo2-rule-help small,
        .fb-rule-grid .eo2-field-error-text {
          display: block;
          margin: 0;
          font-size: .66rem;
          line-height: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fb-rule-grid .eo2-rule-minbid {
          grid-area: minbid;
        }

        .fb-rule-grid .eo2-rule-increment {
          grid-area: increment;
        }

        .fb-rule-grid .eo2-rule-bidders {
          grid-area: bidders;
        }

        .fb-rule-grid .eo2-rule-buyout {
          grid-area: buyout;
        }

        .fb-rule-grid .eo2-rule-buyout-until {
          grid-area: buyoutUntil;
        }

        .fb-rule-grid .eo2-rule-auction-ends {
          grid-area: ends;
        }

        .fb-rule-grid .eo2-rule-cutoff {
          grid-area: cutoff;
        }

        .fb-rule-grid input,
        .fb-rule-grid .eo2-datetime-field {
          width: 100%;
          min-width: 0;
          height: 38px;
          min-height: 38px;
          margin: 0;
          padding: 7px 10px;
          border-radius: 9px;
          box-sizing: border-box;
        }

        .fb-rule-grid .eo2-rule-short {
          max-width: none;
        }

        .eo2-datetime-control {
          position: relative;
          width: 100%;
          min-width: 0;
        }

        .eo2-datetime-trigger {
          width: 100%;
          min-width: 0;
          height: 38px;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 7px 10px;
          border: 1px solid rgba(148, 163, 184, .42);
          border-radius: 9px;
          background: rgba(255, 255, 255, .96);
          color: #111827;
          font: inherit;
          font-size: .82rem;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          box-sizing: border-box;
        }

        .eo2-datetime-trigger:focus {
          border-color: var(--accent-color, #2563eb);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, .12);
          outline: none;
        }

        .eo2-datetime-placeholder {
          color: #94a3b8;
          font-weight: 500;
        }

        .eo2-datetime-calendar {
          flex: 0 0 auto;
          opacity: .65;
        }

        .eo2-datetime-error .eo2-datetime-trigger {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, .12) !important;
          background: rgba(254, 242, 242, .8);
        }

        .eo2-datetime-overlay {
          position: fixed;
          inset: 0;
          z-index: 10020;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(15, 23, 42, .45);
          backdrop-filter: blur(2px);
        }

        .eo2-datetime-dialog {
          width: min(430px, 96vw);
          max-height: calc(100vh - 36px);
          overflow: auto;
          border-radius: 18px;
          border: 1px solid rgba(148, 163, 184, .22);
          background: #fff;
          color: #111827;
          box-shadow: 0 24px 70px rgba(0, 0, 0, .26);
        }

        .eo2-datetime-dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, .18);
        }

        .eo2-datetime-close {
          width: 34px;
          height: 34px;
          min-height: 34px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: rgba(148, 163, 184, .14);
          color: #334155;
          font-size: 1.35rem;
          line-height: 1;
          cursor: pointer;
        }

        .eo2-datetime-dialog-body {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(180px, .85fr);
          gap: 14px;
          padding: 16px;
        }

        .eo2-datetime-label {
          display: block;
          margin-bottom: 7px;
          font-size: .76rem;
          font-weight: 800;
          color: #475569;
        }

        .eo2-date-part input[type="date"] {
          width: 100%;
          min-height: 44px;
          padding: 0 11px;
          border: 1px solid rgba(148, 163, 184, .42);
          border-radius: 11px;
          background: #fff;
          color: #111827;
          font: inherit;
          box-sizing: border-box;
        }

        .eo2-time-row {
          display: grid;
          grid-template-columns: 1fr 10px 1fr 1.15fr;
          align-items: center;
          gap: 5px;
        }

        .eo2-time-row select {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          padding: 0 8px;
          border: 1px solid rgba(148, 163, 184, .42);
          border-radius: 11px;
          background: #fff;
          color: #111827;
          font: inherit;
          font-weight: 700;
        }

        .eo2-time-colon {
          text-align: center;
          font-weight: 900;
          color: #64748b;
        }

        .eo2-datetime-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 12px 16px 16px;
          border-top: 1px solid rgba(148, 163, 184, .18);
        }

        .eo2-datetime-actions button {
          min-width: 90px;
        }

        @media (max-width: 520px) {
          .eo2-datetime-dialog-body {
            grid-template-columns: 1fr;
          }
        }

        .fb-upload-empty-error {
          border-color: #dc2626 !important;
          background: rgba(254, 242, 242, .88) !important;
          box-shadow:
            0 0 0 3px rgba(220, 38, 38, .10);
        }

        .eo2-photo-error-text {
          display: block;
          margin-top: 7px;
          color: #dc2626;
          font-size: .76rem;
          font-weight: 700;
          line-height: 1.35;
        }

        .fb-item-editor {
          padding: 15px;
          border-top: 1px solid rgba(148, 163, 184, .18);
        }

        .fb-item-editor details {
          margin-top: 14px;
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 12px;
          overflow: hidden;
        }

        .fb-item-editor summary {
          cursor: pointer;
          padding: 12px 14px;
          font-weight: 700;
        }

        .fb-upload-empty {
          min-height: 180px;
          border: 1.5px dashed rgba(100, 116, 139, .45);
          border-radius: 18px;
        }

        .fb-photo-card {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, .20);
        }

        .primary-button,
        .secondary-button,
        .icon-button {
          min-height: 42px;
          border-radius: 11px !important;
          font-weight: 700;
        }

        .fb-post-preview-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
          gap: 16px;
          align-items: start;
        }

        .fb-facebook-preview,
        .fb-preview-photo-captions {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 16px;
          background: rgba(255, 255, 255, .96);
          color: #111827;
          overflow: hidden;
        }

        .fb-preview-page {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px 8px;
        }

        .fb-preview-page > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .fb-preview-page span {
          font-size: .75rem;
          color: #64748b;
        }

        .fb-preview-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #1877f2;
          color: #fff;
          font-size: 1.15rem;
          font-weight: 900;
        }

        .fb-facebook-preview pre,
        .fb-preview-photo-captions pre {
          margin: 0;
          padding: 12px 16px 16px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font: inherit;
          font-size: .88rem;
          line-height: 1.5;
        }

        .fb-preview-photo-captions h3 {
          margin: 0;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, .18);
          font-size: .9rem;
        }

        .fb-preview-photo-captions details {
          border-top: 1px solid rgba(148, 163, 184, .18);
        }

        .fb-preview-photo-captions details:first-of-type {
          border-top: 0;
        }

        .fb-preview-photo-captions summary {
          cursor: pointer;
          padding: 11px 14px;
          font-size: .82rem;
          font-weight: 700;
        }

        .fb-publish-actions {
          padding-top: 8px;
        }

        @media (max-width: 720px) {
          .fb-post-setup-grid,
          .fb-post-preview-layout {
            grid-template-columns: 1fr !important;
          }

          .fb-photo-grid {
            grid-template-columns: 1fr !important;
          }


          .eo2-success-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .eo2-success-actions > * {
            width: 100%;
            box-sizing: border-box;
          }

          .eo2-exit-button {
            grid-column: 1 / -1;
          }
        }

      

        @media (max-width: 1180px) {
          .fb-rule-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
            grid-template-areas:
              "minbid increment"
              "bidders buyout"
              "buyoutUntil ends"
              "cutoff cutoff";
          }

          .fb-rule-grid .eo2-rule-short {
            max-width: none;
          }
        }

        @media (max-width: 680px) {
          .fb-rule-grid {
            grid-template-columns: 1fr !important;
            grid-template-areas:
              "minbid"
              "increment"
              "bidders"
              "buyout"
              "buyoutUntil"
              "ends"
              "cutoff";
          }

        }

`}</style>

      <header className="dashboard-header fb-posting-header">
        <div>
          <p className="eyebrow">
            FACEBOOK · AUCTION POSTING
          </p>

          <h1>Create Auction Post</h1>

          <p>
            Build a valid EO2MATE auction caption, organize photos,
            preview the post, and publish directly to your connected Page.
          </p>
        </div>

        <button
          type="button"
          className="icon-button refresh-icon-button"
          onClick={loadPostingSetup}
          disabled={
            loading ||
            publishing ||
            processingFiles
          }
        >
          ↻
        </button>
      </header>

      {errorMessage && (
        <div
          className="dashboard-error global-error"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>1. Post setup</h2>
            <p>
              Choose the Facebook Page and auction type.
            </p>
          </div>
        </div>

        <div className="fb-post-setup-grid">
          <label>
            Facebook Page *

            <select
              value={selectedPageId}
              onChange={(e) =>
                setSelectedPageId(e.target.value)
              }
              disabled={loading || publishing}
            >
              {pages.map((page) => (
                <option
                  key={page.fb_page_id}
                  value={page.fb_page_id}
                >
                  {getPageLabel(page)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Auction Type

            <select
              value={postType}
              onChange={(e) =>
                changePostType(e.target.value)
              }
              disabled={
                loading ||
                publishing ||
                !postTypes.length
              }
            >
              {!postTypes.length && (
                <option value="">
                  No auction type available
                </option>
              )}

              {postTypes.map((row) => (
                <option
                  key={row.post_type_code}
                  value={String(
                    row.post_type_code
                  ).toUpperCase()}
                >
                  {row.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>2. Auction details</h2>
          </div>
        </div>

        <label>
          Seller Caption

          <textarea
            rows="5"
            value={sellerCaption}
            onChange={(e) =>
              setSellerCaption(e.target.value)
            }
            disabled={publishing}
          />
        </label>

        {!isMultiple && (
          <>
            <label>
              Item Name *

              <input
                value={singleItem}
                onChange={(e) =>
                  setSingleItem(e.target.value)
                }
                disabled={publishing}
              />
            </label>
          </>
        )}

        <h3>
          {isMultiple
            ? "Shared / default rules"
            : "Auction rules"}
        </h3>

        <RuleFields
          value={sharedRules}
          onChange={setSharedRules}
          shared
          disabled={publishing}
          fieldPrefix="shared"
          fieldErrors={fieldErrors}
          registerField={registerField}
        />
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>3. Auction photos</h2>

            <p>
              Upload up to {MAX_IMAGES} JPG/PNG images.
            </p>
          </div>
        </div>

        <input
          key={fileInputKey}
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) =>
            addFiles(e.target.files)
          }
        />

        {!items.length ? (
          <>
            <button
              ref={uploadButtonRef}
              type="button"
              className={`fb-upload-empty ${
                fieldErrors.images
                  ? "fb-upload-empty-error"
                  : ""
              }`}
              onClick={() =>
                fileInputRef.current?.click()
              }
              aria-invalid={Boolean(
                fieldErrors.images
              )}
            >
              <strong>
                Upload auction photos
              </strong>
            </button>

            {fieldErrors.images && (
              <small className="eo2-photo-error-text">
                {fieldErrors.images}
              </small>
            )}
          </>
        ) : (
          <div className="fb-photo-grid">
            {items.map((item, index) => (
              <article
                key={item.id}
                className="fb-photo-card"
              >
                <img
                  src={item.previewUrl}
                  alt={`Auction ${index + 1}`}
                />

                <button
                  type="button"
                  onClick={() =>
                    removeItem(item.id)
                  }
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        )}

        {items.length > 0 &&
          fieldErrors.images && (
            <small className="eo2-photo-error-text">
              {fieldErrors.images}
            </small>
          )}
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>4. Preview & publish</h2>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setShowPreview(
                (current) => !current
              )
            }
          >
            {showPreview
              ? "Hide Preview"
              : "Show Preview"}
          </button>
        </div>

        {showPreview && (
          <div className="fb-post-preview-layout">
            <div className="fb-facebook-preview">
              <div className="fb-preview-page">
                <div className="fb-preview-avatar">f</div>
                <div>
                  <strong>{getPageLabel(selectedPage)}</strong>
                  <span>Just now · Public</span>
                </div>
              </div>

              <pre>
                {mainCaption ||
                  "Your generated Facebook caption will appear here."}
              </pre>
            </div>

            {isMultiple && (
              <div className="fb-preview-photo-captions">
                <h3>Per-photo captions</h3>

                {photoCaptions.map((caption, index) => (
                  <details key={items[index]?.id || index}>
                    <summary>Item {index + 1}</summary>
                    <pre>{caption}</pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="fb-publish-actions">
          <button
            type="button"
            className="primary-button"
            onClick={publishAuction}
            disabled={
              loading ||
              publishing ||
              processingFiles ||
              Boolean(successPopup)
            }
          >
            {publishing
              ? "Publishing…"
              : "Publish to Facebook"}
          </button>
        </div>
      </section>

      {(loading ||
        processingFiles ||
        publishing) && (
        <div className="eo2-publish-overlay">
          <div className="eo2-publish-card">
            <div className="eo2-spinner" />

            <h2>
              {publishing
                ? "Publishing auction…"
                : processingFiles
                  ? "Processing images…"
                  : "Loading posting setup…"}
            </h2>
          </div>
        </div>
      )}

      {successPopup && (
        <div
          className="eo2-publish-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="eo2-success-title"
        >
          <div className="eo2-success-card">
            <div className="eo2-success-icon">
              ✓
            </div>

            <h2 id="eo2-success-title">
              Auction published
            </h2>

            <p>
              The Facebook post was created and EO2MATE automation
              was activated successfully.
            </p>

            <p>
              <strong>Page:</strong>{" "}
              {successPopup.page_name}
            </p>


            <p>
              <strong>Type:</strong>{" "}
              {successPopup.post_type_display_name ||
                "Auction"}
            </p>

            <div className="eo2-success-actions">
              {successPopup.permalink_url && (
                <a
                  className="secondary-button"
                  href={successPopup.permalink_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Facebook Post
                </a>
              )}

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  resetFormForNewPost()
                }
              >
                Create New Post
              </button>

              <button
                type="button"
                className="secondary-button eo2-exit-button"
                onClick={() =>
                  setSuccessPopup(null)
                }
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {failurePopup && (
        <div className="eo2-publish-overlay">
          <div className="eo2-success-card">
            <div className="eo2-failure-icon">
              !
            </div>

            <h2>
              Auction posting failed
            </h2>

            <p className="eo2-failure-message">
              {failurePopup.message}
            </p>

            <div className="eo2-success-actions">
              {failurePopup.permalink_url && (
                <a
                  className="secondary-button"
                  href={failurePopup.permalink_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Facebook Post
                </a>
              )}

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setFailurePopup(null)
                }
              >
                Close / Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

}
