/* ============================================================
   Saved Places — LIST archetype frames + states.
   ============================================================ */

function FilterChips({ active = "All" }) {
  const chips = ["All", "Home", "Work", "Saved"];
  return (
    <div className="sp-chips">
      {chips.map((c) => (
        <span key={c} className={"sp-chip" + (c === active ? " active" : "")}>
          {c}
        </span>
      ))}
    </div>
  );
}

function PlaceRow({ place, swiped }) {
  const t = PLACE_TYPES[place.type];
  return (
    <div className={"sp-rowwrap" + (swiped ? " swiped" : "")}>
      {swiped && (
        <div className="sp-swipe-actions">
          <div className="sp-swipe-btn map">
            <LI name="map" size={17} color="#fff" />
            <span>Open</span>
          </div>
          <div className="sp-swipe-btn remove">
            <LI name="trash-2" size={17} color="#fff" />
            <span>Remove</span>
          </div>
        </div>
      )}
      <div className="sp-row">
        <div className="sp-tile" style={{ background: t.tileBg }}>
          <LI name={t.icon} size={20} color={t.tileFg} />
        </div>
        <div className="sp-row-main">
          <div className="sp-row-title">{place.label}</div>
          <div className="sp-row-sub">
            <span>{place.city}, {place.state}</span>
            {t.pillLabel && (
              <span className="sp-pill" style={{ background: t.pillBg, color: t.pillFg }}>
                {t.pillLabel}
              </span>
            )}
          </div>
          <div className="sp-cap">{place.saved}</div>
        </div>
        <button className="sp-dots" aria-label="More">
          <LI name="more-horizontal" size={20} color="var(--fg4)" />
        </button>
      </div>
    </div>
  );
}

// ---- FRAME 1 · POPULATED ------------------------------------
function FrameListPopulated() {
  return (
    <Phone>
      <TopBar
        title="Saved places"
        trailing={
          <button className="sp-iconbtn" aria-label="Search">
            <LI name="search" size={19} color="var(--fg2)" />
          </button>
        }
      />
      <div className="sp-content">
        <div className="sp-count">{SAVED_PLACES.length} places</div>
        <FilterChips active="All" />
        <div className="sp-list">
          {SAVED_PLACES.map((p) => (
            <PlaceRow key={p.id} place={p} />
          ))}
        </div>
      </div>
    </Phone>
  );
}

// ---- FRAME 2 · EMPTY ----------------------------------------
function FrameListEmpty() {
  return (
    <Phone>
      <TopBar title="Saved places" />
      <div className="sp-content">
        <div className="sp-empty">
          <div className="sp-empty-ico">
            <LI name="bookmark" size={30} color="var(--color-primary)" />
          </div>
          <div className="sp-empty-h">No saved places yet</div>
          <div className="sp-empty-sub">
            Save spots you visit often, right from Explore — your home, your
            go-to coffee shop, the park down the block.
          </div>
          <button className="sp-btn-primary">
            <LI name="compass" size={17} color="#fff" />
            Explore nearby
          </button>
        </div>
      </div>
    </Phone>
  );
}

// ---- FRAME 3 · ACTION SHEET (overflow tapped) ---------------
function FrameActionSheet() {
  const target = SAVED_PLACES[3]; // Blue Bottle Coffee
  return (
    <Phone>
      <TopBar title="Saved places" />
      <div className="sp-content">
        <div className="sp-count">{SAVED_PLACES.length} places</div>
        <FilterChips active="All" />
        <div className="sp-list">
          {SAVED_PLACES.map((p) => (
            <PlaceRow key={p.id} place={p} />
          ))}
        </div>
      </div>
      <div className="sp-scrim"></div>
      <div className="sp-sheet sp-actionsheet">
        <div className="sp-sheet-grab"></div>
        <div className="sp-sheet-head">
          <div className="sp-tile sp-tile-sm" style={{ background: "var(--color-primary-100)" }}>
            <LI name="bookmark" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <div className="sp-sheet-title">{target.label}</div>
            <div className="sp-sheet-sub">{target.city}, {target.state}</div>
          </div>
        </div>
        <button className="sp-action">
          <LI name="map" size={19} color="var(--fg2)" />
          <span>Open on map</span>
        </button>
        <button className="sp-action">
          <LI name="share-2" size={19} color="var(--fg2)" />
          <span>Share place</span>
        </button>
        <button className="sp-action destructive">
          <LI name="trash-2" size={19} color="var(--color-error)" />
          <span>Remove</span>
        </button>
        <button className="sp-action cancel">Cancel</button>
      </div>
    </Phone>
  );
}

// ---- FRAME 4 · REMOVE + UNDO SNACKBAR -----------------------
function FrameUndo() {
  const remaining = SAVED_PLACES.filter((p) => p.id !== 4); // removed Blue Bottle
  return (
    <Phone>
      <TopBar title="Saved places" />
      <div className="sp-content">
        <div className="sp-count">{remaining.length} places</div>
        <FilterChips active="All" />
        <div className="sp-list">
          {remaining.map((p) => (
            <PlaceRow key={p.id} place={p} />
          ))}
        </div>
      </div>
      <div className="sp-snackbar">
        <LI name="check-circle-2" size={18} color="#fff" />
        <span className="sp-snack-text">Removed “Blue Bottle Coffee”</span>
        <button className="sp-snack-undo">Undo</button>
      </div>
    </Phone>
  );
}

// ---- FRAME 5 · SWIPE-TO-REVEAL (iOS secondary) --------------
function FrameSwipe() {
  return (
    <Phone>
      <TopBar title="Saved places" />
      <div className="sp-content">
        <div className="sp-count">{SAVED_PLACES.length} places</div>
        <FilterChips active="All" />
        <div className="sp-list">
          {SAVED_PLACES.map((p) => (
            <PlaceRow key={p.id} place={p} swiped={p.id === 3} />
          ))}
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  FilterChips,
  PlaceRow,
  FrameListPopulated,
  FrameListEmpty,
  FrameActionSheet,
  FrameUndo,
  FrameSwipe,
});
