// Readers for the shipped token sources on all three platforms. Each one
// throws when its file moved or its shape changed, so a stale build fails
// instead of quietly emitting old values.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ANDROID_THEME, IOS_COLORSETS, IOS_DESIGN, PACKAGES, WEB_SRC, read, webRequire } from './repo.mjs';

export const SOURCE_FILES = {
  webCss: join(WEB_SRC, 'app/globals.css'),
  theme: join(PACKAGES, 'theme/src'),
  iosColors: join(IOS_DESIGN, 'Colors.swift'),
  iosShadows: join(IOS_DESIGN, 'Shadows.swift'),
  iosSpacing: join(IOS_DESIGN, 'Spacing.swift'),
  iosRadii: join(IOS_DESIGN, 'Radii.swift'),
  androidColors: join(ANDROID_THEME, 'Color.kt'),
  androidShadows: join(ANDROID_THEME, 'Shadows.kt'),
  androidSpacing: join(ANDROID_THEME, 'Spacing.kt'),
  androidRadii: join(ANDROID_THEME, 'Radii.kt'),
  androidType: join(ANDROID_THEME, 'Typography.kt'),
};

const hex2 = (n) => n.toString(16).padStart(2, '0').toUpperCase();
export const rgbToHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function must(value, what) {
  if (value === undefined || value === null || (value instanceof Map && value.size === 0)) {
    throw new Error(`Token source changed shape: ${what}`);
  }
  return value;
}

// ── Web: frontend/apps/web/src/app/globals.css ─────────────────

/** The body of the `{ … }` block that starts at `open` (brace-balanced). */
function blockAt(css, open) {
  const start = css.indexOf('{', open);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  throw new Error('Unbalanced CSS block');
}

/** Custom-property declarations, splitting on `;` outside quotes and parens. */
function declarations(body) {
  const out = new Map();
  let buf = '';
  let depth = 0;
  let quote = null;
  const flush = () => {
    const m = /^\s*--([\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(buf);
    if (m) out.set(m[1], m[2].replace(/\s+/g, ' '));
    buf = '';
  };
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) {
      flush();
      continue;
    }
    buf += ch;
  }
  flush();
  return out;
}

/** "246 247 249" → "#F6F7F9"; hex passes through upper-cased; anything else → null. */
export function asColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  const m = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/.exec(value);
  return m ? rgbToHex(m.slice(1).map(Number)) : null;
}

