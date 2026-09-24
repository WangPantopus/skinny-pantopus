// The component catalogue: display order, the group each card sits in, its
// row height, and the preview script that mounts the real web component from
// window.Pantopus with realistic Pantopus content. Layout classes here are
// Tailwind utilities; the bundle.css build scans this output, so they compile.
//
// Each preview runs in the design-system page's frame, which has already
// loaded tokens.css, bundle.css, React 18 and the bundle. Keep previews
// self-contained: no fetches, no external scripts.
//
// `height` is the card's row height in px; the render check reports previews
// whose content grows past it.

export const PRELUDE = `var P = window.Pantopus, h = React.createElement, I = P.Icons, noop = function () {};
function label(text) { return h(P.Overline, { as: 'div', className: 'mb-2' }, text); }
function mount(el) { ReactDOM.createRoot(document.getElementById('root')).render(el); }`;

const HOME_ADDRESS = '1421 SE Oak St, Portland, OR 97214';

export const CATALOGUE = [
  // ── Brand ────────────────────────────────────────────────────
  {
    name: 'PantopusMark', group: 'Brand', height: 132,
    code: `function item(el, text) { return h('div', { className: 'flex flex-col items-center gap-2' }, el, h('span', { className: 'text-xs text-app-text-secondary' }, text)); }
mount(h('div', { className: 'flex flex-wrap items-end gap-6' },
  item(h(P.PantopusMark, { size: 64, title: 'Pantopus' }), '64 · auto'),
  item(h(P.PantopusMark, { size: 40 }), '40'),
  item(h(P.PantopusMark, { size: 24 }), '24'),
  item(h(P.PantopusMark, { size: 16 }), '16 · plug'),
  item(h('div', { className: 'bg-primary-600 rounded-2xl p-3' }, h(P.PantopusMark, { size: 40, variant: 'reverse' })), 'reverse on primary-600')
));`,
  },
  {
    name: 'PantopusLockup', group: 'Brand', height: 104,
    code: `mount(h('div', { className: 'flex flex-wrap items-center gap-6' },
  h(P.PantopusLockup, { size: 32 }),
  h('div', { className: 'bg-primary-600 rounded-2xl px-5 py-4' }, h(P.PantopusLockup, { size: 24, variant: 'reverse' }))
));`,
  },

  // ── Actions ──────────────────────────────────────────────────
  {
    name: 'Button', group: 'Actions', height: 150,
    code: `mount(h('div', { className: 'flex flex-col gap-4' },
  h('div', { className: 'flex flex-wrap items-center gap-2' },
    h(P.Button, { icon: I.ShieldCheck }, 'Verify address'),
    h(P.Button, { variant: 'ghost' }, 'Not now'),
    h(P.Button, { variant: 'danger' }, 'Remove place'),
    h(P.Button, { disabled: true }, 'Claim home')
  ),
  h('div', { className: 'flex flex-wrap items-center gap-2' },
    h(P.Button, { size: 'lg' }, 'Continue'),
    h(P.Button, { size: 'lg', loading: true }, 'Saving'),
    h(P.Button, { size: 'lg', variant: 'success' }, 'Mark as paid'),
    h(P.Button, { size: 'lg', variant: 'warning' }, 'Report an issue')
  )
));`,
  },
  {
    name: 'TextButton', group: 'Actions', height: 72,
    code: `mount(h('div', { className: 'flex flex-wrap items-center gap-6' },
  h(P.TextButton, { onClick: noop }, 'See all risks'),
  h(P.TextButton, { onClick: noop }, 'Claim home'),
  h(P.TextButton, { onClick: noop, arrow: false }, 'Try again')
));`,
  },
  {
    name: 'IconButton', group: 'Actions', height: 72,
    code: `mount(h('div', { className: 'flex items-center gap-2' },
  h(P.IconButton, { icon: h(I.Bell, { size: 20 }), label: 'Notifications', badge: 3 }),
  h(P.IconButton, { icon: h(I.Search, { size: 20 }), label: 'Search' }),
  h(P.IconButton, { icon: h(P.NavIcons.settings, { size: 20 }), label: 'Settings' })
));`,
  },
  {
    name: 'Pill', group: 'Actions', height: 72,
    code: `function Demo() {
  var s = React.useState('all');
  var pills = [['all', 'All', null], ['gigs', 'Gigs', I.Hammer], ['rentals', 'Rentals', I.Home], ['near', 'Near me', I.MapPin]];
  return h('div', { className: 'flex flex-wrap gap-2' }, pills.map(function (p) {
    return h(P.Pill, { key: p[0], label: p[1], icon: p[2] ? h(p[2], { size: 14 }) : null, active: s[0] === p[0], color: 'var(--color-primary-700)', onClick: function () { s[1](p[0]); } });
  }));
}
mount(h(Demo));`,
  },

  // ── Status ───────────────────────────────────────────────────
  {
    name: 'Chip', group: 'Status', height: 143,
    code: `var variants = ['neutral', 'primary', 'personal', 'home', 'business', 'success', 'warning', 'error', 'info'];
mount(h('div', { className: 'flex flex-col gap-4' },
  h('div', null, label('Size sm'), h('div', { className: 'flex flex-wrap gap-2' }, variants.map(function (v) { return h(P.Chip, { key: v, label: v.charAt(0).toUpperCase() + v.slice(1), variant: v }); }))),
  h('div', null, label('Size md with icon'), h('div', { className: 'flex flex-wrap gap-2' },
    h(P.Chip, { size: 'md', variant: 'success', icon: I.ShieldCheck, label: 'Verified' }),
    h(P.Chip, { size: 'md', variant: 'warning', icon: I.AlertTriangle, label: 'High' }),
    h(P.Chip, { size: 'md', variant: 'info', icon: I.Waves, label: 'Zone AE' }),
    h(P.Chip, { size: 'md', variant: 'home', icon: I.Home, label: 'Home' }),
    h(P.Chip, { size: 'md', variant: 'neutral', label: 'Coming soon' })
  ))
));`,
  },
  {
    name: 'StatusDot', group: 'Status', height: 72,
    code: `function row(tone, text) { return h('span', { className: 'inline-flex items-center gap-1.5 text-[15px] font-medium text-app-text' }, h(P.StatusDot, { tone: tone }), text); }
mount(h('div', { className: 'flex flex-wrap gap-6' },
  row('success', 'AQI 31 · Good'), row('warning', 'Moderate'), row('error', 'Boil-water notice'), row('neutral', 'No reading')
));`,
  },
  {
    name: 'StarRating', group: 'Status', height: 104,
    code: `function Demo() {
  var s = React.useState(0);
  return h('div', { className: 'flex flex-col gap-3' },
    h(P.StarRating, { rating: 4, size: 18, readonly: true, valueLabel: '4.0 · 38 reviews' }),
    h(P.StarRating, { rating: s[0], onChange: s[1], valueLabel: s[0] ? s[0] + ' of 5' : 'Tap to rate' })
  );
}
mount(h(Demo));`,
  },

  // ── Forms ────────────────────────────────────────────────────
  {
    name: 'ValidatedField', group: 'Forms', height: 452,
    code: `mount(h('div', { className: 'max-w-md' },
  h(P.ValidatedField, { label: 'Street address', required: true, valid: true, defaultValue: '1421 SE Oak St' }),
  h(P.ValidatedField, { label: 'Email', required: true, defaultValue: 'rosa@', error: 'Enter an email like name@example.com.' }),
  h(P.ValidatedField, { label: 'Unit', placeholder: 'Apt, suite or floor', helper: 'Optional. Mail carriers use it to find your door.' }),
  h(P.ValidatedField, { label: 'Notes for your household', multiline: true, rows: 2, placeholder: 'Gate code, pickup spot…' })
));`,
  },
  {
    name: 'SearchInput', group: 'Forms', height: 72,
    code: `function Demo() {
  var s = React.useState('pickup');
  return h('div', { className: 'max-w-sm' }, h(P.SearchInput, { value: s[0], onChange: s[1], placeholder: 'Search your mail…' }));
}
mount(h(Demo));`,
  },
  {
    name: 'FieldGroup', group: 'Forms', height: 296,
    code: `mount(h('div', { className: 'max-w-md' },
  h(P.FieldGroup, { overline: 'Your home', description: 'We use this to show public records and local risks for your address.' },
    h(P.ValidatedField, { label: 'Year you moved in', placeholder: '2021' }),
    h(P.ValidatedField, { label: 'Your monthly rent', placeholder: '$0', helper: 'Only shown as a band on your block, never the amount.' })
  )
));`,
  },

  // ── Structure ────────────────────────────────────────────────
  {
    name: 'Overline', group: 'Structure', height: 64,
    code: `mount(h('div', { className: 'flex gap-8' }, h(P.Overline, null, 'Your home'), h(P.Overline, null, 'Risk & readiness'), h(P.Overline, null, 'Step 2 of 4')));`,
  },
  {
    name: 'SectionHeader', group: 'Structure', height: 88,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.SectionHeader, { overline: 'Upcoming', title: 'Pickup days, tax dates, hearings', action: { label: 'See all', onClick: noop } })));`,
  },
  {
    name: 'SectionCard', group: 'Structure', height: 190,
    code: `mount(h('div', { className: 'max-w-lg' },
  h(P.SectionCard, { overline: 'Bills', title: 'Due this week', action: { label: 'View all', onClick: noop } },
    h('p', { className: 'text-sm text-app-text-secondary' }, '2 bills due · $184.18 total. Water is paid through October.')
  )
));`,
  },
  {
    name: 'ArchetypePageHeader', group: 'Structure', height: 184,
    code: `function Demo() {
  var s = React.useState('');
  return h(P.ArchetypePageHeader, {
    overline: 'Home', title: 'Bills', subtitle: 'Track what is due, what is paid, and what changed since last month.',
    primaryAction: { label: 'Add bill', icon: I.Plus, onClick: noop },
    secondaryActions: [{ label: 'Export', icon: I.Download, onClick: noop }]
  }, h(P.SearchInput, { value: s[0], onChange: s[1], placeholder: 'Search bills…' }));
}
mount(h(Demo));`,
  },
  {
    name: 'TabStrip', group: 'Structure', height: 78,
    code: `function Demo() {
  var s = React.useState('upcoming');
  return h('div', { className: 'max-w-lg bg-app-surface' }, h(P.TabStrip, { activeKey: s[0], onChange: s[1], tabs: [{ key: 'upcoming', label: 'Upcoming', count: 3 }, { key: 'paid', label: 'Paid', count: 12 }, { key: 'all', label: 'All' }] }));
}
mount(h(Demo));`,
  },
  {
    name: 'ProgressSegments', group: 'Structure', height: 72,
    code: `mount(h('div', { className: 'max-w-sm' }, h(P.ProgressSegments, { step: 2, totalSteps: 4 })));`,
  },
  {
    name: 'KeyFactsPanel', group: 'Structure', height: 200,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.KeyFactsPanel, { facts: [
  { label: 'Parcel number', value: '986043122', monospace: true, copyable: true },
  { label: 'Year built', value: '1978' },
  { label: 'Lot size', value: '0.18 acres' },
  { label: 'Flood zone', value: 'X (minimal risk)' }
] })));`,
  },
  {
    name: 'StickyFooter', group: 'Structure', height: 179,
    code: `mount(h('div', { className: 'max-w-lg bg-app-surface border border-app-border rounded-2xl overflow-hidden' },
  h('div', { className: 'p-4 text-sm text-app-text-secondary' }, 'Choose who can see your block activity. You can change this later.'),
  h(P.StickyFooter, { helperText: 'Your exact address is never shown to neighbors.', secondaryLabel: 'Back', onSecondaryClick: noop, primaryLabel: 'Continue', onPrimaryClick: noop })
));`,
  },

  // ── Rows ─────────────────────────────────────────────────────
  {
    name: 'FileChevronRow', group: 'Rows', height: 222,
    code: `mount(h('div', { className: 'max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden' },
  h(P.FileChevronRow, { icon: I.FileText, name: 'Deed of trust', meta: 'PDF · 2.4 MB · Added Mar 3', onClick: noop }),
  h(P.FileChevronRow, { icon: I.Receipt, name: 'Property tax statement 2026', meta: 'PDF · 312 KB', onClick: noop }),
  h(P.FileChevronRow, { icon: I.Landmark, iconBg: 'var(--color-identity-home-bg)', iconColor: 'var(--color-identity-home)', name: 'Homestead exemption', meta: 'Approved · Multnomah County', onClick: noop, last: true })
));`,
  },
  {
    name: 'StatusChipRow', group: 'Rows', height: 202,
    code: `mount(h('div', { className: 'max-w-lg flex flex-col gap-2' },
  h(P.StatusChipRow, { icon: I.Zap, title: 'Portland General Electric', subtitle: 'Electric · due Sep 22', amount: '$142.18', statusLabel: 'Due', statusVariant: 'info', onClick: noop }),
  h(P.StatusChipRow, { icon: I.CheckCircle2, iconBg: 'var(--color-success-light)', iconColor: 'var(--color-success)', title: 'Portland Water Bureau', subtitle: 'Water · paid Sep 2', amount: '$42.00', statusLabel: 'Paid', statusVariant: 'success', onClick: noop })
));`,
  },
  {
    name: 'AvatarKebabRow', group: 'Rows', height: 196,
    code: `mount(h('div', { className: 'max-w-lg flex flex-col gap-2' },
  h(P.AvatarKebabRow, { name: 'Rosa Chen', verified: true, roleLabel: 'Owner', roleVariant: 'home', meta: 'Verified resident · since 2021', avatarBg: 'var(--color-identity-home-solid)', onKebabClick: noop }),
  h(P.AvatarKebabRow, { name: 'Marcus Webb', roleLabel: 'Tenant', roleVariant: 'personal', meta: 'Invited Sep 12', avatarBg: 'var(--color-identity-personal-solid)', onKebabClick: noop })
));`,
  },

  // ── Place ────────────────────────────────────────────────────
  {
    name: 'PlaceHeader', group: 'Place', height: 200,
    code: `mount(h('div', { className: 'max-w-lg flex flex-col gap-6' },
  h(P.PlaceHeader, { address: '${HOME_ADDRESS}', initials: 'RC', status: 'verified' }),
  h(P.PlaceHeader, { address: '2718 NE 3rd Ave, Camas, WA 98607', initials: 'MW', status: 'claimed' })
));`,
  },
  {
    name: 'PlaceAvatar', group: 'Place', height: 121,
    code: `function item(el, text) { return h('div', { className: 'flex flex-col items-center gap-2' }, el, h('span', { className: 'text-xs text-app-text-secondary' }, text)); }
mount(h('div', { className: 'flex items-start gap-8' },
  item(h(P.PlaceAvatar, { initials: 'RC', status: 'verified' }), 'Verified'),
  item(h(P.PlaceAvatar, { initials: 'MW', status: 'claimed', label: 'Claimed' }), 'Claimed'),
  item(h(P.PlaceAvatar, { initials: '', status: 'none' }), 'Signed out')
));`,
  },
  {
    name: 'PlaceCard', group: 'Place', height: 120,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.PlaceCard, { className: 'p-4' },
  h('div', { className: 'flex items-center gap-3' },
    h(P.IconTile, { icon: I.Sun }),
    h('div', { className: 'flex-1 min-w-0' },
      h('div', { className: 'text-[15px] font-semibold text-app-text -tracking-[0.01em]' }, 'Sunrise & sunset'),
      h('div', { className: 'text-[12.5px] text-app-text-muted mt-0.5' }, '6:52 AM · 7:14 PM')
    )
  )
)));`,
  },
  {
    name: 'IconTile', group: 'Place', height: 90,
    code: `function item(el, text) { return h('div', { className: 'flex flex-col items-center gap-2' }, el, h('span', { className: 'text-xs text-app-text-secondary' }, text)); }
