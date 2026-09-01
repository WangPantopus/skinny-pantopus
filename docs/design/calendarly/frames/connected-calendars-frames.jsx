// Pantopus — Calendarly · Connected calendars (sheet)
// Archetype: Sheet with provider rows + OAuth handoff (also embeddable as a
// section in the Availability editor). Mirrors List of Rows for the provider/
// account rows with status + per-row toggles, A14.8 for the status-row + re-auth
// banner idiom, A13 Edit Business Page for the connect-button rows, and the A18
// calm status-screen idiom for the coming-soon placeholder.
// Lives in: Scheduling hub → Connected calendars; Availability editor → "Connect
// calendar" row; onboarding optional step; Settings.
//
// Pillar: Personal sky — accent ONLY on the sheet overline. Status is carried by
// semantic chips + icons, NEVER a left-border or flood-fill. White cards, 1px
// border, 16px radius, shadow-sm. Lucide stroke-2, no emoji. Shimmer skeletons.
//
// Reuses primitives from event-editor-shell.jsx (E, Phone, TopBar, HeaderPill,
// Card, Toggle, ToggleRow, SH).

const PROVIDERS = {
  google:  { name: 'Google Calendar', icon: 'calendar-days', color: '#1a73e8', account: 'maria@gmail.com' },
  apple:   { name: 'Apple Calendar',  icon: 'calendar',      color: '#1d1d1f', account: 'maria@icloud.com' },
  outlook: { name: 'Outlook',         icon: 'calendar-range', color: '#0f6cbd', account: 'maria@work.com' },
};

// ─── Dimmed Scheduling hub (background) ──────────────────────

function DimHubRow({ icon, label, sub, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${E.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: E.sunken, color: E.fg3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1 }}>{label}</div>
        <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>{sub}</div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: E.fg4 }} />
    </div>
  );
}

function DimmedHub() {
  return (
    <>
      <TopBar title="Scheduling" />
      <HeaderPill pillar="personal" />
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card overline="Your booking page" pillar="personal">
          <DimHubRow icon="link" label="cal.pantopus.com/maria" sub="Live · 3 event types" last />
        </Card>
        <Card overline="Availability" pillar="personal">
          <DimHubRow icon="calendar-clock" label="Working hours" sub="Mon–Fri, 9:00 AM – 5:00 PM" />
          <DimHubRow icon="calendar-sync" label="Connect calendar" sub="Check for conflicts" last />
        </Card>
      </div>
    </>
  );
}

function Scrim() {
  return <div style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(17,24,39,0.42)' }} />;
}

// ─── Sheet shell ──────────────────────────────────────────────

function Sheet({ children, top = 92 }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, top, zIndex: 20,
      background: E.surface, borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 30px rgba(17,24,39,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 9, paddingBottom: 2, flexShrink: 0 }}>
        <div style={{ width: 38, height: 5, borderRadius: 9999, background: E.borderStrong }} />
      </div>
      <div style={{ padding: '8px 16px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: E.personal, marginBottom: 3 }}>Personal · Scheduling</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: E.fg1, letterSpacing: -0.3 }}>Connected calendars</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0 2px 12px', color: E.blue600, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.1 }}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Helper({ children }) {
  return <div style={{ fontSize: 11.5, color: E.fg3, lineHeight: '16px', padding: '0 2px 2px' }}>{children}</div>;
}

// ─── Provider tile ────────────────────────────────────────────

