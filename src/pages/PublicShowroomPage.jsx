import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import "./PublicShowroomPage.css";

const formatPrice = (value) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 2,
}).format(Number(value || 0));

function StoreIcon({ kind }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/></>,
    bag: <><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4.9 9A7.5 7.5 0 0 1 18 6l2 2M4 17v-5h5"/><path d="M19.1 15A7.5 7.5 0 0 1 6 18l-2-2"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

export default function PublicShowroomPage({ fbPageId }) {
  const [showroom, setShowroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");

  async function loadShowroom() {
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("eo2mate", {
        method: "POST",
        headers: { "x-eo2mate-route": "public-showroom" },
        body: { fb_page_id: fbPageId },
      });
      if (invokeError || !data?.success) {
        const message = data?.error === "SHOWROOM_NOT_FOUND"
          ? "This showroom is not available. Check the link or contact the Page owner."
          : data?.message || invokeError?.message || "We couldn't load this Page's showroom.";
        throw new Error(message);
      }
      setShowroom(data);
      document.title = `${data.page?.name || "Showroom"} | Shop`;
    } catch (loadError) {
      setError(loadError.message || "We couldn't load this Page's showroom.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadShowroom(); }, [fbPageId]);

  const items = useMemo(() => (showroom?.items || []).filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [item.item_name, item.item_code, item.description].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch;
  }).sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : String(a.item_name).localeCompare(String(b.item_name))), [showroom, search, sort]);

  const page = showroom?.page || {};
  const pageUrl = page.link || `https://www.facebook.com/${fbPageId}`;
  const messengerUrl = `https://m.me/${fbPageId}`;

  return <main className="showroom-site">
    <nav className="showroom-nav">
      <a className="showroom-wordmark" href="#top" aria-label={`${page.name || "Facebook Page"} home`}>
        {page.picture ? <img src={page.picture} alt="" /> : <span className="showroom-wordmark-mark">S</span>}
        <span>{page.name || "Facebook Page"}</span>
      </a>
      <div className="showroom-nav-links"><a href="#collection">Shop</a><a href="#about">About</a><a className="showroom-nav-contact" href={messengerUrl} target="_blank" rel="noreferrer">Contact</a></div>
    </nav>

    <section className="showroom-hero" id="top" style={page.cover ? { backgroundImage: `linear-gradient(90deg, rgba(238,244,237,.96), rgba(238,244,237,.82) 54%, rgba(238,244,237,.52)), url("${page.cover}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <div className="showroom-hero-art" aria-hidden="true"><span/><span/><span/></div>
      <div className="showroom-hero-content">
        <div className="showroom-profile-row">
          {page.picture ? <img className="showroom-avatar" src={page.picture} alt={`${page.name || "Page"} profile`} /> : <div className="showroom-avatar showroom-avatar-fallback">{(page.name || "S").slice(0, 1).toUpperCase()}</div>}
          <div><span className="showroom-eyebrow">OFFICIAL PAGE SHOWROOM</span><h1>{page.name || "Facebook Page"}</h1></div>
        </div>
        {page.category && <span className="showroom-category">{page.category}</span>}
        <p className="showroom-intro">{page.about || page.description || "Discover our latest available items. Browse the collection and message us on Facebook if you have a question."}</p>
        <div className="showroom-hero-actions">
          <a className="showroom-follow-button" href={pageUrl} target="_blank" rel="noreferrer"><span aria-hidden="true">f</span> Follow on Facebook</a>
          <a className="showroom-message-button" href={messengerUrl} target="_blank" rel="noreferrer">Message the Page <StoreIcon kind="arrow" /></a>
        </div>
        <div className="showroom-trust-row"><span><i/>Current available stock</span><b>·</b><span>Updated from the Page inventory</span></div>
      </div>
      <a className="showroom-scroll-cue" href="#collection">Explore the collection <span>↓</span></a>
    </section>

    <section className="showroom-notice-board" aria-labelledby="showroom-board-title">
      <div className="showroom-board-heading"><div><span className="showroom-eyebrow">FROM THE PAGE</span><h2 id="showroom-board-title">Promotions & updates</h2><p>Offers, new arrivals and important notes from {page.name || "this Page"}.</p></div><a href={messengerUrl} target="_blank" rel="noreferrer">Ask us a question <StoreIcon kind="arrow"/></a></div>
      {showroom?.announcements?.length ? <div className="showroom-notice-grid">{showroom.announcements.map((note) => <article className={`showroom-notice-card showroom-notice-${String(note.announcement_type || "INFO").toLowerCase()}`} key={note.id}><span className="showroom-notice-type">{note.announcement_type === "PROMOTION" ? "SPECIAL OFFER" : note.announcement_type === "INFO" ? "STORE INFO" : "ANNOUNCEMENT"}</span><h3>{note.title}</h3>{note.body && <p>{note.body}</p>}{(note.starts_at || note.ends_at) && <small>{note.ends_at ? `Until ${new Date(note.ends_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}` : "Limited time"}</small>}{note.cta_url && <a href={note.cta_url} target="_blank" rel="noreferrer">{note.cta_label || "Learn more"} <StoreIcon kind="arrow"/></a>}</article>)}</div>
        : <div className="showroom-board-empty"><span>✦</span><div><strong>Good things are on the way</strong><p>Check back here for promotions, new arrivals and updates from the Page.</p></div></div>}
    </section>

    <section className="showroom-collection" id="collection">
      <header className="showroom-section-heading">
        <div><span className="showroom-eyebrow">THE COLLECTION</span><h2>Available now</h2><p>Browse what is currently in stock. Items with no available quantity are hidden.</p></div>
        <div className="showroom-stock-count"><StoreIcon kind="bag"/><span><strong>{showroom?.items?.length || 0}</strong><small>items available</small></span></div>
      </header>
      <div className="showroom-toolbar">
        <label className="showroom-search"><StoreIcon kind="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or item codes" aria-label="Search available products"/></label>
        <label className="showroom-category-select"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Product name</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
      </div>

      {loading ? <div className="showroom-state"><span className="showroom-spinner"/><strong>Opening the showroom</strong><p>Loading the latest Page details and available items…</p></div>
        : error ? <div className="showroom-state showroom-error"><strong>Showroom unavailable</strong><p>{error}</p><button type="button" onClick={loadShowroom}><StoreIcon kind="refresh"/> Try again</button></div>
          : items.length ? <div className="showroom-product-grid">{items.map((item) => {
            const cover = item.images?.find((image) => image.is_primary)?.url || item.images?.[0]?.url;
            return <article className="showroom-product-card" key={item.id}>
              <div className="showroom-product-photo">{cover ? <img src={cover} alt={item.item_name} loading="lazy"/> : <div className="showroom-no-photo"><span>{page.name?.slice(0, 1) || "S"}</span><small>Product photo</small></div>}<span className="showroom-available"><i/>{item.available} available</span></div>
              <div className="showroom-product-info"><div className="showroom-product-code">{item.item_code}</div><h3>{item.item_name}</h3>{item.description && <p>{item.description}</p>}<div className="showroom-product-bottom"><strong>{formatPrice(item.price)}</strong><a href={messengerUrl} target="_blank" rel="noreferrer">Ask about item <StoreIcon kind="arrow"/></a></div></div>
            </article>;
          })}</div> : <div className="showroom-state showroom-empty"><span className="showroom-empty-icon"><StoreIcon kind="bag"/></span><strong>{search ? "No matching items" : "More items coming soon"}</strong><p>{search ? "Try a different search." : "There are no available inventory items to display right now. Check back later or message the Page."}</p>{search && <button type="button" onClick={() => setSearch("")}>Clear search</button>}</div>}
    </section>

    <section className="showroom-about" id="about">
      <div className="showroom-about-mark">{page.picture ? <img src={page.picture} alt=""/> : <span>{(page.name || "S").slice(0, 1).toUpperCase()}</span>}</div>
      <div className="showroom-about-copy"><span className="showroom-eyebrow">A LITTLE ABOUT US</span><h2>{page.name || "Facebook Page"}</h2><p>{page.description || page.about || "Thanks for visiting our showroom. Follow our Facebook Page for new arrivals, updates and announcements."}</p><div className="showroom-about-links"><a href={pageUrl} target="_blank" rel="noreferrer"><StoreIcon kind="pin"/> Visit and follow our Facebook Page</a><a href={messengerUrl} target="_blank" rel="noreferrer">Send us a message <StoreIcon kind="arrow"/></a></div></div>
    </section>

    <footer className="showroom-footer"><a className="showroom-wordmark" href="#top">{page.picture ? <img src={page.picture} alt=""/> : <span className="showroom-wordmark-mark">S</span>}<span>{page.name || "Facebook Page"}</span></a><span>Public inventory showroom</span><a href={pageUrl} target="_blank" rel="noreferrer">Follow on Facebook <StoreIcon kind="arrow"/></a></footer>
  </main>;
}
