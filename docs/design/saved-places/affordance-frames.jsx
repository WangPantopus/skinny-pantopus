/* ============================================================
   Save / unsave affordance + Save sheet + entry points.
   Reuses the A11 Explore map + bottom-sheet layout.
   ============================================================ */

// Stylized neighborhood map backdrop (parks, water, roads, pins).
function MapBg({ pins = [] }) {
  return (
    <div className="sp-map">
      <div className="sp-map-park" style={{ top: "14%", left: "8%", width: "34%", height: "30%" }}></div>
      <div className="sp-map-park" style={{ top: "55%", left: "62%", width: "30%", height: "26%" }}></div>
      <div className="sp-map-water"></div>
      {/* roads */}
      <div className="sp-road-h" style={{ top: "26%" }}></div>
      <div className="sp-road-h" style={{ top: "52%" }}></div>
      <div className="sp-road-h" style={{ top: "74%" }}></div>
      <div className="sp-road-v" style={{ left: "30%" }}></div>
      <div className="sp-road-v" style={{ left: "58%" }}></div>
      <div className="sp-road-v" style={{ left: "82%" }}></div>
      {/* you-are-here */}
      <div className="sp-here" style={{ top: "44%", left: "47%" }}>
        <span className="sp-here-pulse"></span>
        <span className="sp-here-dot"></span>
      </div>
      {pins.map((p, i) => (
        <div
          key={i}
          className={"sp-pin" + (p.saved ? " saved" : "")}
          style={{ top: p.top, left: p.left, background: p.color }}
        >
          <LI name={p.icon} size={12} color="#fff" />
        </div>
      ))}
    </div>
  );
}

// A place card inside the Explore sheet, with a bookmark toggle.
function ExploreCard({ title, cat, catColor, meta, thumb, saved }) {
  return (
    <div className="sp-ec">
      <div className="sp-ec-thumb" style={{ background: thumb }}>
        <LI name={cat.icon} size={18} color="#fff" />
      </div>
      <div className="sp-ec-main">
        <div className="sp-ec-title">{title}</div>
        <div className="sp-ec-meta">
          <span className="sp-ec-cat" style={{ color: catColor }}>{cat.label}</span>
          <span className="sp-ec-dot">·</span>
          <span>{meta}</span>
        </div>
      </div>
      <button className={"sp-bookmark" + (saved ? " saved" : "")} aria-label={saved ? "Saved" : "Save"}>
        <LI
          name="bookmark"
          size={18}
          color={saved ? "#fff" : "var(--fg3)"}
          style={saved ? { fill: "#fff" } : {}}
        />
      </button>
    </div>
  );
}

const EXPLORE_PINS = [
  { top: "20%", left: "22%", icon: "shopping-bag", color: "var(--cat-goods)" },
  { top: "33%", left: "66%", icon: "hammer", color: "var(--cat-handyman)" },
  { top: "60%", left: "24%", icon: "trees", color: "var(--cat-cleaning)", saved: true },
  { top: "48%", left: "78%", icon: "coffee", color: "var(--color-primary)", saved: true },
];

// ---- FRAME 6 · SAVE AFFORDANCE (toggle, both states) --------
function FrameSaveAffordance() {
  return (
    <Phone>
      <MapBg pins={EXPLORE_PINS} />
      <div className="sp-map-pill">
        <LI name="search" size={15} color="var(--fg3)" />
        <span>Search this area</span>
        <div className="sp-map-pill-filter">
          <LI name="sliders-horizontal" size={14} color="var(--color-primary)" />
        </div>
      </div>
      <div className="sp-sheet sp-explore-sheet">
        <div className="sp-sheet-grab"></div>
        <div className="sp-explore-head">
          <div className="sp-explore-count">47 nearby</div>
          <div className="sp-seg">
            <span className="sp-seg-item active">All</span>
            <span className="sp-seg-item">Tasks</span>
            <span className="sp-seg-item">Items</span>
            <span className="sp-seg-item">Spots</span>
          </div>
        </div>
        <div className="sp-ec-list">
          <ExploreCard
            title="Blue Bottle Coffee"
            cat={{ label: "Coffee", icon: "coffee" }}
            catColor="var(--color-primary)"
            meta="0.3 mi · open now"
            thumb="linear-gradient(135deg,#38bdf8,#0369a1)"
            saved={true}
          />
          <ExploreCard
            title="Mt. Tabor Park"
            cat={{ label: "Spot", icon: "trees" }}
            catColor="var(--cat-cleaning)"
            meta="0.8 mi · sunset views"
            thumb="linear-gradient(135deg,#34d399,#15803d)"
            saved={false}
          />
          <ExploreCard
            title="Oak dining table"
            cat={{ label: "Goods", icon: "shopping-bag" }}
            catColor="var(--cat-goods)"
            meta="0.4 mi · $240"
            thumb="linear-gradient(135deg,#c4b5fd,#7c3aed)"
            saved={false}
          />
        </div>
      </div>
    </Phone>
  );
}

