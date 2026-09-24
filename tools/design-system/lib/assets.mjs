// assets/Logos and assets/Icons.
//
// Logos are drawn from the perforation mark's canonical geometry, the same
// hand-kept mirror scripts/build-icons.mjs uses, behind the same drift guard:
// every number below must still appear verbatim in PantopusMark.tsx. Colors
// come from the built tokens. The favicon and 512px icon are the shipped files.
// Icons are the NavIcons glyphs, drawn from lucide-react's own icon nodes.

import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { LOGOS, NAV_ICONS } from '../config.mjs';
import { lucideIconFile } from './bundle.mjs';
import { WEB, WEB_SRC, packageDir, read, write } from './repo.mjs';

const MARK_SOURCE = join(WEB_SRC, 'components/brand/PantopusMark.tsx');
const PERFORATIONS = [
  [23.5, 4],
  [40.5, 4],
  [23.5, 60],
  [40.5, 60],
  [4, 23.5],
  [4, 40.5],
  [60, 23.5],
  [60, 40.5],
];
const NEEDLES = [
  'viewBox="0 0 64 64"',
  'x="4" y="4" width="56" height="56" rx="13"',
  'r="4.5"',
  'x="20" y="20" width="24" height="24" rx="4"',
  'M26 32.4 30.2 36.6 38.2 26.8',
  'strokeWidth="4.4"',
  ...PERFORATIONS.map(([cx, cy]) => `[${cx}, ${cy}]`),
];
// The launcher tile: the body spans 9/16 of the tile (scripts/build-icons.mjs).
const BODY_FRACTION = 0.5625;
const BUILD_ICONS = join(WEB, 'scripts/build-icons.mjs');

function guard() {
  const mark = read(MARK_SOURCE);
  const drift = NEEDLES.filter((needle) => !mark.includes(needle));
  if (!read(BUILD_ICONS).includes(`fromBody(${BODY_FRACTION})`)) drift.push(`scripts/build-icons.mjs fromBody(${BODY_FRACTION})`);
  if (drift.length) {
    throw new Error(`The mark changed; update lib/assets.mjs to match PantopusMark.tsx. Missing:\n  ${drift.join('\n  ')}`);
  }
}

const mask = (id) =>
  [
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">`,
    '<rect width="64" height="64" fill="#000"/>',
    '<rect x="4" y="4" width="56" height="56" rx="13" fill="#fff"/>',
    ...PERFORATIONS.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="4.5" fill="#000"/>`),
    '<rect x="20" y="20" width="24" height="24" rx="4" fill="#000"/>',
    '</mask>',
  ].join('');

const mark = (id, body, check) =>
  `${mask(id)}<rect width="64" height="64" fill="${body}" mask="url(#${id})"/>` +
  `<path d="M26 32.4 30.2 36.6 38.2 26.8" fill="none" stroke="${check}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;

const svg = (viewBox, width, height, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" role="img" aria-label="Pantopus">${inner}</svg>\n`;

/** Parse a lucide ESM icon file's __iconNode into SVG child elements. */
function lucideChildren(file) {
  const m = /const __iconNode = (\[[\s\S]*?\]);\n/.exec(read(file));
  if (!m) throw new Error(`No icon node in ${file}`);
  const nodes = JSON.parse(m[1].replace(/([{,]\s*)([A-Za-z]+):/g, '$1"$2":'));
  return nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
}

/** NavIcons key → lucide component name, from src/lib/icons.ts. */
function navIcons() {
  const source = read(join(WEB_SRC, 'lib/icons.ts'));
  const block = /export const NavIcons = \{([\s\S]*?)\n\}/.exec(source);
  if (!block) throw new Error('src/lib/icons.ts no longer exports NavIcons');
  return new Map([...block[1].matchAll(/^\s*(\w+):\s*(\w+),/gm)].map((m) => [m[1], m[2]]));
}

/**
 * @param {{ projectDir: string, color: (token: string, theme?: string) => string }} options
 */
export function buildAssets({ projectDir, color }) {
  guard();
  const logos = join(projectDir, 'assets/Logos');
  mkdirSync(logos, { recursive: true });
  const brand = color('color-primary-600', 'light');
  const check = color('color-brand-check', 'light');
  const written = {
    'pantopus-mark.svg': svg('0 0 64 64', 64, 64, mark('pt-mark', brand, check)),
    'pantopus-mark-dark.svg': svg('0 0 64 64', 64, 64, mark('pt-mark-dark', color('color-primary-400', 'light'), check)),
    'pantopus-app-icon.svg': (() => {
      const scale = (BODY_FRACTION * 64) / 56;
      const offset = (64 - 64 * scale) / 2;
      return svg('0 0 64 64', 512, 512, `<rect width="64" height="64" fill="${brand}"/><g transform="translate(${+offset.toFixed(6)} ${+offset.toFixed(6)}) scale(${+scale.toFixed(6)})">${mark('pt-app', '#FFFFFF', '#FFFFFF')}</g>`);
    })(),
    'pantopus-lockup.svg': (() => {
      // PantopusLockup: gap = size/3, wordmark 0.83 × size, bold, -0.02em, lifted 0.04em.
      const size = 64;
      const font = +(size * 0.83).toFixed(2);
      return svg(
        '0 0 352 64',
        352,
        64,
        `<g>${mark('pt-lockup', brand, check)}</g>` +
          `<text x="${+(size + size / 3).toFixed(2)}" y="32" dy="${+(font * 0.35 - font * 0.04).toFixed(2)}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="${font}" font-weight="700" letter-spacing="${+(-0.02 * font).toFixed(2)}" fill="${color('app-text', 'light')}">Pantopus</text>`,
      );
    })(),
  };
  for (const [name, text] of Object.entries(written)) write(join(logos, name), text);
  copyFileSync(join(WEB, 'public/favicon.svg'), join(logos, 'pantopus-favicon.svg'));
  copyFileSync(join(WEB, 'public/icon-512.png'), join(logos, 'pantopus-icon-512.png'));
  for (const name of LOGOS) read(join(logos, name)); // every configured logo exists

  const icons = join(projectDir, 'assets/Icons');
  const registry = navIcons();
  const rows = [];
  const files = [];
  for (const key of NAV_ICONS) {
    const component = registry.get(key);
    if (!component) throw new Error(`NavIcons.${key} is gone from src/lib/icons.ts; update NAV_ICONS in config.mjs`);
    const file = lucideIconFile(component);
    const lucide = basename(file, '.js');
    const name = `${key === lucide ? key : `${key}-${lucide}`}.svg`;
    write(
      join(icons, name),
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${brand}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${lucideChildren(file)}</svg>\n`,
    );
    rows.push(`- \`${name}\`: Lucide \`${lucide}\`, the web's \`NavIcons.${key}\`.`);
    files.push(name);
  }
  const lucideVersion = JSON.parse(read(join(packageDir('lucide-react'), 'package.json'))).version.split('.').slice(0, 2).join('.');
  write(
    join(icons, 'README.md'),
    `# Icons\n\nThe ${files.length} primary navigation glyphs from the web registry (\`src/lib/icons.ts\`), copied from Lucide (lucide-react ${lucideVersion}, ISC). They are 24px, stroke 2, round caps and joins, drawn in ${brand} (\`color-primary-600\`) for display; in product every icon takes \`currentColor\`. iOS renders the same names as SF Symbols, Android as Material Icons Extended.\n\n${rows.join('\n')}\n`,
  );

  return {
    Logos: LOGOS.map((name) => ({ name, path: `assets/Logos/${name}` })),
    Icons: files.map((name) => ({ name, path: `assets/Icons/${name}` })),
  };
}
