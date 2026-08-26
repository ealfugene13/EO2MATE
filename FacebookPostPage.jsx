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
  antiSniper: "0",
};

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

  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * multiplier);
}

function formatMoneyForCaption(value) {
  const parsed = normalizeMoney(value);
  if (parsed === null) return "";
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
  }).format(parsed);
}

function phDateFromLocalInput(value) {
  if (!value) return null;

  const date = new Date(`${value}:00+08:00`);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatFacebookAuctionDate(value) {
  const date = phDateFromLocalInput(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
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
}) {
  const parts = splitDateTimeLocal(value);

  const update = (patch) => {
    onChange(
      combineDateTimeLocal({
        ...parts,
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

  return (
    <div
      className={`eo2-datetime-picker ${
        hasError ? "eo2-datetime-error" : ""
      }`}
      ref={inputRef}
      tabIndex={-1}
    >
      <div className="eo2-date-part">
        <span className="eo2-datetime-label">Date</span>
        <input
          type="date"
          value={parts.date}
          onChange={(e) =>
            update({
              date: e.target.value,
            })
          }
          disabled={disabled}
        />
      </div>

      <div className="eo2-time-part">
        <span className="eo2-datetime-label">Time</span>

        <div className="eo2-time-wheel-group">
          <select
            className="eo2-time-wheel"
            value={parts.hour12}
            onChange={(e) =>
              update({
                hour12: e.target.value,
              })
            }
            disabled={disabled}
            aria-label="Hour"
            size="3"
          >
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>

          <span className="eo2-time-separator">:</span>

          <select
            className="eo2-time-wheel"
            value={parts.minute}
            onChange={(e) =>
              update({
                minute: e.target.value,
              })
            }
            disabled={disabled}
            aria-label="Minute"
            size="3"
          >
            {minutes.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>

          <select
            className="eo2-time-period"
            value={parts.period}
            onChange={(e) =>
              update({
                period: e.target.value,
              })
            }
            disabled={disabled}
            aria-label="AM or PM"
            size="2"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>
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

function buildRuleLines(rules, { includeItem = false, item = "" } = {}) {
  const lines = [];

  if (includeItem && item.trim()) {
    lines.push(`Item: ${item.trim()}`);
  }

  const minBid = formatMoneyForCaption(rules.minBid);
  const increment = formatMoneyForCaption(rules.increment);
  const buyoutAmount = normalizeMoney(rules.buyout);
  const buyout = buyoutAmount !== null ? formatMoneyForCaption(rules.buyout) : "";

  if (minBid) lines.push(`Minimum Bid: ${minBid}`);
  if (increment) lines.push(`Increment: ${increment}`);

  const minimumBidders = Number(rules.minimumBidders || 1);
  if (Number.isFinite(minimumBidders) && minimumBidders > 0) {
    lines.push(`Minimum Bidders: ${Math.trunc(minimumBidders)}`);
  }

  /*
   * EO2MATE standard:
   * blank/null Buyout is treated as 0 server-side.
   * Buyout 0 means disabled, so it does not need to be written
   * into the Facebook caption.
   */
  if (buyoutAmount !== null && buyoutAmount > 0 && buyout) {
    lines.push(`Buyout: ${buyout}`);

    if (rules.buyoutUntil) {
      lines.push(`Buyout Until: ${formatFacebookAuctionDate(rules.buyoutUntil)}`);
    }
  }

  if (rules.auctionEnds) {
    lines.push(`Auction Ends: ${formatFacebookAuctionDate(rules.auctionEnds)}`);
  }

  const bidCutoff = Number(rules.bidCutoff);
  if (Number.isFinite(bidCutoff) && bidCutoff >= 0) {
    lines.push(`Bid Cutoff: ${Math.trunc(bidCutoff)}`);
  }

  const antiSniper = Number(rules.antiSniper);
  if (Number.isFinite(antiSniper) && antiSniper >= 0) {
    lines.push(`Anti Sniper: ${Math.trunc(antiSniper)}`);
  }

  return lines;
}

function mergeRules(shared, item) {
  return {
    minBid: item.minBid || shared.minBid,
    increment: item.increment || shared.increment,
    minimumBidders: item.minimumBidders || shared.minimumBidders,
    buyout: item.buyout !== "" ? item.buyout : shared.buyout,
    buyoutUntil: item.buyoutUntil || shared.buyoutUntil,
    auctionEnds: item.auctionEnds || shared.auctionEnds,
    bidCutoff: item.bidCutoff !== "" ? item.bidCutoff : shared.bidCutoff,
    antiSniper: item.antiSniper !== "" ? item.antiSniper : shared.antiSniper,
  };
}

function createItem(file, index) {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
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
    antiSniper: "",
  };
}

function fieldClass(errors, fieldKey) {
  return errors[fieldKey] ? "eo2-field-error" : "";
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

  const key = (name) => `${fieldPrefix}.${name}`;

  return (
    <div className={`fb-rule-grid ${shared ? "shared" : "item-rules"}`}>
      <label className={fieldClass(fieldErrors, key("minBid"))}>
        Minimum Bid <span className="eo2-required">*</span>
        <input
          ref={registerField(key("minBid"))}
          value={value.minBid}
          onChange={(e) => set("minBid", e.target.value)}
          placeholder={shared ? "500 or 5h" : "Inherit"}
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors[key("minBid")])}
        />
        {fieldErrors[key("minBid")] && (
          <small className="eo2-field-error-text">{fieldErrors[key("minBid")]}</small>
        )}
      </label>

      <label className={fieldClass(fieldErrors, key("increment"))}>
        Increment <span className="eo2-required">*</span>
        <input
          ref={registerField(key("increment"))}
          value={value.increment}
          onChange={(e) => set("increment", e.target.value)}
          placeholder={shared ? "100 or 1h" : "Inherit"}
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors[key("increment")])}
        />
        {fieldErrors[key("increment")] && (
          <small className="eo2-field-error-text">{fieldErrors[key("increment")]}</small>
        )}
      </label>

      <label>
        Minimum Bidders
        <input
          type="number"
          min="1"
          step="1"
          value={value.minimumBidders}
          onChange={(e) => set("minimumBidders", e.target.value)}
          placeholder={shared ? "1" : "Inherit"}
          disabled={disabled}
        />
      </label>

      <label className={fieldClass(fieldErrors, key("buyout"))}>
        Buyout
        <input
          ref={registerField(key("buyout"))}
          value={value.buyout}
          onChange={(e) => set("buyout", e.target.value)}
          placeholder={shared ? "Optional / 0 = disabled" : "Inherit"}
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors[key("buyout")])}
        />
        {fieldErrors[key("buyout")] && (
          <small className="eo2-field-error-text">{fieldErrors[key("buyout")]}</small>
        )}
      </label>

      <label className={fieldClass(fieldErrors, key("buyoutUntil"))}>
        Buyout Until
        <ScrollDateTimePicker
          inputRef={registerField(key("buyoutUntil"))}
          value={value.buyoutUntil}
          onChange={(nextValue) => set("buyoutUntil", nextValue)}
          disabled={disabled || normalizeMoney(value.buyout) === 0}
          hasError={Boolean(fieldErrors[key("buyoutUntil")])}
        />
        {fieldErrors[key("buyoutUntil")] && (
          <small className="eo2-field-error-text">{fieldErrors[key("buyoutUntil")]}</small>
        )}
      </label>

      <label className={fieldClass(fieldErrors, key("auctionEnds"))}>
        Auction Ends <span className="eo2-required">*</span>
        <ScrollDateTimePicker
          inputRef={registerField(key("auctionEnds"))}
          value={value.auctionEnds}
          onChange={(nextValue) => set("auctionEnds", nextValue)}
          disabled={disabled}
          hasError={Boolean(fieldErrors[key("auctionEnds")])}
        />
        {fieldErrors[key("auctionEnds")] && (
          <small className="eo2-field-error-text">{fieldErrors[key("auctionEnds")]}</small>
        )}
      </label>

      <label>
        Bid Cutoff (mins)
        <input
          type="number"
          min="0"
          step="1"
          value={value.bidCutoff}
          onChange={(e) => set("bidCutoff", e.target.value)}
          placeholder={shared ? "60" : "Inherit"}
          disabled={disabled}
        />
      </label>

      <label>
        Anti Sniper (mins)
        <input
          type="number"
          min="0"
          step="1"
          value={value.antiSniper}
          onChange={(e) => set("antiSniper", e.target.value)}
          placeholder={shared ? "0" : "Inherit"}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

export default function FacebookPostPage({ client }) {
  const fileInputRef = useRef(null);
  const uploadButtonRef = useRef(null);
  const fieldRefs = useRef({});
  const itemsRef = useRef([]);

  const [pages, setPages] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [postType, setPostType] = useState("SINGLE");
  const [sellerCaption, setSellerCaption] = useState("");
  const [singleItem, setSingleItem] = useState("");
  const [sharedRules, setSharedRules] = useState({ ...DEFAULT_RULES });
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

  itemsRef.current = items;

  useEffect(() => {
    loadPostingSetup();

    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [client?.client_id]);

  const allowedEnvironmentCode = String(
    subscription?.allowed_environment ||
    client?.default_environment ||
    "CLNT"
  ).toUpperCase();

  const allowedEnvironmentRow = useMemo(
    () =>
      environments.find(
        (row) =>
          String(row.environment_code).toUpperCase() === allowedEnvironmentCode
      ) || null,
    [environments, allowedEnvironmentCode]
  );

  const selectableEnvironments = useMemo(() => {
    if (!environments.length) return [];

    const maxRank = Number(allowedEnvironmentRow?.environment_rank);

    if (!Number.isFinite(maxRank)) {
      return environments.filter((row) => row.is_active === true);
    }

    return environments.filter(
      (row) =>
        row.is_active === true &&
        Number(row.environment_rank) <= maxRank
    );
  }, [environments, allowedEnvironmentRow]);

  useEffect(() => {
    if (!selectableEnvironments.length) return;

    const currentValid = selectableEnvironments.some(
      (row) =>
        String(row.environment_code).toUpperCase() ===
        String(environment).toUpperCase()
    );

    if (currentValid) return;

    const preferred =
      selectableEnvironments.find(
        (row) =>
          String(row.environment_code).toUpperCase() === allowedEnvironmentCode
      ) ||
      selectableEnvironments[selectableEnvironments.length - 1] ||
      selectableEnvironments[0];

    setEnvironment(String(preferred.environment_code).toUpperCase());
  }, [selectableEnvironments, allowedEnvironmentCode, environment]);

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
      if (!current[fieldKey]) return current;
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
      const { data, error } = await supabase.functions.invoke(
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

      setPages(pageRows);
      setSubscription(data.subscription || null);
      setEnvironments(environmentRows);

      setSelectedPageId((current) => {
        if (
          current &&
          pageRows.some((page) => String(page.fb_page_id) === current)
        ) {
          return current;
        }

        return pageRows.length ? String(pageRows[0].fb_page_id) : "";
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

  const mainCaption = useMemo(() => {
    const lines = [];

    if (sellerCaption.trim()) {
      lines.push(sellerCaption.trim(), "");
    }

    if (environment) {
      lines.push(`EO2MATE-${environment}`);
      lines.push("");
    }

    lines.push(
      postType === "SINGLE"
        ? "[Auction-Single]"
        : "[Auction-Multiple]"
    );

    if (postType === "SINGLE") {
      lines.push(
        ...buildRuleLines(sharedRules, {
          includeItem: true,
          item: singleItem,
        })
      );
    } else {
      lines.push(...buildRuleLines(sharedRules));
    }

    return lines.join("\n").trim();
  }, [
    sellerCaption,
    environment,
    postType,
    sharedRules,
    singleItem,
  ]);

  const photoCaptions = useMemo(() => {
    if (postType !== "MULTIPLE") return [];

    return items.map((item) => {
      const effective = mergeRules(sharedRules, item);

      return buildRuleLines(effective, {
        includeItem: true,
        item: item.item,
      }).join("\n");
    });
  }, [postType, items, sharedRules]);

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
      /*
       * Yield once so the processing overlay can render before
       * image validation / preview objects are created.
       */
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      const remaining = MAX_IMAGES - items.length;
      const selected = files.slice(0, remaining);
      const errors = [];

      const accepted = selected.filter((file) => {
        if (!["image/jpeg", "image/png"].includes(file.type)) {
          errors.push(`${file.name}: use JPG or PNG.`);
          return false;
        }

        if (file.size > MAX_IMAGE_BYTES) {
          errors.push(`${file.name}: maximum size is 10 MB.`);
          return false;
        }

        return true;
      });

      if (files.length > remaining) {
        errors.push(`Maximum ${MAX_IMAGES} images per Facebook post.`);
      }

      setItems((current) => [
        ...current,
        ...accepted.map((file, index) =>
          createItem(file, current.length + index)
        ),
      ]);

      if (errors.length) {
        setErrorMessage(errors.join(" "));
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
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
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

  function moveItem(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return;

    setItems((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((item) => item.id === draggedId);
      const toIndex = next.findIndex((item) => item.id === targetId);

      if (fromIndex < 0 || toIndex < 0) return current;

      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      return next;
    });
  }

  function validate() {
    const errors = {};

    if (!selectedPageId) {
      errors.page = "Select a Facebook Page.";
    }

    if (!environment) {
      errors.environment = "Select an operating mode.";
    }

    if (!items.length) {
      errors.images = "Upload at least one image.";
    }

    if (postType === "SINGLE") {
      if (!singleItem.trim()) {
        errors.singleItem = "Item name is required.";
      }

      if (normalizeMoney(sharedRules.minBid) === null) {
        errors["shared.minBid"] = "Minimum Bid is required.";
      }

      if (normalizeMoney(sharedRules.increment) === null) {
        errors["shared.increment"] = "Increment is required.";
      }

      const sharedEnd = phDateFromLocalInput(sharedRules.auctionEnds);

      if (!sharedEnd) {
        errors["shared.auctionEnds"] = "Auction Ends is required.";
      } else if (sharedEnd.getTime() <= Date.now()) {
        errors["shared.auctionEnds"] = "Auction Ends must be in the future.";
      }

      const buyoutAmount =
        sharedRules.buyout === ""
          ? 0
          : normalizeMoney(sharedRules.buyout);

      if (buyoutAmount === null) {
        errors["shared.buyout"] = "Buyout amount is invalid.";
      } else if (buyoutAmount > 0) {
        const buyoutUntil = phDateFromLocalInput(sharedRules.buyoutUntil);

        if (!buyoutUntil) {
          errors["shared.buyoutUntil"] =
            "Buyout Until is required when Buyout is enabled.";
        } else if (
          sharedEnd &&
          buyoutUntil.getTime() > sharedEnd.getTime()
        ) {
          errors["shared.buyoutUntil"] =
            "Buyout Until cannot be later than Auction Ends.";
        }
      }
    } else {
      items.forEach((item, index) => {
        const prefix = `item.${item.id}`;

        if (!item.item.trim()) {
          errors[`${prefix}.item`] =
            `Item ${index + 1} name is required.`;
        }

        const effective = mergeRules(sharedRules, item);
        const end = phDateFromLocalInput(effective.auctionEnds);

        if (normalizeMoney(effective.minBid) === null) {
          errors[`${prefix}.minBid`] =
            `Item ${index + 1}: Minimum Bid is required.`;
        }

        if (normalizeMoney(effective.increment) === null) {
          errors[`${prefix}.increment`] =
            `Item ${index + 1}: Increment is required.`;
        }

        if (!end) {
          errors[`${prefix}.auctionEnds`] =
            `Item ${index + 1}: Auction Ends is required.`;
        } else if (end.getTime() <= Date.now()) {
          errors[`${prefix}.auctionEnds`] =
            `Item ${index + 1}: Auction Ends must be in the future.`;
        }

        const buyoutAmount =
          effective.buyout === ""
            ? 0
            : normalizeMoney(effective.buyout);

        if (buyoutAmount === null) {
          errors[`${prefix}.buyout`] =
            `Item ${index + 1}: Buyout amount is invalid.`;
        } else if (buyoutAmount > 0) {
          const buyoutUntil = phDateFromLocalInput(effective.buyoutUntil);

          if (!buyoutUntil) {
            errors[`${prefix}.buyoutUntil`] =
              `Item ${index + 1}: Buyout Until is required when Buyout is enabled.`;
          } else if (
            end &&
            buyoutUntil.getTime() > end.getTime()
          ) {
            errors[`${prefix}.buyoutUntil`] =
              `Item ${index + 1}: Buyout Until cannot be later than Auction Ends.`;
          }
        }
      });
    }

    return errors;
  }

  function focusFirstError(errors) {
    const firstKey = Object.keys(errors)[0];

    if (!firstKey) return;

    window.requestAnimationFrame(() => {
      let node = fieldRefs.current[firstKey];

      if (firstKey === "images") {
        node = uploadButtonRef.current;
      }

      if (!node) return;

      node.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        if (typeof node.focus === "function") {
          node.focus({ preventScroll: true });
        }
      }, 350);
    });
  }

  function resetFormForNewPost({
    keepSuccessPopup = false,
  } = {}) {
    itemsRef.current.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });

    /*
     * Full NEW POST reset.
     *
     * Keep only account/setup context:
     *   - connected Facebook Pages
     *   - subscription/environment reference data
     *
     * Clear every seller-entered auction value.
     */
    setPostType("SINGLE");
    setSellerCaption("");
    setSingleItem("");
    setSharedRules({
      minBid: "",
      increment: "",
      minimumBidders: "1",
      buyout: "",
      buyoutUntil: "",
      auctionEnds: "",
      bidCutoff: "60",
      antiSniper: "0",
    });
    setItems([]);
    itemsRef.current = [];
    setDraggingId(null);
    setShowPreview(true);
    setFieldErrors({});
    setErrorMessage("");
    setMessage("");

    if (!keepSuccessPopup) {
      setSuccessPopup(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    /*
     * Page and operating mode are setup context, not auction input.
     * Keep them selected for convenience when creating another post.
     */
    if (pages.length) {
      setSelectedPageId(String(pages[0].fb_page_id));
    }

    if (selectableEnvironments.length) {
      const preferred =
        selectableEnvironments.find(
          (row) =>
            String(row.environment_code).toUpperCase() ===
            allowedEnvironmentCode
        ) ||
        selectableEnvironments[selectableEnvironments.length - 1];

      setEnvironment(String(preferred.environment_code).toUpperCase());
    }
  }

  async function publishAuction() {
    const errors = validate();

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setErrorMessage(
        "Please complete the highlighted required field(s)."
      );
      setMessage("");
      focusFirstError(errors);
      return;
    }

    setFieldErrors({});

    const confirmed = window.confirm(
      `Publish this ${
        postType === "SINGLE" ? "Single" : "Multiple"
      } Auction to Facebook?\n\n` +
      `Page: ${
        pages.find(
          (page) => String(page.fb_page_id) === selectedPageId
        )?.page_name || "Facebook Page"
      }\n` +
      `Mode: ${environment}\n` +
      `Images: ${items.length}`
    );

    if (!confirmed) return;

    setPublishing(true);
    setMessage("");
    setErrorMessage("");

    try {
      const payload = {
        client_id: client.client_id,
        fb_page_id: selectedPageId,
        environment,
        post_type: postType,
        main_caption: mainCaption,
        photo_captions:
          postType === "MULTIPLE"
            ? photoCaptions
            : items.map(() => ""),
      };

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));

      items.forEach((item, index) => {
        formData.append(
          `image_${index}`,
          item.file,
          item.file.name
        );
      });

      const { data, error } = await supabase.functions.invoke(
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
          pages.find(
            (page) =>
              String(page.fb_page_id) === selectedPageId
          )?.page_name || "Facebook Page",
      };

      /*
       * Reset immediately after a confirmed successful publish,
       * so the screen is ready for a new auction.
       */
      resetFormForNewPost({ keepSuccessPopup: true });

      setSuccessPopup(successData);
    } catch (error) {
      setErrorMessage(
        error?.message ||
        "Unable to publish the auction to Facebook."
      );
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
          to { transform: rotate(360deg); }
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
          0% { transform: translateX(-120%); }
          100% { transform: translateX(360%); }
        }

        .eo2-success-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #dcfce7;
          color: #166534;
          font-size: 30px;
          font-weight: 800;
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

        .fb-posting-panel .panel-header h2 {
          letter-spacing: -.02em;
        }

        .fb-posting-panel label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          font-size: .82rem;
          font-weight: 700;
          letter-spacing: .01em;
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
          transition:
            border-color .18s ease,
            box-shadow .18s ease,
            background .18s ease,
            transform .18s ease;
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
          background-image:
            linear-gradient(45deg, transparent 50%, currentColor 50%),
            linear-gradient(135deg, currentColor 50%, transparent 50%);
          background-position:
            calc(100% - 18px) calc(50% - 2px),
            calc(100% - 13px) calc(50% - 2px);
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
        }

        .fb-posting-panel input:hover:not(:disabled),
        .fb-posting-panel select:hover:not(:disabled),
        .fb-posting-panel textarea:hover:not(:disabled) {
          border-color: rgba(100, 116, 139, .72);
        }

        .fb-posting-panel input:focus,
        .fb-posting-panel select:focus,
        .fb-posting-panel textarea:focus {
          border-color: var(--accent-color, #2563eb);
          box-shadow:
            0 0 0 3px color-mix(
              in srgb,
              var(--accent-color, #2563eb) 16%,
              transparent
            );
          background: #fff;
        }

        .fb-posting-panel input:disabled,
        .fb-posting-panel select:disabled,
        .fb-posting-panel textarea:disabled {
          cursor: not-allowed;
          opacity: .62;
          background: rgba(148, 163, 184, .10);
        }

        .fb-posting-panel input[type="number"] {
          font-variant-numeric: tabular-nums;
        }

        .fb-posting-panel input[type="datetime-local"] {
          position: relative;
          min-width: 0;
          padding-right: 12px;
          font-variant-numeric: tabular-nums;
          color-scheme: light;
        }

        .fb-posting-panel input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          width: 22px;
          height: 22px;
          padding: 4px;
          margin-left: 6px;
          border-radius: 8px;
          cursor: pointer;
          opacity: .72;
          transition:
            opacity .15s ease,
            background .15s ease;
        }

        .fb-posting-panel input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
          background: rgba(148, 163, 184, .16);
        }

        .fb-post-setup-grid,
        .fb-rule-grid {
          gap: 16px !important;
          align-items: start;
        }

        .fb-post-setup-grid {
          grid-template-columns:
            repeat(auto-fit, minmax(220px, 1fr)) !important;
        }

        .fb-rule-grid {
          grid-template-columns:
            repeat(auto-fit, minmax(200px, 1fr)) !important;
        }

        .fb-item-editor {
          padding: 15px;
          border-top: 1px solid rgba(148, 163, 184, .18);
          background: rgba(148, 163, 184, .035);
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
          user-select: none;
        }

        .fb-item-editor details[open] summary {
          border-bottom: 1px solid rgba(148, 163, 184, .18);
        }

        .fb-item-editor details .fb-rule-grid {
          padding: 14px;
        }

        .fb-upload-empty {
          min-height: 180px;
          border: 1.5px dashed rgba(100, 116, 139, .45);
          border-radius: 18px;
          background:
            linear-gradient(
              180deg,
              rgba(148, 163, 184, .055),
              rgba(148, 163, 184, .015)
            );
          transition:
            border-color .18s ease,
            background .18s ease,
            transform .18s ease,
            box-shadow .18s ease;
        }

        .fb-upload-empty:hover:not(:disabled) {
          border-color: var(--accent-color, #2563eb);
          background:
            color-mix(
              in srgb,
              var(--accent-color, #2563eb) 5%,
              transparent
            );
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(15, 23, 42, .08);
        }

        .fb-photo-card {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, .20);
          background: rgba(255,255,255,.025);
        }

        .primary-button,
        .secondary-button,
        .icon-button {
          min-height: 42px;
          border-radius: 11px !important;
          font-weight: 700;
          letter-spacing: -.01em;
        }

        .fb-publish-actions {
          padding-top: 8px;
        }

        @media (prefers-color-scheme: dark) {
          .fb-posting-panel input,
          .fb-posting-panel select,
          .fb-posting-panel textarea {
            background: rgba(15, 23, 42, .58);
            color: #f8fafc;
            border-color: rgba(148, 163, 184, .30);
          }

          .fb-posting-panel input:focus,
          .fb-posting-panel select:focus,
          .fb-posting-panel textarea:focus {
            background: rgba(15, 23, 42, .82);
          }

          .fb-posting-panel input[type="datetime-local"] {
            color-scheme: dark;
          }
        }


        .eo2-datetime-picker {
          display: grid;
          grid-template-columns: minmax(150px, 1fr) minmax(220px, 1.25fr);
          gap: 12px;
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, .30);
          border-radius: 14px;
          background: rgba(148, 163, 184, .035);
          min-width: 0;
        }

        .eo2-datetime-picker:focus-within {
          border-color: var(--accent-color, #2563eb);
          box-shadow:
            0 0 0 3px color-mix(
              in srgb,
              var(--accent-color, #2563eb) 12%,
              transparent
            );
        }

        .eo2-datetime-error {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, .10);
          background: rgba(254, 242, 242, .35);
        }

        .eo2-date-part,
        .eo2-time-part {
          min-width: 0;
        }

        .eo2-datetime-label {
          display: block;
          margin: 0 0 6px 2px;
          font-size: .72rem;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
          opacity: .56;
        }

        .eo2-date-part input[type="date"] {
          min-height: 48px;
        }

        .eo2-time-wheel-group {
          display: grid;
          grid-template-columns: minmax(64px, 1fr) auto minmax(64px, 1fr) minmax(68px, .8fr);
          align-items: center;
          gap: 7px;
          min-width: 0;
        }

        .eo2-time-wheel,
        .eo2-time-period {
          appearance: auto !important;
          -webkit-appearance: auto !important;
          background-image: none !important;
          padding: 0 !important;
          min-height: 92px !important;
          height: 92px;
          overflow-y: auto;
          scroll-behavior: smooth;
          text-align: center;
          font-variant-numeric: tabular-nums;
          border-radius: 12px !important;
        }

        .eo2-time-period {
          min-width: 68px;
        }

        .eo2-time-wheel option,
        .eo2-time-period option {
          min-height: 30px;
          padding: 7px 5px;
          text-align: center;
          font-size: .95rem;
        }

        .eo2-time-separator {
          font-size: 1.25rem;
          font-weight: 800;
          opacity: .62;
        }

        @media (max-width: 720px) {
          .fb-post-setup-grid,
          .fb-rule-grid,
          .fb-post-preview-layout {
            grid-template-columns: 1fr !important;
          }

          .fb-photo-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-header.fb-posting-header {
            gap: 12px;
            align-items: flex-start;
          }

          .eo2-publish-card,
          .eo2-success-card {
            padding: 22px 18px;
          }

          .fb-posting-panel input,
          .fb-posting-panel select,
          .fb-posting-panel textarea {
            font-size: 16px;
          }

          .eo2-datetime-picker {
            grid-template-columns: 1fr;
          }

          .eo2-time-wheel-group {
            grid-template-columns: minmax(68px, 1fr) auto minmax(68px, 1fr) minmax(72px, .8fr);
          }

          .eo2-time-wheel,
          .eo2-time-period {
            min-height: 100px !important;
            height: 100px;
            font-size: 16px;
          }
        }
      `}</style>

      <header className="dashboard-header fb-posting-header">
        <div>
          <p className="eyebrow">FACEBOOK · AUCTION POSTING</p>
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
          disabled={loading || publishing || processingFiles}
          title="Refresh Facebook Pages and Operating Modes"
          aria-label="Refresh Facebook Pages and Operating Modes"
        >
          ↻
        </button>
      </header>

      {message && (
        <div className="success-message global-error">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="dashboard-error global-error" role="alert">
          {errorMessage}
        </div>
      )}

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>1. Post setup</h2>
            <p>Choose the Page, operating mode and auction type.</p>
          </div>
        </div>

        <div className="fb-post-setup-grid">
          <label className={fieldClass(fieldErrors, "page")}>
            Facebook Page <span className="eo2-required">*</span>
            <select
              ref={registerField("page")}
              value={selectedPageId}
              onChange={(e) => {
                setSelectedPageId(e.target.value);
                clearFieldError("page");
              }}
              disabled={loading || publishing || processingFiles}
              aria-invalid={Boolean(fieldErrors.page)}
            >
              {!pages.length && (
                <option value="">No active Page connected</option>
              )}

              {pages.map((page) => (
                <option
                  key={page.fb_page_id}
                  value={page.fb_page_id}
                >
                  {page.page_name || "Facebook Page"}
                </option>
              ))}
            </select>
            {fieldErrors.page && (
              <small className="eo2-field-error-text">
                {fieldErrors.page}
              </small>
            )}
          </label>

          <label className={fieldClass(fieldErrors, "environment")}>
            Operating Mode <span className="eo2-required">*</span>
            <select
              ref={registerField("environment")}
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                clearFieldError("environment");
              }}
              disabled={loading || publishing || processingFiles}
              aria-invalid={Boolean(fieldErrors.environment)}
            >
              {!selectableEnvironments.length && (
                <option value="">
                  No active operating mode available
                </option>
              )}

              {selectableEnvironments.map((row) => (
                <option
                  key={row.environment_code}
                  value={String(row.environment_code).toUpperCase()}
                >
                  EO2MATE-{String(row.environment_code).toUpperCase()}
                  {" · "}
                  {row.environment_name}
                </option>
              ))}
            </select>

            <small>
              Modes come from the EO2MATE environment reference table
              and are limited by this client's subscription.
            </small>

            {fieldErrors.environment && (
              <small className="eo2-field-error-text">
                {fieldErrors.environment}
              </small>
            )}
          </label>

          <label>
            Auction Type
            <select
              value={postType}
              onChange={(e) => changePostType(e.target.value)}
              disabled={publishing}
            >
              <option value="SINGLE">Single Auction</option>
              <option value="MULTIPLE">Multiple Auction</option>
            </select>
          </label>
        </div>
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>2. Auction details</h2>
            <p>
              Enter the seller caption and EO2MATE auction rules.
            </p>
          </div>
        </div>

        <label>
          Seller Caption
          <textarea
            rows="5"
            value={sellerCaption}
            onChange={(e) => setSellerCaption(e.target.value)}
            placeholder="Optional seller caption shown before the EO2MATE auction rules."
            disabled={publishing}
          />
        </label>

        {postType === "SINGLE" && (
          <label className={fieldClass(fieldErrors, "singleItem")}>
            Item Name <span className="eo2-required">*</span>
            <input
              ref={registerField("singleItem")}
              value={singleItem}
              onChange={(e) => {
                setSingleItem(e.target.value);
                clearFieldError("singleItem");
              }}
              placeholder="Auction item"
              disabled={publishing}
              aria-invalid={Boolean(fieldErrors.singleItem)}
            />
            {fieldErrors.singleItem && (
              <small className="eo2-field-error-text">
                {fieldErrors.singleItem}
              </small>
            )}
          </label>
        )}

        <h3>
          {postType === "MULTIPLE"
            ? "Shared / default rules"
            : "Auction rules"}
        </h3>

        <RuleFields
          value={sharedRules}
          onChange={(next) => {
            setSharedRules(next);
            setFieldErrors((current) => {
              const cleaned = { ...current };
              Object.keys(cleaned)
                .filter((key) => key.startsWith("shared."))
                .forEach((key) => delete cleaned[key]);
              return cleaned;
            });
          }}
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
              Upload up to {MAX_IMAGES} JPG/PNG images. Drag to reorder.
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={publishing || processingFiles || items.length >= MAX_IMAGES}
            >
              Add photos
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />

        {!items.length ? (
          <button
            ref={uploadButtonRef}
            type="button"
            className={`fb-upload-empty ${
              fieldErrors.images ? "eo2-upload-error" : ""
            }`}
            onClick={() => fileInputRef.current?.click()}
            disabled={publishing || processingFiles}
          >
            <span className="fb-upload-icon">+</span>
            <strong>
              Upload auction photos <span className="eo2-required">*</span>
            </strong>
            <span>JPG or PNG · maximum 10 MB each</span>
            {fieldErrors.images && (
              <span className="eo2-field-error-text">
                {fieldErrors.images}
              </span>
            )}
          </button>
        ) : (
          <div
            className={`fb-photo-grid ${
              postType === "MULTIPLE" ? "multiple" : "single"
            }`}
          >
            {items.map((item, index) => {
              const prefix = `item.${item.id}`;

              return (
                <article
                  key={item.id}
                  className={`fb-photo-card ${
                    draggingId === item.id ? "dragging" : ""
                  }`}
                  draggable={!publishing}
                  onDragStart={() => setDraggingId(item.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    moveItem(draggingId, item.id);
                    setDraggingId(null);
                  }}
                >
                  <div className="fb-photo-preview-wrap">
                    <img
                      src={item.previewUrl}
                      alt={`Auction ${index + 1}`}
                    />
                    <span className="fb-photo-number">
                      {postType === "MULTIPLE"
                        ? `Item ${index + 1}`
                        : `Photo ${index + 1}`}
                    </span>
                    <span
                      className="fb-drag-handle"
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </span>
                    <button
                      type="button"
                      className="fb-photo-remove"
                      onClick={() => removeItem(item.id)}
                      disabled={publishing}
                      title="Remove photo"
                    >
                      ×
                    </button>
                  </div>

                  {postType === "MULTIPLE" && (
                    <div className="fb-item-editor">
                      <label
                        className={fieldClass(
                          fieldErrors,
                          `${prefix}.item`
                        )}
                      >
                        Item Name <span className="eo2-required">*</span>
                        <input
                          ref={registerField(`${prefix}.item`)}
                          value={item.item}
                          onChange={(e) => {
                            updateItem(item.id, {
                              item: e.target.value,
                            });
                            clearFieldError(`${prefix}.item`);
                          }}
                          placeholder={`Item ${index + 1}`}
                          disabled={publishing}
                          aria-invalid={Boolean(
                            fieldErrors[`${prefix}.item`]
                          )}
                        />
                        {fieldErrors[`${prefix}.item`] && (
                          <small className="eo2-field-error-text">
                            {fieldErrors[`${prefix}.item`]}
                          </small>
                        )}
                      </label>

                      <details>
                        <summary>Override shared rules</summary>

                        <RuleFields
                          value={item}
                          onChange={(next) => {
                            updateItem(item.id, next);
                            setFieldErrors((current) => {
                              const cleaned = { ...current };
                              Object.keys(cleaned)
                                .filter((key) =>
                                  key.startsWith(`${prefix}.`)
                                )
                                .forEach(
                                  (key) => delete cleaned[key]
                                );
                              return cleaned;
                            });
                          }}
                          disabled={publishing}
                          fieldPrefix={prefix}
                          fieldErrors={fieldErrors}
                          registerField={registerField}
                        />
                      </details>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>4. Preview & publish</h2>
            <p>Review the exact EO2MATE caption before publishing.</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowPreview((current) => !current)}
            disabled={publishing}
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>

        {showPreview && (
          <div className="fb-post-preview-layout">
            <div className="fb-facebook-preview">
              <div className="fb-preview-page">
                <div className="fb-preview-avatar">f</div>
                <div>
                  <strong>
                    {getPageLabel(
                      pages.find(
                        (page) =>
                          String(page.fb_page_id) === selectedPageId
                      )
                    )}
                  </strong>
                  <span>Just now · 🌐</span>
                </div>
              </div>

              <pre>
                {mainCaption ||
                  "Your generated Facebook caption will appear here."}
              </pre>
            </div>

            {postType === "MULTIPLE" && (
              <div>
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
            disabled={loading || publishing || processingFiles}
          >
            {publishing ? "Publishing…" : "Publish to Facebook"}
          </button>
        </div>
      </section>

      {(loading || processingFiles || publishing) && (
        <div
          className="eo2-publish-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={
            publishing
              ? "Publishing auction"
              : processingFiles
                ? "Processing images"
                : "Loading posting setup"
          }
        >
          <div className="eo2-publish-card">
            <div className="eo2-spinner" />

            <h2>
              {publishing
                ? "Publishing auction…"
                : processingFiles
                  ? "Processing images…"
                  : "Loading posting setup…"}
            </h2>

            <p>
              {publishing
                ? "Uploading images, creating the Facebook post and activating EO2MATE automation."
                : processingFiles
                  ? "Checking the selected images and preparing previews."
                  : "Loading Facebook Pages, operating modes and client posting setup."}
            </p>

            <div className="eo2-progress-track">
              <div className="eo2-progress-bar" />
            </div>

            <small>
              {publishing
                ? "Please keep this page open until publishing completes."
                : "This will close automatically when processing is complete."}
            </small>
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
            <div className="eo2-success-icon">✓</div>
            <h2 id="eo2-success-title">Auction published</h2>
            <p>
              The Facebook post was created successfully. Click Create New Post to start with a clean auction form.
            </p>
            <p>
              <strong>Page:</strong> {successPopup.page_name}
            </p>
            <p>
              <strong>Mode:</strong> {successPopup.environment}
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
                onClick={() => resetFormForNewPost()}
              >
                Create New Post
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
