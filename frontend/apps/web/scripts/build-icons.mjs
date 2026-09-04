#!/usr/bin/env node
// ============================================================
// ICON BUILD — renders every raster app icon from the ONE canonical
// geometry, so a change to the mark can be pushed to all three
// platforms instead of redrawn by hand.
//
// The mark is defined once, in three hand-kept mirrors:
//   web      src/components/brand/PantopusMark.tsx   (the source of truth)
//   iOS      ios/.../Core/Design/Components/PantopusMark.swift
//   Android  android/.../ui/theme/PantopusMark.kt
// This script is the fourth mirror — the RASTER one. The numbers in
// GEOMETRY below are copied from PantopusMark.tsx and must move with
// it: viewBox 64, body 4,4 56x56 r13, eight r4.5 perforations punched
// out, a 20,20 24x24 r4 window knocked out, and either the <=20px plug
// or the check on top.
//
//   node scripts/build-icons.mjs              # write every icon in place
//   node scripts/build-icons.mjs --out /tmp/x # dry run into a scratch dir
//   node scripts/build-icons.mjs --only ico   # only targets matching a substring
//   node scripts/build-icons.mjs --list       # print the targets, write nothing
//
// No image library: SVG rasterizing here is a few analytic distance
// fields (rounded rect, circle, capsule) composited with anti-aliased
// coverage, and PNG/ICO are written straight out with node's zlib.
// Adding sharp or resvg to the web app's dependency tree to redraw
// eight icons is not a trade worth making.
//
// The PNGs currently committed were produced by an earlier throwaway
// script. This one reproduces them; it does not need to match them
// byte for byte, because a rasterizer's exact anti-aliasing is not the
// contract — the geometry is. Diff the PIXELS, not the bytes.
// ============================================================

import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const appsRoot = join(webRoot, '..');

// ── The mark, in its 64-unit viewBox ────────────────────────────

const VIEWBOX = 64;

const GEOMETRY = {
  /** The stamp body. */
  body: { x: 4, y: 4, w: 56, h: 56, r: 13 },
  /** Eight perforations, punched OUT of the body, centred on its edges. */
  perforations: [
    [23.5, 4], [40.5, 4], [23.5, 60], [40.5, 60],
    [4, 23.5], [4, 40.5], [60, 23.5], [60, 40.5],
  ],
  perforationR: 4.5,
  /** The window: also a knockout, so the ground shows through it. */
  window: { x: 20, y: 20, w: 24, h: 24, r: 4 },
  /** Stands in for the check at and below PLUG_MAX_SIZE. */
  plug: { x: 26, y: 26, w: 12, h: 12, r: 3 },
  /** The check, as its polyline plus half its 4.4 stroke width. */
  check: [[26, 32.4], [30.2, 36.6], [38.2, 26.8]],
  checkR: 4.4 / 2,
};

/** Below this RENDERED edge length the check is illegible. */
const PLUG_MAX_SIZE = 20;

const BODY = [0x02, 0x84, 0xc7]; // --color-primary-600
const CHECK = [0x16, 0xa3, 0x4a]; // --color-identity-home
const WHITE = [0xff, 0xff, 0xff];

// ── Targets ─────────────────────────────────────────────────────
//
// `markFraction` is how much of the canvas edge the mark's 64-unit box
// spans, centred. Two values are in use, and both are chosen from the
// BODY edge (4..60 of 64) because that is the edge a person sees:
//
//   bodyFraction 0.5625  — web, Apple touch and the iOS app icon. The
//     body covers 9/16 of the tile; the rest is brand ground, which is
//     what makes the knocked-out window read at launcher size.
//   bodyFraction 0.50625 — Android adaptive foreground, the same mark
//     at 0.9 scale so it clears the launcher mask, which crops the
//     108dp canvas to as little as a 66dp circle.
//
// A favicon has no ground and no mask, so it fills its tile (1.0).

const fromBody = (bodyFraction) => (bodyFraction * VIEWBOX) / GEOMETRY.body.w;

const WEB_MARK = fromBody(0.5625);
const ANDROID_MARK = fromBody(0.50625);

