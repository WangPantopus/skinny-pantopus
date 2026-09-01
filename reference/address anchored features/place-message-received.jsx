// ─────────────────────────────────────────────────────────────
// Place — D2 · Neighbor message / received  (Flow D — Inbox)
// The receiving side of a verified-neighbor message. No identity is
// shown — just "a verified neighbor nearby." The body is the same
// neutral template the sender picked. Replies are templated and stay
// anonymous both ways. Calm, in-control framing: feedback, block, and
// report are reassuring, and never notify the sender.
// Reuses DetailHeader / SectionLabel / Chip / Icon (window).
// ─────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Thanks for the heads-up",
  "Got it — I'll check",
  "Nothing on my end, thanks",
];

// ── Anonymized sender row — verified, never named ──
function AnonSender({ time = '2h ago' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eef1f4', border: '1px solid #e2e6ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="shield-check" size={23} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK, letterSpacing: '-0.012em' }}>From a verified neighbor nearby</div>
        <div style={{ fontSize: 12.5, color: MUTE, marginTop: 1 }}>On your block · {time}</div>
      </div>
      <Chip tone="success" icon="shield-check">Verified</Chip>
    </div>
  );
}

// ── The received message ──
function ReceivedCard({ body }) {
  return (
    <div className="pl-card" style={{ padding: 17 }}>
      <AnonSender />
      <div style={{ fontSize: 16, color: INK, lineHeight: '24px', marginTop: 15 }}>{body}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f3f5', fontSize: 12.5, color: FAINT, lineHeight: '17px' }}>
        <Icon name="eye-off" size={14} color="#b6bcc4" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>They chose this from a set of pre-written notes — they can't type freely, and they don't know who you are either.</span>
      </div>
    </div>
  );
}

// ── Templated quick replies (anonymous both ways) ──
function QuickReplyBar({ onReply }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {QUICK_REPLIES.map((r) => (
          <button
            key={r}
            type="button"
            className="pl-reply"
            onClick={() => onReply(r)}
            style={{
              fontFamily: 'inherit', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: SKY,
              background: '#F0F9FF', border: '1px solid #bae6fd', borderRadius: 9999, padding: '9px 15px', whiteSpace: 'nowrap',
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, padding: '0 2px', fontSize: 12.5, color: FAINT }}>
        <Icon name="eye-off" size={13} color="#b6bcc4" strokeWidth={2} />
        Replies are templated and stay anonymous.
      </div>
    </div>
  );
}

// ── Sent-reply confirmation ──
function ReplySent({ reply, onChange }) {
  return (
    <div className="pl-card" style={{ padding: 15, background: '#F0FDF4', borderColor: '#bbf7d0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: HOME_GREEN_BG, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="check" size={19} color={HOME_GREEN} strokeWidth={2.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>Reply sent</div>
          <div style={{ fontSize: 13, color: INK2, marginTop: 1 }}>“{reply}”</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 11, paddingTop: 11, borderTop: '1px solid #d6f0df' }}>
        <span style={{ fontSize: 12.5, color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="eye-off" size={13} color="#15803d" strokeWidth={2} /> Delivered anonymously
        </span>
        <button className="pl-textbtn" onClick={onChange} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SKY, fontWeight: 600, fontSize: 13.5, fontFamily: 'inherit' }}>Change reply</button>
      </div>
    </div>
  );
}

// ── Manage row (feedback / block / report) ──
function ManageRow({ icon, tone = 'neutral', title, sub, isLast = false }) {
  const fg = tone === 'danger' ? '#b91c1c' : INK2;
  const tile = tone === 'danger' ? '#FEF2F2' : '#f1f3f5';
  const tileBd = tone === 'danger' ? '#fecaca' : '#e7eaee';
  const tileFg = tone === 'danger' ? '#dc2626' : '#6b7280';
  return (
    <button type="button" className="pl-manage" style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: isLast ? 'none' : '1px solid #f1f3f5' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: tile, border: `1px solid ${tileBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} color={tileFg} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: fg }}>{title}</div>
        <div style={{ fontSize: 12.5, color: MUTE, lineHeight: '17px', marginTop: 1 }}>{sub}</div>
      </div>
      <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
    </button>
  );
}

function ManageCard() {
  return (
    <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ManageRow icon="thumbs-down" title="This isn't helpful" sub="Tell us this note wasn't useful. The sender won't be told." />
      <ManageRow icon="ban" title="Block this neighbor" sub="Stop messages from this verified home. They won't be notified." />
      <ManageRow icon="flag" tone="danger" title="Report this message" sub="Flag it for the Pantopus trust team to review." isLast />
    </div>
  );
}

// ── Assembled received screen ──
function MessageReceived({ body = 'A package may have been left at the wrong door near you. You might want to check around.' }) {
  const [reply, setReply] = React.useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Message" address="Inbox · verified neighbors" onBack={() => {}} />

        <div style={{ padding: '8px 16px 36px' }}>
          <ReceivedCard body={body} />

          <SectionLabel>Reply</SectionLabel>
          {reply
            ? <ReplySent reply={reply} onChange={() => setReply(null)} />
            : <QuickReplyBar onReply={setReply} />}

          <SectionLabel>Manage this message</SectionLabel>
          <ManageCard />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '0 2px', fontSize: 12.5, color: FAINT, lineHeight: '18px' }}>
            <Icon name="shield" size={14} color="#b6bcc4" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>You're in control. This neighbor doesn't know who you are, and you can stop messages from them at any time.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  MessageReceived, AnonSender, ReceivedCard, QuickReplyBar, ReplySent, ManageRow, ManageCard, QUICK_REPLIES,
});
