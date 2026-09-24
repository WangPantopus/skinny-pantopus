// tokens.json from the platform sources plus the curated spec.
//
// Values: globals.css (web light + dark), the iOS asset catalog (Dark · iOS),
// Color.kt, and the shared theme package. The spec (content/tokens.mjs)
// supplies order, names, notes and the cross-platform mapping. Every
// disagreement between platforms, every token a platform adds or drops, and
// every sub-4.5:1 pair a note doesn't acknowledge lands in the report.

import { join } from 'node:path';
import { COLORS, COLOR_NOTE, FAMILIES, IGNORED, RADIUS, SHADOWS, SPACING, THEMES, TYPE_GROUPS } from '../content/tokens.mjs';
import { ratio } from './contrast.mjs';
import { REPO, read, webRequire } from './repo.mjs';
import * as S from './sources.mjs';

const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Normal: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };
const RADIUS_NATIVE = { '2xl': 'xl2', '3xl': 'xl3' };
// A failing pair is fine when its note says so.
const ACKNOWLEDGED = /flag|NOT legible|never text|decorative/i;

const px = (n) => (n === 0 ? '0' : `${n}px`);
const em = (n) => `${Number(n.toFixed(4))}em`;

/** Normalize rgba() spacing and numbers so equal shadows compare equal. */
function normShadow(value) {
  return value.replace(/rgba\(([^)]*)\)/g, (_, args) => `rgba(${args.split(',').map((a) => String(Number(a))).join(', ')})`);
}

const shadowCss = (s) => `${px(s.x)} ${px(s.y)} ${px(s.radius)} rgba(${s.rgb.join(', ')}, ${Number(s.opacity)})`;

