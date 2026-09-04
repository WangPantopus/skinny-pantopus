// Auth design-reference screenshot harness — Log in / Create account /
// Auth error, rendered inside a device frame at 408 x 800 CSS px @2x.
//
// Replaces the ephemeral `/tmp/auth-screenshots/render.mjs` referenced by
// `AuthScreensSnapshotTest`: that harness was never committed, so the
// baselines it produced could not be regenerated when the brand mark
// changed. This one lives in the repo.
//
// Run:  node tools/auth-screenshots/render.mjs
//
// Writes:
//   frontend/apps/android/app/src/test/snapshots/auth/<screen>-android.png
//   docs/screenshots/auth-<screen>-android.png
//
// Chromium comes from the web app's @playwright/test, driven through the
// locally installed Chrome channel so no browser download is needed.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const require = createRequire(join(REPO, 'frontend/apps/web/package.json'));
const { chromium } = require('@playwright/test');

const ANDROID_SNAPSHOTS = join(REPO, 'frontend/apps/android/app/src/test/snapshots/auth');
const DOCS = join(REPO, 'docs/screenshots');

// 340 x 720 screen inside a 360 x 740 bezel, centred on a 408 x 800 page.
const VIEWPORT = { width: 408, height: 800 };
const SCALE = 2;

// Design tokens — mirror `PantopusColors` verbatim.
const P = {
  primary100: '#e0f2fe',
  primary400: '#38bdf8',
  primary600: '#0284c7',
  home: '#16a34a',
  surface: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  fg: '#111827',
  fg2: '#6b7280',
  fg3: '#9ca3af',
  error: '#dc2626',
  errorBg: '#fef2f2',
  success: '#16a34a',
};

const PERFORATIONS = [
  [23.5, 4], [40.5, 4], [23.5, 60], [40.5, 60],
  [4, 23.5], [4, 40.5], [60, 23.5], [60, 40.5],
];

let markSeq = 0;

/**
 * The perforation mark: stamp body, eight punched perforations, a
 * knocked-out window, and the check inside it. Geometry is the canonical
 * 64-unit grid shared with `PantopusMark.tsx` / `.swift` / `.kt`.
 */
function mark(size, { body = P.primary600, check = P.home } = {}) {
  const id = `ptmask${markSeq++}`;
  const holes = PERFORATIONS
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#000"/>`)
    .join('');
  const glyph = size <= 20
    ? `<rect x="26" y="26" width="12" height="12" rx="3" fill="${body}"/>`
    : `<path d="M26 32.4 30.2 36.6 38.2 26.8" fill="none" stroke="${check}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="flex:none;display:block">
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="#000"/>
      <rect x="4" y="4" width="56" height="56" rx="13" fill="#fff"/>
      ${holes}
      <rect x="20" y="20" width="24" height="24" rx="4" fill="#000"/>
    </mask>
    <rect width="64" height="64" fill="${body}" mask="url(#${id})"/>
    ${glyph}
  </svg>`;
}

/** Mark + wordmark, gap size/3, wordmark 0.83x at 700 with -0.02em tracking. */
function lockup(size) {
  return `<span style="display:inline-flex;align-items:center;gap:${size / 3}px">
    ${mark(size)}
    <span style="font-size:${size * 0.83}px;font-weight:700;letter-spacing:-0.02em;line-height:1;color:${P.fg};transform:translateY(-0.04em)">Pantopus</span>
  </span>`;
}

const ICONS = {
  'at-sign': '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
};