// ---- FRAME 7 · SAVE PLACE SHEET (label + type) --------------
function FrameSaveSheet() {
  return (
    <Phone>
      <MapBg pins={EXPLORE_PINS} />
      <div className="sp-map-pill">
        <LI name="search" size={15} color="var(--fg3)" />
        <span>Search this area</span>
      </div>
      <div className="sp-scrim"></div>
      <div className="sp-sheet sp-savesheet">
        <div className="sp-sheet-grab"></div>
        <div className="sp-savesheet-head">
          <div className="sp-savesheet-title">Save place</div>
          <button className="sp-iconbtn" aria-label="Close">
            <LI name="x" size={18} color="var(--fg3)" />
          </button>
        </div>

        <label className="sp-field-label">Name</label>
        <div className="sp-input">
          <span>Blue Bottle Coffee</span>
          <LI name="pencil" size={15} color="var(--fg4)" />
        </div>

        <label className="sp-field-label">Type</label>
        <div className="sp-typepick">
          <div className="sp-type-opt">
            <div className="sp-type-ico" style={{ background: "var(--color-identity-home-bg)" }}>
              <LI name="house" size={18} color="var(--color-identity-home)" />
            </div>
            <span>Home</span>
          </div>
          <div className="sp-type-opt">
            <div className="sp-type-ico" style={{ background: "var(--color-identity-business-bg)" }}>
              <LI name="briefcase" size={18} color="var(--color-identity-business)" />
            </div>
            <span>Work</span>
          </div>
          <div className="sp-type-opt active">
            <div className="sp-type-ico" style={{ background: "var(--color-primary-100)" }}>
              <LI name="bookmark" size={18} color="var(--color-primary)" />
            </div>
            <span>Other</span>
          </div>
        </div>

        <button className="sp-btn-primary sp-btn-block">
          <LI name="bookmark" size={17} color="#fff" style={{ fill: "#fff" }} />
          Save
        </button>
      </div>
    </Phone>
  );
}

// ---- FRAME 8 · ENTRY POINT · Explore header -----------------
function FrameEntryExplore() {
  return (
    <Phone>
      <MapBg pins={EXPLORE_PINS} />
      <div className="sp-map-topbar">
        <div className="sp-map-pill inline">
          <LI name="search" size={15} color="var(--fg3)" />
          <span>Explore Elm Park</span>
        </div>
        <button className="sp-saved-btn">
          <LI name="bookmark" size={16} color="var(--color-primary)" style={{ fill: "var(--color-primary)" }} />
          <span>Saved</span>
        </button>
      </div>
      <div className="sp-anno" style={{ top: 102, right: 16 }}>
        <div className="sp-anno-arrow"></div>
        Tap to open your<br />saved places
      </div>
      <div className="sp-sheet sp-explore-sheet collapsed">
        <div className="sp-sheet-grab"></div>
        <div className="sp-explore-head">
          <div className="sp-explore-count">47 nearby</div>
        </div>
        <div className="sp-ec-list">
          <ExploreCard
            title="Blue Bottle Coffee"
            cat={{ label: "Coffee", icon: "coffee" }}
            catColor="var(--color-primary)"
            meta="0.3 mi · open now"
            thumb="linear-gradient(135deg,#38bdf8,#0369a1)"
            saved={true}
          />
        </div>
      </div>
      <TabBar active="home" />
    </Phone>
  );
}

// ---- FRAME 9 · ENTRY POINT · Me / profile -------------------
function FrameEntryProfile() {
  const Item = ({ icon, color, bg, label, value, last }) => (
    <div className={"sp-me-row" + (last ? " last" : "")}>
      <div className="sp-tile sp-tile-sm" style={{ background: bg }}>
        <LI name={icon} size={16} color={color} />
      </div>
      <span className="sp-me-label">{label}</span>
      {value && <span className="sp-me-val">{value}</span>}
      <LI name="chevron-right" size={18} color="var(--fg4)" />
    </div>
  );
  return (
    <Phone>
      <div className="sp-content sp-me">
        <div className="sp-me-head">
          <div className="sp-me-avatar">MK<span className="sp-vb">✓</span></div>
          <div>
            <div className="sp-me-name">Maria Klein</div>
            <div className="sp-me-sub">Elm Park · Verified</div>
          </div>
        </div>

        <div className="sp-me-group-label">Your activity</div>
        <div className="sp-me-card">
          <Item icon="bookmark" color="var(--color-primary)" bg="var(--color-primary-100)" label="Saved places" value="5" />
          <Item icon="clock" color="var(--fg2)" bg="var(--app-surface-sunken)" label="Recent searches" />
          <Item icon="star" color="var(--cat-child-care)" bg="#fef3c7" label="Reviews" value="12" last />
        </div>

        <div className="sp-me-group-label">Account</div>
        <div className="sp-me-card">
          <Item icon="shield-check" color="var(--color-identity-home)" bg="var(--color-identity-home-bg)" label="Verification" />
          <Item icon="settings" color="var(--fg2)" bg="var(--app-surface-sunken)" label="Settings" last />
        </div>
      </div>
      <TabBar active="me" />
    </Phone>
  );
}

Object.assign(window, {
  MapBg,
  ExploreCard,
  FrameSaveAffordance,
  FrameSaveSheet,
  FrameEntryExplore,
  FrameEntryProfile,
});
