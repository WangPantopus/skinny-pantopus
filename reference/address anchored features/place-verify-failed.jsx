// ─────────────────────────────────────────────────────────────
// Place — B4 · Verification couldn't complete (alternate method)
// The failure branch, kept calm and blameless. We name the likely
// reason plainly (code expired, no record match), reassure that
// nothing they have changed, then offer the OTHER two methods as
// selectable rows. Amber for the honest "didn't work" — never a
// red flood. Reuses MethodRow/Radio from place-verify.jsx.
// ─────────────────────────────────────────────────────────────

// ── Fail mark — amber tile + soft alert badge (not red) ────────
function FailMark({ icon = 'mailbox' }) {
  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: '#FFFBEB', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color="#b45309" strokeWidth={2} />
      </div>
      <div style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 9999, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 6px rgba(17,24,39,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="triangle-alert" size={15} color="#D97706" strokeWidth={2.25} />
      </div>
    </div>
  );
}

// ── Footer primary — "Try another way" (sky) ───────────────────
function TryAnotherButton({ label = 'Try another way' }) {
  return (
    <button className="vf-primary" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: '100%', height: 52, background: SKY, color: '#fff', border: 'none', borderRadius: 13,
      fontFamily: 'inherit', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(2,132,199,0.20)',
    }}>
      {label}
      <Icon name="arrow-right" size={17} color="#fff" strokeWidth={2.5} />
    </button>
  );
}

const FAIL_METHODS = {
  mail: { id: 'mail', icon: 'send', label: 'Mail a code to my address', sub: 'We send a postcard with a code' },
  records: { id: 'records', icon: 'file-search', label: 'Match property records', sub: 'Instant if your name is on the deed or lease' },
  document: { id: 'document', icon: 'upload', label: 'Upload a document', sub: 'A utility bill, lease, or bank statement' },
};

const FAIL_REASON = {
  mail: {
    icon: 'mailbox',
    chip: { tone: 'warning', icon: 'clock', text: 'Code expired' },
    reason: 'The code on your postcard expired before it was entered — codes stay good for 14 days. No problem, let\u2019s get you a fresh start.',
    others: ['records', 'document'],
  },
  records: {
    icon: 'file-search',
    chip: { tone: 'warning', icon: 'search', text: 'No record match' },
    reason: 'We couldn\u2019t match your name to the public records for this address. That\u2019s common for renters and recent moves — it isn\u2019t a problem with you.',
    others: ['mail', 'document'],
  },
};

// ─────────────────────────────────────────────────────────────
// VerifyFailed — assembled screen
//   method: the method that FAILED ('mail' | 'records')
//   pick:   which offered method's radio is on (defaults to first)
// ─────────────────────────────────────────────────────────────
function VerifyFailed({ method = 'mail', pick }) {
  const f = FAIL_REASON[method] || FAIL_REASON.mail;
  const selected = pick || f.others[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9', paddingTop: 56 }}>
      <PendingHeader />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 18px 24px' }}>
        <FailMark icon={f.icon} />

        <h1 style={{ margin: '20px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: INK, lineHeight: '30px' }}>We couldn't verify that yet.</h1>
        <div style={{ marginTop: 12 }}>
          <Chip tone={f.chip.tone} icon={f.chip.icon}>{f.chip.text}</Chip>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 14.5, color: INK2, lineHeight: '21px', letterSpacing: '-0.005em' }}>
          {f.reason}
        </p>

        {/* the other two methods */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 9, padding: '0 2px' }}>Other ways to verify</div>
          <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
            {f.others.map((id, i) => {
              const m = FAIL_METHODS[id];
              return (
                <MethodRow key={id} icon={m.icon} label={m.label} sub={m.sub} selected={selected === id} isLast={i === f.others.length - 1} />
              );
            })}
          </div>
        </div>

        {/* calm reassurance — nothing was lost */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '0 2px' }}>
          <Icon name="shield-check" size={15} color={FAINT} strokeWidth={2} style={{ marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px', letterSpacing: '-0.003em' }}>
            Nothing on your dashboard changed. You can keep using everything you have.
          </span>
        </div>
      </div>

      {/* footer */}
      <div style={{ padding: '12px 16px 14px' }}>
        <TryAnotherButton />
      </div>
    </div>
  );
}

Object.assign(window, {
  VerifyFailed, FailMark, TryAnotherButton,
});
