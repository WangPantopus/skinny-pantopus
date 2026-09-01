// ─────────────────────────────────────────────────────────────
// Place — A4 · Address input + autocomplete
// Dedicated U.S. address-entry screen. Four states:
//   empty · typing-with-suggestions · selected · unsupported-region
// Reuses place-components atoms (Icon, Chip, colors) + the
// suggestion list-row recipe. Calm fallback, never a hard error.
// ─────────────────────────────────────────────────────────────

// ── Screen header: back + title + region ───────────────────────
function AddrHeader() {
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="lx-back" style={{ width: 36, height: 36, borderRadius: 9999, background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <Icon name="arrow-left" size={18} color={INK2} strokeWidth={2.25} />
        </button>
        <RegionPill />
      </div>
      <h1 style={{ margin: '16px 0 2px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: INK, lineHeight: '27px' }}>Find your place.</h1>
      <p style={{ margin: 0, fontSize: 13.5, color: MUTE, lineHeight: '19px' }}>Type a U.S. street address to see what's true about it.</p>
    </div>
  );
}

// ── Flexible address input ─────────────────────────────────────
function AddrInput({ value = '', focused = false, valid = false, clearable = false, warn = false }) {
  const borderCol = warn ? '#e5b769' : focused ? SKY : valid ? '#86efac' : BORDER;
  const shadow = focused
    ? '0 0 0 4px rgba(2,132,199,0.12)'
    : valid
    ? '0 0 0 4px rgba(22,163,74,0.10)'
    : '0 1px 3px rgba(0,0,0,0.04)';
  const pinColor = warn ? '#b45309' : focused ? SKY : valid ? HOME_GREEN : FAINT;
  const caret = <span className="lx-caret" style={{ display: 'inline-block', width: 2, height: 20, background: SKY, marginLeft: 1, borderRadius: 1, verticalAlign: 'middle' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 12px 0 14px', background: '#fff', borderRadius: 13, border: `1.5px solid ${borderCol}`, boxShadow: shadow }}>
      <Icon name="map-pin" size={19} color={pinColor} strokeWidth={2} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: value ? 500 : 400, color: value ? INK : FAINT, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center' }}>
        {value || (focused ? '' : 'Enter your address')}
        {focused && caret}
        {!value && !focused ? null : null}
      </span>
      {valid && (
        <span style={{ width: 22, height: 22, borderRadius: 9999, background: HOME_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={14} color="#fff" strokeWidth={3} />
        </span>
      )}
      {clearable && !valid && (
        <button className="lx-clear" style={{ width: 24, height: 24, borderRadius: 9999, background: '#f1f3f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="x" size={14} color={MUTE} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ── Suggestion list (the list-row recipe) ──────────────────────
function SuggestList({ rows }) {
  return (
    <div className="pl-card" style={{ padding: 4, marginTop: 8 }}>
      {rows.map((r, i) => (
        <div key={i} className="lx-sugg" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 10px', borderRadius: 10, background: r.best ? '#F0F9FF' : 'transparent', borderBottom: i < rows.length - 1 ? `1px solid ${r.best ? 'transparent' : '#f1f3f5'}` : 'none' }}>
          <Icon name="map-pin" size={16} color={r.best ? SKY : FAINT} strokeWidth={2} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.line}</div>
            <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1 }}>{r.sub}</div>
          </div>
          {r.best && <Icon name="corner-down-left" size={15} color={SKY} strokeWidth={2} />}
        </div>
      ))}
    </div>
  );
}

// ── Plain action row (reuses the list-row recipe) ──────────────
function ActionRow({ icon, label, sub, tone = 'sky' }) {
  const fg = tone === 'sky' ? SKY : INK2;
  const bg = tone === 'sky' ? '#E0F2FE' : '#f1f3f5';
  const ic = tone === 'sky' ? SKY : MUTE;
  return (
    <div className="lx-sugg" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={17} color={ic} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: tone === 'sky' ? fg : INK, letterSpacing: '-0.01em' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1 }}>{sub}</div>}
      </div>
      <Icon name="chevron-right" size={17} color="#c4c8cf" strokeWidth={2.25} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AddressEntry — the four states
// ─────────────────────────────────────────────────────────────
function AddressEntry({ state = 'empty' }) {
  const shell = (children, footer) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56 }}>
      <AddrHeader />
      <div style={{ flex: 1, minHeight: 0, padding: '16px 16px 0', display: 'flex', flexDirection: 'column' }}>{children}</div>
      {footer && <div style={{ padding: '12px 16px 14px' }}>{footer}</div>}
    </div>
  );

  // ── EMPTY: focused, no input yet ──
  if (state === 'empty') {
    return shell(
      <div>
        <AddrInput focused value="" />
        <div className="pl-card" style={{ padding: 4, marginTop: 8 }}>
          <ActionRow icon="locate-fixed" label="Use my current location" sub="Find the address you're standing at" />
        </div>
        <p style={{ margin: '14px 4px 0', fontSize: 13, color: FAINT, lineHeight: '18px' }}>Start typing to see matching addresses.</p>
      </div>
    );
  }

  // ── TYPING: partial input + suggestions ──
  if (state === 'typing') {
    return shell(
      <div>
        <AddrInput focused clearable value="1421 SE Oak" />
        <SuggestList
          rows={[
            { line: '1421 SE Oak St', sub: 'Portland, OR 97214', best: true },
            { line: '1421 SE Oakway Ct', sub: 'Portland, OR 97215' },
            { line: '1421 Oakdale Ave', sub: 'Gresham, OR 97030' },
            { line: '1421 NE Oakhurst Dr', sub: 'Hillsboro, OR 97124' },
          ]}
        />
      </div>
    );
  }

  // ── SELECTED: a match chosen, CTA enabled ──
  if (state === 'selected') {
    return shell(
      <div>
        <AddrInput valid value="1421 SE Oak St" />
        <div className="pl-card pl-hero" style={{ marginTop: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="map-pinned" size={20} color={HOME_GREEN} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>1421 SE Oak St</div>
            <div style={{ fontSize: 13.5, color: MUTE, marginTop: 2 }}>Portland, OR 97214</div>
            <div style={{ marginTop: 10 }}>
              <Chip tone="success" icon="check">Address matched</Chip>
            </div>
          </div>
        </div>
        <p style={{ margin: '14px 6px 0', fontSize: 12.5, color: MUTE, lineHeight: '17px', display: 'flex', gap: 6 }}>
          <Icon name="lock" size={13} color={FAINT} strokeWidth={2} style={{ marginTop: 1 }} />
          You're just looking. Saving this place is what later asks for an account.
        </p>
      </div>,
      <SeePlaceButton />
    );
  }

  // ── UNSUPPORTED REGION: calm, never a hard error ──
  return shell(
    <div>
      <AddrInput clearable warn value="221B Baker St, London" />
      <div className="pl-card" style={{ marginTop: 12, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="globe" size={20} color={MUTE} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: INK, letterSpacing: '-0.01em', lineHeight: '20px' }}>Home features are U.S.-only for now</div>
          </div>
        </div>
        <p style={{ margin: '12px 0 14px', fontSize: 14, color: INK2, lineHeight: '20px' }}>That address is outside our coverage, so records and risks aren't available yet. Here's what you can still do:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ActionRow icon="users-round" label="Follow people and places" sub="Creators, shops, and communities you care about" tone="neutral" />
          <ActionRow icon="compass" label="Browse the map" sub="See who's verified and what's happening nearby" tone="neutral" />
        </div>
      </div>
    </div>,
    <button className="lx-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 54, background: SKY, color: '#fff', border: 'none', borderRadius: 13, fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', boxShadow: '0 6px 16px rgba(2,132,199,0.20)' }}>
      Browse and follow
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

Object.assign(window, { AddressEntry, AddrInput, SuggestList, ActionRow, AddrHeader });
