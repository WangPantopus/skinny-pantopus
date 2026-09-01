// T6.1c P5 — Forgot password / Reset password / Verify email
// screenshot harness. Generates 9 PNGs (3 screens × 3 platforms)
// rendered against a hand-rolled HTML/SVG that mirrors the design
// package's tokens + geometry verbatim. Self-contained — no network.
//
// Run:  node /home/user/pantopus/tools/t5-screenshots/auth-p5.mjs
//
// Writes to:
//   docs/screenshots/auth-{forgot,reset,verify}-{ios,android,web}.png
//   frontend/apps/ios/PantopusTests/__Snapshots__/auth/<screen>-ios.png
//   frontend/apps/android/app/src/test/snapshots/auth/<screen>-android.png

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

import { P, htmlDoc, frame } from './lib.mjs';

const REPO = '/home/user/pantopus';
const VIEWPORTS = {
  ios: { width: 390, height: 844, deviceScaleFactor: 1 },
  android: { width: 411, height: 891, deviceScaleFactor: 1 },
  web: { width: 400, height: 900, deviceScaleFactor: 1 },
};

async function ensureDir(p) { await mkdir(p, { recursive: true }); }
async function writePng(file, buf) { await ensureDir(dirname(file)); await writeFile(file, buf); }

async function snap(browser, html, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const png = await page.screenshot({ fullPage: false, type: 'png' });
  await ctx.close();
  return png;
}

// ---------- Inline icon helper (subset needed by P5) ----------
const ICONS = {
  'chevron-left': '<polyline points="15 18 9 12 15 6"></polyline>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'at-sign': '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
  'mailbox': '<path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4z"/><polyline points="15 9 18 9 18 11"/><path d="M6 11V7"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
};

function icon(name, { size = 16, color = P.fg2, strokeWidth = 2 } = {}) {
  const path = ICONS[name] ?? '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${path}</svg>`;
}

// ---------- Layout helpers ----------
function topBar({ title, leading = 'chevron-left' }) {
  return `<div style="position:relative;height:44px;background:${P.surface};border-bottom:1px solid ${P.borderSubtle};display:flex;align-items:center;padding:0 8px">
    <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">
      ${icon(leading, { size: 22, color: P.fg1 })}
    </div>
    <div style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:${P.fg1};pointer-events:none">${title}</div>
  </div>`;
}

function pantopusFieldShell({ label, leading, value, placeholder = '', trailing = '' }) {
  return `<div style="display:flex;flex-direction:column;gap:4px">
    <div style="font-size:12px;color:${P.fg3}">${label}</div>
    <div style="display:flex;align-items:center;gap:8px;padding:0 12px;min-height:44px;background:${P.surface};border:1px solid ${P.border};border-radius:10px">
      ${leading ? icon(leading, { size: 16, color: P.fg3 }) : ''}
      <div style="flex:1;font-size:15px;color:${value ? P.fg1 : P.fg4}">${value || placeholder}</div>
      ${trailing}
    </div>
  </div>`;
}

function primaryCTA({ label, enabled = true }) {
  const bg = enabled ? P.primary600 : P.borderStrong ?? '#D1D5DB';
  return `<button style="width:100%;min-height:48px;border:0;background:${bg};color:${P.surface};font-size:15px;font-weight:600;border-radius:14px;cursor:pointer">${label}</button>`;
}

function ghostCTA({ label }) {
  return `<button style="width:100%;min-height:44px;border:1px solid #D1D5DB;background:${P.surface};color:${P.fg1};font-size:15px;font-weight:600;border-radius:14px;cursor:pointer">${label}</button>`;
}

function textLink({ label, color = P.primary600 }) {
  return `<button style="border:0;background:transparent;color:${color};font-size:13px;font-weight:600;cursor:pointer">${label}</button>`;
}

// ---------- Forgot password (form phase) ----------
function forgotBody() {
  return `<div style="display:flex;flex-direction:column;flex:1;background:${P.surface}">
    ${topBar({ title: 'Forgot password' })}
    <div style="display:flex;flex-direction:column;gap:20px;padding:20px;flex:1">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:22px;font-weight:700;color:${P.fg1};letter-spacing:-0.01em">Reset your password</div>
        <div style="font-size:13px;color:${P.fg3}">Enter your email and we'll send you a link to reset it.</div>
      </div>
      ${pantopusFieldShell({ label: 'Email', leading: 'at-sign', value: 'alice@example.com' })}
      ${primaryCTA({ label: 'Send reset link', enabled: true })}
      <div style="flex:1"></div>
      <div style="display:flex;align-items:center;justify-content:center;gap:4px;color:${P.fg3};font-size:11px">
        ${icon('shield-check', { size: 12, color: P.fg3 })} Verified by address
      </div>
    </div>
  </div>`;
}