/** Blue ground, white mark — the launcher-tile treatment. */
const REVERSE_ON_BRAND = { bodyColor: WHITE, checkColor: WHITE, ground: BODY };
/** White mark, no ground: Android composites it over its own background layer. */
const REVERSE_ON_NOTHING = { bodyColor: WHITE, checkColor: WHITE, ground: null };
/** The mark in brand colour on transparency, as favicon.svg draws it. */
const BRAND_ON_NOTHING = { bodyColor: BODY, checkColor: CHECK, ground: null };

const TARGETS = [
  // The .ico exists for clients that probe the document root and ignore
  // favicon.svg. Same two builds the SVG picks between, frozen: the 16
  // gets the plug, the 32 gets the check.
  {
    kind: 'ico',
    file: join(webRoot, 'public/favicon.ico'),
    sizes: [16, 32],
    markFraction: 1,
    ...BRAND_ON_NOTHING,
  },
  { kind: 'png', file: join(webRoot, 'public/icon-192.png'), size: 192, markFraction: WEB_MARK, ...REVERSE_ON_BRAND },
  { kind: 'png', file: join(webRoot, 'public/icon-512.png'), size: 512, markFraction: WEB_MARK, ...REVERSE_ON_BRAND },
  { kind: 'png', file: join(webRoot, 'public/apple-touch-icon.png'), size: 180, markFraction: WEB_MARK, ...REVERSE_ON_BRAND },
  {
    kind: 'png',
    file: join(appsRoot, 'ios/Pantopus/Resources/Assets.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'),
    size: 1024,
    markFraction: WEB_MARK,
    ...REVERSE_ON_BRAND,
  },
  // Adaptive-icon foregrounds. The blue ground is a vector drawable
  // (res/drawable/ic_launcher_background.xml), not a PNG, so these are
  // the white mark on transparency.
  ...[
    ['mdpi', 108], ['hdpi', 162], ['xhdpi', 216], ['xxhdpi', 324], ['xxxhdpi', 432],
  ].map(([density, size]) => ({
    kind: 'png',
    file: join(appsRoot, `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`),
    size,
    markFraction: ANDROID_MARK,
    ...REVERSE_ON_NOTHING,
  })),
];

// ── Drift guard ─────────────────────────────────────────────────
//
// The constants above are a hand-copy: PantopusMark.tsx is a client
// TSX component whose shapes are JSX, and _mark.ts is SVG path strings
// — neither is importable into a plain node script, and neither is in
// the form a distance-field rasterizer needs. So instead of pretending
// the copy cannot rot, we check it: every number and colour this script
// draws with must still be findable, verbatim, in the files it claims
// to mirror. Change the mark and this fails until you change it here
// too, which is the whole point.

const MIRRORS = [
  {
    file: join(webRoot, 'src/components/brand/PantopusMark.tsx'),
    needles: [
      'viewBox="0 0 64 64"',
      'x="4" y="4" width="56" height="56" rx="13"',
      'r="4.5"',
      'x="20" y="20" width="24" height="24" rx="4"',
      'x="26" y="26" width="12" height="12" rx="3"',
      'M26 32.4 30.2 36.6 38.2 26.8',
      'strokeWidth="4.4"',
      'PLUG_MAX_SIZE = 20',
      ...GEOMETRY.perforations.map(([cx, cy]) => `[${cx}, ${cy}]`),
    ],
  },
  {
    // The colours are tokens, not literals, in the component; they
    // resolve here.
    file: join(webRoot, 'src/app/globals.css'),
    needles: ['--color-primary-600: #0284c7', '--color-identity-home: #16A34A'],
  },
];

function assertMirrorsAgree() {
  const drift = [];
  for (const { file, needles } of MIRRORS) {
    const src = readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (!src.includes(needle)) drift.push(`${relative(webRoot, file)} no longer contains \`${needle}\``);
    }
  }
  if (drift.length > 0) {
    console.error('\nICON BUILD ABORTED — the geometry in this script no longer matches the mark:\n');
    for (const d of drift) console.error(`  ${d}`);
    console.error('\nReconcile GEOMETRY (and the colours) in scripts/build-icons.mjs with the component, then re-run.\n');
    process.exit(1);
  }
}