function icon(name, { size = 16, color = P.fg2, stroke = 2 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${ICONS[name]}</svg>`;
}

function statusBar() {
  return `<div style="height:52px;display:flex;align-items:center;justify-content:space-between;padding:14px 26px 0;font-size:15px;font-weight:700;color:${P.fg}">
    <span>9:41</span>
    <span style="display:flex;gap:5px;align-items:center">
      <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="${P.fg}"/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill="${P.fg}"/><rect x="9" y="2" width="3" height="9" rx="0.6" fill="${P.fg}"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="${P.fg}"/></svg>
      <svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill="${P.fg}"/><path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill="${P.fg}"/><circle cx="7.5" cy="9" r="1.3" fill="${P.fg}"/></svg>
      <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="${P.fg}" stroke-opacity="0.35"/><rect x="2" y="2" width="18" height="8" rx="1.6" fill="${P.fg}"/><path d="M23 4v4a2 2 0 0 0 0-4z" fill="${P.fg}" fill-opacity="0.4"/></svg>
    </span>
  </div>`;
}

/** The perforated device shell: black bezel, dynamic island, home indicator. */
function device(body) {
  return `<div style="width:408px;height:800px;background:linear-gradient(160deg,#e9ecef,#e2e5e9);display:flex;align-items:center;justify-content:center">
    <div style="width:360px;height:740px;background:#0b0b0d;border-radius:54px;padding:10px;box-shadow:0 24px 60px rgba(15,23,42,0.28)">
      <div style="position:relative;width:340px;height:720px;background:${P.surface};border-radius:44px;overflow:hidden;display:flex;flex-direction:column">
        <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);width:108px;height:30px;border-radius:15px;background:#0b0b0d;z-index:2"></div>
        ${statusBar()}
        <div style="flex:1;display:flex;flex-direction:column;padding:0 20px;overflow:hidden">${body}</div>
        <div style="height:22px;display:flex;align-items:center;justify-content:center">
          <div style="width:122px;height:5px;border-radius:3px;background:#a3a8ad"></div>
        </div>
      </div>
    </div>
  </div>`;
}

function field({ label, value, leading, trailing = '', accessory = '', border = P.border, mono = false }) {
  return `<div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:12px;font-weight:600;color:${P.fg2}">${label}</span>
      ${accessory}
    </div>
    <div style="height:44px;border:1px solid ${border};border-radius:12px;display:flex;align-items:center;gap:8px;padding:0 12px;background:${P.surface}">
      ${icon(leading, { size: 16, color: P.fg2 })}
      <span style="flex:1;font-size:14px;color:${P.fg};${mono ? 'letter-spacing:1px' : ''}">${value}</span>
      ${trailing}
    </div>
  </div>`;
}

function primaryButton(text, { withArrow = true } = {}) {
  return `<div style="height:48px;border-radius:14px;background:${P.primary600};display:flex;align-items:center;justify-content:center;gap:6px">
    <span style="font-size:15px;font-weight:600;color:#fff">${text}</span>
    ${withArrow ? icon('arrow-right', { size: 18, color: '#fff' }) : ''}
  </div>`;
}

function ghostButton(text) {
  return `<div style="height:48px;border-radius:14px;border:1px solid ${P.borderStrong};background:${P.surface};display:flex;align-items:center;justify-content:center">
    <span style="font-size:15px;font-weight:600;color:${P.fg}">${text}</span>
  </div>`;
}

/** Web's centred "Or continue with" rule, mirrored on the natives. */
function methodSeparator() {
  return `<div style="display:flex;align-items:center;gap:12px">
    <div style="flex:1;height:1px;background:${P.border}"></div>
    <span style="font-size:12px;color:${P.fg2}">Or continue with</span>
    <div style="flex:1;height:1px;background:${P.border}"></div>
  </div>`;
}

function legalLine() {
  const link = (t) => `<span style="color:${P.primary600};text-decoration:underline">${t}</span>`;
  return `<div style="font-size:11px;line-height:1.45;color:${P.fg2};text-align:center">By continuing with Google or Apple, you agree to our ${link('Terms of Service')} and ${link('Privacy Policy')}.</div>`;
}

function trustFooter() {
  return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding-bottom:6px">
    ${icon('shield-check', { size: 14, color: P.fg3 })}
    <span style="font-size:12px;color:${P.fg2}">Verified by address</span>
  </div>`;
}

// ---------------------------------------------------------------- screens

/**
 * Log in — the shipped order: brand, heading, email, password, Log in,
 * the "Or continue with" rule, Google, Apple, the OAuth legal line that
 * belongs to those two buttons, then the create-account link.
 */
