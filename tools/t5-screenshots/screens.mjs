// 12 T5 screen body renderers. Each returns an HTML fragment that
// goes inside the platform frame. Mirrors the design package's
// frames-jsx files at `/tmp/moredesignedpages/more-designed-pages/`.

import { P, icon, topBar, tabStrip, chipStrip, searchBar, fab } from './lib.mjs';
import {
  typeIconLeading, categoryGradientLeading, avatarLeading, bidderStackLeading,
  thumbnailLeading, chip, rowCard, rowFooter, chevronTrailing,
  circularActionTrailing, verticalActionsTrailing, priceStackTrailing,
  amountWithChipTrailing, kebabTrailing, dateSep, sectionHeader, banner,
  inlineNote, emptyState,
} from './rows.mjs';

const scrollFrame = (inner, hasFab = false) =>
  `<div style="flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative">
    <div style="flex:1;overflow:hidden;padding:14px 16px ${hasFab ? '96px' : '24px'}">${inner}</div>
  </div>`;

// ─── 1. Notifications ────────────────────────────────────────────
export function notifications() {
  const body = [
    dateSep('Today'),
    rowCard({
      leading: typeIconLeading({ name: 'message-circle', bg: P.personalBg, fg: P.personal }),
      title: 'Maria Kovács replied to your gig',
      body: '"Sounds great — can we move it to Saturday instead of Friday?"',
      chips: [{ text: 'Reply', iconName: 'message-circle', bg: P.personalBg, fg: P.personal }],
      metaTail: '· 12m',
      unread: true,
    }),
    rowCard({
      leading: typeIconLeading({ name: 'at-sign', bg: P.businessBg, fg: P.business }),
      title: 'Jordan Park mentioned you in a post',
      body: '"@you any tips for moving a piano up 3 flights?"',
      chips: [{ text: 'Mention', iconName: 'at-sign', bg: P.businessBg, fg: P.business }],
      metaTail: '· 32m',
      unread: true,
    }),
    rowCard({
      leading: typeIconLeading({ name: 'badge-check', bg: P.successBg, fg: P.success }),
      title: 'Your home claim was approved',
      body: '12 Elm St · approved by Pantopus admin',
      chips: [{ text: 'Claim', iconName: 'badge-check', bg: P.successBg, fg: P.success }],
      metaTail: '· 2h',
      unread: true,
    }),
    rowCard({
      leading: typeIconLeading({ name: 'briefcase', bg: P.warningBg, fg: P.warning }),
      title: 'New bid on "Mount 65″ TV above brick fireplace"',
      body: 'Sam offered $85 · 3 other bids',
      chips: [{ text: 'Gig', iconName: 'briefcase', bg: P.warningBg, fg: P.warning }],
      metaTail: '· 4h',
      unread: true,
    }),
    dateSep('Earlier'),
    rowCard({
      leading: typeIconLeading({ name: 'tag', bg: P.homeBg, fg: P.home }),
      title: '"IKEA Lack table" listing got a new offer',
      body: 'Alex offered $25 (vs $30 asking)',
      chips: [{ text: 'Listing', iconName: 'tag', bg: P.homeBg, fg: P.home }],
      metaTail: '· yesterday',
    }),
    rowCard({
      leading: typeIconLeading({ name: 'shield-alert', bg: P.errorBg, fg: P.error }),
      title: 'Safety check completed for Elm Park',
      body: 'Neighborhood watch reported all clear',
      chips: [{ text: 'Safety', iconName: 'shield-alert', bg: P.errorBg, fg: P.error }],
      metaTail: '· 2d',
    }),
    rowCard({
      leading: typeIconLeading({ name: 'info', bg: P.slateBg, fg: P.slate }),
      title: 'Pantopus is now in your neighborhood',
      body: 'Welcome — claim your home to unlock the full feed',
      chips: [{ text: 'System', iconName: 'info', bg: P.slateBg, fg: P.slate }],
      metaTail: '· 3d',
    }),
  ].join('');
  return [
    topBar({ title: 'Notifications', right: `<button style="font-size:13px;font-weight:600;color:${P.primary600};background:transparent;border:none;cursor:pointer;padding:0 4px">Mark all read</button>` }),
    tabStrip({ tabs: ['All (12)', 'Unread (4)'], active: 0 }),
    scrollFrame(body),
  ].join('');
}

