// Tailwind config for components/bundle.css: the web app's own
// tailwind.config.js, adapted for the design-system preview frame.
//
//  1. dark: variants follow the frame's data-theme attribute (both dark
//     themes) instead of prefers-color-scheme.
//  2. The app-* colors are hex tokens in tokens.css, not the web's "R G B"
//     triplets, so opacity modifiers go through color-mix().
//  3. tokens.css defines an .overline type-style class, so Tailwind's
//     text-decoration utility of the same name is kept out.
//
// build.mjs passes the content list (component sources and previews) as a
// JSON file through DESIGN_SYSTEM_TAILWIND_CONTENT.

const fs = require('node:fs');
const path = require('node:path');

const web = require(path.resolve(__dirname, '../../../frontend/apps/web/tailwind.config.js'));
const config = JSON.parse(JSON.stringify(web));

const mix = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;
for (const [key, value] of Object.entries(config.theme.extend.colors)) {
  const channels = typeof value === 'string' && /^rgb\(var\(--([\w-]+)\) \/ <alpha-value>\)$/.exec(value);
  if (channels) config.theme.extend.colors[key] = mix(channels[1]);
}
for (const frames of Object.values(config.theme.extend.keyframes ?? {})) {
  for (const step of Object.values(frames)) {
    const channels = typeof step.backgroundColor === 'string' && /^rgb\(var\(--([\w-]+)\)\)$/.exec(step.backgroundColor);
    if (channels) step.backgroundColor = `var(--${channels[1]})`;
  }
}

config.darkMode = [
  'variant',
  ['&:where([data-theme="dark"], [data-theme="dark"] *)', '&:where([data-theme="dark-ios"], [data-theme="dark-ios"] *)'],
];
config.blocklist = ['overline'];
config.content = JSON.parse(fs.readFileSync(process.env.DESIGN_SYSTEM_TAILWIND_CONTENT, 'utf8'));

module.exports = config;