mount(h('div', { className: 'flex items-end gap-6' },
  item(h(P.IconTile, { icon: I.Home, tone: 'home' }), 'home'),
  item(h(P.IconTile, { icon: I.Lock, tone: 'muted' }), 'muted'),
  item(h(P.IconTile, { icon: I.ShieldCheck, tone: 'sky' }), 'sky'),
  item(h(P.IconTile, { icon: I.Waves, size: 32 }), '32 · inline')
));`,
  },
  {
    name: 'Chevron', group: 'Place', height: 90,
    code: `mount(h('div', { className: 'max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-sm px-3.5 py-3 flex items-center gap-3' },
  h(P.IconTile, { icon: I.Waves, size: 32 }),
  h('div', { className: 'flex-1 text-[15px] font-semibold text-app-text -tracking-[0.01em]' }, 'Drinking water'),
  h(P.Chevron)
));`,
  },
  {
    name: 'PlaceGroup', group: 'Place', height: 417,
    code: `mount(h('div', { className: 'max-w-2xl' }, h(P.PlaceGroup, { label: 'Risk & readiness' },
  h(P.PlaceSectionCard, { icon: I.Waves, title: 'Flood', asOf: 'May 2026', value: 'Zone X — minimal flood risk', chip: { label: 'Low', variant: 'success' }, onClick: noop }),
  h(P.PlaceSectionCard, { icon: I.Flame, title: 'Wildfire', asOf: 'Aug 2026', value: 'Moderate hazard on your block', chip: { label: 'Watch', variant: 'warning' }, onClick: noop }),
  h(P.PlaceSectionCard, { icon: I.CloudRain, title: 'Weather', inline: true, statusDot: 'success', value: '58° · light rain', onClick: noop })
)));`,
  },
  {
    name: 'PlaceSectionCard', group: 'Place', height: 691,
    code: `function cell(text, el) { return h('div', null, label(text), el); }
