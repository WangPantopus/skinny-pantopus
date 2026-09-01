// Row-rendering primitives shared by all 12 screens. Mirrors the
// `RowModel` / `RowLeading` / `RowTrailing` shapes that the iOS and
// Android `ListOfRows` shells render.

import { P, icon } from './lib.mjs';

// 40pt circular icon disk.
export function typeIconLeading({ name, bg, fg }) {
  return `<div style="width:40px;height:40px;border-radius:20px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(name, { size: 20, color: fg })}</div>`;
}

// 40pt categorical icon with linear gradient — Gigs/My bids/My tasks/Offers.
export function categoryGradientLeading({ name, from, to }) {
  return `<div style="width:40px;height:40px;border-radius:20px;background:linear-gradient(135deg,${from},${to});display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${P.surface}">${icon(name, { size: 20, color: '#fff' })}</div>`;
}

// 44pt avatar with optional verified badge overlay — Connections, Discover hub People section.
export function avatarLeading({ name, tone = 'personal', verified = false, size = 44 }) {
  const tones = {
    personal: [P.personal, '#3b82f6'],
    business: [P.business, '#c084fc'],
    home: [P.home, '#22c55e'],
    warning: [P.warning, '#fbbf24'],
    rose: [P.rose, '#fb7185'],
    violet: [P.violet, '#a78bfa'],
    teal: [P.teal, '#5eead4'],
    amber: [P.amber, '#fbbf24'],
  };
  const [a, b] = tones[tone] || tones.personal;
  const initials = name.split(/\s+/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
  const badge = verified
    ? `<div style="position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:8px;background:${P.home};border:2px solid ${P.surface};display:flex;align-items:center;justify-content:center;color:${P.surface}">${icon('check', { size: 9, color: '#fff', stroke: 3 })}</div>`
    : '';
  return `
    <div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0">
      <div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:linear-gradient(135deg,${a},${b});color:${P.surface};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.36)}px;font-weight:600">${initials}</div>
      ${badge}
    </div>`;
}

// 22pt overlapping avatars + "+N" overflow tile — My tasks V2 bidder stack.
export function bidderStackLeading({ bidders, overflow = 0 }) {
  const tones = {
    violet: [P.violet, '#a78bfa'],
    amber: [P.amber, '#fbbf24'],
    teal: [P.teal, '#5eead4'],
    rose: [P.rose, '#fb7185'],
  };
  const tile = (initials, tone, offset) => {
    const [a, b] = tones[tone] || tones.violet;
    return `<div style="position:absolute;left:${offset}px;width:22px;height:22px;border-radius:11px;background:linear-gradient(135deg,${a},${b});border:2px solid ${P.surface};color:${P.surface};font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center">${initials}</div>`;
  };
  const overflowTile = overflow > 0
    ? `<div style="position:absolute;left:${bidders.length * 16}px;width:22px;height:22px;border-radius:11px;background:${P.slateBg};border:2px solid ${P.surface};color:${P.fg2};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">+${overflow}</div>`
    : '';
  const width = (bidders.length * 16) + 22 + (overflow > 0 ? 6 : 0);
  return `<div style="position:relative;height:22px;width:${width}px;flex-shrink:0;align-self:center">${bidders.map((b, i) => tile(b.initials, b.tone, i * 16)).join('')}${overflowTile}</div>`;
}

// 64pt rounded-square thumbnail — Pets, Listing offers hero.
export function thumbnailLeading({ name = 'image', bg = P.warningBg, fg = P.warning }) {
  return `<div style="width:64px;height:64px;border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(name, { size: 28, color: fg })}</div>`;
}

// Chip (status / category / inline).
export function chip({ text, bg, fg, iconName }) {
  const ic = iconName ? icon(iconName, { size: 11, color: fg, stroke: 2.5 }) : '';
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:${bg};color:${fg};font-size:11px;font-weight:600;line-height:1.2;white-space:nowrap">${ic}${text}</span>`;
}

// Compact button — used in row footers (34pt) and inline actions (28-30pt).
export function compactButton({ label, variant = 'primary', size = 34, iconName }) {
  const styles = {
    primary: { bg: P.primary600, fg: P.surface, bd: 'transparent' },
    ghost:   { bg: P.surface,    fg: P.fg2,     bd: P.border },
    destructive: { bg: P.surface, fg: P.error,  bd: P.border },
  };
  const { bg, fg, bd } = styles[variant] || styles.primary;
  const ic = iconName ? icon(iconName, { size: 14, color: fg, stroke: 2 }) : '';
  return `<button style="height:${size}px;padding:0 12px;border-radius:9px;background:${bg};color:${fg};border:1px solid ${bd};display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:600;font-size:13px;cursor:pointer">${ic}${label}</button>`;
}

// One row "card" — used by every screen.
export function rowCard({
  leading = '',
  title,
  subtitle = '',
  body = '',
  trailing = '',
  chips = [],
  metaTail = '',
  footer = '',
  unread = false,
  highlight = null, // 'leading' / 'unread' / 'muted' / null
  inlineChip = '',
  engagement = null,
  headerChips = [],
  edit = false,
  splitWith = null, // { members: ['J','A'], totalWays: 3 } — T6.0a Bills
}) {
  let bgTint = P.surface;
  let borderColor = P.border;
  let opacity = 1;
  if (highlight === 'unread' || unread) {
    bgTint = P.primary25;
    borderColor = P.personalBg;
  }
  if (highlight === 'leading') {
    bgTint = '#fff7ed'; // amber-50
    borderColor = '#fcd34d'; // amber-300
  }
  if (highlight === 'muted') {
    opacity = 0.78;
  }
  const dot = unread
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${P.primary600};margin-left:8px;flex-shrink:0;align-self:center"></span>`
    : '';
  const headerChipsHtml = headerChips.length
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${headerChips.map(c => chip(c)).join('')}</div>`
    : '';
  const splitTailHtml = splitWith ? splitStackTail(splitWith) : '';
  const chipsHtml = chips.length
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">${chips.map(c => chip(c)).join('')}${metaTail ? `<span style="font-size:11px;color:${P.fg3}">${metaTail}</span>` : ''}${splitTailHtml}</div>`
    : (metaTail || splitTailHtml
        ? `<div style="display:flex;align-items:center;margin-top:6px;font-size:11px;color:${P.fg3}">${metaTail || ''}${splitTailHtml}</div>`
        : '');
  const engagementHtml = engagement
    ? `<div style="display:flex;align-items:center;gap:12px;padding-top:10px;margin-top:10px;border-top:1px solid ${P.borderSubtle};font-size:12px;color:${P.fg3}">
        ${engagement.items.map(it => `<span style="display:inline-flex;align-items:center;gap:4px">${icon(it.icon, { size: 14, color: P.fg3 })}${it.count}</span>`).join('')}
        ${edit ? `<span style="margin-left:auto;color:${P.primary600};font-weight:600;font-size:12px">Edit</span>` : ''}
      </div>`
    : '';
  return `
    <div style="background:${bgTint};border:1px solid ${borderColor};border-radius:14px;padding:12px;margin-bottom:10px;opacity:${opacity}">
      <div style="display:flex;gap:12px;align-items:flex-start">
        ${leading}
        <div style="flex:1;min-width:0">
          ${headerChipsHtml}
          <div style="display:flex;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:${P.fg1};line-height:1.35">${title}${dot}</div>
              ${subtitle ? `<div style="font-size:12px;color:${P.fg3};margin-top:2px">${subtitle}</div>` : ''}
            </div>
            ${inlineChip ? chip(inlineChip) : ''}
          </div>
          ${body ? `<div style="font-size:13px;color:${P.fg2};margin-top:6px;line-height:1.45">${body}</div>` : ''}
          ${chipsHtml}
          ${engagementHtml}
        </div>
        ${trailing}
      </div>
      ${footer}
    </div>`;
}

export function rowFooter(buttons) {
  return `<div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid ${P.borderSubtle}">${buttons.map(b => compactButton({ ...b, size: 34 })).join('')}</div>`;
}

export function chevronTrailing() {
  return `<div style="display:flex;align-items:center;color:${P.fg4};flex-shrink:0">${icon('chevron-right', { size: 18, color: P.fg4 })}</div>`;
}

export function circularActionTrailing({ name = 'message-circle', bg = P.primary50, fg = P.primary600, size = 38 }) {
  return `<button style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${bg};color:${fg};border:none;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;align-self:center;cursor:pointer">${icon(name, { size: 18, color: fg })}</button>`;
}

export function verticalActionsTrailing({ primary, secondary }) {
  return `
    <div style="display:flex;flex-direction:column;gap:6px;align-self:center;flex-shrink:0">
      <button style="height:30px;padding:0 14px;border-radius:8px;background:${P.primary600};color:${P.surface};border:none;font-weight:600;font-size:12px;cursor:pointer">${primary}</button>
      <button style="height:28px;padding:0 14px;border-radius:8px;background:${P.surface};color:${P.fg2};border:1px solid ${P.border};font-weight:600;font-size:12px;cursor:pointer">${secondary}</button>
    </div>`;
}

export function priceStackTrailing({ amount, sublabel = '' }) {
  return `
    <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;align-self:flex-start;gap:2px">
      <div style="font-size:15px;font-weight:700;color:${P.fg1}">${amount}</div>
      ${sublabel ? `<div style="font-size:11px;color:${P.fg3}">${sublabel}</div>` : ''}
    </div>`;
}

export function amountWithChipTrailing({ amount, chipDef }) {
  return `
    <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;align-self:center;gap:4px">
      <div style="font-size:15px;font-weight:700;color:${P.fg1}">${amount}</div>
      ${chip(chipDef)}
    </div>`;
}

export function kebabTrailing() {
  return `<button style="width:36px;height:36px;background:transparent;border:none;color:${P.fg4};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;align-self:flex-start;margin-top:-4px">${icon('more-vertical', { size: 18, color: P.fg4 })}</button>`;
}

// Date separator ("Today" / "Earlier") — Notifications.
export function dateSep(label) {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${P.fg4};margin:14px 4px 8px">${label}</div>`;
}

// Section header with optional count + "See all" — Discover hub.
export function sectionHeader({ title, count, onSeeAll = true }) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 4px 8px">
    <div style="display:flex;align-items:baseline;gap:6px">
      <h2 style="margin:0;font-size:15px;font-weight:700;color:${P.fg1}">${title}</h2>
      ${count != null ? `<span style="font-size:12px;color:${P.fg4}">${count}</span>` : ''}
    </div>
    ${onSeeAll ? `<button style="background:transparent;border:none;color:${P.primary600};font-size:12px;font-weight:600;cursor:pointer">See all</button>` : ''}
  </div>`;
}

export function banner({ title, body, tone = 'info', iconName, cta }) {
  // T6.0a — `iconName` adds a leading icon disc; `cta` adds a trailing
  // tinted pill button. Both optional, additive.
  const tones = {
    info:    { bg: P.primary50,  fg: P.primary700, accent: P.primary600 },
    success: { bg: P.successBg,  fg: P.success,    accent: P.success },
    amber:   { bg: P.warningBg,  fg: P.warning,    accent: P.warning },
    home:    { bg: P.homeBg,     fg: P.home,       accent: P.home },
  };
  const t = tones[tone] || tones.info;
  const iconHtml = iconName
    ? `<div style="width:36px;height:36px;border-radius:9px;background:${P.surface};border:1px solid ${t.bg};color:${t.accent};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px">${icon(iconName, { size: 18, color: t.accent })}</div>`
    : '';
  const ctaHtml = cta
    ? `<button style="padding:7px 12px;border-radius:9px;background:${t.accent};border:none;color:${P.surface};font-size:12px;font-weight:600;flex-shrink:0;margin-left:8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">${cta.iconName ? icon(cta.iconName, { size: 14, color: P.surface }) : ''}${cta.label}</button>`
    : '';
  return `<div style="background:${t.bg};border:1px solid ${t.bg};border-radius:14px;padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:0">
    ${iconHtml}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
      <div style="font-size:13px;font-weight:700;color:${P.fg1}">${title}</div>
      <div style="font-size:12px;color:${P.fg2};opacity:0.85">${body}</div>
    </div>
    ${ctaHtml}
  </div>`;
}

// Right-edge "Split N ways" caption + 18pt overlapping avatars on a row.
// T6.0a additive — used by Bills rows when a bill is split between
// household members. Tones come from the existing palette so future
// consumers (e.g. Household tasks "assigned-to" stacks) can reuse.
export function splitStackTail({ members, totalWays }) {
  const tones = [
    { bg: P.personalBg, fg: P.personal },
    { bg: P.successBg, fg: P.success },
    { bg: P.warningBg, fg: P.warning },
    { bg: P.errorBg, fg: P.error },
  ];
  const visible = members.slice(0, 3);
  const avatars = visible.map((m, i) => {
    const t = tones[i % tones.length];
    return `<div style="width:18px;height:18px;border-radius:9px;background:${t.bg};color:${t.fg};display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;border:1.5px solid ${P.surface};box-sizing:border-box;margin-left:-4px">${m}</div>`;
  }).join('');
  return `<div style="display:inline-flex;align-items:center;gap:6px;margin-left:auto"><span style="font-size:11px;color:${P.fg3};white-space:nowrap">Split ${totalWays} ways</span><div style="display:inline-flex;align-items:center;padding-left:4px">${avatars}</div></div>`;
}

// "X others bid" italic note — Listing offers / Offers.
export function inlineNote(text) {
  return `<div style="margin-top:6px;font-size:12px;font-style:italic;color:${P.fg3};background:${P.sunken};padding:6px 8px;border-radius:6px">${text}</div>`;
}

// Empty state.
export function emptyState({ iconName, headline, body, ctaLabel }) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center">
      <div style="width:56px;height:56px;border-radius:28px;background:${P.primary50};display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:${P.primary600}">${icon(iconName, { size: 28, color: P.primary600 })}</div>
      <div style="font-size:16px;font-weight:600;color:${P.fg1};margin-bottom:6px">${headline}</div>
      <div style="font-size:13px;color:${P.fg3};max-width:280px;line-height:1.5;margin-bottom:16px">${body}</div>
      ${ctaLabel ? `<button style="height:40px;padding:0 18px;border-radius:10px;background:${P.primary600};color:${P.surface};border:none;font-weight:600;font-size:14px;cursor:pointer">${ctaLabel}</button>` : ''}
    </div>`;
}
