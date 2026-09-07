// ============================================================
// PantopusMark — the perforation mark.
//
// A postage-stamp body with a knocked-out window and a verification
// check: mail, what is shown, and proof. This is the ONLY place the
// geometry lives; every brand surface (app shell, the /start funnel,
// the favicon build) renders through here.
//
// Canonical geometry, viewBox 0 0 64 64:
//   body          rounded rect 4,4 56x56 r13
//   perforations  8 circles r4.5 punched OUT of the body
//   window        rounded rect 20,20 24x24 r4, also punched OUT — a
//                 KNOCKOUT. Whatever sits behind the mark shows through
//                 it, so it takes no colour token.
//   check         M26 32.4 L30.2 36.6 L38.2 26.8, stroke 4.4, round
//                 cap + join, drawn on top, inside the window.
//
// Colour comes from the theme tokens: the body is primary-600 in light
// and primary-400 in dark (darkMode: 'media'), the check is the pinned
// pillar green. The `reverse` variant paints body AND check white for
// coloured grounds — that reads because the window is a knockout and
// the ground shows through it. Do not "fix" it to a coloured check.
//
// Misuse: never rotate it, never recolour it to another pillar (violet
// and amber are product states, not brand), never fill the window,
// never put the check outside the window.
// ============================================================

'use client';

import { useId } from 'react';

/** Perforation centres — 8 circles of r=4.5 punched out of the body. */
const PERFORATIONS: ReadonlyArray<readonly [number, number]> = [
  [23.5, 4],
  [40.5, 4],
  [23.5, 60],
  [40.5, 60],
  [4, 23.5],
  [4, 40.5],
  [60, 23.5],
  [60, 40.5],
];

/**
 * At and below this size the check is illegible, so it is replaced by a
 * solid plug in the body colour.
 */
const PLUG_MAX_SIZE = 20;

export type PantopusMarkVariant = 'auto' | 'reverse';

type PantopusMarkProps = {
  /** Rendered edge length in px. Minimum 16. */
  size: number;
  /** `auto` resolves light/dark from the theme; `reverse` is white-on-colour. */
  variant?: PantopusMarkVariant;
  /**
   * Accessible name. Omit when the mark sits beside the "Pantopus"
   * wordmark — the text carries the name and the mark is decorative.
   */
  title?: string;
  className?: string;
};

export function PantopusMark({ size, variant = 'auto', title, className = '' }: PantopusMarkProps) {
  const uid = useId();
  // Two marks on one page must not share a mask id, or the second mask
  // silently wins.
  const maskId = `pt-mark-${uid}`;
  const titleId = `pt-mark-title-${uid}`;

  const bodyClass = variant === 'reverse' ? 'text-white' : 'text-primary-600 dark:text-primary-400';
  const checkClass = variant === 'reverse' ? 'text-white' : 'text-brand-check';
  const usePlug = size <= PLUG_MAX_SIZE;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title id={titleId}>{title}</title> : null}

      {/* White keeps the body; black punches the perforations and the window. */}
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="#000" />
        <rect x="4" y="4" width="56" height="56" rx="13" fill="#fff" />
        {PERFORATIONS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.5" fill="#000" />
        ))}
        <rect x="20" y="20" width="24" height="24" rx="4" fill="#000" />
      </mask>

      <rect width="64" height="64" fill="currentColor" mask={`url(#${maskId})`} className={bodyClass} />

      {usePlug ? (
        <rect x="26" y="26" width="12" height="12" rx="3" fill="currentColor" className={bodyClass} />
      ) : (
        <path
          d="M26 32.4 30.2 36.6 38.2 26.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={checkClass}
        />
      )}
    </svg>
  );
}

type PantopusLockupProps = {
  /** Mark edge length in px; the wordmark and gap derive from it. */
  size: number;
  variant?: PantopusMarkVariant;
  className?: string;
};

/**
 * The mark plus the "Pantopus" wordmark. Gap is a third of the mark
 * height, the wordmark is 0.83x the mark height at weight 700 with
 * -0.02em tracking. The mark is decorative here — the wordmark names us.
 */
export function PantopusLockup({ size, variant = 'auto', className = '' }: PantopusLockupProps) {
  const gap = size / 3;
  const fontSize = size * 0.83;
  const wordClass = variant === 'reverse' ? 'text-white' : 'text-app-text';

  return (
    <span className={`inline-flex items-center select-none ${className}`} style={{ gap }}>
      <PantopusMark size={size} variant={variant} />
      <span
        // Flex centring lines up the bounding boxes; the nudge lifts the
        // wordmark so the mark sits on its x-height instead.
        className={`font-bold -tracking-[0.02em] leading-none ${wordClass}`}
        style={{ fontSize, transform: 'translateY(-0.04em)' }}
      >
        Pantopus
      </span>
    </span>
  );
}

export default PantopusMark;