mount(h('div', { className: 'grid gap-4 sm:grid-cols-2' },
  cell('Loaded', h(P.PlaceSectionCard, { icon: I.Waves, title: 'Flood', asOf: 'May 2026', value: 'Zone X — minimal flood risk', caption: 'FEMA National Flood Hazard Layer', chip: { label: 'Low', variant: 'success' }, onClick: noop })),
  cell('Stale', h(P.PlaceSectionCard, { icon: I.CloudRain, title: 'Weather', asOf: '6:10 AM', state: 'stale', value: '58° · light rain', onClick: noop })),
  cell('Inline', h(P.PlaceSectionCard, { icon: I.Landmark, title: 'Estimated value', inline: true, value: '$612K', onClick: noop })),
  cell('Action', h(P.PlaceSectionCard, { icon: I.Thermometer, title: 'Heat & cold', action: { label: 'Turn on heat alerts', onClick: noop } })),
  cell('Loading', h(P.PlaceSectionCard, { icon: I.Zap, title: 'Power outages', state: 'loading' })),
  cell('Empty', h(P.PlaceSectionCard, { icon: I.Hammer, title: 'Recent permits', state: 'empty' })),
  cell('Unavailable', h(P.PlaceSectionCard, { icon: I.Zap, title: 'Power outages', state: 'unavailable' })),
  cell('Error', h(P.PlaceSectionCard, { icon: I.Waves, title: 'Drinking water', state: 'error', onRetry: noop }))
));`,
  },
  {
    name: 'HeroCard', group: 'Place', height: 420,
    code: `mount(h('div', { className: 'grid gap-4 sm:grid-cols-2' },
  h(P.HeroCard, { title: 'All clear on your block today.', chip: { label: 'All clear', icon: I.CheckCircle2 }, mainIcon: I.Sun, nudge: { icon: I.CalendarClock, text: 'Yard debris pickup moves to Thursday this week.', onClick: noop }, onOpen: noop }),
  h(P.HeroCard, { variant: 'alert', title: 'Heat advisory until 8 PM, with highs near 97°F.', chip: { label: 'Advisory', icon: I.AlertTriangle }, mainIcon: I.Thermometer, nudge: { icon: I.AlertTriangle, text: 'Check on neighbors who live alone.' } })
));`,
  },
  {
    name: 'AhaCard', group: 'Place', height: 241,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.AhaCard, {
  tone: 'alert', grade: 'High', icon: I.Flame,
  headline: 'Your block sits in a high wildfire hazard band.',
  detail: 'Most homes within half a mile are rated high for wildfire hazard potential.',
  source: 'USFS Wildfire Hazard Potential',
  followUp: 'What can I do to lower my risk?', onFollowUp: noop
})));`,
  },
  {
    name: 'LockedCard', group: 'Place', height: 164,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.LockedCard, { icon: I.Hammer, title: 'Recent permits', reason: 'Claim your place to see permits filed on your home.', cta: 'Claim home', onCta: noop })));`,
  },
  {
    name: 'DensityCard', group: 'Place', height: 320,
    code: `mount(h('div', { className: 'max-w-lg flex flex-col gap-3' },
  h(P.DensityCard, { bucket: 'few', onCta: noop, onClick: noop }),
  h(P.DensityCard, { bucket: 'none', onCta: noop })
));`,
  },
  {
    name: 'VerifyBanner', group: 'Place', height: 123,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.VerifyBanner, { onClick: noop })));`,
  },
  {
    name: 'Sparkline', group: 'Place', height: 112,
    code: `mount(h('div', { className: 'max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 flex items-end gap-3' },
  h('div', { className: 'flex-1' },
    h('div', { className: 'text-[15px] font-medium text-app-text leading-[21px]' }, '$612K'),
    h('div', { className: 'text-[12.5px] text-app-text-muted mt-1.5' }, 'Estimate, not an appraisal')
  ),
  h(P.Sparkline)
));`,
  },
  {
    name: 'DetailHeader', group: 'Place', height: 98,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.DetailHeader, { title: 'Risk & readiness', address: '1421 SE Oak St · Portland', onBack: noop })));`,
  },
  {
    name: 'DetailSectionLabel', group: 'Place', height: 72,
    code: `mount(h('div', { className: 'max-w-lg -mt-6' }, h(P.DetailSectionLabel, null, 'Hazards')));`,
  },
  {
    name: 'SourceNote', group: 'Place', height: 56,
    code: `mount(h('div', { className: 'max-w-lg -mt-2.5' }, h(P.SourceNote, { name: 'FEMA National Flood Hazard Layer', asOf: 'May 2026' })));`,
  },
  {
    name: 'InfoNote', group: 'Place', height: 220,
    code: `mount(h('div', { className: 'max-w-lg -mt-4' },
  h(P.InfoNote, null, 'Screening, not a diagnosis. Levels come from public test results near your address.'),
  h(P.InfoNote, { tone: 'warning' }, 'These readings are more than 30 days old.'),
  h(P.InfoNote, { tone: 'sky' }, 'Your exact address is never shown to neighbors.')
));`,
  },
  {
    name: 'ComingSoonRow', group: 'Place', height: 101,
    code: `mount(h('div', { className: 'max-w-lg' }, h(P.ComingSoonRow, { icon: I.Package, title: 'Package tracking', sub: 'Know when deliveries reach your door.' })));`,
  },

  // ── Feedback ─────────────────────────────────────────────────
  {
    name: 'EmptyState', group: 'Feedback', height: 395,
    code: `mount(h(P.EmptyState, { icon: I.Inbox, title: 'No mail yet', description: 'Mail sent to your verified address shows up here.', actionLabel: 'Set up mailbox', onAction: noop }));`,
  },
  {
    name: 'ArchetypeEmptyState', group: 'Feedback', height: 427,
    code: `mount(h(P.ArchetypeEmptyState, { icon: I.Home, tone: 'home', headline: 'You haven’t added a place yet', subcopy: 'Add your address to see what’s true about it.', ctaLabel: 'Add a place', onCtaClick: noop, secondaryCtaLabel: 'Not now', onSecondaryCtaClick: noop }));`,
  },
  {
    name: 'ErrorState', group: 'Feedback', height: 354,
    code: `mount(h(P.ErrorState, { message: 'We couldn’t load your bills. Check your connection and try again.', onRetry: noop }));`,
  },
  {
    name: 'Toast', group: 'Feedback', height: 252,
    code: `var items = [['success', 'Address verified'], ['error', 'Couldn’t save your changes. Try again.'], ['info', 'Link copied'], ['warning', 'You’re offline. Changes sync when you reconnect.']];
