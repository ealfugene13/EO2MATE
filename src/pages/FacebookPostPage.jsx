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

function getPageLabel(page) {
  return (
    page?.page_name ||
    page?.fb_page_name ||
    page?.name ||
    page?.fb_page_id ||
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
  const buyout = formatMoneyForCaption(rules.buyout);

  if (minBid) lines.push(`Minimum Bid: ${minBid}`);
  if (increment) lines.push(`Increment: ${increment}`);

  const minimumBidders = Number(rules.minimumBidders || 1);
  if (Number.isFinite(minimumBidders) && minimumBidders > 0) {
    lines.push(`Minimum Bidders: ${Math.trunc(minimumBidders)}`);
  }

  if (buyout) {
    lines.push(`Buyout: ${buyout}`);
  }

  if (rules.buyoutUntil) {
    lines.push(`Buyout Until: ${formatFacebookAuctionDate(rules.buyoutUntil)}`);
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
    buyout: item.buyout || shared.buyout,
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

function RuleFields({
  value,
  onChange,
  shared = false,
  disabled = false,
}) {
  const set = (key, nextValue) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  return (
    <div className={`fb-rule-grid ${shared ? "shared" : "item-rules"}`}>
      <label>
        Minimum Bid
        <input
          value={value.minBid}
          onChange={(e) => set("minBid", e.target.value)}
          placeholder={shared ? "500 or 5h" : "Inherit"}
          disabled={disabled}
        />
      </label>

      <label>
        Increment
        <input
          value={value.increment}
          onChange={(e) => set("increment", e.target.value)}
          placeholder={shared ? "100 or 1h" : "Inherit"}
          disabled={disabled}
        />
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

      <label>
        Buyout
        <input
          value={value.buyout}
          onChange={(e) => set("buyout", e.target.value)}
          placeholder={shared ? "Optional" : "Inherit"}
          disabled={disabled}
        />
      </label>

      <label>
        Buyout Until
        <input
          type="datetime-local"
          value={value.buyoutUntil}
          onChange={(e) => set("buyoutUntil", e.target.value)}
          disabled={disabled}
        />
      </label>

      <label>
        Auction Ends
        <input
          type="datetime-local"
          value={value.auctionEnds}
          onChange={(e) => set("auctionEnds", e.target.value)}
          disabled={disabled}
        />
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

  const [pages, setPages] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [environment, setEnvironment] = useState("CLNT");
  const [postType, setPostType] = useState("SINGLE");
  const [sellerCaption, setSellerCaption] = useState("");
  const [singleItem, setSingleItem] = useState("");
  const [sharedRules, setSharedRules] = useState(DEFAULT_RULES);
  const [items, setItems] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [publishedPost, setPublishedPost] = useState(null);

  useEffect(() => {
    loadPostingSetup();

    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (!subscription) return;

    const allowed = String(
      subscription.allowed_environment ||
      client?.default_environment ||
      "CLNT"
    ).toUpperCase();

    setEnvironment(allowed === "PROD" ? "PROD" : allowed === "TEST" ? "TEST" : "CLNT");
  }, [subscription, client?.default_environment]);

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

      setPages(pageRows);
      setSubscription(data.subscription || null);

      if (pageRows.length && !selectedPageId) {
        setSelectedPageId(
          String(pageRows[0].fb_page_id)
        );
      }
    } catch (error) {
      setErrorMessage(error.message || "Unable to load Facebook posting setup.");
    } finally {
      setLoading(false);
    }
  }

  const allowedEnvironment = String(
    subscription?.allowed_environment ||
    client?.default_environment ||
    "CLNT"
  ).toUpperCase();

  const environmentOptions = useMemo(() => {
    if (allowedEnvironment === "PROD") return ["CLNT", "TEST", "PROD"];
    if (allowedEnvironment === "TEST") return ["CLNT", "TEST"];
    return ["CLNT"];
  }, [allowedEnvironment]);

  const mainCaption = useMemo(() => {
    const lines = [];

    if (sellerCaption.trim()) {
      lines.push(sellerCaption.trim(), "");
    }

    lines.push(`EO2MATE-${environment}`);
    lines.push("");
    lines.push(postType === "SINGLE" ? "[Auction-Single]" : "[Auction-Multiple]");

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
  }, [sellerCaption, environment, postType, sharedRules, singleItem]);

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
    setPublishedPost(null);
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    setErrorMessage("");

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
      ...accepted.map((file, index) => createItem(file, current.length + index)),
    ]);

    if (errors.length) {
      setErrorMessage(errors.join(" "));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    const problems = [];

    if (!selectedPageId) {
      problems.push("Select a Facebook Page.");
    }

    if (!environmentOptions.includes(environment)) {
      problems.push(`${environment} is not enabled for this client.`);
    }

    if (!items.length) {
      problems.push("Upload at least one image.");
    }

    if (!normalizeMoney(sharedRules.minBid)) {
      problems.push("Minimum Bid is required.");
    }

    if (!normalizeMoney(sharedRules.increment)) {
      problems.push("Increment is required.");
    }

    const sharedEnd = phDateFromLocalInput(sharedRules.auctionEnds);

    if (!sharedEnd && postType === "SINGLE") {
      problems.push("Auction Ends is required.");
    }

    if (sharedEnd && sharedEnd.getTime() <= Date.now()) {
      problems.push("Auction Ends must be in the future.");
    }

    if (sharedRules.buyout && !normalizeMoney(sharedRules.buyout)) {
      problems.push("Buyout amount is invalid.");
    }

    if (sharedRules.buyoutUntil) {
      const buyoutUntil = phDateFromLocalInput(sharedRules.buyoutUntil);

      if (!buyoutUntil) {
        problems.push("Buyout Until is invalid.");
      } else if (sharedEnd && buyoutUntil.getTime() > sharedEnd.getTime()) {
        problems.push("Buyout Until cannot be later than Auction Ends.");
      }
    }

    if (postType === "SINGLE") {
      if (!singleItem.trim()) {
        problems.push("Item name is required for Single Auction.");
      }
    } else {
      items.forEach((item, index) => {
        if (!item.item.trim()) {
          problems.push(`Item ${index + 1}: item name is required.`);
        }

        const effective = mergeRules(sharedRules, item);
        const end = phDateFromLocalInput(effective.auctionEnds);

        if (!end) {
          problems.push(`Item ${index + 1}: Auction Ends is required.`);
        } else if (end.getTime() <= Date.now()) {
          problems.push(`Item ${index + 1}: Auction Ends must be in the future.`);
        }

        if (!normalizeMoney(effective.minBid)) {
          problems.push(`Item ${index + 1}: Minimum Bid is required.`);
        }

        if (!normalizeMoney(effective.increment)) {
          problems.push(`Item ${index + 1}: Increment is required.`);
        }
      });
    }

    return problems;
  }

  async function publishAuction() {
    const problems = validate();

    if (problems.length) {
      setErrorMessage(problems.join(" "));
      setMessage("");
      return;
    }

    const confirmed = window.confirm(
      `Publish this ${postType === "SINGLE" ? "Single" : "Multiple"} Auction to Facebook?\n\n` +
      `Page: ${getPageLabel(pages.find((page) => String(page.fb_page_id) === selectedPageId))}\n` +
      `Mode: ${environment}\n` +
      `Images: ${items.length}`
    );

    if (!confirmed) return;

    setPublishing(true);
    setMessage("");
    setErrorMessage("");
    setPublishedPost(null);

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
        formData.append(`image_${index}`, item.file, item.file.name);
      });

      const { data, error } = await supabase.functions.invoke(
        "facebook-auction-publish",
        {
          body: formData,
        }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Facebook publishing failed.");
      }

      setPublishedPost(data);
      setMessage(
        "Auction published successfully. EO2MATE will process the Facebook post through the normal webhook."
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
        "Unable to publish the auction to Facebook."
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <header className="dashboard-header fb-posting-header">
        <div>
          <p className="eyebrow">FACEBOOK · AUCTION POSTING</p>
          <h1>Create Auction Post</h1>
          <p>
            Build a valid EO2MATE auction caption, organize photos, preview the post,
            and publish directly to your connected Page.
          </p>
        </div>

        <button
          type="button"
          className="icon-button refresh-icon-button"
          onClick={loadPostingSetup}
          disabled={loading || publishing}
          title="Refresh Facebook Pages"
          aria-label="Refresh Facebook Pages"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.3-2.1L20 9" />
            <path d="M4 15l2.6 2.1A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
      </header>

      {message && <div className="success-message global-error">{message}</div>}
      {errorMessage && <div className="dashboard-error global-error">{errorMessage}</div>}

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>1. Post setup</h2>
            <p>Choose the Page, environment and auction type.</p>
          </div>
        </div>

        <div className="fb-post-setup-grid">
          <label>
            Facebook Page
            <select
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
              disabled={loading || publishing}
            >
              {!pages.length && <option value="">No active Page connected</option>}
              {pages.map((page) => (
                <option key={page.fb_page_id} value={page.fb_page_id}>
                  {getPageLabel(page)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Operating Mode
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              disabled={publishing}
            >
              {environmentOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "CLNT"
                    ? "EO2MATE-CLNT · Manual payment"
                    : mode === "TEST"
                      ? "EO2MATE-TEST · PayMongo test"
                      : "EO2MATE-PROD · Live payment"}
                </option>
              ))}
            </select>
            <small>Admin entitlement: {allowedEnvironment}</small>
          </label>

          <div className="fb-auction-type-field">
            <span>Auction Type</span>
            <div className="fb-segmented-control">
              <button
                type="button"
                className={postType === "SINGLE" ? "active" : ""}
                onClick={() => changePostType("SINGLE")}
                disabled={publishing}
              >
                Single Auction
              </button>
              <button
                type="button"
                className={postType === "MULTIPLE" ? "active" : ""}
                onClick={() => changePostType("MULTIPLE")}
                disabled={publishing}
              >
                Multiple Auction
              </button>
            </div>
          </div>
        </div>

        <div className="fb-mode-note">
          <strong>
            {postType === "SINGLE" ? "Single Auction" : "Multiple Auction"}
          </strong>
          <span>
            {postType === "SINGLE"
              ? "All uploaded photos belong to one auction. Only main-post comments are valid bids."
              : "Each photo becomes one auction item. Bids are made on the corresponding photo; main-post bids are not valid."}
          </span>
        </div>
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>2. Seller caption + auction rules</h2>
            <p>Your own caption appears first. EO2MATE syntax is generated below it automatically.</p>
          </div>
        </div>

        <div className="fb-caption-editor">
          <label>
            Seller caption
            <textarea
              rows="5"
              value={sellerCaption}
              onChange={(e) => setSellerCaption(e.target.value)}
              placeholder="Example: Weekend auction! Please read the rules before bidding."
              disabled={publishing}
            />
          </label>

          {postType === "SINGLE" && (
            <label>
              Item
              <input
                value={singleItem}
                onChange={(e) => setSingleItem(e.target.value)}
                placeholder="Example: Hot Toys Iron Man"
                disabled={publishing}
              />
            </label>
          )}

          <div>
            <div className="fb-section-label">
              <strong>
                {postType === "MULTIPLE" ? "Shared/default rules" : "Auction rules"}
              </strong>
              {postType === "MULTIPLE" && (
                <span>Each item may override these values below.</span>
              )}
            </div>

            <RuleFields
              value={sharedRules}
              onChange={setSharedRules}
              shared
              disabled={publishing}
            />
          </div>

          <div className="fb-money-help">
            <strong>Money shortcuts:</strong>
            <span><code>5h</code> = 500</span>
            <span><code>2k</code> = 2,000</span>
          </div>
        </div>
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>3. Photos {postType === "MULTIPLE" ? "& items" : ""}</h2>
            <p>
              Upload up to {MAX_IMAGES} JPG/PNG photos. Drag cards to change their Facebook display/item order.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={publishing || items.length >= MAX_IMAGES}
          >
            + Add Photos
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {!items.length ? (
          <button
            type="button"
            className="fb-upload-empty"
            onClick={() => fileInputRef.current?.click()}
            disabled={publishing}
          >
            <span className="fb-upload-icon">+</span>
            <strong>Upload auction photos</strong>
            <span>JPG or PNG · maximum 10 MB each</span>
          </button>
        ) : (
          <div className={`fb-photo-grid ${postType === "MULTIPLE" ? "multiple" : "single"}`}>
            {items.map((item, index) => (
              <article
                key={item.id}
                className={`fb-photo-card ${draggingId === item.id ? "dragging" : ""}`}
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
                  <img src={item.previewUrl} alt={`Auction ${index + 1}`} />
                  <span className="fb-photo-number">
                    {postType === "MULTIPLE" ? `Item ${index + 1}` : `Photo ${index + 1}`}
                  </span>
                  <span className="fb-drag-handle" title="Drag to reorder">⋮⋮</span>
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
                    <label>
                      Item name
                      <input
                        value={item.item}
                        onChange={(e) =>
                          updateItem(item.id, {
                            item: e.target.value,
                          })
                        }
                        placeholder={`Item ${index + 1}`}
                        disabled={publishing}
                      />
                    </label>

                    <details>
                      <summary>Override shared rules</summary>
                      <RuleFields
                        value={item}
                        onChange={(next) => updateItem(item.id, next)}
                        disabled={publishing}
                      />
                    </details>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-panel fb-posting-panel">
        <div className="panel-header">
          <div>
            <h2>4. Preview & publish</h2>
            <p>Review the exact EO2MATE captions before publishing.</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowPreview((current) => !current)}
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
                      pages.find((page) => String(page.fb_page_id) === selectedPageId)
                    )}
                  </strong>
                  <span>Just now · 🌐</span>
                </div>
              </div>

              <pre>{mainCaption || "Your generated Facebook caption will appear here."}</pre>

              {items.length > 0 && (
                <div className={`fb-preview-images count-${Math.min(items.length, 4)}`}>
                  {items.slice(0, 4).map((item, index) => (
                    <div className="fb-preview-image" key={item.id}>
                      <img src={item.previewUrl} alt="" />
                      {postType === "MULTIPLE" && (
                        <span>{item.item || `Item ${index + 1}`}</span>
                      )}
                    </div>
                  ))}
                  {items.length > 4 && (
                    <div className="fb-preview-more">+{items.length - 4}</div>
                  )}
                </div>
              )}
            </div>

            <div className="fb-generated-captions">
              <div>
                <strong>Main post caption</strong>
                <button
                  type="button"
                  className="table-action-button"
                  onClick={() => navigator.clipboard?.writeText(mainCaption)}
                >
                  Copy
                </button>
              </div>
              <pre>{mainCaption}</pre>

              {postType === "MULTIPLE" && photoCaptions.map((caption, index) => (
                <details key={items[index]?.id || index}>
                  <summary>
                    Photo {index + 1}: {items[index]?.item || "Unnamed item"}
                  </summary>
                  <pre>{caption}</pre>
                </details>
              ))}
            </div>
          </div>
        )}

        <div className="fb-publish-footer">
          <div>
            <strong>Ready to publish?</strong>
            <span>
              Facebook will receive the post and photos first. The existing EO2MATE webhook then creates/synchronizes the auction.
            </span>
          </div>

          <button
            type="button"
            className="primary-button fb-publish-button"
            onClick={publishAuction}
            disabled={publishing || loading || !pages.length}
          >
            {publishing ? "Publishing..." : "Publish to Facebook"}
          </button>
        </div>

        {publishedPost && (
          <div className="fb-published-result">
            <div>
              <strong>Published successfully</strong>
              <span>Facebook Post ID: {publishedPost.fb_post_id}</span>
            </div>

            {publishedPost.permalink_url && (
              <a
                href={publishedPost.permalink_url}
                target="_blank"
                rel="noreferrer"
                className="primary-button"
              >
                Open Facebook Post
              </a>
            )}
          </div>
        )}
      </section>
    </>
  );
}