function login() {
  return `<div style="display:flex;flex-direction:column;height:100%;gap:14px;padding-top:12px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      ${lockup(36)}
      <span style="font-size:12px;color:${P.fg2}">Your neighborhood, verified.</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:8px">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.09em;color:${P.primary600}">WELCOME BACK</span>
      <span style="font-size:24px;font-weight:700;color:${P.fg}">Log in to Pantopus</span>
      <span style="font-size:13px;color:${P.fg2}">Pick up where you left off on your block.</span>
    </div>
    ${field({ label: 'Email', value: 'maria.k@email.com', leading: 'at-sign' })}
    ${field({
      label: 'Password',
      value: '••••••••••••',
      leading: 'lock',
      trailing: icon('eye', { size: 16, color: P.fg2 }),
      accessory: `<span style="font-size:12px;font-weight:600;color:${P.primary600}">Forgot password?</span>`,
    })}
    ${primaryButton('Log in')}
    ${methodSeparator()}
    ${ghostButton('Continue with Google')}
    ${ghostButton('Continue with Apple')}
    ${legalLine()}
    <div style="text-align:center;font-size:13px;color:${P.fg2}">New to Pantopus? <span style="font-weight:600;color:${P.primary600}">Create account</span></div>
    <div style="flex:1"></div>
    ${trustFooter()}
  </div>`;
}

function signup() {
  const ok = icon('check', { size: 16, color: P.success });
  return `<div style="display:flex;flex-direction:column;height:100%;gap:14px;padding-top:12px">
    <div style="display:flex;justify-content:center">${lockup(36)}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:4px">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.09em;color:${P.primary600}">GET STARTED</span>
      <span style="font-size:24px;font-weight:700;color:${P.fg}">Create your account</span>
      <span style="font-size:13px;color:${P.fg2};text-align:center;line-height:1.4">One identity, three pillars — personal,<br/>home, business.</span>
    </div>
    ${field({ label: 'Email', value: 'maria.k@email.com', leading: 'at-sign', trailing: ok, border: P.success })}
    ${field({ label: 'Password', value: '••••••••••••', leading: 'lock', trailing: icon('eye', { size: 16, color: P.fg2 }) })}
    <div style="display:flex;align-items:center;gap:6px;margin-top:-8px">
      <div style="flex:1;height:4px;border-radius:2px;background:#b45309"></div>
      <div style="flex:1;height:4px;border-radius:2px;background:#b45309"></div>
      <div style="flex:1;height:4px;border-radius:2px;background:#eceff2"></div>
      <span style="font-size:12px;font-weight:700;color:#b45309">Fair</span>
    </div>
    ${field({ label: 'Confirm password', value: '••••••••••••', leading: 'lock', trailing: ok, border: P.success })}
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:20px;height:20px;border-radius:6px;background:${P.primary600};display:flex;align-items:center;justify-content:center">${icon('check', { size: 13, color: '#fff', stroke: 3 })}</div>
      <span style="font-size:13px;color:${P.fg}">I agree to the <span style="font-weight:600;color:${P.primary600}">Terms</span> and <span style="font-weight:600;color:${P.primary600}">Privacy Policy</span></span>
    </div>
    ${primaryButton('Create account')}
    <div style="text-align:center;font-size:13px;color:${P.fg2}">I have an account. <span style="font-weight:600;color:${P.primary600}">Log in</span></div>
    <div style="flex:1"></div>
    ${trustFooter()}
  </div>`;
}

function authError() {
  return `<div style="display:flex;flex-direction:column;height:100%;padding-top:12px">
    <div style="display:flex;justify-content:center">${lockup(36)}</div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
      <div style="width:104px;height:104px;border-radius:52px;background:${P.errorBg};display:flex;align-items:center;justify-content:center">
        ${icon('alert-circle', { size: 56, color: P.error })}
      </div>
      <span style="font-size:24px;font-weight:700;color:${P.fg};text-align:center">Can't reach Pantopus</span>
      <span style="font-size:13px;color:${P.fg2};text-align:center">Check your connection and try again.</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;padding-bottom:14px">
      ${primaryButton('Try again', { withArrow: false })}
      ${ghostButton('Go back')}
    </div>
    ${trustFooter()}
  </div>`;
}

const SCREENS = { login, signup, error: authError };

function htmlDoc(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:Roboto,"Helvetica Neue",system-ui,sans-serif;color:${P.fg};-webkit-font-smoothing:antialiased}
  </style></head><body>${body}</body></html>`;
}

async function writePng(file, buf) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, render] of Object.entries(SCREENS)) {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await ctx.newPage();
    await page.setContent(htmlDoc(device(render())), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const png = await page.screenshot({ type: 'png' });
    await ctx.close();
    await writePng(join(ANDROID_SNAPSHOTS, `${name}-android.png`), png);
    await writePng(join(DOCS, `auth-${name}-android.png`), png);
    console.log(`  ${name}-android.png  (${png.length} bytes)`);
  }
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