// ─── 2. Bills ────────────────────────────────────────────────────
export function bills() {
  const body = [
    rowCard({
      leading: typeIconLeading({ name: 'receipt', bg: P.primary50, fg: P.primary600 }),
      title: 'ConEd Electric',
      subtitle: 'Due Oct 15 · 12 Elm St',
      trailing: amountWithChipTrailing({ amount: '$142', chipDef: { text: 'Due', bg: P.warningBg, fg: P.warning } }),
    }),
    rowCard({
      leading: typeIconLeading({ name: 'receipt', bg: P.primary50, fg: P.primary600 }),
      title: 'National Grid Gas',
      subtitle: 'Due Oct 22',
      trailing: amountWithChipTrailing({ amount: '$78', chipDef: { text: 'Due', bg: P.warningBg, fg: P.warning } }),
    }),
    rowCard({
      leading: typeIconLeading({ name: 'receipt', bg: P.primary50, fg: P.primary600 }),
      title: 'Verizon Internet',
      subtitle: 'Due Oct 28',
      trailing: amountWithChipTrailing({ amount: '$95', chipDef: { text: 'Scheduled', bg: P.personalBg, fg: P.personal } }),
    }),
    rowCard({
      leading: typeIconLeading({ name: 'receipt', bg: P.primary50, fg: P.primary600 }),
      title: 'Water & Sewer',
      subtitle: 'Was due Oct 1',
      trailing: amountWithChipTrailing({ amount: '$42', chipDef: { text: 'Overdue', bg: P.errorBg, fg: P.error } }),
    }),
  ].join('');
  return [
    topBar({ title: 'Bills' }),
    tabStrip({ tabs: ['Upcoming (4)', 'Paid (12)', 'All (16)'], active: 0 }),
    scrollFrame(body, true),
    fab({ kind: 'secondaryCreate' }),
  ].join('');
}

// ─── 3. Pets ─────────────────────────────────────────────────────
export function pets() {
  const body = [
    rowCard({
      leading: thumbnailLeading({ name: 'paw-print', bg: '#fef3c7', fg: '#92400e' }),
      title: 'Mango',
      inlineChip: { text: 'Dog', bg: P.warningBg, fg: P.warning },
      subtitle: 'Golden Retriever · 3 yr',
      body: 'Loves the back porch. Daily 6pm walk.',
      trailing: kebabTrailing(),
    }),
    rowCard({
      leading: thumbnailLeading({ name: 'cat', bg: P.slateBg, fg: P.slate }),
      title: 'Pepper',
      inlineChip: { text: 'Cat', bg: P.slateBg, fg: P.slate },
      subtitle: 'Tuxedo · 7 yr',
      body: 'Indoor only. Allergic to fish.',
      trailing: kebabTrailing(),
    }),
    rowCard({
      leading: thumbnailLeading({ name: 'paw-print', bg: P.homeBg, fg: P.home }),
      title: 'Biscuit',
      inlineChip: { text: 'Dog', bg: P.warningBg, fg: P.warning },
      subtitle: 'Beagle mix · 2 yr',
      body: 'Friendly with kids and other dogs.',
      trailing: kebabTrailing(),
    }),
  ].join('');
  return [
    topBar({ title: 'Pets' }),
    scrollFrame(body, true),
    fab({ kind: 'secondaryCreate' }),
  ].join('');
}

