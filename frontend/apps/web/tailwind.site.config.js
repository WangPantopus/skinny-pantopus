// Tailwind for src/app/(site)/site.css, the full stylesheet of every page except the homepage, the sign-in pages,
// not-found and error. Those pages load only src/app/globals.css, which every page loads first, with Tailwind's
// reset (preflight). Repeating the reset here would put its attribute selectors ([type='button'] …) after the
// homepage's own stylesheet once a visitor comes back to it from another page, and override its buttons, so it's
// off. `@tailwind base` still emits the --tw-* defaults that transforms, filters and rings here rely on.
const base = require('./tailwind.config.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  corePlugins: { ...base.corePlugins, preflight: false },
};
