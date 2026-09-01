// A14.8 — Vacation hold (src/app/mailbox/vacation.tsx)
// Toggle-heavy variant with a date-range pair at the top and a primary
// Save action wired into the top bar (iOS trailing convention).
//
// Two frames:
//   1) Populated — a hold being scheduled. Dates picked, scope toggled,
//      forwarding on, emergency contact set. Save sits in the top bar.
//   2) Secondary — Hold currently active. A sky-tinted status hero
//      replaces the schedule rows: days left, items intercepted so far,
//      and an "End hold early" destructive at the bottom in place of Save.

// ─── Active-hold status hero ─────────────────────────────────────────────
function HoldStatusHero({ daysLeft, until, stats }) {
  return (
    <div style={{ padding: '14px 12px 0' }}>
      <div style={{
        background: 'linear-gradient(140deg, #0284C7 0%, #075985 100%)',
        color: '#fff', borderRadius: 16, padding: '16px 18px 14px',
        boxShadow: '0 6px 16px rgba(2,132,199,.18)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.18)', padding: '3px 9px',
            borderRadius: 9999, fontSize: 10.5, fontWeight: 700,
            letterSpacing: 0.06, textTransform: 'uppercase',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#7dd3fc',
              boxShadow: '0 0 0 3px rgba(125,211,252,0.3)',
            }}/>
            Hold active
          </div>
          <span style={{
            fontSize: 11, color: 'rgba(255,255,255,0.7)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>until {until}</span>
        </div>
        <div style={{
          fontSize: 32, fontWeight: 700, letterSpacing: -0.5,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        }}>{daysLeft} <span style={{ fontSize: 18, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>days left</span></div>

        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.18)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{
                fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                letterSpacing: -0.3,
              }}>{s.n}</div>
              <div style={{
                fontSize: 10.5, color: 'rgba(255,255,255,0.7)',
                marginTop: 1, textTransform: 'uppercase',
                fontWeight: 600, letterSpacing: 0.06,
              }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Save button (top-bar trailing) ──────────────────────────────────────
function SaveButton({ disabled }) {
  return (
    <button style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      padding: '6px 4px', fontSize: 15, fontWeight: 600,
      color: disabled ? S.fg4 : S.primary600,
      fontFamily: 'inherit', letterSpacing: -0.1,
    }}>Save</button>
  );
}

// ─── Date range chip ─────────────────────────────────────────────────────
// Sits inside the When card between the two date rows. Mini horizontal
// timeline strip from "from" to "to", labeled with the span length.
function DateSpan({ days, fromDow, toDow }) {
  return (
    <div style={{ padding: '6px 16px 14px' }}>
      <div style={{ position: 'relative', height: 28 }}>
        <div style={{
          position: 'absolute', top: 13, left: 8, right: 8, height: 4,
          borderRadius: 9999, background: S.primary100,
        }}/>
        <div style={{
          position: 'absolute', top: 13, left: 8, right: 8, height: 4,
          borderRadius: 9999,
          background: `repeating-linear-gradient(90deg, ${S.primary600} 0 6px, ${S.primary600}40 6px 10px)`,
        }}/>
        <div style={{
          position: 'absolute', top: 10, left: 4, width: 10, height: 10,
          borderRadius: '50%', background: S.primary600,
          boxShadow: '0 0 0 2px #fff',
        }}/>
        <div style={{
          position: 'absolute', top: 10, right: 4, width: 10, height: 10,
          borderRadius: '50%', background: S.primary600,
          boxShadow: '0 0 0 2px #fff',
        }}/>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff', padding: '2px 10px', borderRadius: 9999,
          border: `1px solid ${S.primary600}`,
          fontSize: 11, fontWeight: 700, color: S.primary600,
          fontVariantNumeric: 'tabular-nums', letterSpacing: 0.04,
        }}>{days} days</div>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: S.fg4, fontWeight: 600, marginTop: 2,
        letterSpacing: 0.06, textTransform: 'uppercase',
      }}>
        <span>{fromDow}</span>
        <span>{toDow}</span>
      </div>
    </div>
  );
}