// ─── 4. Connections ──────────────────────────────────────────────
export function connections() {
  const body = [
    rowCard({
      leading: avatarLeading({ name: 'Maria Kovács', tone: 'personal', verified: true }),
      title: 'Maria Kovács',
      subtitle: 'Elm Park · 0.2 mi',
      body: 'Last chat 2 days ago',
      trailing: circularActionTrailing({ name: 'message-circle' }),
    }),
    rowCard({
      leading: avatarLeading({ name: 'Jordan Park', tone: 'business', verified: true }),
      title: 'Jordan Park',
      subtitle: 'Pinecrest · 0.4 mi',
      body: 'Mutual: 3 connections',
      trailing: circularActionTrailing({ name: 'message-circle' }),
    }),
    rowCard({
      leading: avatarLeading({ name: 'Alex Chen', tone: 'home', verified: false }),
      title: 'Alex Chen',
      subtitle: 'Elm Park · 0.1 mi',
      body: 'Lent you their drill in August',
      trailing: circularActionTrailing({ name: 'message-circle' }),
    }),
    rowCard({
      leading: avatarLeading({ name: 'Sam Reyes', tone: 'warning', verified: true }),
      title: 'Sam Reyes',
      subtitle: 'Pinecrest · 0.5 mi',
      body: 'Helped move couch last weekend',
      trailing: circularActionTrailing({ name: 'message-circle' }),
    }),
  ].join('');
  return [
    topBar({ title: 'Connections' }),
    searchBar({ placeholder: 'Search connections' }),
    tabStrip({ tabs: ['All (24)', 'Neighbors (18)', 'Pending (3)'], active: 0 }),
    scrollFrame(body, true),
    fab({ kind: 'secondaryCreate', iconName: 'user-plus' }),
  ].join('');
}

// ─── 5. Offers (cross-listing) ───────────────────────────────────
export function offers() {
  const body = [
    banner({ title: '5 active offers', body: '2 expire in the next 24 hours', tone: 'info' }),
    rowCard({
      leading: categoryGradientLeading({ name: 'hammer', from: P.amber, to: P.warning }),
      title: 'Mount 65″ TV above brick fireplace',
      subtitle: 'from Sam Reyes · 2h ago',
      trailing: priceStackTrailing({ amount: '$95', sublabel: 'asking $120' }),
      chips: [{ text: 'Top bid', iconName: 'check', bg: P.successBg, fg: P.success }],
      metaTail: '· 1d left',
    }),
    rowCard({
      leading: categoryGradientLeading({ name: 'home', from: P.home, to: '#22c55e' }),
      title: 'Saturday move help — 2hr, a few boxes',
      subtitle: 'from Alex Chen · 4h ago',
      trailing: priceStackTrailing({ amount: '$80/hr', sublabel: 'asking $75/hr' }),
      chips: [{ text: 'Outbid', iconName: 'x', bg: P.errorBg, fg: P.error }],
      metaTail: '· 6h left',
    }),
    rowCard({
      leading: categoryGradientLeading({ name: 'paw-print', from: P.rose, to: '#fb7185' }),
      title: 'Midday dog walks Tue/Thu — shepherd mix',
      subtitle: 'from Jordan Park · yesterday',
      trailing: priceStackTrailing({ amount: '$22', sublabel: 'asking $25' }),
      chips: [{ text: 'Shortlisted', iconName: 'sparkles', bg: P.personalBg, fg: P.personal }],
      metaTail: '· 2d left',
    }),
    rowCard({
      leading: categoryGradientLeading({ name: 'tag', from: P.primary500, to: P.primary700 }),
      title: 'IKEA Lack table (oak, 55×55)',
      subtitle: 'from Riya Patel · 3d ago',
      trailing: priceStackTrailing({ amount: '$25', sublabel: 'asking $30' }),
      chips: [{ text: 'Reviewing bids', iconName: 'inbox', bg: P.personalBg, fg: P.personal }],
      metaTail: '· 4 others bid',
    }),
  ].join('');
  return [
    topBar({
      title: 'Offers',
      right: `<button style="width:36px;height:36px;background:transparent;border:none;color:${P.fg2};display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${icon('sliders-horizontal', { size: 20, color: P.fg2 })}</button>`,
    }),
    tabStrip({ tabs: ['Received (5)', 'Sent (3)'], active: 0 }),
    scrollFrame(body),
  ].join('');
}