export function readWeb() {
  const css = read(SOURCE_FILES.webCss).replace(/\/\*[\s\S]*?\*\//g, '');
  const root = must(/^:root\s*\{/m.exec(css), 'globals.css has no top-level :root block');
  const media = must(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/.exec(css), 'globals.css has no dark media block');
  const darkBody = blockAt(css, media.index);
  const darkRoot = must(/:root\s*\{/.exec(darkBody), 'dark media block has no :root');
  return {
    light: must(declarations(blockAt(css, root.index)), 'globals.css :root declarations'),
    dark: must(declarations(blockAt(darkBody, darkRoot.index)), 'globals.css dark declarations'),
    text: read(SOURCE_FILES.webCss),
  };
}

// ── Shared theme package: frontend/packages/theme/src ──────────

/** Evaluate a dependency-free TS module (plain `export const` objects). */
function evalTs(file) {
  const ts = webRequire('typescript');
  const js = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const module = { exports: {} };
  const noImports = () => {
    throw new Error(`${file} imports another module; the theme reader expects standalone token files`);
  };
  vm.runInNewContext(js, { module, exports: module.exports, require: noImports }, { filename: file });
  return module.exports;
}

export function readTheme() {
  const dir = SOURCE_FILES.theme;
  return {
    spacing: must(evalTs(join(dir, 'spacing.ts')).spacing, 'theme spacing'),
    radii: must(evalTs(join(dir, 'radii.ts')).radii, 'theme radii'),
    typography: must(evalTs(join(dir, 'typography.ts')).typography, 'theme typography'),
    cssShadows: must(evalTs(join(dir, 'shadows.ts')).cssShadows, 'theme cssShadows'),
  };
}

// ── iOS: Colors.swift + the asset catalog ──────────────────────

function channel(value, floatMode) {
  const v = String(value).trim();
  if (/^0x/i.test(v)) return parseInt(v, 16);
  return floatMode ? Math.round(parseFloat(v) * 255) : parseInt(v, 10);
}

function colorsetHex(components) {
  const parts = [components.red, components.green, components.blue];
  const floatMode = parts.some((p) => String(p).includes('.')) || parts.every((p) => Number(p) <= 1);
  return rgbToHex(parts.map((p) => channel(p, floatMode)));
}

/** Theme.Color token → { light, dark, asset } from its colorset (dark falls back to light). */
export function readIosColors() {
  const swift = read(SOURCE_FILES.iosColors);
  const out = new Map();
  for (const m of swift.matchAll(/static let (\w+) = SwiftUI\.Color\("([^"]+)"/g)) {
    const file = join(IOS_COLORSETS, `${m[2]}.colorset`, 'Contents.json');
    if (!existsSync(file)) throw new Error(`Theme.Color.${m[1]} points at a missing colorset: ${m[2]}`);
    let light;
    let dark;
    for (const entry of JSON.parse(read(file)).colors) {
      const appearances = entry.appearances ?? [];
      const hex = colorsetHex(entry.color.components);
      if (appearances.length === 0) light = hex;
      else if (appearances.some((a) => a.appearance === 'luminosity' && a.value === 'dark')) dark = hex;
    }
    out.set(m[1], { light: must(light, `${m[2]} light color`), dark: dark ?? light, asset: m[2] });
  }
  return must(out, 'Colors.swift tokens');
}

/** PantopusShadow tokens → { color, opacity, radius, x, y }. */
export function readIosShadows(iosColors) {
  const out = new Map();
  for (const m of read(SOURCE_FILES.iosShadows).matchAll(/static let (\w+) = PantopusShadow\(([\s\S]*?)\)\n/g)) {
    // \b keeps `y:` from matching inside `opacity:`.
    const arg = (name) => must(new RegExp(`\\b${name}:\\s*([^,\\n)]+)`).exec(m[2]), `PantopusShadow.${m[1]} ${name}`)[1].trim();
    const color = arg('color');
    const token = /Theme\.Color\.(\w+)/.exec(color)?.[1];
    out.set(m[1], {
      rgb: color === '.black' ? [0, 0, 0] : hexToRgb(must(iosColors.get(token), `shadow color ${color}`).light),
      opacity: Number(arg('opacity')),
      radius: Number(arg('radius')),
      x: Number(arg('x')),
      y: Number(arg('y')),
    });
  }
  return must(out, 'Shadows.swift tokens');
}

// ── Android: ui/theme ──────────────────────────────────────────

export function readAndroidColors() {
  const kt = read(SOURCE_FILES.androidColors);
  return must(
    new Map([...kt.matchAll(/val (\w+) = Color\(0xFF([0-9A-Fa-f]{6})\)/g)].map((m) => [m[1], `#${m[2].toUpperCase()}`])),
    'Color.kt tokens',
  );
}

export function readAndroidShadows(androidColors) {
  const out = new Map();
  for (const m of read(SOURCE_FILES.androidShadows).matchAll(/val (\w+) = PantopusElevation\(([^)]*)\)/g)) {
    const [color, alpha, radius, x, y] = m[2].split(',').map((s) => s.trim());
    const token = /PantopusColors\.(\w+)/.exec(color)?.[1];
    out.set(m[1], {
      rgb: color === 'Color.Black' ? [0, 0, 0] : hexToRgb(must(androidColors.get(token), `elevation color ${color}`)),
      opacity: parseFloat(alpha),
      radius: parseFloat(radius),
      x: parseFloat(x),
      y: parseFloat(y),
    });
  }
  return must(out, 'Shadows.kt elevations');
}

/** PantopusTextStyle roles → { fontSize, lineHeight, weight, letterSpacingEm }. */
export function readAndroidType() {
  const out = new Map();
  for (const m of read(SOURCE_FILES.androidType).matchAll(/val (\w+) =\s*TextStyle\(([\s\S]*?)\n\s*\)/g)) {
    const body = m[2];
    const num = (re) => (re.exec(body) ? Number(re.exec(body)[1]) : undefined);
    out.set(m[1], {
      fontSize: num(/fontSize = ([\d.]+)\.sp/),
      lineHeight: num(/lineHeight = ([\d.]+)\.sp/),
      weight: /fontWeight = FontWeight\.(\w+)/.exec(body)?.[1],
      letterSpacingEm: num(/letterSpacing = \(?(-?[\d.]+)\)?\.em/) ?? 0,
    });
  }
  return must(out, 'Typography.kt styles');
}

/** `val s4: Dp = 16.dp` / `public static let s4: CGFloat = 16` → Map(name → number). */
export function readNativeScale(file) {
  const text = read(file);
  const re = file.endsWith('.kt') ? /val (\w+): Dp = ([\d.]+)\.dp/g : /static let (\w+): CGFloat = ([\d.]+)/g;
  return must(new Map([...text.matchAll(re)].map((m) => [m[1], Number(m[2])])), `${file} scale`);
}
