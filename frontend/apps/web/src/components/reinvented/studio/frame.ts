// Where things placed in the Studio land on the picture that is posted (Pulse, reinvented; coord/CONTRACT.md §2b: a
// stamp's x, y and scale are on the PICTURE itself). The Studio draws the picture inside its 9:16 stage and places
// stamps, playable items and dots on the stage. A picture with words, drawing or a crop is posted as that 9:16 stage
// (momentMedia's photo()), so stage and picture are the same. One without is posted at its own shape, so a stage
// position is turned into a position on the picture as the stage drew it (fitted whole, centred).

const STAGE_W = 9,
  STAGE_H = 16;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 10000) / 10000;

export interface Frame {
  point(x: number, y: number): { x: number; y: number };
  /** A size given as a share of the stage's width, as a share of the picture's. */
  scale(s: number): number;
  box(b: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number };
}

const SAME: Frame = { point: (x, y) => ({ x, y }), scale: (s) => s, box: (b) => b };

/** `size`: the picture's own width and height; `stageIsPicture`: it is posted as the 9:16 stage (edited). */
export function stageFrame(size: { w: number; h: number } | null, stageIsPicture: boolean): Frame {
  if (stageIsPicture || !size || !size.w || !size.h) return SAME;
  const s = Math.min(STAGE_W / size.w, STAGE_H / size.h);
  const pw = size.w * s,
    ph = size.h * s;
  const left = (STAGE_W - pw) / 2,
    top = (STAGE_H - ph) / 2;
  if (Math.abs(pw - STAGE_W) < 1e-6 && Math.abs(ph - STAGE_H) < 1e-6) return SAME;
  const point = (x: number, y: number) => ({
    x: round(clamp((x * STAGE_W - left) / pw, 0, 1)),
    y: round(clamp((y * STAGE_H - top) / ph, 0, 1)),
  });
  return {
    point,
    scale: (v) => round(clamp((v * STAGE_W) / pw, 0.25, 4)),
    box: (b) => {
      const at = point(b.x, b.y);
      return {
        x: at.x,
        y: at.y,
        w: round(clamp((b.w * STAGE_W) / pw, 0.01, 1 - at.x)),
        h: round(clamp((b.h * STAGE_H) / ph, 0.01, 1 - at.y)),
      };
    },
  };
}

/**
 * Whether any of `points` (on the 9:16 stage) lies off the picture's own box, as the stage draws a picture `size` whole
 * and upright (PHASE-6 F2: things placed anywhere on the canvas, the backdrop included). A picture posted at its own
 * shape would pull such a thing back onto its edge, so then the Moment goes up in its canvas form instead.
 */
export function offPicture(size: { w: number; h: number } | null, points: { x: number; y: number }[]): boolean {
  if (!size || !size.w || !size.h || !points.length) return false;
  const s = Math.min(STAGE_W / size.w, STAGE_H / size.h);
  const pw = size.w * s,
    ph = size.h * s;
  const left = (STAGE_W - pw) / 2 / STAGE_W,
    top = (STAGE_H - ph) / 2 / STAGE_H,
    right = 1 - left,
    bottom = 1 - top;
  const slack = 0.002;
  return points.some((p) => p.x < left - slack || p.x > right + slack || p.y < top - slack || p.y > bottom + slack);
}

/** PHASE-6 K2: how much of an item, in px, always stays on the canvas, on both axes. */
export const KEEP_ON_PX = 24;

/**
 * The middle (0 to 1 of the canvas, `lo`..`hi` at most) an item of `size` px may take on a canvas `total` px long so that at
 * least 24 px of the item's own box stays on it (the whole item when it is smaller than that). PHASE-6 K2.
 */
export function keepOn(v: number, size: number, total: number, lo = 0, hi = 1): number {
  if (!(total > 0) || !(size > 0)) return clamp(v, lo, hi);
  const m = (Math.min(KEEP_ON_PX, size) - size / 2) / total;
  return clamp(v, Math.max(lo, m), Math.min(hi, 1 - m));
}