// ─── 6. My bids ──────────────────────────────────────────────────
export function myBids() {
  const body = [
    banner({ title: 'Reviewing 5 active bids', body: '2 of them are currently the top bid.', tone: 'info' }),
    rowCard({
      leading: categoryGradientLeading({ name: 'hammer', from: P.amber, to: P.warning }),
      title: 'Mount 65″ TV above brick fireplace · drill anchors included',
      subtitle: 'for Sarah Kowalski · Elm Park · 2d ago',
      trailing: priceStackTrailing({ amount: '$95', sublabel: 'budget $120' }),
      chips: [{ text: 'Top bid', iconName: 'check', bg: P.successBg, fg: P.success }],
      metaTail: '· 3 others bid · 1d left to reply',
      footer: rowFooter([
        { label: 'Withdraw', iconName: 'x', variant: 'destructive' },
        { label: 'Edit bid', iconName: 'check', variant: 'primary' },
      ]),
    }),
    rowCard({
      leading: categoryGradientLeading({ name: 'home', from: P.home, to: '#22c55e' }),
      title: 'Saturday move help, 2 hours, a few boxes + couch',
      subtitle: 'for Alex Chen · Pinecrest · 5h ago',
      trailing: priceStackTrailing({ amount: '$80/hr', sublabel: 'budget $75/hr' }),
      chips: [{ text: 'Outbid', iconName: 'x', bg: P.errorBg, fg: P.error }],
      metaTail: '· 7 others bid · 6h left',
      footer: rowFooter([
        { label: 'Withdraw', iconName: 'x', variant: 'destructive' },
        { label: 'Revise', iconName: 'pen-line', variant: 'primary' },
      ]),
    }),
    rowCard({
      leading: categoryGradientLeading({ name: 'paw-print', from: P.rose, to: '#fb7185' }),
      title: 'Midday dog walks Tue/Thu — friendly shepherd mix',
      subtitle: 'for Jordan Park · Elm Park · yesterday',
      trailing: priceStackTrailing({ amount: '$22 / walk', sublabel: 'budget $25' }),
      chips: [{ text: 'Shortlisted', iconName: 'sparkles', bg: P.personalBg, fg: P.personal }],
      metaTail: '· 2d left',
    }),
  ].join('');
  return [
    topBar({ title: 'My bids' }),
    tabStrip({ tabs: ['Active 5', 'Accepted 2', 'Rejected 3', 'Done 12'], active: 0 }),
    scrollFrame(body, true),
    fab({ kind: 'extendedNav', label: 'Browse tasks', iconName: 'compass' }),
  ].join('');
}

// ─── 7. My tasks V2 ──────────────────────────────────────────────
export function myTasks() {
  const body = [
    banner({ title: '2 tasks need your attention', body: 'Review bids on "Saturday move help" — closes today.', tone: 'amber' }),
    rowCard({
      leading: bidderStackLeading({
        bidders: [
          { initials: 'AR', tone: 'violet' },
          { initials: 'MT', tone: 'amber' },
          { initials: 'JP', tone: 'teal' },
        ],
        overflow: 9,
      }),
      title: 'Saturday move help, 2 hours, a few boxes + couch',
      trailing: priceStackTrailing({ amount: '$80/hr' }),
      chips: [{ text: 'Reviewing bids', iconName: 'inbox', bg: P.personalBg, fg: P.personal }],
      metaTail: '· 12 bids · closes in 6h',
      footer: rowFooter([
        { label: 'Review bids', iconName: 'inbox', variant: 'primary' },
      ]),
    }),
    rowCard({
      leading: bidderStackLeading({
        bidders: [
          { initials: 'SR', tone: 'rose' },
          { initials: 'KP', tone: 'teal' },
        ],
        overflow: 0,
      }),
      title: 'Hang 3 floating shelves in living room',
      trailing: priceStackTrailing({ amount: '$60' }),
      chips: [{ text: 'No bids yet', iconName: 'info', bg: P.slateBg, fg: P.slate }],
      metaTail: '· closes in 2d',
    }),
    rowCard({
      leading: bidderStackLeading({
        bidders: [
          { initials: 'MR', tone: 'violet' },
        ],
        overflow: 0,
      }),
      title: 'Deep clean 2BR before move-out',
      trailing: priceStackTrailing({ amount: '$180' }),
      chips: [{ text: 'Shortlisting', iconName: 'sparkles', bg: P.warningBg, fg: P.warning }],
      metaTail: '· 5 bids · closes Sat',
    }),
  ].join('');
  return [
    topBar({ title: 'My tasks' }),
    tabStrip({ tabs: ['Open 5', 'Active 2', 'Done 8', 'Closed 3'], active: 0 }),
    scrollFrame(body, true),
    fab({ kind: 'canonicalCreate' }),
  ].join('');
}

