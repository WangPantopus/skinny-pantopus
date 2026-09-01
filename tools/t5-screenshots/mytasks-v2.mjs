// T6.0b My tasks V2 — Magic Task re-skin design-reference snapshot.
// Outputs three per-platform PNGs at docs/screenshots/mytasks-v2-*.png.
// Each PNG shows both design frames side-by-side: populated (Open tab
// with 5 tasks) + empty (Magic Task primary CTA + 3 quick prompts).
//
// Mirrors `A08 — per-screen batch 1/mytasks-frames.jsx` verbatim:
// Magic Task gradient leading tile (44pt + sparkles disc clipped over
// the top-right corner), uppercase archetype overline (10pt magic-
// violet), engagement-mode badge (neutral-tinted chip after the
// status chip), 60pt Magic Task FAB (primary600 → primary700 gradient
// with sparkles disc overlay), reframed empty state.
//
// Run: `node tools/t5-screenshots/mytasks-v2.mjs`

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

import {
  P, frame, htmlDoc, topBar, tabStrip, icon, statusBar, androidStatusBar,
} from './lib.mjs';

const REPO = '/home/user/pantopus';
const PARITY_DIR = `${REPO}/docs/screenshots`;

// Each PNG holds two 390-wide frames side by side + padding.
const VIEWPORTS = {
  ios:     { width: 880, height: 940, deviceScaleFactor: 1 },
  android: { width: 880, height: 940, deviceScaleFactor: 1 },
  web:     { width: 880, height: 940, deviceScaleFactor: 1 },
};

// Magic Task lavender quartet — mirrors @pantopus/theme tokens.
const MAGIC = {
  magic: '#6d28d9',
  magicBg: '#ede9fe',
  magicBgSoft: '#f5f3ff',
  magicBorder: '#ddd6fe',
};

// Status palette from the design's STATUS map.
const STATUS = {
  reviewing:   { label: 'Reviewing bids',   bg: P.personalBg, fg: P.personal, icon: 'inbox' },
  urgent:      { label: 'Closes in 4h',     bg: P.errorBg,    fg: P.error,    icon: 'clock' },
  nobids:      { label: 'No bids yet',      bg: P.sunken,     fg: P.fg3,      icon: 'alert-circle' },
};

// Engagement-mode palette (T6.0b). Neutral-tinted chip with mode icon.
const MODE = {
  in_person: { label: 'In person', icon: 'map-pin' },
  drop_off:  { label: 'Drop-off',  icon: 'package' },
  remote:    { label: 'Remote',    icon: 'monitor' },
  hybrid:    { label: 'Hybrid',    icon: 'shuffle' },
};

// Additional icons not in lib.mjs that we need for the archetype tiles
// and the empty-state quick prompts. Inlined here so the harness has no
// new external deps. Same 24x24 stroke style as the lib's ICONS.
const EXTRA_ICONS = {
  tv: '<rect width="20" height="15" x="2" y="3" rx="2" ry="2"/><polyline points="8 21 12 17 16 21"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  dog: '<path d="M11.25 16.25h1.5L12 17z"/><path d="M16 14v.5"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/><path d="M8 14v.5"/><path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/>',
  hammer: '<path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  'circle-slash': '<circle cx="12" cy="12" r="10"/><line x1="22" x2="2" y1="2" y2="22"/>',
};

