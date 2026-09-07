import { readFileSync } from 'node:fs';
import path from 'node:path';

// Read the shipped token sources, so a palette edit cannot silently undo the
// contrast pass. This checks color pairs; rendered screens still need visual QA.
type RGB = number[];
type Palette = Record<string, RGB>;
const apps = path.resolve(__dirname, '../..');
const white = [1, 1, 1];
const roles = [
  'success',
  'warning',
  'error',
  'info',
  'personal',
  'home',
  'business',
];
const semanticRoles = roles.slice(0, 4);
const surfaces = [
  'appBg',
  'appSurface',
  'appSurfaceRaised',
  'appSurfaceSunken',
  'appSurfaceMuted',
];
const inks = ['appText', 'appTextStrong', 'appTextSecondary', 'appTextMuted'];
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function rgb(value: string): RGB {
  if (value.startsWith('#')) {
    return [1, 3, 5].map(
      (offset) => parseInt(value.slice(offset, offset + 2), 16) / 255,
    );
  }
  return value.split(/\s+/).map((channel) => Number(channel) / 255);
}

function luminance(color: RGB): number {
  const linear = color.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a: RGB, b: RGB): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const css = readFileSync(
  path.join(apps, 'web/src/app/globals.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');
const blocks = [...css.matchAll(/:root\s*\{([^}]+)\}/g)];
const declarations = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
const light = declarations(blocks[0][1]);
const dark = { ...light, ...declarations(blocks[1][1]) };

function webPalette(tokens: Record<string, string>): Palette {
  const result: Palette = {};
  for (const key of [...surfaces, ...inks])
    result[key] = rgb(tokens[kebab(key)]);
  for (const role of roles) {
    const prefix = semanticRoles.includes(role) ? 'color-' : 'color-identity-';
    for (const suffix of [
      '',
      'Bg',
      'Solid',
      ...(semanticRoles.includes(role) ? ['Light'] : []),
    ]) {
      result[role + suffix] = rgb(tokens[prefix + role + kebab(suffix)]);
    }
  }
  result.link = rgb(tokens['color-link']);
  return result;
}

function iosPalette(appearance: 'light' | 'dark'): Palette {
  const result: Palette = {};
  function read(group: string, name: string): RGB {
    const asset = JSON.parse(
      readFileSync(
        path.join(
          apps,
          `ios/Pantopus/Resources/Assets.xcassets/Colors/${group}/${capitalize(name)}.colorset/Contents.json`,
        ),
        'utf8',
      ),
    );
    const entry =
      asset.colors.find((color: { appearances?: { value: string }[] }) =>
        appearance === 'dark'
          ? color.appearances?.some((a) => a.value === 'dark')
          : !color.appearances,
      ) ?? asset.colors[0];
    const c = entry.color.components;
    return [c.red, c.green, c.blue].map(Number);
  }
  for (const key of [...surfaces, ...inks]) result[key] = read('Neutral', key);
  for (const role of roles) {
    const semantic = semanticRoles.includes(role);
    for (const suffix of ['', 'Bg', 'Solid', ...(semantic ? ['Light'] : [])]) {
      result[role + suffix] = read(
        semantic ? 'Semantic' : 'Identity',
        role + suffix,
      );
    }
  }
  return result;
}

const androidSource = readFileSync(
  path.join(
    apps,
    'android/app/src/main/java/app/pantopus/android/ui/theme/Color.kt',
  ),
  'utf8',
);
const android: Palette = Object.fromEntries(
  [...androidSource.matchAll(/val (\w+) = Color\(0xFF([a-fA-F\d]{6})\)/g)].map(
    (m) => [m[1], rgb('#' + m[2])],
  ),
);
for (const role of roles) android[role + 'Solid'] = android[role];

for (const [name, palette] of Object.entries({
  'web light': webPalette(light),
  'web dark': webPalette(dark),
  'iOS light': iosPalette('light'),
  'iOS dark': iosPalette('dark'),
  'Android light feature tokens': android,
})) {
  describe(name, () => {
    for (const ink of inks) {
      test.each(surfaces)(`${ink} clears AA on %s`, (surface) => {
        expect(contrast(palette[ink], palette[surface])).toBeGreaterThanOrEqual(
          4.5,
        );
      });
    }
    for (const role of roles) {
      test(`${role} label clears AA on its tint and surface`, () => {
        for (const ground of [
          role + 'Bg',
          'appSurface',
          ...(semanticRoles.includes(role) ? [role + 'Light'] : []),
        ]) {
          expect(
            contrast(palette[role], palette[ground]),
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
      test(`${role} solid supports white text`, () => {
        expect(contrast(white, palette[role + 'Solid'])).toBeGreaterThanOrEqual(
          4.5,
        );
      });
    }
    if (palette.link) {
      test.each(surfaces)('link text clears AA on %s', (surface) => {
        expect(contrast(palette.link, palette[surface])).toBeGreaterThanOrEqual(
          4.5,
        );
      });
    }
  });
}