// ─── 8. My pulse (My posts) ──────────────────────────────────────
export function myPulse() {
  const body = [
    rowCard({
      headerChips: [{ text: 'Ask', iconName: 'sparkle', bg: P.personalBg, fg: P.personal }],
      title: 'Anyone know a good piano mover near Elm Park?',
      body: 'Need to move a baby grand up 3 flights — uprights only need not apply.',
      metaTail: '· 2h ago',
      trailing: kebabTrailing(),
      engagement: { items: [{ icon: 'message-circle', count: 4 }, { icon: 'thumbs-up', count: 12 }] },
      edit: true,
    }),
    rowCard({
      headerChips: [{ text: 'Recommend', iconName: 'thumbs-up', bg: P.homeBg, fg: P.home }],
      title: 'Elm Park Farmers Market — Saturday 9–1',
      body: 'New apple cider stand is excellent. Cash only.',
      metaTail: '· yesterday',
      trailing: kebabTrailing(),
      engagement: { items: [{ icon: 'message-circle', count: 2 }, { icon: 'thumbs-up', count: 8 }] },
      edit: true,
    }),
    rowCard({
      headerChips: [{ text: 'Event', iconName: 'calendar', bg: P.businessBg, fg: P.business }],
      title: 'Block party · Sat Oct 26 · 4–8pm',
      body: 'Pinecrest section. BYO chair + dish. Kids welcome.',
      metaTail: '· 3d ago',
      trailing: kebabTrailing(),
      engagement: { items: [{ icon: 'message-circle', count: 7 }, { icon: 'thumbs-up', count: 22 }] },
      edit: true,
    }),
    rowCard({
      headerChips: [{ text: 'Lost', iconName: 'flag', bg: P.errorBg, fg: P.error }],
      title: 'Lost: silver bracelet near the Elm Park playground',
      body: 'Small charm with "K" engraved. Sentimental value. Reward.',
      metaTail: '· 5d ago',
      trailing: kebabTrailing(),
      engagement: { items: [{ icon: 'message-circle', count: 1 }, { icon: 'thumbs-up', count: 3 }] },
      edit: true,
    }),
  ].join('');
  return [
    topBar({ title: 'My posts' }),
    tabStrip({ tabs: ['Active (4)', 'Archived (11)'], active: 0 }),
    scrollFrame(body, true),
    fab({ kind: 'secondaryCreate', iconName: 'pen-line' }),
  ].join('');
}

// ─── 9. Listing offers (per-listing) ─────────────────────────────
export function listingOffers() {
  const hero = `
    <div style="background:${P.surface};border:1px solid ${P.border};border-radius:14px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center">
      ${thumbnailLeading({ name: 'tag', bg: P.primary50, fg: P.primary600 })}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:${P.fg1}">IKEA Lack side table (oak, 55×55)</div>
        <div style="font-size:12px;color:${P.fg3};margin-top:2px">Asking $30 · listed 3 days ago · 4 offers</div>
      </div>
      <div style="text-align:right;font-size:15px;font-weight:700;color:${P.fg1}">$30</div>
    </div>`;
  const body = [
    hero,
    rowCard({
      leading: avatarLeading({ name: 'Riya Patel', tone: 'violet' }),
      title: 'Riya Patel',
      subtitle: 'Elm Park · 0.4 mi',
      trailing: priceStackTrailing({ amount: '$28', sublabel: '–7% vs ask' }),
      chips: [{ text: 'Top offer', iconName: 'check', bg: P.successBg, fg: P.success }],
      metaTail: '· 1h ago',
      highlight: 'leading',
      footer: rowFooter([
        { label: 'Decline', iconName: 'x', variant: 'destructive' },
        { label: 'Counter', iconName: 'pen-line', variant: 'ghost' },
        { label: 'Accept', iconName: 'check', variant: 'primary' },
      ]),
    }),
    rowCard({
      leading: avatarLeading({ name: 'Marco Bianchi', tone: 'amber' }),
      title: 'Marco Bianchi',
      subtitle: 'Pinecrest · 0.6 mi',
      trailing: priceStackTrailing({ amount: '$25', sublabel: '–17% vs ask' }),
      chips: [{ text: 'Pending', iconName: 'inbox', bg: P.warningBg, fg: P.warning }],
      metaTail: '· 4h ago',
      body: inlineNote('"Can do cash today, I\'m a block away."'),
    }),
    rowCard({
      leading: avatarLeading({ name: 'Alex Chen', tone: 'teal' }),
      title: 'Alex Chen',
      subtitle: 'Elm Park · 0.1 mi',
      trailing: priceStackTrailing({ amount: '$20', sublabel: '–33% vs ask' }),
      chips: [{ text: 'Countered', iconName: 'pen-line', bg: P.personalBg, fg: P.personal }],
      metaTail: '· yesterday · your counter $26',
    }),
  ].join('');
  return [
    topBar({ title: 'Offers · Lack table' }),
    scrollFrame(body),
  ].join('');
}

