// ─────────────────────────────────────────────────────────────
// Place — D1 · Neighbor message / compose  (Flow D — Inbox)
// Send a verified message to a neighbor. The trust-and-safety
// constraints ARE the UI: template-only (no free text), delivered
// anonymously, scoped to verified homes on your block, rate-limited,
// and blockable. Reuses DetailHeader / SectionLabel / Source / Chip
// / TextButton / Icon and the home-green / sky system (window).
// ─────────────────────────────────────────────────────────────

// Neutral, pre-written notes. The sender reads the exact words that
// will be delivered — there is no field to type anything else.
const MSG_TEMPLATES = [
  { id: 'noise',   icon: 'volume-2',  cat: 'Late-night noise',   body: 'A verified neighbor mentioned some noise after 10pm. Just a friendly heads-up — no need to reply.' },
  { id: 'package', icon: 'package',   cat: 'Misdelivered package', body: 'A package may have been left at the wrong door near you. You might want to check around.' },
  { id: 'vehicle', icon: 'car',       cat: 'Parked vehicle',     body: "A friendly heads-up that a vehicle has been parked nearby for a while. Nothing urgent." },
  { id: 'pet',     icon: 'dog',       cat: 'Pet in the yard',    body: 'A neighbor noticed a pet out in the yard. Just making sure everything is okay.' },
  { id: 'gate',    icon: 'door-open', cat: 'Open gate or door',  body: 'A gate or door nearby looks like it was left open. Thought you would want to know.' },
];

// ── Recipient — an address on your block, never a name ──
function RecipientCard() {
  return (
    <div className="pl-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="house" size={20} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>1425 SE Oak St</div>
        <div style={{ fontSize: 13, color: MUTE, marginTop: 1 }}>Two doors down · on your block</div>
      </div>
      <button className="pl-textbtn" style={{ background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>Change</button>
    </div>
  );
}

// ── Privacy reassurance — the core promise, stated plainly ──
function PrivacyNote() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 14px', background: '#F0F9FF', border: '1px solid #bae6fd', borderRadius: 14, marginTop: 8 }}>
      <Icon name="eye-off" size={18} color="#0369a1" strokeWidth={2} style={{ marginTop: 1 }} />
      <div style={{ fontSize: 13.5, color: '#0c4a6e', lineHeight: '19px' }}>
        <b style={{ fontWeight: 700 }}>Your identity stays private.</b> It's delivered as “from a verified neighbor nearby” — never your name or address.
      </div>
    </div>
  );
}