mount(h('div', { className: 'flex flex-col gap-2 items-start' }, items.map(function (t, i) {
  return h(P.Toast, { key: i, toast: { id: i, variant: t[0], message: t[1], duration: 1000000000 }, onDismiss: noop });
})));`,
  },
  {
    name: 'ShimmerLine', group: 'Feedback', height: 100,
    code: `mount(h('div', { className: 'flex flex-col gap-2.5' }, h(P.ShimmerLine, { width: 'w-48' }), h(P.ShimmerLine, { width: 'w-72' }), h(P.ShimmerLine, { width: 'w-32' })));`,
  },
  {
    name: 'ShimmerBlock', group: 'Feedback', height: 151,
    code: `mount(h('div', { className: 'max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-sm p-4' },
  h('div', { className: 'flex items-center gap-3 mb-3' }, h(P.ShimmerBlock, { className: 'w-[34px] h-[34px] rounded-[9px]' }), h(P.ShimmerBlock, { className: 'h-4 w-32' })),
  h('div', { className: 'flex flex-col gap-2.5 pt-0.5' }, h(P.ShimmerBlock, { className: 'h-[15px] w-3/5' }), h(P.ShimmerBlock, { className: 'h-3 w-5/6' }))
));`,
  },

  // ── Overlays ─────────────────────────────────────────────────
  {
    name: 'BottomSheet', group: 'Overlays', height: 440,
    code: `var reasons = ['It’s spam or a scam', 'It’s in the wrong neighborhood', 'It shares someone’s private address', 'Something else'];
