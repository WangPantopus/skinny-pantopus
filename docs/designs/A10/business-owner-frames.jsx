// A10.7 — Business (owner view) (src/app/businesses/[id]/index.tsx)
// Archetype: A10 — Detail: Content · variant: content detail (body + actions)
// Owner-facing twin of A10.6. Same business (Marlow & Co.), two framings:
//   Frame 1 — OWNER / EDIT view: edit affordances, insights, profile strength, review replies
//   Frame 2 — PREVIEW AS NEIGHBOR: the exact public render, framed by a preview bar
// Reuses primitives exported to window by business-frames.jsx.

// Shared data so owner view & public preview describe the SAME business.
const MARLOW = {
  banner: 'linear-gradient(125deg, #0c4a6e 0%, #0284c7 52%, #22c1a6 100%)',
  logoBg: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
  logoIcon: 'sparkles',
  name: 'Marlow & Co. Cleaning',
  handle: '@marlowco',
  locality: 'Elm Park',
  cats: [
    { icon: 'sparkles', label: 'Cleaning', bg: B.catCleaningBg, fg: B.catCleaning },
    { icon: 'home', label: 'Home & apartment', bg: B.sunken, fg: B.fg2 },
    { icon: 'box', label: 'Move-out', bg: B.sunken, fg: B.fg2 },
    { icon: 'leaf', label: 'Eco products', bg: B.sunken, fg: B.fg2 },
  ],
  about: "Family-run cleaning crew that's worked Elm Park homes since 2019. Two-person teams, your own checklist, same crew each visit. We bring eco-safe supplies — you don't stock a thing. Bonded and insured.",
  hours: [
    { day: 'Monday', hours: '8:00 AM – 6:00 PM', today: true },
    { day: 'Tuesday', hours: '8:00 AM – 6:00 PM' },
    { day: 'Wednesday', hours: '8:00 AM – 6:00 PM' },
    { day: 'Thursday', hours: '8:00 AM – 6:00 PM' },
    { day: 'Friday', hours: '8:00 AM – 5:00 PM' },
    { day: 'Saturday', hours: '9:00 AM – 2:00 PM' },
    { day: 'Sunday', hours: 'Closed', closed: true },
  ],
  services: [
    { icon: 'spray-can', name: 'Standard clean', meta: '2 hr · 2-person team', price: 'from $90', unit: 'per visit' },
    { icon: 'sparkles', name: 'Deep clean', meta: '4 hr · baseboards, inside oven', price: 'from $180', unit: 'per visit' },
    { icon: 'box', name: 'Move-out clean', meta: 'Empty home · deposit-ready', price: 'from $240', unit: 'flat' },
  ],
  gallery: [
    { bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', label: 'Kitchen', icon: 'image' },
    { bg: 'linear-gradient(135deg,#22c1a6,#0e9488)', label: 'Bathroom', icon: 'image' },
    { bg: 'linear-gradient(135deg,#7c8da3,#475569)', label: 'Living room', icon: 'image' },
    { bg: 'linear-gradient(135deg,#0369a1,#075985)', more: 9 },
  ],
};

// ─── Owner-only: top bar ─────────────────────────────────────

function OwnerTopBar() {
  const Btn = ({ icon }) => (
    <button style={{
      width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer', color: B.fg1, padding: 0,
      borderRadius: 8,
    }}>
      <i data-lucide={icon} style={{ width: 19, height: 19 }} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 8px', height: 48, boxSizing: 'border-box',
      background: B.surface, borderBottom: `1px solid ${B.border}`, flexShrink: 0, zIndex: 5,
    }}>
      <Btn icon="chevron-left" />
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: B.fg1, letterSpacing: -0.15, lineHeight: '16px' }}>
          Business
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: B.biz, letterSpacing: 0.04,
          textTransform: 'uppercase', marginTop: 1,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <i data-lucide="square-pen" style={{ width: 9, height: 9, strokeWidth: 2.5 }} /> Owner view
        </div>
      </div>
      <Btn icon="bar-chart-3" />
      <Btn icon="settings" />
    </div>
  );
}