// ─── 10. Discover hub ───────────────────────────────────────────
export function discoverHub() {
  const peopleSection = `
    ${sectionHeader({ title: 'People', count: 18, onSeeAll: true })}
    <div style="background:${P.surface};border:1px solid ${P.border};border-radius:14px;overflow:hidden;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid ${P.borderSubtle}">
        ${avatarLeading({ name: 'Maria Kovács', tone: 'personal', verified: true, size: 36 })}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${P.fg1}">Maria Kovács</div>
          <div style="font-size:11px;color:${P.fg3}">Elm Park · 0.2 mi</div>
        </div>
        ${icon('chevron-right', { size: 16, color: P.fg4 })}
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid ${P.borderSubtle}">
        ${avatarLeading({ name: 'Jordan Park', tone: 'business', verified: true, size: 36 })}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${P.fg1}">Jordan Park</div>
          <div style="font-size:11px;color:${P.fg3}">Pinecrest · 0.4 mi</div>
        </div>
        ${icon('chevron-right', { size: 16, color: P.fg4 })}
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px">
        ${avatarLeading({ name: 'Alex Chen', tone: 'home', verified: false, size: 36 })}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${P.fg1}">Alex Chen</div>
          <div style="font-size:11px;color:${P.fg3}">Elm Park · 0.1 mi</div>
        </div>
        ${icon('chevron-right', { size: 16, color: P.fg4 })}
      </div>
    </div>`;
  const businessSection = `
    ${sectionHeader({ title: 'Businesses', count: 12, onSeeAll: true })}
    <div style="background:${P.surface};border:1px solid ${P.border};border-radius:14px;overflow:hidden;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid ${P.borderSubtle}">
        ${categoryGradientLeading({ name: 'hammer', from: P.amber, to: P.warning })}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${P.fg1}">Elm Handyman Co.</div>
          <div style="font-size:11px;color:${P.fg3}">Handyman · ★ 4.8 · 0.3 mi</div>
        </div>
        ${icon('chevron-right', { size: 16, color: P.fg4 })}
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px">
        ${categoryGradientLeading({ name: 'paw-print', from: P.rose, to: '#fb7185' })}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${P.fg1}">Pinecrest Pet Sitters</div>
          <div style="font-size:11px;color:${P.fg3}">Pet care · ★ 4.9 · 0.5 mi</div>
        </div>
        ${icon('chevron-right', { size: 16, color: P.fg4 })}
      </div>
    </div>`;
  const gigsSection = `
    ${sectionHeader({ title: 'Gigs', count: 8, onSeeAll: true })}
    <div style="background:${P.surface};border:1px solid ${P.border};border-radius:14px;overflow:hidden;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px">
        ${categoryGradientLeading({ name: 'home', from: P.home, to: '#22c55e' })}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${P.fg1}">Saturday move help · 2hr</div>
          <div style="font-size:11px;color:${P.fg3}">Elm Park · 0.2 mi</div>
        </div>
        ${priceStackTrailing({ amount: '$80/hr' })}
      </div>
    </div>`;
  const body = [peopleSection, businessSection, gigsSection].join('');
  return [
    topBar({ title: 'Discover' }),
    chipStrip({ chips: ['All', 'People', 'Businesses', 'Gigs', 'Listings'], active: 0 }),
    scrollFrame(body),
  ].join('');
}