// ── One pre-written template, selectable (radio) ──
function TemplateRow({ t, selected, onSelect }) {
  return (
    <button
      type="button"
      className="pl-tpl"
      onClick={() => onSelect(t.id)}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 13,
        borderRadius: 14, background: selected ? '#F0FDF4' : '#fff',
        border: `${selected ? 1.5 : 1}px solid ${selected ? '#86efac' : '#e5e7eb'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}
    >
      {/* radio */}
      <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected ? HOME_GREEN : '#fff', border: selected ? 'none' : '2px solid #d1d5db' }}>
        {selected && <Icon name="check" size={13} color="#fff" strokeWidth={3.25} />}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <Icon name={t.icon} size={14} color={selected ? HOME_GREEN : '#9ca3af'} strokeWidth={2} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: selected ? '#15803d' : '#9ca3af' }}>{t.cat}</span>
        </div>
        <div style={{ fontSize: 13.5, color: INK2, lineHeight: '18px' }}>{t.body}</div>
      </div>
    </button>
  );
}

// ── How the recipient receives it — anonymized, with their controls ──
function DeliveryPreview({ t }) {
  return (
    <div className="pl-card" style={{ padding: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#eef1f4', border: '1px solid #e2e6ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="shield-check" size={20} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>A verified neighbor nearby</div>
          <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1 }}>On your block · just now</div>
        </div>
        <Chip tone="success" icon="shield-check">Verified</Chip>
      </div>

      <div style={{ fontSize: 14, color: INK2, lineHeight: '20px', padding: '12px 13px', background: '#f6f7f9', borderRadius: 12 }}>{t.body}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f3f5' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: INK2, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 9999, padding: '6px 13px' }}>
          <Icon name="reply" size={14} color={INK2} strokeWidth={2} /> Reply with a note
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#b91c1c', background: '#FEF2F2', border: '1px solid #fecaca', borderRadius: 9999, padding: '6px 13px' }}>
          <Icon name="ban" size={14} color="#b91c1c" strokeWidth={2} /> Block
        </span>
      </div>
      <div style={{ fontSize: 12, color: FAINT, marginTop: 9 }}>They can reply with a template or block you anytime.</div>
    </div>
  );
}

// ── Respectful-use + rate limit + block, in one calm card ──
function SafetyCard() {
  const rows = [
    { icon: 'heart-handshake', t: 'Keep it neighborly', s: 'For genuine heads-ups — not complaints, sales, or anything targeted.' },
    { icon: 'clock', t: 'A few messages a week', s: "There's a gentle limit, so the channel stays low-volume and calm." },
    { icon: 'ban', t: 'Always blockable', s: 'Anyone can block messages from verified neighbors at any time.' },
  ];
  return (
    <div className="pl-card" style={{ padding: '6px 14px' }}>
      {rows.map((r, i) => (
        <div key={r.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid #f1f3f5' }}>
          <Icon name={r.icon} size={18} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK2 }}>{r.t}</div>
            <div style={{ fontSize: 12.5, color: MUTE, lineHeight: '17px', marginTop: 1 }}>{r.s}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Pinned send bar ──
function SendBar({ enabled = true }) {
  return (
    <div style={{ flexShrink: 0, padding: '12px 16px 26px', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)', borderTop: '1px solid #ececef' }}>
      <button
        className="pl-send"
        disabled={!enabled}
        style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: enabled ? SKY : '#cbd5e1', color: '#fff', cursor: enabled ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: enabled ? '0 6px 16px rgba(2,132,199,.20)' : 'none',
        }}
      >
        <Icon name="send" size={18} color="#fff" strokeWidth={2.25} /> Send
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: 12, color: FAINT }}>
        <Icon name="eye-off" size={13} color="#b6bcc4" strokeWidth={2} />
        Delivered anonymously · a few messages a week
      </div>
    </div>
  );
}

// ── Assembled compose screen ──
function MessageCompose({ selected = 'noise', onSelect = () => {} }) {
  const t = MSG_TEMPLATES.find((x) => x.id === selected) || MSG_TEMPLATES[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="New message" address="To a verified neighbor on your block" onBack={() => {}} />

        <div style={{ padding: '6px 16px 28px' }}>
          <SectionLabel>To</SectionLabel>
          <RecipientCard />
          <PrivacyNote />

          <SectionLabel>Choose a note</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MSG_TEMPLATES.map((tpl) => (
              <TemplateRow key={tpl.id} t={tpl} selected={tpl.id === selected} onSelect={onSelect} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 10, padding: '0 2px', fontSize: 12.5, color: FAINT, lineHeight: '17px' }}>
            <Icon name="info" size={14} color="#b6bcc4" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Messages are pre-written to keep them neutral. Free typing isn't available — it's how we keep this channel safe.</span>
          </div>

          <SectionLabel>How it's delivered</SectionLabel>
          <DeliveryPreview t={t} />

          <SectionLabel>Good to know</SectionLabel>
          <SafetyCard />
        </div>
      </div>

      <SendBar enabled={!!selected} />
    </div>
  );
}

Object.assign(window, {
  MessageCompose, RecipientCard, PrivacyNote, TemplateRow, DeliveryPreview, SafetyCard, SendBar, MSG_TEMPLATES,
});