// ─── Owner-only: live status + view-as toggle ───────────────

function OwnerLiveBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      background: B.surface, borderBottom: `1px solid ${B.border}`,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: B.success600 }} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: B.fg1 }}>Page is live</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: B.fg4 }} />
        <span style={{ fontSize: 11.5, color: B.fg3 }}>Edited 3d ago</span>
      </div>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: B.surface, border: `1px solid ${B.border}`, color: B.fg1,
        padding: '6px 11px', borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      }}>
        <i data-lucide="eye" style={{ width: 13, height: 13 }} /> View as neighbor
      </button>
    </div>
  );
}

// ─── Owner-only: header with edit affordances ───────────────

function OwnerHeader() {
  const EditFab = ({ icon, style }) => (
    <button style={{
      width: 28, height: 28, borderRadius: '50%', background: 'rgba(17,24,39,0.55)',
      border: '1.5px solid rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      padding: 0, ...style,
    }}>
      <i data-lucide={icon} style={{ width: 14, height: 14, color: '#fff' }} />
    </button>
  );
  return (
    <div style={{ background: B.surface, borderBottom: `1px solid ${B.border}` }}>
      <div style={{ height: 116, background: MARLOW.banner, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.18) 100%)',
        }} />
        <div style={{ position: 'absolute', right: 12, top: 12 }}>
          <EditFab icon="camera" />
        </div>
      </div>
      <div style={{ padding: '0 18px 16px', position: 'relative' }}>
        <div style={{ position: 'relative', marginTop: -30, marginBottom: 10, width: 'fit-content' }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18, background: MARLOW.logoBg, border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(17,24,39,0.18)',
          }}>
            <i data-lucide={MARLOW.logoIcon} style={{ width: 30, height: 30, color: '#fff', strokeWidth: 2 }} />
          </div>
          <div style={{ position: 'absolute', right: -6, bottom: -6 }}>
            <EditFab icon="pencil" style={{ width: 24, height: 24 }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: B.fg1, letterSpacing: -0.5, lineHeight: '24px' }}>
                {MARLOW.name}
              </span>
              <i data-lucide="pencil" style={{ width: 14, height: 14, color: B.primary600, flexShrink: 0 }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: B.fg3, flexWrap: 'wrap',
            }}>
              <span style={{ color: B.primary700, fontWeight: 600 }}>{MARLOW.handle}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: B.fg4 }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <i data-lucide="map-pin" style={{ width: 11, height: 11 }} />{MARLOW.locality}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 11, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip icon="shield-check" bg={B.bizBg} fg={B.bizDeep} weight={700}>Business · Verified</Chip>
          <Chip dot bg={B.successBg} fg={B.success600} weight={700}>Open now</Chip>
        </div>
      </div>
    </div>
  );
}

// ─── Owner-only: insights strip ──────────────────────────────