export function buildTokens(info) {
  const report = { errors: [], warnings: [], lowContrast: [] };
  const web = S.readWeb();
  const theme = S.readTheme();
  const ios = S.readIosColors();
  const android = S.readAndroidColors();

  // ── Colors ────────────────────────────────────────────────────
  const values = new Map();
  for (const t of COLORS) {
    if (!t.usage) report.errors.push(`${t.name}: no usage note`);
    if (t.alias) {
      values.set(t.name, { alias: t.alias });
      continue;
    }
    let light;
    let dark;
    let darkIos;
    if (t.web) {
      const cssName = t.web === true ? t.name : t.web;
      const raw = web.light.get(cssName);
      if (raw === undefined) {
        report.errors.push(`globals.css no longer defines --${cssName} (${t.name})`);
        continue;
      }
      light = S.asColor(raw);
      if (!light) {
        report.errors.push(`--${cssName} is not a hex or R G B color: ${raw}`);
        continue;
      }
      if (web.dark.has(cssName)) dark = S.asColor(web.dark.get(cssName));
    }
    if (t.ios) {
      const c = ios.get(t.ios);
      if (!c) report.errors.push(`Colors.swift no longer defines Theme.Color.${t.ios} (${t.name})`);
      else {
        if (light && c.light !== light) report.warnings.push(`${t.name}: web ${light} vs iOS ${t.ios} ${c.light}`);
        light ??= c.light;
        // Spell out the iOS dark value whenever it differs, or when the web
        // has a dark value too, so a reader sees all three columns.
        if (dark !== undefined || c.dark !== light) darkIos = c.dark;
      }
    }
    if (t.android) {
      const a = android.get(t.android);
      if (!a) report.errors.push(`Color.kt no longer defines PantopusColors.${t.android} (${t.name})`);
      else {
        if (light && a !== light) report.warnings.push(`${t.name}: ${light} vs Android ${t.android} ${a}`);
        light ??= a;
      }
    }
    if (!light) {
      report.errors.push(`${t.name}: no platform defines it`);
      continue;
    }
    values.set(t.name, { light, dark, darkIos });
  }

  const resolve = (name, themeId) => {
    const v = values.get(name);
    if (!v) throw new Error(`usage note references unknown token ${name}`);
    if (v.alias) return resolve(v.alias, themeId);
    return (themeId === 'dark' ? v.dark : themeId === 'dark-ios' ? v.darkIos : undefined) ?? v.light;
  };

  for (const t of COLORS.filter((c) => c.alias)) {
    if (!values.has(t.alias)) report.errors.push(`${t.name} aliases missing token ${t.alias}`);
    const webValue = web.light.get(t.name);
    if (webValue && S.asColor(webValue) !== resolve(t.alias, 'light')) {
      report.warnings.push(`--${t.name} is ${webValue}, but ${t.alias} is ${resolve(t.alias, 'light')}`);
    }
  }

  const colorTokens = [];
  for (const t of COLORS) {
    const v = values.get(t.name);
    if (!v) continue;
    const usage = (t.usage ?? '').replace(/\{\{([\w-]+)\|([\w-]+)\}\}/g, (_, fg, bg) => {
      const r = THEMES.map((th) => ratio(resolve(fg, th.id), resolve(bg, th.id)));
      r.forEach((x, i) => {
        if (x >= 4.5) return;
        const line = `${THEMES[i].id} ${fg} on ${bg} = ${x}`;
        (ACKNOWLEDGED.test(t.usage) ? report.lowContrast : report.warnings).push(ACKNOWLEDGED.test(t.usage) ? line : `unflagged low contrast: ${line}`);
      });
      return `(${r.map((x, i) => `${THEMES[i].name.replace('Dark · iOS', 'iOS')} ${x.toFixed(2)}`).join(' · ')})`;
    });
    let value;
    if (v.alias) value = `{${v.alias}}`;
    else {
      const byTheme = { light: v.light.toLowerCase() };
      if (v.dark) byTheme.dark = v.dark.toLowerCase();
      if (v.darkIos) byTheme['dark-ios'] = v.darkIos.toLowerCase();
      value = Object.keys(byTheme).length === 1 ? byTheme.light : byTheme;
    }
    colorTokens.push({ name: t.name, value, usage });
  }

  // Tokens a platform defines that the spec neither maps nor ignores.
  const mapped = (key) => new Set(COLORS.map((c) => (c[key] === true ? c.name : c[key])).filter(Boolean));
  const webMapped = new Set([...mapped('web'), ...COLORS.filter((c) => c.alias).map((c) => c.name)]);
  for (const [name, raw] of web.light) {
    if (S.asColor(raw) && !webMapped.has(name) && !(name in IGNORED.web)) report.warnings.push(`untracked web color --${name}: add it to content/tokens.mjs`);
  }
  for (const name of web.dark.keys()) {
    if (!web.light.has(name)) report.warnings.push(`--${name} is defined only in the dark block`);
  }
  const iosMapped = mapped('ios');
  for (const name of ios.keys()) {
    if (!iosMapped.has(name) && !(name in IGNORED.ios)) report.warnings.push(`untracked iOS color Theme.Color.${name}: add it to content/tokens.mjs`);
  }
  const androidMapped = mapped('android');
  for (const [name, hex] of android) {
    if (!androidMapped.has(name) && !(name in IGNORED.android)) report.warnings.push(`untracked Android color PantopusColors.${name}: add it to content/tokens.mjs`);
    // The dark Material twins should match the iOS dark neutrals.
    const twin = /^(app\w+)Dark$/.exec(name)?.[1];
    if (twin && ios.get(twin) && ios.get(twin).dark !== hex) {
      report.warnings.push(`Android ${name} ${hex} vs iOS ${twin} dark ${ios.get(twin).dark}`);
    }
  }
  for (const key of ['ios', 'android']) {
    const source = key === 'ios' ? ios : android;
    for (const name of Object.keys(IGNORED[key])) {
      if (!source.has(name)) report.warnings.push(`IGNORED.${key}.${name} no longer exists; drop it from content/tokens.mjs`);
    }
  }

  // ── Type ──────────────────────────────────────────────────────
  const tailwindTheme = webRequire('tailwindcss/defaultTheme');
  const families = {};
  for (const [key, spec] of Object.entries(FAMILIES)) {
    families[key] = spec.tailwind ? tailwindTheme.fontFamily[spec.tailwind].join(', ') : web.light.get(spec.webVar);
    if (!families[key]) report.errors.push(`font family ${key} has no source`);
  }

  const androidType = S.readAndroidType();
  const sourceText = new Map();
  const groups = TYPE_GROUPS.map((g) => {
    const styles = g.styles.map((s) => {
      if (!s.usage) report.errors.push(`type style ${s.name}: no usage note`);
      if (g.derived) {
        const base = theme.typography[s.name];
        if (!base) {
          report.errors.push(`typography.ts no longer defines ${s.name}`);
          return null;
        }
        const out = { name: s.name, fontSize: px(base.fontSize), lineHeight: px(base.lineHeight), fontWeight: Number(base.fontWeight) };
        const nat = s.native && androidType.get(s.native);
        if (s.native && !nat) report.warnings.push(`PantopusTextStyle.${s.native} is missing (${s.name})`);
        if (nat) {
          if (nat.fontSize !== base.fontSize || nat.lineHeight !== base.lineHeight || WEIGHTS[nat.weight] !== Number(base.fontWeight)) {
            report.warnings.push(`${s.name}: theme ${base.fontSize}/${base.lineHeight}/${base.fontWeight} vs Android ${s.native} ${nat.fontSize}/${nat.lineHeight}/${nat.weight}`);
          }
          if (nat.letterSpacingEm) out.letterSpacing = em(nat.letterSpacingEm);
        }
        return { ...out, sample: s.sample, usage: s.usage };
      }
      if (s.source) {
        const [file, needle] = s.source;
        if (!sourceText.has(file)) sourceText.set(file, read(join(REPO, file)));
        if (!sourceText.get(file).includes(needle)) report.warnings.push(`type style ${s.name} may be stale: ${file} no longer contains "${needle}"`);
      }
      const { source, ...rest } = s;
      return rest;
    });
    const known = new Set(g.styles.map((s) => s.name));
    if (g.derived) {
      for (const name of Object.keys(theme.typography)) {
        if (!known.has(name)) report.warnings.push(`untracked text style typography.${name}: add it to content/tokens.mjs`);
      }
    }
    const group = { name: g.name, family: g.family };
    if (g.note) group.note = g.note;
    group.styles = styles.filter(Boolean);
    return group;
  });

  // ── Spacing and radius ────────────────────────────────────────
  const iosSpacing = S.readNativeScale(S.SOURCE_FILES.iosSpacing);
  const androidSpacing = S.readNativeScale(S.SOURCE_FILES.androidSpacing);
  const spacing = Object.entries(theme.spacing).map(([key, n]) => {
    const name = `spacing-${key}`;
    if (web.light.get(name) !== `${n}px`) report.warnings.push(`--${name} is ${web.light.get(name)}, theme says ${n}px`);
    for (const [label, scale] of [['iOS', iosSpacing], ['Android', androidSpacing]]) {
      if (scale.get(`s${key}`) !== n) report.warnings.push(`${label} Spacing.s${key} is ${scale.get(`s${key}`)}, theme says ${n}`);
    }
    if (!SPACING.usage[name]) report.errors.push(`${name}: no usage note`);
    return { name, value: `${n}px`, usage: SPACING.usage[name] };
  });

  const iosRadii = S.readNativeScale(S.SOURCE_FILES.iosRadii);
  const androidRadii = S.readNativeScale(S.SOURCE_FILES.androidRadii);
  const radius = Object.entries(theme.radii).map(([key, n]) => {
    const name = `radius-${key}`;
    if (web.light.get(name) !== `${n}px`) report.warnings.push(`--${name} is ${web.light.get(name)}, theme says ${n}px`);
    const nativeKey = RADIUS_NATIVE[key] ?? key;
    for (const [label, scale] of [['iOS', iosRadii], ['Android', androidRadii]]) {
      if (scale.has(nativeKey) && scale.get(nativeKey) !== n) report.warnings.push(`${label} Radii.${nativeKey} is ${scale.get(nativeKey)}, theme says ${n}`);
    }
    if (!RADIUS.usage[name]) report.errors.push(`${name}: no usage note`);
    return { name, value: `${n}px`, usage: RADIUS.usage[name] };
  });
  for (const name of [...Object.keys(SPACING.usage), ...Object.keys(RADIUS.usage)]) {
    if (![...spacing, ...radius].some((t) => t.name === name)) report.warnings.push(`${name} has a note but no value any more`);
  }

  // ── Shadows ───────────────────────────────────────────────────
  const iosShadows = S.readIosShadows(ios);
  const androidShadows = S.readAndroidShadows(android);
  const shadow = [];
  for (const t of SHADOWS.tokens) {
    const [kind, key] = t.from.split(':');
    let value;
    if (kind === 'theme') value = theme.cssShadows[key];
    else if (kind === 'web') value = web.light.get(key);
    else if (kind === 'ios') value = iosShadows.get(key) && shadowCss(iosShadows.get(key));
    else if (kind === 'android') value = androidShadows.get(key) && shadowCss(androidShadows.get(key));
    if (!value) {
      report.errors.push(`${t.name}: ${t.from} not found`);
      continue;
    }
    value = normShadow(value);
    if (t.ios && iosShadows.get(t.ios) && shadowCss(iosShadows.get(t.ios)) !== value) report.warnings.push(`${t.name} ${value} vs iOS ${t.ios} ${shadowCss(iosShadows.get(t.ios))}`);
    if (t.android && androidShadows.get(t.android) && shadowCss(androidShadows.get(t.android)) !== value) report.warnings.push(`${t.name} ${value} vs Android ${t.android} ${shadowCss(androidShadows.get(t.android))}`);
    shadow.push({ name: t.name, value, usage: t.usage });
  }

  const tokens = {
    name: 'Pantopus',
    version: 1,
    color: { note: COLOR_NOTE, themes: THEMES, tokens: colorTokens },
    type: { fonts: [], families, groups },
    spacing: { note: SPACING.note, tokens: spacing },
    radius: { note: RADIUS.note, tokens: radius },
    shadow: { note: SHADOWS.note, tokens: shadow },
    meta: {
      source: 'github',
      repo: info.repo,
      ref: `${info.branch}@${info.commit}`,
      paths: {
        tokens: [
          'frontend/apps/web/src/app/globals.css',
          'frontend/packages/theme/src/*.ts',
          'frontend/apps/ios/Pantopus/Core/Design/*.swift',
          'frontend/apps/ios/Pantopus/Resources/Assets.xcassets/Colors/**',
          'frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/*.kt',
        ],
        assets: ['frontend/apps/web/src/components/brand/PantopusMark.tsx', 'frontend/apps/web/public/favicon.svg', 'frontend/apps/web/src/lib/icons.ts'],
        docs: ['tools/design-system/content/README.md', 'tools/design-system/content/components/*.md'],
      },
      components: 'frontend/apps/web/src/components/{archetypes/primitives,archetypes/place,ui,brand}',
      producer: 'tools/design-system/build.mjs',
      synced: info.date,
    },
  };

  return { tokens, css: compileCss(tokens), resolve, report };
}

/** The preview frame's tokens.css, compiled the way the page does it. */
function compileCss(tokens) {
  const themes = tokens.color.themes.map((t) => t.id);
  const toCss = (v) => (/^\{(.+)\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
  const lines = [];
  themes.forEach((id, i) => {
    lines.push(i === 0 ? `:root, [data-theme="${id}"] {` : `[data-theme="${id}"] {`);
    for (const t of tokens.color.tokens) {
      const v = typeof t.value === 'string' ? (i === 0 ? t.value : undefined) : t.value[id];
      if (v) lines.push(`  --${t.name}: ${toCss(v)};`);
    }
    if (i === 0) for (const t of tokens.shadow.tokens) lines.push(`  --${t.name}: ${t.value};`);
    lines.push('}');
  });
  lines.push(':root {');
  for (const t of [...tokens.spacing.tokens, ...tokens.radius.tokens]) lines.push(`  --${t.name}: ${t.value};`);
  for (const [k, v] of Object.entries(tokens.type.families)) lines.push(`  --font-${k}: ${v};`);
  lines.push('}');
  return lines.join('\n') + '\n';
}