// ---------- Reset password ----------
function strengthMeter({ score = 2 }) {
  const colors = [P.error, P.warning, P.success];
  const label = ['Weak', 'Fair', 'Strong'][score - 1] || '—';
  const color = colors[score - 1] || P.border;
  const bar = (i) => `<div style="flex:1;height:5px;border-radius:999px;background:${i < score ? color : P.sunken}"></div>`;
  return `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
    ${bar(0)}${bar(1)}${bar(2)}
    <div style="width:48px;text-align:right;font-size:11px;font-weight:600;color:${color}">${label}</div>
  </div>`;
}

function resetBody() {
  return `<div style="display:flex;flex-direction:column;flex:1;background:${P.surface}">
    ${topBar({ title: 'Set new password', leading: 'x' })}
    <div style="display:flex;flex-direction:column;gap:20px;padding:20px;flex:1">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:22px;font-weight:700;color:${P.fg1};letter-spacing:-0.01em">Set a new password</div>
        <div style="font-size:13px;color:${P.fg3}">Choose a password you haven't used here before.</div>
      </div>
      <div>
        ${pantopusFieldShell({ label: 'New password', leading: 'lock', value: '••••••••', trailing: icon('eye', { size: 16, color: P.fg3 }) })}
        ${strengthMeter({ score: 2 })}
      </div>
      ${pantopusFieldShell({ label: 'Confirm new password', leading: 'lock', value: '••••••••', trailing: icon('eye', { size: 16, color: P.fg3 }) })}
      ${primaryCTA({ label: 'Set password', enabled: true })}
      <div style="flex:1"></div>
    </div>
  </div>`;
}

// ---------- Verify email ----------
function verifyBody() {
  return `<div style="display:flex;flex-direction:column;flex:1;background:${P.surface}">
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px;padding:40px 20px 20px;flex:1">
      <div style="width:140px;height:140px;border-radius:999px;background:${P.primary50};display:flex;align-items:center;justify-content:center">
        ${icon('mailbox', { size: 80, color: P.primary500 })}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:center">
        <div style="font-size:22px;font-weight:700;color:${P.fg1};letter-spacing:-0.01em">Verify your email</div>
        <div style="font-size:13px;color:${P.fg3};max-width:280px;line-height:1.5">We sent a verification link to <span style="color:${P.fg1};font-weight:600">alice@example.com</span>. Click it to unlock all features.</div>
      </div>
      <div style="flex:1"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;padding:16px;background:${P.surface};border-top:1px solid ${P.borderSubtle}">
      ${primaryCTA({ label: 'Open mail app', enabled: true })}
      ${ghostCTA({ label: 'Resend email' })}
      <div style="display:flex;justify-content:center">${textLink({ label: "I'll do this later" })}</div>
      <div style="display:flex;justify-content:center">${textLink({ label: 'Wrong email? Change it', color: P.fg3 })}</div>
    </div>
  </div>`;
}

// ---------- Render loop ----------
const SCREENS = {
  forgot: forgotBody,
  reset: resetBody,
  verify: verifyBody,
};

async function main() {
  const browser = await chromium.launch();
  try {
    for (const [name, body] of Object.entries(SCREENS)) {
      for (const platform of ['ios', 'android', 'web']) {
        const html = htmlDoc({
          title: `auth-${name}-${platform}`,
          body: frame({ platform, body: body() }),
          font: platform === 'android' ? 'roboto' : 'system-ui',
        });
        const png = await snap(browser, html, VIEWPORTS[platform]);
        const docsPath = `${REPO}/docs/screenshots/auth-${name}-${platform}.png`;
        await writePng(docsPath, png);
        if (platform === 'ios') {
          await writePng(`${REPO}/frontend/apps/ios/PantopusTests/__Snapshots__/auth/${name}-ios.png`, png);
        }
        if (platform === 'android') {
          await writePng(`${REPO}/frontend/apps/android/app/src/test/snapshots/auth/${name}-android.png`, png);
        }
        console.log(`✓ ${name}-${platform}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
