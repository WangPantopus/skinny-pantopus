// T6.2b Me design-parity-refresh — one-off render script.
// Outputs four per-platform PNGs at docs/screenshots/me-{personal,home}-{ios,android}.png
// matching the new design (identity pill row on top of a 3-stop
// gradient header, 72pt verification-ring avatar + name + tagline,
// 3-tile stats card, 2×3 action grid, section groups, destructive
// sign-out card).
//
// Run: `node tools/t5-screenshots/me-frames.mjs`
//
// Reuses the T5 harness's lib.mjs primitives. Sister to
// `render.mjs` — kept separate so it doesn't churn T5 baselines.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

import { P, icon as libIcon, htmlDoc, statusBar, androidStatusBar } from './lib.mjs';

// Local icon supplement — extends the T5 lib.mjs ICONS dictionary with
// the Me-specific glyphs without touching the shared file (keeps T5
// snapshot baselines from churning).
const EXTRA_ICONS = {
  user: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
  'hand-coins': '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>',
  'wand-sparkles': '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
  'arrow-left': '<line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
};

function icon(name, opts) {
  if (EXTRA_ICONS[name]) {
    const { size = 18, color = 'currentColor', stroke = 2, fill = 'none' } = opts || {};
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${EXTRA_ICONS[name]}</svg>`;
  }
  return libIcon(name, opts);
}

const REPO = '/home/user/pantopus';
const PARITY_DIR = `${REPO}/docs/screenshots`;

const VIEWPORTS = {
  ios: { width: 390, height: 844, deviceScaleFactor: 1 },
  android: { width: 411, height: 891, deviceScaleFactor: 1 },
};

// Identity palettes per the design (matches `MeIdentity.headerGradient`
// on iOS / Android — 3-stop gradient using primary600 → primary500 →
// primary700 for sky; home/business use the same accent ramped via
// 86% opacity).
const IDENTITIES = {
  personal: {
    accent: P.primary600,
    accentSoft: P.primary50,
    headerGradient: [P.primary600, P.primary500, P.primary700],
  },
  home: {
    accent: P.home,
    accentSoft: P.homeBg,
    headerGradient: [P.home, mix(P.home, 0.86), P.home],
  },
  business: {
    accent: P.business,
    accentSoft: P.businessBg,
    headerGradient: [P.business, mix(P.business, 0.86), P.business],
  },
};

// Hex with alpha, baked over white so the rendered swatch matches the
// Compose `Color.copy(alpha = 0.86f)` blended on top of the gradient
// stop above it.
function mix(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c) => Math.round(c * alpha + 255 * (1 - alpha));
  return `#${[blend(r), blend(g), blend(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function identityPillRow(activeId) {
  const pill = (key, label, iconName) => {
    const active = key === activeId;
    const meta = IDENTITIES[key];
    const bg = active ? meta.accent : 'transparent';
    const fg = active ? '#fff' : P.fg2;
    return `
      <div style="flex:1;height:30px;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:${bg};border-radius:999px">
        ${icon(iconName, { size: 11, color: fg, stroke: 2.4 })}
        <span style="font-size:12px;font-weight:700;color:${fg}">${label}</span>
      </div>`;
  };
  return `
    <div style="background:${P.surface};border-radius:999px;border:1px solid ${P.border};padding:3px;display:flex;gap:6px">
      ${pill('personal', 'Personal', 'user')}
      ${pill('home', 'Home', 'home')}
      ${pill('business', 'Business', 'briefcase')}
    </div>`;
}

function header({ identity, displayName, initials, handle, locality, tagline, verified }) {
  const meta = IDENTITIES[identity];
  const gradient = `linear-gradient(180deg, ${meta.headerGradient[0]} 0%, ${meta.headerGradient[1]} 50%, ${meta.headerGradient[2]} 100%)`;
  // 72pt avatar with the verification ring (white circular border) +
  // 22pt verified badge — accent-coloured ring with a sky-tinted check
  // glyph on white. Matches `MeView.swift` / `MeView.kt`.
  const avatar = `
    <div style="position:relative;width:76px;height:76px;flex-shrink:0">
      <div style="width:72px;height:72px;border-radius:36px;background:linear-gradient(135deg, ${meta.accent} 0%, ${mix(meta.accent, 0.8)} 100%);border:3px solid ${P.surface};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:26px;box-shadow:0 4px 14px rgba(15,23,42,0.18)">${initials}</div>
      ${verified ? `
        <div style="position:absolute;top:-2px;right:-2px;width:22px;height:22px;border-radius:11px;background:${P.surface};border:2px solid ${meta.accent};display:flex;align-items:center;justify-content:center;color:${P.primary600}">
          ${icon('check', { size: 11, color: P.primary600, stroke: 3.5 })}
        </div>` : ''}
    </div>`;
  return `
    <div style="background:${gradient};padding:16px;display:flex;flex-direction:column;gap:12px">
      ${identityPillRow(identity)}
      <div style="display:flex;align-items:center;gap:14px">
        ${avatar}
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
          <div style="font-size:20px;font-weight:700;color:#fff;line-height:1.1;letter-spacing:-0.01em">${displayName}</div>
          <div style="font-size:12px;font-weight:500;color:rgba(255,255,255,0.85)">${handle}</div>
          ${locality ? `<div style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.85);font-size:12px;font-weight:500">${icon('map-pin', { size: 11, color: 'rgba(255,255,255,0.85)' })} ${locality}</div>` : ''}
        </div>
      </div>
      ${tagline ? `<div style="font-size:13.5px;color:rgba(255,255,255,0.9);line-height:1.4">${tagline}</div>` : ''}
    </div>`;
}

function statsRow(stats) {
  const cells = stats.map((s, i) => `
    <div style="flex:1;padding:12px 4px;display:flex;flex-direction:column;align-items:center;gap:2px${i < stats.length - 1 ? `;border-right:1px solid ${P.borderSubtle}` : ''}">
      <div style="font-size:18px;font-weight:700;color:${P.fg1}">${s.value}</div>
      <div style="font-size:10px;font-weight:600;color:${P.fg3};letter-spacing:0.04em;text-transform:uppercase">${s.label}</div>
    </div>`).join('');
  return `
    <div style="margin:12px 16px 0;background:${P.surface};border:1px solid ${P.border};border-radius:12px;display:flex">
      ${cells}
    </div>`;
}

function actionGrid({ tiles, accent }) {
  const tileHtml = tiles.map((t) => `
    <div style="height:72px;background:${P.surface};border:1px solid ${P.border};border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
      ${icon(t.icon, { size: 20, color: accent })}
      <div style="font-size:11px;font-weight:600;color:${P.fg1}">${t.label}</div>
    </div>`).join('');
  return `
    <div style="margin:16px 16px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${tileHtml}
    </div>`;
}

function sectionGroup({ header: headerLabel, rows }) {
  const rowHtml = rows.map((r, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;min-height:48px${i < rows.length - 1 ? `;border-bottom:1px solid ${P.borderSubtle}` : ''}">
      ${icon(r.icon, { size: 17, color: P.fg2 })}
      <div style="font-size:13.5px;font-weight:600;color:${P.fg1};flex:1">${r.label}</div>
      ${r.value ? `<div style="font-size:12px;font-weight:500;color:${P.fg3}">${r.value}</div>` : ''}
      ${icon('chevron-right', { size: 14, color: P.fg4 })}
    </div>`).join('');
  return `
    <div style="margin:16px 16px 0">
      <div style="font-size:10px;font-weight:700;color:${P.fg4};letter-spacing:0.04em;text-transform:uppercase;padding-left:4px;margin-bottom:8px">${headerLabel}</div>
      <div style="background:${P.surface};border:1px solid ${P.border};border-radius:10px;overflow:hidden">
        ${rowHtml}
      </div>
    </div>`;
}