// ── Rasterizer ──────────────────────────────────────────────────
//
// Every shape is a signed distance in mark units: negative inside,
// positive outside, and the magnitude is the distance to the edge.
// That makes the boolean ops trivial (union = min, subtract = max
// against a negated field) and gives anti-aliasing for free — a pixel
// whose centre sits half a pixel outside an edge is half covered.

/** Signed distance to a rounded rectangle. */
function sdRoundRect(px, py, { x, y, w, h, r }) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Signed distance to a circle. */
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/**
 * Signed distance to a capsule — a segment fattened by `r`. A round
 * cap and a round join are both just "every point within r of the
 * polyline", so the check is the union of its two capsules and needs
 * no stroke-to-outline conversion.
 */
function sdCapsule(px, py, [ax, ay], [bx, by], r) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - t * vx, wy - t * vy) - r;
}

/** The body with the perforations and the window taken out of it. */
function sdMarkBody(px, py) {
  let holes = sdRoundRect(px, py, GEOMETRY.window);
  for (const [cx, cy] of GEOMETRY.perforations) {
    holes = Math.min(holes, sdCircle(px, py, cx, cy, GEOMETRY.perforationR));
  }
  return Math.max(sdRoundRect(px, py, GEOMETRY.body), -holes);
}

/** Distance → how much of a pixel `unit` units wide the shape covers. */
function coverage(d, unit) {
  return Math.min(1, Math.max(0, 0.5 - d / unit));
}

/** Straight-alpha source-over, in place, at one pixel. */
function over(buf, i, color, a) {
  if (a <= 0) return;
  const da = buf[i + 3] / 255;
  const outA = a + da * (1 - a);
  if (outA <= 0) return;
  for (let c = 0; c < 3; c++) {
    buf[i + c] = Math.round((color[c] * a + buf[i + c] * da * (1 - a)) / outA);
  }
  buf[i + 3] = Math.round(outA * 255);
}

/**
 * Render the mark into a `size`x`size` RGBA buffer.
 * `markFraction` is the mark's 64-unit box as a fraction of the canvas.
 */
function render({ size, markFraction, bodyColor, checkColor, ground }) {
  const buf = new Uint8ClampedArray(size * size * 4);
  const markPx = size * markFraction;
  const scale = markPx / VIEWBOX; // px per mark unit
  const origin = (size - markPx) / 2;
  const unit = 1 / scale; // mark units per pixel — the AA width

  // At and below PLUG_MAX_SIZE the check is illegible; the components
  // switch on the RENDERED mark size, so this does too.
  const usePlug = markPx <= PLUG_MAX_SIZE;

  for (let py = 0; py < size; py++) {
    const v = (py + 0.5 - origin) / scale;
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5 - origin) / scale;
      const i = (py * size + px) * 4;

      if (ground) {
        buf[i] = ground[0]; buf[i + 1] = ground[1]; buf[i + 2] = ground[2]; buf[i + 3] = 255;
      }

      over(buf, i, bodyColor, coverage(sdMarkBody(u, v), unit));

      if (usePlug) {
        over(buf, i, bodyColor, coverage(sdRoundRect(u, v, GEOMETRY.plug), unit));
      } else {
        const [a, b, c] = GEOMETRY.check;
        const d = Math.min(sdCapsule(u, v, a, b, GEOMETRY.checkR), sdCapsule(u, v, b, c, GEOMETRY.checkR));
        over(buf, i, checkColor, coverage(d, unit));
      }
    }
  }
  return buf;
}

// ── PNG ─────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Filter one scanline five ways and keep the one that compresses best. */
function filterScanline(cur, prev, bpp, out, at) {
  const n = cur.length;
  let best = null;
  for (let f = 0; f < 5; f++) {
    const line = Buffer.alloc(n);
    let sum = 0;
    for (let x = 0; x < n; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v;
      if (f === 0) v = cur[x];
      else if (f === 1) v = cur[x] - a;
      else if (f === 2) v = cur[x] - b;
      else if (f === 3) v = cur[x] - ((a + b) >> 1);
      else v = cur[x] - paeth(a, b, c);
      line[x] = v & 0xff;
      sum += line[x] < 128 ? line[x] : 256 - line[x];
    }
    if (!best || sum < best.sum) best = { sum, f, line };
  }
  out[at] = best.f;
  best.line.copy(out, at + 1);
}