mount(h(P.BottomSheet, {
  open: true, onClose: noop, title: 'Report this post', subhead: 'We review every report within a day.',
  footer: h('div', { className: 'flex justify-end gap-2' }, h(P.Button, { variant: 'ghost' }, 'Cancel'), h(P.Button, { variant: 'danger' }, 'Send report'))
}, h('div', { className: 'flex flex-col' }, reasons.map(function (r, i) {
  return h('label', { key: i, className: 'flex items-center gap-3 py-2.5 text-sm text-app-text' }, h('input', { type: 'radio', name: 'reason', defaultChecked: i === 2 }), r);
}))));`,
  },
  {
    name: 'ModalShell', group: 'Overlays', height: 440,
    code: `mount(h(P.ModalShell, {
  open: true, onClose: noop, onCancel: noop, onSubmit: noop,
  icon: I.Mail, iconColor: 'var(--color-success)', iconBgColor: 'var(--color-success-bg)',
  title: 'Mail a verification code', subtitle: 'A postcard arrives in 3 to 7 days.', cancelLabel: 'Go back',
  submitLabel: 'Send postcard', submitIcon: I.Mail
}, h('div', { className: 'rounded-xl bg-app-surface-sunken p-3 text-sm text-app-text' },
  h('div', { className: 'font-semibold' }, 'Rosa Chen'),
  h('div', { className: 'text-app-text-secondary' }, '${HOME_ADDRESS}')
)));`,
  },
  {
    name: 'PlaceSwitcher', group: 'Overlays', height: 440,
    code: `mount(h(P.PlaceSwitcher, {
  open: true, onClose: noop, onPick: noop, onAddPlace: noop, activeId: 'oak',
  homes: [
    { id: 'oak', line1: '1421 SE Oak St', city: 'Portland, OR', status: 'verified' },
    { id: 'third', line1: '2718 NE 3rd Ave', city: 'Camas, WA', status: 'claimed' }
  ]
}));`,
  },
];