function destructiveCard(label) {
  return `
    <div style="margin:20px 16px;background:${P.surface};border:1px solid ${P.border};border-radius:10px;display:flex;align-items:center;gap:12px;padding:14px;min-height:48px">
      ${icon('arrow-left', { size: 17, color: P.error })}
      <div style="font-size:13.5px;font-weight:600;color:${P.error}">${label}</div>
    </div>`;
}

// ---- Frame data ----

const PERSONAL = {
  identity: 'personal',
  displayName: 'Maria K.',
  initials: 'MK',
  handle: '@maria',
  locality: 'Elm Park',
  tagline: 'Neighborhood cleanup organiser; coffee enthusiast.',
  verified: true,
  stats: [
    { id: 'activity', value: '12', label: 'Activity' },
    { id: 'trust', value: 'Verified', label: 'Trust' },
    { id: 'reputation', value: '4.9', label: 'Reputation' },
  ],
  actionTiles: [
    { id: 'posts', icon: 'file-text', label: 'My posts' },
    { id: 'bids', icon: 'hammer', label: 'My bids' },
    { id: 'gigs', icon: 'clipboard-list', label: 'My tasks' },
    { id: 'offers', icon: 'hand-coins', label: 'Offers' },
    { id: 'listings', icon: 'tag', label: 'Listings' },
    { id: 'connections', icon: 'user-plus', label: 'Connections' },
  ],
  sections: [
    {
      id: 'profile_privacy',
      header: 'Profile & Privacy',
      rows: [
        { id: 'edit', icon: 'pen-line', label: 'Edit profile' },
        { id: 'identityCenter', icon: 'shield-check', label: 'Identity Center' },
        { id: 'audience', icon: 'megaphone', label: 'Audience profile' },
      ],
    },
    {
      id: 'activity',
      header: 'Activity',
      rows: [
        { id: 'posts', icon: 'file-text', label: 'My posts' },
        { id: 'bids', icon: 'hammer', label: 'My bids' },
        { id: 'gigs', icon: 'clipboard-list', label: 'My tasks' },
        { id: 'offers', icon: 'hand-coins', label: 'Offers' },
        { id: 'homes', icon: 'home', label: 'My homes' },
        { id: 'businesses', icon: 'briefcase', label: 'My businesses' },
      ],
    },
    {
      id: 'help_legal',
      header: 'Help & Legal',
      rows: [
        { id: 'help', icon: 'info', label: 'Help' },
        { id: 'terms', icon: 'file-text', label: 'Terms' },
        { id: 'privacy', icon: 'shield-check', label: 'Privacy', value: 'Neighbors' },
      ],
    },
  ],
  destructive: 'Log out',
};

