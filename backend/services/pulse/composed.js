'use strict';

// Pulse, reinvented, phase 5: a picture shown as its author composed it (coord CONTRACT 10c, PHASE-5 piece A6). The Studio
// places a photo on the 9:16 canvas (Resize's model) and posts it as that canvas, backdrop included; a video isn't
// re-encoded, so its placement on the canvas is kept beside it. The backdrop's two colours (top, bottom) are kept too, so
// a screen wider or taller than 9:16 continues the author's backdrop around the canvas. `whole` tells the new viewers to show the picture fit, on
// its backdrop, on every screen shape, never cut again by the reader's screen. Studio fields only: refused from a
// switched-off author (routes/moments.js), answered only to a switch-on reader (momentStore), so a switched-off reader and
// the 2.1.6 apps get today's picture and today's video.

const PLACEMENT_KEYS = ['width', 'x', 'y', 'turn'];
// A placed video's width, as a share of the 9:16 canvas's width: Resize zooms to four times cover, and a video wider than
// the canvas has a cover wider than it (a 16:9 video's is 3.16), so the width may go well past 4 (CONTRACT 10c).
const WIDEST = 32;
const BACKDROP_KEYS = ['top', 'bottom'];
const COLOUR = /^#[0-9A-Fa-f]{6}$/;

function invalid(message) {
  return Object.assign(new Error(message), { status: 400, code: 'MOMENT_INVALID' });
}

function number(value, min, max, what) {
  const n = Number(value);
  if (typeof value !== 'number' || !Number.isFinite(n) || n < min || n > max) {
    throw invalid(`placement.${what} is ${min} to ${max}.`);
  }
  return Math.round(n * 10000) / 10000;
}

/** The backdrop's two colours (`#RRGGBB`, kept upper-case), so a wider screen continues the author's backdrop. */
function backdropOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !BACKDROP_KEYS.includes(key))
    || !BACKDROP_KEYS.every((key) => typeof value[key] === 'string' && COLOUR.test(value[key]))) {
    throw invalid('backdrop is { top, bottom }, each a colour like #1A2B3C.');
  }
  return { top: value.top.toUpperCase(), bottom: value.bottom.toUpperCase() };
}

/**
 * The kept part of `body`'s `whole`, `placement` and `backdrop` for a Moment of `kind` (CONTRACT 10c), or {} when none
 * was sent. Throws a 400 MOMENT_INVALID error with words that say what is wrong.
 */
function parse(body, { kind }) {
  const b = body || {};
  const hasWhole = Object.prototype.hasOwnProperty.call(b, 'whole');
  const hasPlacement = Object.prototype.hasOwnProperty.call(b, 'placement') && b.placement != null;
  const hasBackdrop = Object.prototype.hasOwnProperty.call(b, 'backdrop') && b.backdrop != null;
  if (!hasWhole && !hasPlacement && !hasBackdrop) return {};
  if (hasWhole && typeof b.whole !== 'boolean') throw invalid('whole is true or false.');
  const whole = b.whole === true;
  if (whole && !['photo', 'video'].includes(kind)) throw invalid('A text card is drawn as it is: whole goes with a photo or a video.');
  if (hasBackdrop && !whole) throw invalid('A backdrop goes with whole: true.');
  const backdrop = hasBackdrop ? { backdrop: backdropOf(b.backdrop) } : {};
  if (!hasPlacement) return whole ? { whole: true, ...backdrop } : {};
  if (kind !== 'video') throw invalid('A placement goes with a video (a photo is posted as its canvas).');
  if (!whole) throw invalid('A placement goes with whole: true.');
  const p = b.placement;
  if (typeof p !== 'object' || Array.isArray(p) || Object.keys(p).some((key) => !PLACEMENT_KEYS.includes(key))) {
    throw invalid('placement is { width, x, y, turn }.');
  }
  return {
    whole: true,
    placement: {
      width: number(p.width, 0.25, WIDEST, 'width'),
      x: number(p.x, 0, 1, 'x'),
      y: number(p.y, 0, 1, 'y'),
      turn: number(p.turn, -180, 180, 'turn'),
    },
    ...backdrop,
  };
}

/** `whole`, `placement` and `backdrop` as a switch-on reader's Moment answer carries them (CONTRACT 10c). */
function answerOf(m) {
  const whole = m?.whole === true;
  return {
    whole,
    placement: whole && m.placement ? { ...m.placement } : null,
    backdrop: whole && m.backdrop ? { top: m.backdrop.top, bottom: m.backdrop.bottom } : null,
  };
}

module.exports = { parse, answerOf };