/**
 * Encode an RGBA buffer. A fully opaque image is written as colour type
 * 2 (RGB) rather than 6 — a quarter smaller, and it is what the icons
 * in the tree already are.
 */
function encodePng(rgba, size) {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }

  const bpp = opaque ? 3 : 4;
  const stride = size * bpp;
  const raw = Buffer.alloc(size * (stride + 1));
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < size; y++) {
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      cur[x * bpp] = rgba[s];
      cur[x * bpp + 1] = rgba[s + 1];
      cur[x * bpp + 2] = rgba[s + 2];
      if (!opaque) cur[x * bpp + 3] = rgba[s + 3];
    }
    filterScanline(cur, prev, bpp, raw, y * (stride + 1));
    prev = cur;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // colour type
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO ─────────────────────────────────────────────────────────
//
// An .ico is a 6-byte directory header, one 16-byte entry per image,
// then the images back to back. Each image may be a BMP or — since
// Vista, and in every browser that still reads .ico at all — a whole
// PNG file, which is what we embed. A 256px image records its edge as
// 0, so the byte never overflows; ours are 16 and 32.

function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = header.length + dir.length;

  pngs.forEach(({ size, png }, n) => {
    const at = n * 16;
    dir[at] = size >= 256 ? 0 : size; // width
    dir[at + 1] = size >= 256 ? 0 : size; // height
    dir[at + 2] = 0; // palette size — 0 for direct colour
    dir[at + 3] = 0; // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...pngs.map((p) => p.png)]);
}

/**
 * Read an .ico back and report what a client would find in it. Called
 * on what we just wrote, so a malformed directory fails the build here
 * rather than silently in someone's browser tab.
 */
function describeIco(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    throw new Error('not an ICO: bad directory header');
  }
  const count = buf.readUInt16LE(4);
  if (count < 1) throw new Error('ICO declares no images');
  return Array.from({ length: count }, (_, n) => {
    const at = 6 + n * 16;
    const declared = buf[at] === 0 ? 256 : buf[at];
    const len = buf.readUInt32LE(at + 8);
    const off = buf.readUInt32LE(at + 12);
    if (off + len > buf.length) throw new Error(`ICO entry ${n} runs past the end of the file`);
    const img = buf.subarray(off, off + len);
    const isPng = img.readUInt32BE(0) === 0x89504e47;
    if (!isPng) throw new Error(`ICO entry ${n} is not a PNG`);
    // IHDR is always the first chunk: 8 bytes signature + 8 bytes chunk header.
    const w = img.readUInt32BE(16), h = img.readUInt32BE(20);
    if (w !== declared || h !== declared) {
      throw new Error(`ICO entry ${n}: directory says ${declared}px, the PNG is ${w}x${h}`);
    }
    return `${w}x${h} PNG, ${len} bytes`;
  });
}

// ── Run ─────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const listOnly = argv.includes('--list');

const destination = (file) => (outDir ? join(outDir, relative(appsRoot, file)) : file);

assertMirrorsAgree();

const selected = TARGETS.filter((t) => !only || t.file.includes(only));
if (selected.length === 0) {
  console.error(`No target matches --only ${only}. Run with --list to see them.`);
  process.exit(1);
}

if (listOnly) {
  for (const t of selected) {
    const size = t.kind === 'ico' ? t.sizes.join('+') : t.size;
    console.log(`${size.toString().padStart(8)}  ${relative(appsRoot, t.file)}`);
  }
  process.exit(0);
}

for (const target of selected) {
  const out = destination(target.file);
  mkdirSync(dirname(out), { recursive: true });

  if (target.kind === 'ico') {
    const pngs = target.sizes.map((size) => ({ size, png: encodePng(render({ ...target, size }), size) }));
    writeFileSync(out, encodeIco(pngs));
    // Round-trip what landed on disk, not what we held in memory.
    const entries = describeIco(readFileSync(out));
    console.log(`${relative(appsRoot, target.file)} — ${entries.join(', ')}`);
  } else {
    const png = encodePng(render(target), target.size);
    writeFileSync(out, png);
    console.log(`${relative(appsRoot, target.file)} — ${target.size}x${target.size}, ${png.length} bytes`);
  }
}

if (outDir) console.log(`\nWrote to ${outDir} — nothing in the repo was touched.`);
