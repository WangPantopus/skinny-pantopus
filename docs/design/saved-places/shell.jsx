/* ============================================================
   Shared mobile shell + helpers for the Saved Places frames.
   Matches the Pantopus mobile UI kit (300×620 iPhone frame).
   ============================================================ */

// Lucide icon helper. Lucide copies the <i> element's inline style
// onto the generated <svg>, so width/height/color set here stick.
function LI({ name, size = 20, color, style = {} }) {
  return (
    <i
      data-lucide={name}
      style={{ width: size + "px", height: size + "px", color, ...style }}
    ></i>
  );
}

function StatusBar() {
  return (
    <div className="sp-sb">
      <span>9:41</span>
      <div className="sp-sb-right">
        <div className="sp-sb-bars"></div>
        <div className="sp-batt"><i></i></div>
      </div>
    </div>
  );
}

// Phone bezel. `dim` darkens content when a sheet/overlay is open.
function Phone({ children }) {
  return (
    <div className="sp-phone">
      <div className="sp-phone-inner">
        <div className="sp-island"></div>
        <StatusBar />
        {children}
        <div className="sp-home-ind"></div>
      </div>
    </div>
  );
}

// Pushed-screen top bar: back chevron · centered title · optional trailing.
function TopBar({ title, trailing }) {
  return (
    <div className="sp-topbar">
      <button className="sp-iconbtn" aria-label="Back">
        <LI name="chevron-left" size={22} color="var(--fg2)" />
      </button>
      <div className="sp-topbar-title">{title}</div>
      <div className="sp-topbar-trailing">
        {trailing || <span style={{ width: 30 }}></span>}
      </div>
    </div>
  );
}

// Bottom tab bar (used on Explore + Me frames; hidden on pushed list).
function TabBar({ active }) {
  const tabs = [
    { id: "home", icon: "home", label: "Home" },
    { id: "pulse", icon: "radio", label: "Pulse" },
    { id: "market", icon: "shopping-bag", label: "Market" },
    { id: "mail", icon: "mailbox", label: "Mail" },
    { id: "me", icon: "user", label: "Me" },
  ];
  return (
    <div className="sp-tabbar">
      {tabs.map((t) => (
        <div key={t.id} className={"sp-tab" + (active === t.id ? " active" : "")}>
          <LI name={t.icon} size={22} />
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// Type → icon-tile config (identity / primary tinting per the brief).
const PLACE_TYPES = {
  home: {
    icon: "house",
    tileBg: "var(--color-identity-home-bg)",
    tileFg: "var(--color-identity-home)",
    pillBg: "var(--color-identity-home-bg)",
    pillFg: "#15803d",
    pillLabel: "Home",
  },
  work: {
    icon: "briefcase",
    tileBg: "var(--color-identity-business-bg)",
    tileFg: "var(--color-identity-business)",
    pillBg: "var(--color-identity-business-bg)",
    pillFg: "#6d28d9",
    pillLabel: "Work",
  },
  saved: {
    icon: "bookmark",
    tileBg: "var(--color-primary-100)",
    tileFg: "var(--color-primary)",
    pillBg: null,
    pillFg: null,
    pillLabel: null,
  },
  searched: {
    icon: "map-pin",
    tileBg: "var(--color-primary-100)",
    tileFg: "var(--color-primary)",
    pillBg: null,
    pillFg: null,
    pillLabel: null,
  },
};

// Sample data — Portland, OR, spread across types so each chip has content.
const SAVED_PLACES = [
  { id: 1, label: "Mom's house", type: "home", city: "Portland", state: "OR", saved: "Saved 3 weeks ago" },
  { id: 2, label: "The Studio", type: "work", city: "Portland", state: "OR", saved: "Saved last month" },
  { id: 3, label: "Lan Su Garden", type: "saved", city: "Portland", state: "OR", saved: "Saved yesterday" },
  { id: 4, label: "Blue Bottle Coffee", type: "saved", city: "Portland", state: "OR", saved: "Saved 5 days ago" },
  { id: 5, label: "Mt. Tabor Park", type: "saved", city: "Portland", state: "OR", saved: "Saved 1 week ago" },
];

Object.assign(window, { LI, StatusBar, Phone, TopBar, TabBar, PLACE_TYPES, SAVED_PLACES });