function ProviderTile({ provider, muted }) {
  const p = PROVIDERS[provider];
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      background: E.surface, border: `1px solid ${E.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <i data-lucide={p.icon} style={{ width: 19, height: 19, strokeWidth: 2, color: muted ? E.fg4 : p.color }} />
    </div>
  );
}

// ─── Status pill (semantic chip) ─────────────────────────────

function StatusPill({ kind }) {
  const map = {
    synced:    { bg: E.success100, fg: E.success700, icon: 'check', label: 'Synced' },
    attention: { bg: E.warningBg,  fg: '#92400e',    icon: 'triangle-alert', label: 'Action needed' },
  };
  const s = map[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 9999,
      background: s.bg, color: s.fg, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      <i data-lucide={s.icon} style={{ width: 10, height: 10, strokeWidth: 2.6 }} /> {s.label}
    </span>
  );
}

// ─── Connect row (not connected) ─────────────────────────────

function ConnectRow({ provider }) {
  const p = PROVIDERS[provider];
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 11,
    }}>
      <ProviderTile provider={provider} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>Not connected</div>
      </div>
      <button style={{
        height: 32, padding: '0 13px', borderRadius: 9, border: 'none', background: E.blue600, color: '#fff',
        fontSize: 12.5, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.1, flexShrink: 0,
      }}>Connect</button>
    </div>
  );
}

// ─── Connecting row (OAuth in flight) ────────────────────────

function ConnectingRow({ provider }) {
  const p = PROVIDERS[provider];
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 11,
    }}>
      <ProviderTile provider={provider} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <i data-lucide="external-link" style={{ width: 11, height: 11, color: E.fg3 }} />
          <span style={{ fontSize: 11, color: E.fg3 }}>Opening Google…</span>
        </div>
      </div>
      <div style={{ width: 76, height: 12, borderRadius: 6, ...SH }} />
    </div>
  );
}

// ─── Toggle pair for a connected account ─────────────────────

function AccountToggles({ disabled }) {
  return (
    <>
      <ToggleRow icon="search-check" label="Check for conflicts" sub="Block times when you're busy elsewhere" on={!disabled} disabled={disabled} />
      <ToggleRow icon="calendar-plus" label="Add bookings to this calendar" sub="New bookings show up here" on={!disabled} disabled={disabled} last />
    </>
  );
}

function AccountHeader({ provider, status }) {
  const p = PROVIDERS[provider];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <ProviderTile provider={provider} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize: 11, color: E.fg3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.account}</div>
      </div>
      <div style={{ flexShrink: 0 }}><StatusPill kind={status} /></div>
    </div>
  );
}

// ─── Connected / synced row ──────────────────────────────────

function ConnectedRow({ provider }) {
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <AccountHeader provider={provider} status="synced" />
      <div style={{ height: 1, background: E.border }} />
      <AccountToggles />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: E.fg3 }}>
          <i data-lucide="refresh-cw" style={{ width: 11, height: 11 }} /> Synced 2 min ago
        </div>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: E.fg3, fontSize: 11.5, fontWeight: 600 }}>Disconnect</button>
      </div>
    </div>
  );
}

// ─── Re-auth needed row ──────────────────────────────────────

function ReAuthRow({ provider }) {
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <AccountHeader provider={provider} status="attention" />
      <div style={{
        background: E.warningBg, border: `1px solid ${E.warningBorder}`, borderRadius: 12, padding: '11px 12px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <i data-lucide="triangle-alert" style={{ width: 16, height: 16, color: E.warning, strokeWidth: 2, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', letterSpacing: -0.1, marginBottom: 2, lineHeight: '16px' }}>Reconnect Google to keep checking for conflicts</div>
            <div style={{ fontSize: 11, color: '#78350f', lineHeight: '15px' }}>Until you reconnect, we can't see new events and might double-book you.</div>
          </div>
        </div>
        <button style={{
          width: '100%', height: 38, borderRadius: 9, border: 'none', background: E.blue600, color: '#fff',
          fontSize: 12.5, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <i data-lucide="refresh-cw" style={{ width: 14, height: 14 }} /> Reconnect
        </button>
      </div>
    </div>
  );
}

// ─── Permission-denied row ───────────────────────────────────

function DeniedRow({ provider }) {
  const p = PROVIDERS[provider];
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <ProviderTile provider={provider} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: E.fg1, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: E.fg3, marginTop: 1 }}>Not connected</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: E.raised, border: `1px solid ${E.border}`, borderRadius: 12, padding: '10px 11px' }}>
        <i data-lucide="lock" style={{ width: 14, height: 14, color: E.fg4, strokeWidth: 2, flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: E.fg2, lineHeight: '16px', marginBottom: 6 }}>Calendar access was declined. Allow it in Settings to connect.</div>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: E.blue600, fontSize: 12, fontWeight: 700 }}>
            <i data-lucide="settings" style={{ width: 13, height: 13 }} /> Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coming-soon placeholder (A18 calm) ──────────────────────

function ComingSoon() {
  return (
    <div style={{
      background: E.surface, border: `1px solid ${E.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{ width: 54, height: 54, borderRadius: 16, background: E.blue50, color: E.blue600, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <i data-lucide="calendar-sync" style={{ width: 26, height: 26, strokeWidth: 1.9 }} />
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 700, color: E.fg1, letterSpacing: -0.2, marginBottom: 6 }}>Calendar sync is coming soon</div>
      <div style={{ fontSize: 12.5, color: E.fg3, lineHeight: '18px', maxWidth: 232, marginBottom: 20 }}>
        We'll let you know when you can connect Google, Apple, and Outlook to check for conflicts.
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        {['google', 'apple', 'outlook'].map((p) => (
          <div key={p} style={{ opacity: 0.5 }}><ProviderTile provider={p} muted /></div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 · PLACEHOLDER (coming soon)
// ═══════════════════════════════════════════════════════════════

function FramePlaceholder() {
  return (
    <Phone label="Connected calendars — coming soon">
      <DimmedHub />
      <Scrim />
      <Sheet>
        <ComingSoon />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 · NONE CONNECTED
// ═══════════════════════════════════════════════════════════════

function FrameNone() {
  return (
    <Phone label="Connected calendars — none connected">
      <DimmedHub />
      <Scrim />
      <Sheet>
        <Helper>Connect a calendar to check for conflicts and add bookings automatically.</Helper>
        <ConnectRow provider="google" />
        <ConnectRow provider="apple" />
        <ConnectRow provider="outlook" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 3 · CONNECTING (OAuth)
// ═══════════════════════════════════════════════════════════════

function FrameConnecting() {
  return (
    <Phone label="Connected calendars — connecting">
      <DimmedHub />
      <Scrim />
      <Sheet>
        <Helper>Connect a calendar to check for conflicts and add bookings automatically.</Helper>
        <ConnectingRow provider="google" />
        <ConnectRow provider="apple" />
        <ConnectRow provider="outlook" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 4 · CONNECTED / SYNCED
// ═══════════════════════════════════════════════════════════════

function FrameConnected() {
  return (
    <Phone label="Connected calendars — connected">
      <DimmedHub />
      <Scrim />
      <Sheet>
        <ConnectedRow provider="google" />
        <ConnectRow provider="apple" />
        <ConnectRow provider="outlook" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 5 · SYNC ERROR / RE-AUTH NEEDED
// ═══════════════════════════════════════════════════════════════

function FrameReAuth() {
  return (
    <Phone label="Connected calendars — re-auth needed">
      <DimmedHub />
      <Scrim />
      <Sheet>
        <ReAuthRow provider="google" />
        <ConnectRow provider="outlook" />
      </Sheet>
    </Phone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 6 · PERMISSION DENIED
// ═══════════════════════════════════════════════════════════════

function FrameDenied() {
  return (
    <Phone label="Connected calendars — permission denied">
      <DimmedHub />
      <Scrim />
      <Sheet>
        <DeniedRow provider="apple" />
        <ConnectRow provider="google" />
        <ConnectRow provider="outlook" />
      </Sheet>
    </Phone>
  );
}

Object.assign(window, {
  FramePlaceholder, FrameNone, FrameConnecting, FrameConnected, FrameReAuth, FrameDenied,
});