const HOME = {
  identity: 'home',
  displayName: '12 Rose Court',
  initials: 'RC',
  handle: 'Household · 2 members',
  locality: 'Elm Park',
  tagline: '12 Rose Court, Unit 4B',
  verified: true,
  stats: [
    { id: 'bills', value: '3', label: 'Bills due' },
    { id: 'tasks', value: '5', label: 'Open tasks' },
    { id: 'members', value: '2', label: 'Members' },
  ],
  actionTiles: [
    { id: 'bills', icon: 'receipt', label: 'Bills' },
    { id: 'pets', icon: 'paw-print', label: 'Pets' },
    { id: 'members', icon: 'users', label: 'Members' },
    { id: 'polls', icon: 'thumbs-up', label: 'Polls' },
    { id: 'calendar', icon: 'calendar', label: 'Calendar' },
    { id: 'docs', icon: 'file-text', label: 'Documents' },
  ],
  sections: [
    {
      id: 'household',
      header: 'Household',
      rows: [
        { id: 'members', icon: 'users', label: 'Members' },
        { id: 'owners', icon: 'shield-check', label: 'Owners' },
        { id: 'access', icon: 'badge-check', label: 'Access codes' },
      ],
    },
    {
      id: 'activity',
      header: 'Activity',
      rows: [
        { id: 'bills', icon: 'receipt', label: 'Bills' },
        { id: 'tasks', icon: 'hammer', label: 'Household tasks' },
        { id: 'packages', icon: 'inbox', label: 'Packages' },
        { id: 'emergency', icon: 'shield-alert', label: 'Emergency info' },
      ],
    },
    {
      id: 'help_legal',
      header: 'Help & Legal',
      rows: [
        { id: 'help', icon: 'info', label: 'Help' },
        { id: 'terms', icon: 'file-text', label: 'Terms' },
        { id: 'privacy', icon: 'shield-check', label: 'Privacy', value: 'Neighbors' },
      ],
    },
  ],
  destructive: 'Switch identity → Personal',
};

function meBody(spec) {
  const meta = IDENTITIES[spec.identity];
  return [
    header(spec),
    statsRow(spec.stats),
    actionGrid({ tiles: spec.actionTiles, accent: meta.accent }),
    ...spec.sections.map(sectionGroup),
    destructiveCard(spec.destructive),
  ].join('');
}

function frameWithPlatformChrome({ platform, body }) {
  const isIOS = platform === 'ios';
  const sb = isIOS ? statusBar() : androidStatusBar();
  return `
    <div style="background:${P.bg};min-height:100vh;display:flex;flex-direction:column">
      ${sb}
      <div style="flex:1;background:${P.bg}">
        ${body}
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
async function writePng(file, buf) { await ensureDir(dirname(file)); await writeFile(file, buf); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const frames = [
    { key: 'personal', spec: PERSONAL },
    { key: 'home', spec: HOME },
  ];
  for (const { key, spec } of frames) {
    const body = meBody(spec);
    for (const platform of ['ios', 'android']) {
      const platformBody = frameWithPlatformChrome({ platform, body });
      const fontFamily = platform === 'android' ? 'roboto' : 'system-ui';
      const html = htmlDoc({ title: `Me · ${key} · ${platform}`, body: platformBody, font: fontFamily });
      const png = await snap(browser, html, VIEWPORTS[platform]);
      const outFile = join(PARITY_DIR, `me-${key}-${platform}.png`);
      await writePng(outFile, png);
      console.log(`  ${platform.padEnd(8)} me-${key}-${platform}.png  (${png.length} bytes)`);
    }
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