// ─── Compact stat row inside the active hold ─────────────────────────────
function HeldList({ items }) {
  return (
    <div>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <div style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: S.sunken, color: S.fg2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i data-lucide={it.icon} style={{ width: 16, height: 16, strokeWidth: 2 }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 500, color: S.fg1, letterSpacing: -0.1,
              }}>{it.label}</div>
              <div style={{ fontSize: 11.5, color: S.fg3, marginTop: 1 }}>{it.sub}</div>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: S.fg1,
              fontVariantNumeric: 'tabular-nums',
            }}>{it.n}</div>
          </div>
          {i < items.length - 1 && (
            <div style={{ height: 1, background: S.borderSub, marginLeft: 16 }}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Frame 1 — Scheduling a hold ─────────────────────────────────────────
function FrameVacationPopulated() {
  return (
    <Phone>
      <TopBar title="Vacation hold" trailing={<SaveButton/>}/>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>

        <Overline>When</Overline>
        <div style={{ padding: '0 12px' }}>
          <div style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <Row label="From" sub="9:00 AM pickup"
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: S.fg1, fontWeight: 500 }}>
                    Tue, May 28
                  </span>
                  <Chevron/>
                </div>
              }/>
            <div style={{ height: 1, background: S.borderSub, marginLeft: 16 }}/>
            <Row label="To" sub="Resume delivery"
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: S.fg1, fontWeight: 500 }}>
                    Mon, Jun 9
                  </span>
                  <Chevron/>
                </div>
              }/>
            <div style={{ height: 1, background: S.borderSub, marginLeft: 16 }}/>
            <DateSpan days={13} fromDow="Tue · May 28" toDow="Mon · Jun 9"/>
          </div>
        </div>

        <Overline>Hold during this period</Overline>
        <Card helper="Civic notices always get delivered — too important to hold.">
          <Row label="Packages" sub="Carriers hold at neighborhood hub" right={<Toggle on={true}/>}/>
          <Row label="Mail & flyers" sub="Postal hold via USPS API" right={<Toggle on={true}/>}/>
          <Row label="Marketplace pickups" sub="Buyers see &quot;away&quot; status" right={<Toggle on={true}/>}/>
          <Row label="Civic notices" sub="Permits, voting, service alerts"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: S.fg4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.06 }}>Always on</span>
                <Toggle on={false}/>
              </div>
            }/>
        </Card>

        <Overline>Forwarding</Overline>
        <Card helper="Urgent items (overnight, signature-required) re-route the same day.">
          <Row label="Forward urgent mail" sub="Else held until you return" right={<Toggle on={true}/>}/>
          <Row
            leading={
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: S.primary50, color: S.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="map-pin" style={{ width: 16, height: 16, strokeWidth: 2 }}/>
              </div>
            }
            label="142 Mulberry St, Apt 3B"
            sub="New York, NY 10013 · Mom's place"
            right={<Chevron/>}/>
        </Card>

        <Overline>Emergency contact</Overline>
        <Card helper="We'll call them if a delivery driver flags an issue at your door.">
          <Row
            leading={<Avatar name="Sam Park" size={32}/>}
            label="Sam Park"
            sub="Spouse · (•••) 555-0247"
            right={<Chevron/>}/>
        </Card>

        <MonoFooter>14 Elm Park Lane · Last hold Jul 2023</MonoFooter>
      </div>
    </Phone>
  );
}

// ─── Frame 2 — Hold currently active ─────────────────────────────────────
function FrameVacationActive() {
  return (
    <Phone>
      <TopBar title="Vacation hold" trailing={
        <button style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '6px 4px', fontSize: 15, fontWeight: 600,
          color: S.fg3, fontFamily: 'inherit',
        }}>Edit</button>
      }/>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>

        <HoldStatusHero
          daysLeft={5}
          until="Jun 9"
          stats={[
            { n: 4, l: 'Packages' },
            { n: 12, l: 'Mail items' },
            { n: 1, l: 'Forwarded' },
          ]}
        />

        <Overline>Currently held</Overline>
        <div style={{ padding: '0 12px' }}>
          <div style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <HeldList items={[
              { icon: 'package', label: 'Packages', sub: 'Held at Park Slope hub', n: 4 },
              { icon: 'mail', label: 'Mail & flyers', sub: 'USPS holding', n: 12 },
              { icon: 'arrow-right-circle', label: 'Forwarded urgent', sub: '→ 142 Mulberry St', n: 1 },
              { icon: 'file-warning', label: 'Civic notices', sub: 'Delivered as normal', n: 2 },
            ]}/>
          </div>
          <div style={{ padding: '8px 4px 0', fontSize: 11.5, color: S.fg3, lineHeight: '16px' }}>
            Everything held resumes delivery the morning of Jun 9.
          </div>
        </div>

        <Overline>Forwarding to</Overline>
        <Card>
          <Row
            leading={
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: S.primary50, color: S.primary600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="map-pin" style={{ width: 16, height: 16, strokeWidth: 2 }}/>
              </div>
            }
            label="142 Mulberry St, Apt 3B"
            sub="Mom's place · 1 item sent"
            right={<Chevron/>}/>
        </Card>

        <Overline>Emergency contact</Overline>
        <Card>
          <Row
            leading={<Avatar name="Sam Park" size={32}/>}
            label="Sam Park"
            sub="Spouse · last contacted never"
            right={<Chevron/>}/>
        </Card>

        <div style={{ height: 18 }}/>
        <Card>
          <Row label="End hold early" sub="Mail resumes tomorrow morning" destructive/>
        </Card>

        <MonoFooter>14 Elm Park Lane · Active since May 28</MonoFooter>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameVacationPopulated, FrameVacationActive });
