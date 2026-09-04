// ============================================================
// The perforation mark, built for Satori (the /api/og image routes).
//
// The DOM component draws the knockouts with an SVG <mask>. Satori
// supports no <mask>, so here the eight perforations and the window
// are holes in ONE even-odd path: whatever sits behind the mark still
// shows through them, which is the whole point of the window.
//
// Emitted as a string and handed to <img src={markDataUri(size)} />
// rather than as inline SVG JSX, so the attribute names reaching the
// rasterizer are the kebab-case ones it actually reads.
// ============================================================

/** Literals, not tokens: Satori resolves no CSS variables. */
const BODY = '#0284C7'; // --color-primary-600
const CHECK = '#16A34A'; // --color-identity-home
const REVERSE = '#ffffff'; // body and check together, on a coloured ground

// The stamp body (x4 y4 w56 h56 rx13) traced clockwise. Each perforation
// circle is centred ON an edge, so its inner half is a clean semicircular
// bite taken out of the outline — cut here rather than laid down as its own
// subpath, because an even-odd subpath would paint the half that falls
// outside the body instead of removing anything. Every bite arc is
// sweep-flag 0: concave against a clockwise outline.
const OUTLINE = [
  'M17 4H19A4.5 4.5 0 0 0 28 4H36A4.5 4.5 0 0 0 45 4H47',
  'A13 13 0 0 1 60 17V19A4.5 4.5 0 0 0 60 28V36A4.5 4.5 0 0 0 60 45V47',
  'A13 13 0 0 1 47 60H45A4.5 4.5 0 0 0 36 60H28A4.5 4.5 0 0 0 19 60H17',
  'A13 13 0 0 1 4 47V45A4.5 4.5 0 0 0 4 36V28A4.5 4.5 0 0 0 4 19V17',
  'A13 13 0 0 1 17 4Z',
].join('');

/** The window (x20 y20 w24 h24 rx4), fully enclosed, so even-odd punches it out. */
const WINDOW = 'M24 20H40A4 4 0 0 1 44 24V40A4 4 0 0 1 40 44H24A4 4 0 0 1 20 40V24A4 4 0 0 1 24 20Z';

const BODY_PATH = OUTLINE + WINDOW;

export type MarkVariant = 'brand' | 'reverse';

/** The mark as an SVG string at `size` px. Minimum size is 16. */
export function markSvg(size: number, variant: MarkVariant = 'brand'): string {
  const body = variant === 'reverse' ? REVERSE : BODY;
  const check = variant === 'reverse' ? REVERSE : CHECK;
  // At 20px and below the check is illegible, so a solid plug stands in for it.
  const glyph =
    size <= 20
      ? `<rect x="26" y="26" width="12" height="12" rx="3" fill="${body}"/>`
      : `<path d="M26 32.4 30.2 36.6 38.2 26.8" fill="none" stroke="${check}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<path d="${BODY_PATH}" fill="${body}" fill-rule="evenodd"/>${glyph}</svg>`
  );
}

/** The mark as a data URI, ready for an <img src> inside an ImageResponse. */
export function markDataUri(size: number, variant: MarkVariant = 'brand'): string {
  return `data:image/svg+xml;base64,${btoa(markSvg(size, variant))}`;
}

/** Lockup metrics: gap is a third of the mark, wordmark 0.83 of it. */
export function lockup(markSize: number) {
  return { markSize, gap: Math.round(markSize / 3), wordmarkSize: Math.round(markSize * 0.83) };
}
