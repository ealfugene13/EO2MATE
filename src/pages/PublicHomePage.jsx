const modules = [
  { icon: "◎", title: "Live Selling", text: "Run real-time selling sessions with staff-assisted order capture." },
  { icon: "⚒", title: "Mining", text: "Manage Mine, Take and Lock claims for single or multiple items." },
  { icon: "↗", title: "Auctions", text: "Publish auction posts, track bids and manage winners." },
  { icon: "＋", title: "Pre-Order & Regular Sale", text: "Accept quantity-based reservations and standard sale claims." },
  { icon: "▦", title: "Inventory", text: "Keep products, stock levels and sales activity organized." },
  { icon: "▤", title: "Orders & Delivery", text: "Follow orders from checkout through fulfillment." },
];

export default function PublicHomePage({ onLogin }) {
  return (
    <main className="public-home">
      <nav className="public-nav">
        <a className="public-brand" href="#top" aria-label="EO2MATE home"><span className="public-brand-mark">E</span><span>EO2MATE</span></a>
        <div className="public-nav-actions"><a href="#functions">Functions</a><button className="public-login-button" onClick={onLogin}>Sign in</button></div>
      </nav>
      <section className="public-hero" id="top">
        <div className="public-hero-copy">
          <span className="public-kicker"><i /> SOCIAL COMMERCE OPERATIONS</span>
          <h1>Run your selling<br/><em>from one place.</em></h1>
          <p>EO2MATE helps Facebook sellers manage posts, claims, inventory, orders and delivery in a connected workspace.</p>
          <div className="public-hero-actions"><button className="public-primary-button" onClick={onLogin}>Sign in to your workspace <span aria-hidden="true">→</span></button><a href="#functions">Explore functions</a></div>
          <div className="public-trust-line"><span className="public-check">✓</span> Secure account access <span className="public-dot">·</span> Facebook Page automation <span className="public-dot">·</span> Order management</div>
        </div>
        <div className="public-dashboard-preview" aria-label="Illustration of EO2MATE workspace">
          <div className="preview-top"><span className="preview-logo">E</span><div><b>Workspace overview</b><small>Sales operations at a glance</small></div><span className="preview-live"><i/> LIVE</span></div>
          <div className="preview-metrics"><div><small>Active posts</small><strong>12</strong><span>Across selling modes</span></div><div><small>Open orders</small><strong>28</strong><span>Ready for follow-up</span></div></div>
          <div className="preview-activity-title">RECENT ACTIVITY <span>View workspace →</span></div>
          <div className="preview-activity"><span className="activity-icon purple">↗</span><div><b>Auction activity</b><small>New bid received</small></div><time>Just now</time></div>
          <div className="preview-activity"><span className="activity-icon green">＋</span><div><b>Sale claim</b><small>Order added to queue</small></div><time>2 min ago</time></div>
          <div className="preview-activity"><span className="activity-icon amber">▦</span><div><b>Inventory update</b><small>Stock level refreshed</small></div><time>5 min ago</time></div>
          <div className="preview-lock-note"><span>⌑</span> Workspace data is available after sign in</div>
        </div>
        <div className="public-orb public-orb-one"/><div className="public-orb public-orb-two"/>
      </section>
      <section className="public-modules" id="functions">
        <div className="public-section-heading"><div><span className="public-kicker">THE EO2MATE WORKSPACE</span><h2>Tools for every step of a sale</h2></div><p>Explore the platform functions. Sign in is required to access business data and operate each tool.</p></div>
        <div className="public-module-grid">{modules.map((item) => <button className="public-module-card" key={item.title} onClick={onLogin}><span className="module-icon">{item.icon}</span><span className="module-lock" aria-label="Sign in required">↗</span><strong>{item.title}</strong><span>{item.text}</span><small>Sign in to access <b>→</b></small></button>)}</div>
      </section>
      <footer className="public-footer"><a className="public-brand" href="#top"><span className="public-brand-mark">E</span><span>EO2MATE</span></a><span>© {new Date().getFullYear()} EO2MATE · Social selling operations</span><div><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/data-deletion/">Data deletion</a></div></footer>
    </main>
  );
}
