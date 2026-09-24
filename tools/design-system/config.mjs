// Settings for the Pantopus design-system build.

export const SYSTEM = {
  /** The design system's name (the page title and the cover). */
  title: 'Pantopus',
  /** The bundle's global: window.Pantopus. */
  namespace: 'Pantopus',
  /** The published Design System artifact this build feeds. */
  artifact: 'https://claude.ai/artifact/MCub8DTnkdhoFnMbtF8QF5',
};

/** React 18 UMD builds in vendor/, packed so previews never hit a CDN. */
export const LIBRARIES = [
  { name: 'react', version: '18.3.1', global: 'React', file: 'components/lib/react.production.min.js' },
  { name: 'react-dom', version: '18.3.1', global: 'ReactDOM', file: 'components/lib/react-dom.production.min.js' },
];

/** Asset groups in page order; `tile` sizes their tiles (l … xs). */
export const ASSET_GROUPS = [
  { name: 'Logos', tile: 'l' },
  { name: 'Icons', tile: 's' },
];

/** Logo files in tile order (lib/assets.mjs writes them). */
export const LOGOS = [
  'pantopus-mark.svg',
  'pantopus-mark-dark.svg',
  'pantopus-lockup.svg',
  'pantopus-app-icon.svg',
  'pantopus-icon-512.png',
  'pantopus-favicon.svg',
];

/** NavIcons keys (frontend/apps/web/src/lib/icons.ts) shipped as SVG, in tile order. */
export const NAV_ICONS = [
  'place',
  'today',
  'nearby',
  'mail',
  'hub',
  'messages',
  'notifications',
  'search',
  'map',
  'identity',
  'profile',
  'scheduling',
  'audience',
  'marketplace',
  'tasks',
  'settings',
];