function extraIcon(name, opts = {}) {
  const { size = 18, color = 'currentColor', stroke = 2, fill = 'none' } = opts;
  const body = EXTRA_ICONS[name];
  if (!body) {
    // Fall back to lib's icon set for shared glyphs (sparkles, plus, …).
    return icon(name, opts);
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${body}</svg>`;
}

function archetypeTile({ iconName, gradientCss }) {
  return `
    <div style="position:relative;width:44px;height:44px;flex-shrink:0">
      <div style="width:44px;height:44px;border-radius:11px;background:${gradientCss};color:#fff;display:flex;align-items:center;justify-content:center">
        ${extraIcon(iconName, { size: 22, color: '#fff', stroke: 1.7 })}
      </div>
      <div style="position:absolute;top:-3px;right:-3px;width:18px;height:18px;border-radius:50%;background:#fff;border:1.5px solid ${MAGIC.magicBorder};color:${MAGIC.magic};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(17,24,39,0.08)">
        ${icon('sparkles', { size: 10, color: MAGIC.magic, stroke: 2.4 })}
      </div>
    </div>`;
}

function categoryTile({ iconName, gradientCss }) {
  return `
    <div style="width:40px;height:40px;border-radius:8px;background:${gradientCss};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
      ${extraIcon(iconName, { size: 20, color: '#fff', stroke: 2 })}
    </div>`;
}

function bidderStack({ bidders, overflow }) {
  const tones = {
    sky:    { bg: '#bae6fd', fg: '#075985' },
    teal:   { bg: '#a7f3d0', fg: '#065f46' },
    amber:  { bg: '#fde68a', fg: '#92400e' },
    rose:   { bg: '#fecdd3', fg: '#9f1239' },
    violet: { bg: '#ddd6fe', fg: '#5b21b6' },
  };
  const avatars = bidders.map((b, i) => {
    const t = tones[b.tone] || tones.sky;
    const ml = i === 0 ? 0 : -8;
    return `<div style="margin-left:${ml}px;width:22px;height:22px;border-radius:50%;background:${t.bg};color:${t.fg};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;letter-spacing:0.2px;border:2px solid #fff;box-sizing:border-box;flex-shrink:0">${b.initials}</div>`;
  }).join('');
  const overflowTile = overflow > 0
    ? `<div style="margin-left:-8px;width:22px;height:22px;border-radius:50%;background:${P.sunken};color:${P.fg2};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid #fff;box-sizing:border-box">+${overflow}</div>`
    : '';
  return `<div style="display:flex;align-items:center">${avatars}${overflowTile}</div>`;
}

function statusChip({ kind }) {
  const s = STATUS[kind];
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:10px;font-weight:600;white-space:nowrap">${icon(s.icon, { size: 10, color: s.fg })}${s.label}</span>`;
}

function modeBadge({ mode }) {
  const m = MODE[mode];
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px 3px 6px;border-radius:6px;background:${P.surface};border:1px solid ${P.border};color:${P.fg2};font-size:10px;font-weight:600;white-space:nowrap">${extraIcon(m.icon, { size: 10, color: P.fg2 })}${m.label}</span>`;
}

function rowActions(html) {
  return `<div style="display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid ${P.border}">${html}</div>`;
}

function ghostBtn({ iconName, label, flex = 1 }) {
  return `<button style="flex:${flex};height:34px;border-radius:9px;padding:0 12px;background:${P.surface};color:${P.fg2};border:1px solid ${P.border};font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:5px">${extraIcon(iconName, { size: 13, color: P.fg2 })}${label}</button>`;
}

function primaryBtn({ iconName, label, flex = 1 }) {
  return `<button style="flex:${flex};height:34px;border-radius:9px;padding:0 12px;background:${P.primary600};color:#fff;border:none;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:5px;box-shadow:0 2px 4px rgba(2,132,199,0.2)">${extraIcon(iconName, { size: 13, color: '#fff' })}${label}</button>`;
}

function taskRow({
  archetype, // { overline, iconName, gradientCss }
  title, budgetLabel,
  postedMeta,
  bidders, overflow,
  status, mode,
  actions,
  isMagic = true,
}) {
  const leading = isMagic
    ? archetypeTile({ iconName: archetype.iconName, gradientCss: archetype.gradientCss })
    : categoryTile({ iconName: archetype.iconName, gradientCss: archetype.gradientCss });
  const overline = isMagic
    ? `<div style="font-size:9.5px;font-weight:700;color:${MAGIC.magic};letter-spacing:0.06em;text-transform:uppercase;margin-bottom:2px;display:inline-flex;align-items:center;gap:4px">${archetype.overline.toUpperCase()}</div>`
    : '';
  const stack = bidders && bidders.length
    ? `<div style="margin-right:2px">${bidderStack({ bidders, overflow: overflow || 0 })}</div>`
    : '';
  const modeBadgeHtml = mode ? modeBadge({ mode }) : '';
  return `
    <div style="background:${P.surface};border:1px solid ${P.border};border-radius:16px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:10px">
      <div style="display:flex;align-items:flex-start;gap:12px">
        ${leading}
        <div style="flex:1;min-width:0">
          ${overline}
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px">
            <span style="flex:1;min-width:0;font-size:13.5px;font-weight:600;color:${P.fg1};letter-spacing:-0.1px;line-height:18px">${title}</span>
            <span style="font-size:15px;font-weight:700;color:${P.fg1};letter-spacing:-0.3px;flex-shrink:0;line-height:18px">${budgetLabel}</span>
          </div>
          <div style="font-size:11.5px;color:${P.fg3};margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${postedMeta}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${stack}
            ${statusChip({ kind: status })}
            ${modeBadgeHtml}
          </div>
        </div>
      </div>
      ${actions || ''}
    </div>`;
}

// 60pt Magic Task FAB. Gradient + sparkles disc overlay.
function magicFab() {
  return `
    <div style="position:absolute;right:16px;bottom:24px;z-index:5">
      <button style="position:relative;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,${P.primary600} 0%,${P.primary700} 100%);color:#fff;border:none;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(2,132,199,0.42),0 2px 4px rgba(2,132,199,0.2);cursor:pointer">
        ${icon('plus', { size: 22, color: '#fff', stroke: 2.4 })}
        <span style="position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;color:${MAGIC.magic}">
          ${icon('sparkles', { size: 11, color: MAGIC.magic, stroke: 2.6 })}
        </span>
      </button>
    </div>`;
}

function populatedBody() {
  const banner = `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:12px;background:${P.primary50};border:1px solid ${P.primary100};border-radius:12px">
      <div style="width:32px;height:32px;border-radius:8px;background:#fff;color:${P.primary600};display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ${P.primary100}">${icon('inbox', { size: 16, color: P.primary600 })}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:${P.fg1}">9 new bids since yesterday</div>
        <div style="font-size:11px;color:${P.fg3};margin-top:1px"><span style="color:${P.error};font-weight:600">1</span> task closing in the next 24h</div>
      </div>
    </div>`;

  const rows = [
    taskRow({
      archetype: {
        overline: 'Mount & install',
        iconName: 'tv',
        gradientCss: 'linear-gradient(135deg,#60a5fa,#1d4ed8)',
      },
      title: 'Mount 65″ TV above brick fireplace · drill anchors needed',
      budgetLabel: '$120',
      postedMeta: 'Posted 2d ago · <span style="color:#374151;font-weight:500">12 bids</span> · $65 – $145',
      bidders: [
        { initials: 'AR', tone: 'violet' },
        { initials: 'MT', tone: 'amber' },
        { initials: 'JP', tone: 'teal' },
      ],
      overflow: 9,
      status: 'reviewing',
      mode: 'in_person',
      actions: rowActions(
        ghostBtn({ iconName: 'pencil', label: 'Edit', flex: 1 }) +
        primaryBtn({ iconName: 'inbox', label: 'Review 12 bids', flex: 2 }),
      ),
    }),
    taskRow({
      archetype: {
        overline: 'Moving help',
        iconName: 'package',
        gradientCss: 'linear-gradient(135deg,#a78bfa,#6d28d9)',
      },
      title: 'Saturday move help, 2 hours, a few boxes + couch',
      budgetLabel: '$80/hr',
      postedMeta: 'Posted 3d ago · <span style="color:#374151;font-weight:500">7 bids</span> · $50 – $90/hr',
      bidders: [
        { initials: 'IB', tone: 'rose' },
        { initials: 'LP', tone: 'sky' },
        { initials: 'CR', tone: 'amber' },
      ],
      overflow: 4,
      status: 'urgent',
      mode: 'in_person',
      actions: rowActions(
        ghostBtn({ iconName: 'clock', label: 'Extend 24h', flex: 1 }) +
        primaryBtn({ iconName: 'inbox', label: 'Review 7 bids', flex: 2 }),
      ),
    }),
    taskRow({
      archetype: {
        overline: 'Pet care',
        iconName: 'dog',
        gradientCss: 'linear-gradient(135deg,#4ade80,#15803d)',
      },
      title: 'Dog walking 3×/week for Bowie (sweet Aussie mix)',
      budgetLabel: '$25',
      postedMeta: 'Posted 1d ago · <span style="color:#374151;font-weight:500">5 bids</span> · $18 – $28',
      bidders: [
        { initials: 'KN', tone: 'teal' },
        { initials: 'EM', tone: 'violet' },
        { initials: 'SH', tone: 'amber' },
      ],
      overflow: 2,
      status: 'reviewing',
      mode: 'in_person',
      actions: rowActions(
        ghostBtn({ iconName: 'pencil', label: 'Edit', flex: 1 }) +
        primaryBtn({ iconName: 'inbox', label: 'Review 5 bids', flex: 2 }),
      ),
    }),
    taskRow({
      archetype: {
        overline: 'Tech support',
        iconName: 'laptop',
        gradientCss: 'linear-gradient(135deg,#22d3ee,#0e7490)',
      },
      title: 'Help migrating photos from old iMac to new MacBook',
      budgetLabel: '$60',
      postedMeta: 'Posted 6h ago · <span style="color:#374151;font-weight:500">3 bids</span> · $40 – $75',
      bidders: [
        { initials: 'HM', tone: 'sky' },
        { initials: 'DT', tone: 'rose' },
        { initials: 'YC', tone: 'sky' },
      ],
      overflow: 0,
      status: 'reviewing',
      mode: 'remote',
      actions: rowActions(
        ghostBtn({ iconName: 'pencil', label: 'Edit', flex: 1 }) +
        primaryBtn({ iconName: 'inbox', label: 'Review 3 bids', flex: 2 }),
      ),
    }),
    taskRow({
      archetype: {
        overline: 'Furniture assembly',
        iconName: 'hammer',
        gradientCss: 'linear-gradient(135deg,#f59e0b,#b45309)',
      },
      title: 'Assemble IKEA Billy bookcase (parts + tools here)',
      budgetLabel: '$60',
      postedMeta: 'Posted 4d ago · 0 bids',
      bidders: [],
      overflow: 0,
      status: 'nobids',
      mode: 'in_person',
      actions: rowActions(
        ghostBtn({ iconName: 'pencil', label: 'Edit details', flex: 1 }) +
        primaryBtn({ iconName: 'rocket', label: 'Boost in feed', flex: 1 }),
      ),
    }),
  ].join('');

  const scrollInner =
    `<div style="flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative">
      <div style="flex:1;overflow:hidden;padding:14px 16px 96px">${banner}${rows}</div>
    </div>`;

  const filterIcon = `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:${P.fg1}">${icon('sliders-horizontal', { size: 20, color: P.fg1 })}</div>`;
  return [
    topBar({ title: 'My tasks', right: filterIcon }),
    tabStrip({ tabs: ['Open (5)', 'Active (2)', 'Done (8)', 'Closed (3)'], active: 0 }),
    scrollInner,
    magicFab(),
  ].join('');
}

function emptyBody() {
  const quickPrompts = [
    'Mount a TV above my fireplace this weekend',
    'Walk my dog Tue / Thu mornings',
    'Help me move a couch on Saturday',
  ];
  const promptButtons = quickPrompts.map((q) => `
    <button style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:${P.surface};border:1px solid ${P.border};color:${P.fg2};font-size:12.5px;font-weight:500;text-align:left;box-shadow:0 1px 2px rgba(0,0,0,0.03);width:100%">
      ${icon('sparkles', { size: 13, color: MAGIC.magic, stroke: 2.2 })}
      <span style="flex:1;min-width:0">${q}</span>
      ${icon('arrow-up-right', { size: 13, color: P.fg4, stroke: 2 })}
    </button>`).join('');

  const illustration = `
    <div style="position:relative;width:96px;height:96px;margin-bottom:22px">
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 30%,${MAGIC.magicBgSoft} 0%,${MAGIC.magicBg} 100%)"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:${MAGIC.magic}">
        ${extraIcon('clipboard-list', { size: 38, color: MAGIC.magic, stroke: 1.7 })}
      </div>
      <div style="position:absolute;bottom:2px;right:2px;width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid ${MAGIC.magicBorder};color:${MAGIC.magic};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(109,40,217,0.18)">
        ${icon('sparkles', { size: 16, color: MAGIC.magic, stroke: 2.4 })}
      </div>
    </div>`;

  const tryBtn = `
    <button style="display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:12px;background:linear-gradient(135deg,${P.primary600} 0%,${P.primary700} 100%);color:#fff;border:none;font-size:14px;font-weight:600;box-shadow:0 6px 16px rgba(2,132,199,0.32);margin-bottom:10px">
      ${icon('sparkles', { size: 16, color: '#fff', stroke: 2.4 })}
      Try Magic Task
    </button>`;

  const inner = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 28px 80px;text-align:center">
      ${illustration}
      <div style="font-size:20px;font-weight:600;color:${P.fg1};letter-spacing:-0.3px;margin-bottom:8px;line-height:26px">
        No tasks posted yet —<br/>try Magic Task
      </div>
      <div style="font-size:13px;color:${P.fg3};line-height:19px;max-width:280px;margin-bottom:22px">
        Describe what you need in a sentence. Magic Task drafts the title, budget, and schedule — you just confirm and post.
      </div>
      <div style="width:100%;display:flex;flex-direction:column;gap:6px;margin-bottom:18px">
        ${promptButtons}
      </div>
      ${tryBtn}
      <button style="background:transparent;border:none;padding:4px 8px;color:${P.fg3};font-size:12.5px;font-weight:500">Or post manually</button>
    </div>`;

  const filterIcon = `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:${P.fg1}">${icon('sliders-horizontal', { size: 20, color: P.fg1 })}</div>`;
  return [
    topBar({ title: 'My tasks', right: filterIcon }),
    tabStrip({ tabs: ['Open (0)', 'Active (0)', 'Done (0)', 'Closed (0)'], active: 0 }),
    inner,
    magicFab(),
  ].join('');
}

// Renders two phone frames side-by-side at the platform's canonical
// viewport. The wrapper aligns them so a single PNG shows both the
// populated and empty design frames.
function sideBySideBody({ platform }) {
  const populated = frame({ platform, body: populatedBody() });
  const empty = frame({ platform, body: emptyBody() });
  const phoneWidth = platform === 'android' ? 411 : (platform === 'web' ? 400 : 390);
  return `
    <div style="display:flex;gap:24px;padding:24px;align-items:flex-start;background:#fafafa;min-height:100vh">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${P.fg3}">${platform} · populated</div>
        <div style="width:${phoneWidth}px;height:844px;background:${P.surface};border:1px solid ${P.border};border-radius:32px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08)">
          ${populated}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${P.fg3}">${platform} · empty</div>
        <div style="width:${phoneWidth}px;height:844px;background:${P.surface};border:1px solid ${P.border};border-radius:32px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08)">
          ${empty}
        </div>
      </div>
    </div>`;
}

async function snap(browser, html, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const png = await page.screenshot({ fullPage: true, type: 'png' });
  await ctx.close();
  return png;
}

async function ensureDir(p) { await mkdir(p, { recursive: true }); }
async function writePng(file, buf) {
  await ensureDir(dirname(file));
  await writeFile(file, buf);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const platform of ['ios', 'android', 'web']) {
    const fontFamily = platform === 'android' ? 'roboto' : 'system-ui';
    // Render both frames side-by-side for a single PNG per platform.
    const platformBody = sideBySideBody({ platform });
    const phoneWidth = platform === 'android' ? 411 : (platform === 'web' ? 400 : 390);
    const compositeWidth = phoneWidth * 2 + 24 * 3;
    const html = htmlDoc({ title: `My tasks V2 · ${platform}`, body: platformBody, font: fontFamily });
    const png = await snap(browser, html, { width: compositeWidth, height: 920, deviceScaleFactor: 1 });
    const outFile = join(PARITY_DIR, `mytasks-v2-${platform}.png`);
    await writePng(outFile, png);
    console.log(`  ${platform.padEnd(8)} mytasks-v2-${platform}.png  (${png.length} bytes)`);
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