function InsightsStrip() {
  const Metric = ({ icon, value, delta, label, first }) => (
    <div style={{
      flex: 1, padding: '11px 8px',
      borderLeft: first ? 'none' : `1px solid ${B.borderSub}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <i data-lucide={icon} style={{ width: 13, height: 13, color: B.primary600, strokeWidth: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: B.fg1, letterSpacing: -0.3 }}>{value}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: B.fg3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.03 }}>{label}</span>
        {delta && (
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 9.5, color: B.success600, fontWeight: 700 }}>
            <i data-lucide="arrow-up" style={{ width: 9, height: 9, strokeWidth: 3 }} />{delta}
          </span>
        )}
      </div>
    </div>
  );
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.border}`, borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px 7px', borderBottom: `1px solid ${B.borderSub}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: B.fg2, letterSpacing: 0.03 }}>
          This week
        </span>
        <button style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11.5, color: B.primary600, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          Insights <i data-lucide="chevron-right" style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div style={{ display: 'flex' }}>
        <Metric first icon="eye" value="1.2k" delta="18%" label="Views" />
        <Metric icon="bookmark" value="84" delta="6%" label="Saves" />
        <Metric icon="message-circle" value="23" label="Contacts" />
      </div>
    </div>
  );
}

// ─── Owner-only: profile strength ────────────────────────────

function ProfileStrength() {
  return (
    <Card pad="13px 14px 14px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.fg1, letterSpacing: -0.1 }}>Profile strength</div>
          <div style={{ fontSize: 11, color: B.fg3, marginTop: 1 }}>One step from a complete page</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: B.success600, letterSpacing: -0.4 }}>92%</div>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: B.sunken, overflow: 'hidden', marginBottom: 11 }}>
        <div style={{ width: '92%', height: '100%', background: B.success600, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          { done: true, label: 'Logo, banner & description' },
          { done: true, label: 'Hours & service area' },
          { done: false, label: 'Add 2 more work photos', cta: 'Add' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: s.done ? B.successBg : B.surface,
              border: s.done ? 'none' : `1.5px dashed ${B.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {s.done && <i data-lucide="check" style={{ width: 11, height: 11, color: B.success600, strokeWidth: 3 }} />}
            </div>
            <span style={{
              flex: 1, fontSize: 12.5, color: s.done ? B.fg3 : B.fg1, fontWeight: s.done ? 500 : 600,
              textDecoration: s.done ? 'line-through' : 'none',
            }}>{s.label}</span>
            {s.cta && (
              <button style={{
                background: B.primary50, color: B.primary700, border: 'none',
                padding: '4px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}>{s.cta}</button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Owner-only: services manage list ────────────────────────

function ManageServices() {
  return (
    <Card pad="0">
      {MARLOW.services.map((s, i, arr) => (
        <div key={s.name} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderBottom: i < arr.length - 1 ? `1px solid ${B.borderSub}` : 'none',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: B.primary50, color: B.primary600, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i data-lucide={s.icon} style={{ width: 16, height: 16, strokeWidth: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: B.fg1, letterSpacing: -0.1 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: B.fg3, marginTop: 1 }}>{s.meta} · {s.price}</div>
          </div>
          <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: B.fg4, flexShrink: 0 }} />
        </div>
      ))}
      <button style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '11px 14px', background: 'transparent', border: 'none',
        borderTop: `1px solid ${B.borderSub}`, cursor: 'pointer',
        color: B.primary600, fontSize: 12.5, fontWeight: 600,
      }}>
        <i data-lucide="plus" style={{ width: 14, height: 14, strokeWidth: 2.5 }} /> Add a service
      </button>
    </Card>
  );
}

// ─── Owner-only: gallery with add tile ───────────────────────

function ManageGallery() {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}>
      <button style={{
        flexShrink: 0, width: 92, height: 92, borderRadius: 12, cursor: 'pointer',
        border: `1.5px dashed ${B.primary200}`, background: B.primary50, color: B.primary600,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <i data-lucide="plus" style={{ width: 20, height: 20, strokeWidth: 2.2 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600 }}>Add</span>
      </button>
      {MARLOW.gallery.map((t, i) => (
        <div key={i} style={{
          position: 'relative', flexShrink: 0, width: 116, height: 92, borderRadius: 12, overflow: 'hidden',
          background: t.bg, border: `1px solid ${B.border}`, display: 'flex', alignItems: 'flex-end',
        }}>
          {t.icon && (
            <i data-lucide={t.icon} style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 24, height: 24, color: 'rgba(255,255,255,0.92)', strokeWidth: 1.6,
            }} />
          )}
          {t.more != null ? (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700,
            }}>+{t.more}</div>
          ) : (
            <>
              <div style={{
                position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide="pencil" style={{ width: 11, height: 11, color: '#fff' }} />
              </div>
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', padding: '6px 8px',
                color: '#fff', fontSize: 10.5, fontWeight: 600,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)',
              }}>{t.label}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Owner-only: reviews with reply affordance ───────────────

function OwnerReview({ initials, avatarBg, name, meta, rating, body, reply }) {
  return (
    <Card pad="12px 14px 13px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Avatar size={32} initials={initials} bg={avatarBg} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: B.fg1, letterSpacing: -0.1 }}>{name}</div>
          <div style={{ fontSize: 10.5, color: B.fg3 }}>{meta}</div>
        </div>
        <Stars rating={rating} size={12} />
      </div>
      <div style={{ fontSize: 12.5, color: B.fg2, lineHeight: '18px' }}>{body}</div>
      {reply ? (
        <div style={{
          marginTop: 9, padding: '9px 11px', background: B.sunken, borderRadius: 10,
          borderLeft: `2px solid ${B.biz}`,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: B.bizDeep, marginBottom: 2,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <i data-lucide="corner-down-right" style={{ width: 11, height: 11 }} /> Marlow & Co. replied
          </div>
          <div style={{ fontSize: 12, color: B.fg2, lineHeight: '17px' }}>{reply}</div>
        </div>
      ) : (
        <button style={{
          marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 5,
          background: B.surface, border: `1px solid ${B.border}`, color: B.fg1,
          padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
        }}>
          <i data-lucide="reply" style={{ width: 12, height: 12 }} /> Reply
        </button>
      )}
    </Card>
  );
}

// ─── FRAME 1 — Owner / edit view ─────────────────────────────

function FrameOwnerEdit() {
  return (
    <BPhone>
      <OwnerTopBar />
      <OwnerLiveBar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <OwnerHeader />

        <div style={{ padding: '14px 16px 130px' }}>
          <InsightsStrip />

          <div style={{ marginTop: 12 }}>
            <ProfileStrength />
          </div>

          <SectionTitle action="Edit" actionIcon="pencil">Categories</SectionTitle>
          <CategoryRow cats={MARLOW.cats} />

          <SectionTitle action="Edit" actionIcon="pencil">About</SectionTitle>
          <div style={{ fontSize: 13.5, color: B.fg2, lineHeight: '20px', letterSpacing: -0.05 }}>
            {MARLOW.about}
          </div>

          <SectionTitle action="Edit" actionIcon="pencil">Hours</SectionTitle>
          <Hours open statusLabel="Open now" statusSub="Closes 6:00 PM" rows={MARLOW.hours} />

          <SectionTitle action="Edit" actionIcon="pencil">Service area</SectionTitle>
          <AddressMap
            address="Based near 5th & Birch"
            sub="Exact address shared after booking"
            serviceArea="Serves Elm Park & Cedar Heights — within 4 mi"
          />

          <SectionTitle action="Manage" actionIcon="settings-2">Services</SectionTitle>
          <ManageServices />

          <SectionTitle>Photos</SectionTitle>
          <ManageGallery />

          <SectionTitle action="2 to reply" actionIcon="message-square">Reviews</SectionTitle>
          <RatingSummary avg={4.9} count={128} dist={[
            { n: 5, pct: 92 }, { n: 4, pct: 6 }, { n: 3, pct: 2 }, { n: 2, pct: 0 }, { n: 1, pct: 0 },
          ]} />
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <OwnerReview
              initials="DR" avatarBg="linear-gradient(135deg,#dc2626,#b91c1c)"
              name="Dana R." meta="2d · Deep clean" rating={4}
              body="Great job overall — only ding is they ran 20 min late. Place looked spotless though."
            />
            <OwnerReview
              initials="JT" avatarBg="linear-gradient(135deg,#16a34a,#15803d)"
              name="Jamal T." meta="1w · Standard clean" rating={5}
              body="Same two folks every time, which I love. They remember the dog and shut the gate."
              reply="Thanks Jamal — Rosa and Mae always look forward to seeing Biscuit. See you next visit."
            />
          </div>
        </div>
      </div>

      <ActionBar
        primary={{ icon: 'square-pen', label: 'Edit page' }}
        secondary={{ icon: 'eye', label: 'Preview' }}
      />
    </BPhone>
  );
}

// ─── FRAME 2 — Preview as neighbor (public render) ───────────

function PreviewBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
      background: '#1f2937', flexShrink: 0, zIndex: 6,
    }}>
      <i data-lucide="eye" style={{ width: 15, height: 15, color: '#fff' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: -0.1 }}>Previewing as a neighbor</div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)' }}>This is exactly what the public sees</div>
      </div>
      <button style={{
        background: 'rgba(255,255,255,0.16)', border: 'none', color: '#fff',
        padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      }}>Exit</button>
    </div>
  );
}

function FramePreviewPublic() {
  return (
    <BPhone>
      <PreviewBar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* floating public controls on banner */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, zIndex: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px',
          }}>
            {['chevron-left', 'share'].map((ic, i) => (
              <button key={ic} style={{
                width: 34, height: 34, borderRadius: '50%', background: 'rgba(17,24,39,0.32)',
                backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer', color: '#fff', padding: 0,
                display: i === 0 ? 'flex' : 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i data-lucide={ic} style={{ width: 19, height: 19 }} />
              </button>
            ))}
          </div>
          <BizHeader
            banner={MARLOW.banner}
            logoBg={MARLOW.logoBg}
            logoIcon={MARLOW.logoIcon}
            name={MARLOW.name}
            handle={MARLOW.handle}
            locality={MARLOW.locality}
            statusChip={<Chip dot bg={B.successBg} fg={B.success600} weight={700}>Open now</Chip>}
          />
        </div>

        <StatStrip stats={[
          { value: '4.9', label: '128 reviews', icon: 'star', color: B.star, iconFill: true },
          { value: '340', label: 'Jobs done' },
          { value: '~20m', label: 'Response' },
        ]} />

        <div style={{ padding: '14px 16px 130px' }}>
          <CategoryRow cats={MARLOW.cats} />

          <SectionTitle>About</SectionTitle>
          <div style={{ fontSize: 13.5, color: B.fg2, lineHeight: '20px', letterSpacing: -0.05 }}>{MARLOW.about}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Chip icon="shield" bg={B.primary50} fg={B.primary700}>Bonded & insured</Chip>
            <Chip icon="users" bg={B.primary50} fg={B.primary700}>3 team members</Chip>
            <Chip icon="calendar-check" bg={B.primary50} fg={B.primary700}>Since 2019</Chip>
          </div>

          <SectionTitle>Hours</SectionTitle>
          <Hours open statusLabel="Open now" statusSub="Closes 6:00 PM" rows={MARLOW.hours} />

          <SectionTitle>Service area</SectionTitle>
          <AddressMap
            address="Based near 5th & Birch"
            sub="Exact address shared after booking"
            serviceArea="Serves Elm Park & Cedar Heights — within 4 mi"
          />

          <SectionTitle action="See all">Services</SectionTitle>
          <Services items={MARLOW.services} />

          <SectionTitle action="See all">Recent work</SectionTitle>
          <Gallery tiles={MARLOW.gallery} />

          <SectionTitle action="See all 128">Reviews</SectionTitle>
          <RatingSummary avg={4.9} count={128} dist={[
            { n: 5, pct: 92 }, { n: 4, pct: 6 }, { n: 3, pct: 2 }, { n: 2, pct: 0 }, { n: 1, pct: 0 },
          ]} />
          <div style={{ marginTop: 8 }}>
            <ReviewCard
              initials="JT" avatarBg="linear-gradient(135deg,#16a34a,#15803d)"
              name="Jamal T." meta="1w · Standard clean" rating={5} verified
              body="Same two folks every time, which I love. They remember the dog and shut the gate. Place smells like nothing, which is exactly right."
            />
          </div>
        </div>
      </div>

      <ActionBar
        primary={{ icon: 'message-circle', label: 'Contact' }}
        secondary={{ icon: 'calendar-plus', label: 'Book' }}
      />
    </BPhone>
  );
}

Object.assign(window, { FrameOwnerEdit, FramePreviewPublic });