// ─── 11. Discover businesses ─────────────────────────────────────
export function discoverBusinesses() {
  const cat = (title, items) => `
    ${sectionHeader({ title, count: items.length, onSeeAll: true })}
    <div style="background:${P.surface};border:1px solid ${P.border};border-radius:14px;overflow:hidden;margin-bottom:12px">
      ${items.map((it, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;${i < items.length - 1 ? `border-bottom:1px solid ${P.borderSubtle}` : ''}">
          ${categoryGradientLeading({ name: it.icon, from: it.from, to: it.to })}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:${P.fg1}">${it.name}</div>
            <div style="font-size:11px;color:${P.fg3}">${it.meta}</div>
          </div>
          ${icon('chevron-right', { size: 16, color: P.fg4 })}
        </div>`).join('')}
    </div>`;
  const body = [
    cat('Handyman', [
      { name: 'Elm Handyman Co.', icon: 'hammer', from: P.amber, to: P.warning, meta: '★ 4.8 · 0.3 mi' },
      { name: 'Pinecrest Repair', icon: 'hammer', from: P.amber, to: P.warning, meta: '★ 4.6 · 0.7 mi' },
    ]),
    cat('Cleaning', [
      { name: 'Sparkle Clean', icon: 'sparkles', from: P.primary500, to: P.primary700, meta: '★ 4.9 · 0.5 mi' },
    ]),
    cat('Pet care', [
      { name: 'Pinecrest Pet Sitters', icon: 'paw-print', from: P.rose, to: '#fb7185', meta: '★ 4.9 · 0.5 mi' },
      { name: 'Elm Park Vet', icon: 'paw-print', from: P.rose, to: '#fb7185', meta: '★ 4.7 · 0.4 mi' },
    ]),
  ].join('');
  return [
    topBar({
      title: 'Discover businesses',
      right: `<button style="width:36px;height:36px;background:transparent;border:none;color:${P.fg2};display:inline-flex;align-items:center;justify-content:center;cursor:pointer">${icon('sliders-horizontal', { size: 20, color: P.fg2 })}</button>`,
    }),
    searchBar({ placeholder: 'Search nearby businesses' }),
    chipStrip({ chips: ['All', 'Handyman', 'Cleaning', 'Pet care', 'Tech', 'Tutoring', 'Child care', 'Moving', 'Other'], active: 0 }),
    scrollFrame(body),
  ].join('');
}

// ─── 12. Review claims (web only — placeholder mobile shot too) ──
export function reviewClaims() {
  const body = [
    banner({ title: 'Admin queue · 4 pending', body: 'Approve, reject, or request more evidence.', tone: 'amber' }),
    rowCard({
      leading: avatarLeading({ name: 'Riya Patel', tone: 'violet' }),
      title: 'Riya Patel',
      subtitle: '12 Elm St · primary residence',
      chips: [
        { text: 'Pending', bg: P.warningBg, fg: P.warning },
        { text: '3 attachments', bg: P.slateBg, fg: P.slate, iconName: 'file-text' },
      ],
      metaTail: '· filed 2d ago',
      footer: rowFooter([{ label: 'Review claim', iconName: 'check', variant: 'primary' }]),
    }),
    rowCard({
      leading: avatarLeading({ name: 'Sam Reyes', tone: 'amber' }),
      title: 'Sam Reyes',
      subtitle: '88 Pinecrest Ln · primary residence',
      chips: [
        { text: 'Pending', bg: P.warningBg, fg: P.warning },
        { text: '5 attachments', bg: P.slateBg, fg: P.slate, iconName: 'file-text' },
      ],
      metaTail: '· filed 5h ago',
      footer: rowFooter([{ label: 'Review claim', iconName: 'check', variant: 'primary' }]),
    }),
  ].join('');
  return [
    topBar({ title: 'Review claims' }),
    tabStrip({ tabs: ['Pending (4)', 'Approved (38)', 'Rejected (3)'], active: 0 }),
    scrollFrame(body),
  ].join('');
}

export const ALL_SCREENS = {
  notifications: { title: 'Notifications', body: notifications, caption: 'Tabbed list with status chips, primary-tinted unread tint with `primary25` background + `personalBg` border. iOS / Android / web all render the same row geometry; web "Mark all read" is a text button vs the mobile right-slot icon-text — intentional per F8.' },
  bills: { title: 'Bills', body: bills, caption: '4 status chips (Due / Paid / Overdue / Scheduled), 52pt secondaryCreate FAB, `amountWithChip` trailing variant (T5.0 additive). Web mirrors mobile geometry; no platform-specific divergence.' },
  pets: { title: 'Pets', body: pets, caption: '64pt rounded-square thumbnail leading (T5.0 additive `RowLeading.Thumbnail.Large`). 52pt secondaryCreate FAB. iOS + Android ship a 3-step Add wizard; web keeps a single-page modal (intentional — fewer screens on web).' },
  connections: { title: 'Connections', body: connections, caption: '44pt avatar + verified badge overlay, 38pt circular message CTA, 52pt secondaryCreate FAB ("user-plus"). Pending tab swaps the circular action for a vertical Accept (30pt primary) / Ignore (28pt ghost) stack — same archetype, different `RowTrailing`.' },
  offers: { title: 'Offers (cross-listing)', body: offers, caption: '2 tabs (Received / Sent), `priceStack` trailing with "asking $X" sub-label, 8-state status derivation, top-bar filter icon. No FAB. Web is the same shell — Offers V2 web reskin was rebuilt on `<ListOfRowsShell />` in T5.2.4.' },
  myBids: { title: 'My bids', body: myBids, caption: '4 tabs (Active/Accepted/Rejected/Done), 11-variant status chip, per-tab row footer with 34pt `CompactButton.footer`, `BannerConfig` summary, 48pt `extendedNav` "Browse tasks" pill FAB (not a create action — F1).' },
  myTasks: { title: 'My tasks V2', body: myTasks, caption: '4 tabs (Open/Active/Done/Closed), inline `BidderStack` leading (22pt overlapping avatars with `+N` overflow tile — T5.0 additive). 9-variant status chip, per-status footer, 56pt canonicalCreate FAB (the largest variant per F1).' },
  myPulse: { title: 'My posts', body: myPulse, caption: 'Shape C6: no leading; intent chip in `headerChips`; primary-emphasis body; engagement strip with comment + thumbs-up counts and an inline "Edit" affordance. 2 tabs (Active / Archived), 52pt secondaryCreate FAB ("pen-line"). Archive / Restore are local-only optimistic — backend route lands in T6.' },
  listingOffers: { title: 'Listing offers (per-listing)', body: listingOffers, caption: 'No tabs / no FAB. `ListingContextConfig` hero card (additive shell slot). `priceStack` with "–7% vs ask" delta, 7-state status chip, optional "Your counter $X" pill + italic quote note, `RowHighlight.leading` amber LEADING badge on the top pending offer.' },
  discoverHub: { title: 'Discover hub', body: discoverHub, caption: '4-chip filter strip, 4 typed `SectionStyle.card` sections in design-spec order (People · Businesses · Gigs · Listings), per-section `count` + "See all" CTA, mixed leading (avatarWithBadge / categoryGradientIcon / thumbnail), `priceStack` trailing on Gigs and Listings.' },
  discoverBusinesses: { title: 'Discover businesses', body: discoverBusinesses, caption: '9-chip category filter strip, search bar slot, category-grouped `RowSection.card` in chip order when "All" / single section when filtered, 40pt categoryGradientIcon + chevron. Two deliberate divergences from buildout-plan verification: no FAB, top-bar filter icon vs "search" — documented in T5-summary.' },
  reviewClaims: { title: 'Review claims (web only)', body: reviewClaims, caption: 'Web-only screen — mobile deferred per F9 + §1.8 (no admin tier on iOS / Android today). 3 tabs (Pending / Approved / Rejected), banner above Pending, Shape C row with paperclip evidence chip + 34pt review-claim footer. Mobile shots render the same design as a contract reference.' },
};
