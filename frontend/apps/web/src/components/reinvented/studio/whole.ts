// See the picture first (PHASE-5 A; coord/CONTRACT.md 10c): a picture shown as its author composed it. The Studio's
// picture sits on the 9:16 canvas: whole and upright at zoom 1 (contained before any turn), then sized, moved and turned
// to any angle, on a backdrop that blends the picture's own top and bottom colours, as the iPhone's and Android's
// Resize do (width as a share of the canvas's width before turning, its middle, its turn). The preview (StudioPicture)
// and what is posted are drawn with these same numbers, so what the author sees is what readers get.

import { canvasOf, jpeg, paintOverlay, type Artwork } from '@/components/moments/momentArtwork';

/** The backdrop's two colours, `#RRGGBB` upper-case, as `POST /api/moments` takes them (10c). */
export interface Backdrop {
  top: string;
  bottom: string;
}
/** A video's place on the canvas (10c): its width as a share of the canvas's width before turning, its middle, its turn. */
export interface Placement {
  width: number;
  x: number;
  y: number;
  turn: number;
}

/** The canvas a moved photo goes up as: 1152 x 2048, as the iPhone's (today's photos go up at most 2048 on a side). */
export const CANVAS_W = 1152,
  CANVAS_H = 2048;
// The canvas in the units the Studio works in (9:16).
const CW = 9,
  CH = 16;
/** Until the picture's own colours are read. */
export const DARK_BACKDROP: Backdrop = { top: '#111111', bottom: '#111111' };
/**
 * The width's limits, as a share of the canvas's (10c's `placement.width`, the phones' Resize): at least a quarter of the
 * canvas; sized up to four times the canvas, or four times Fill when Fill is wider (a wide video, as the phones' Resize
 * zooms to four times cover). The server takes a placed video's width up to 32 (#5245).
 */
const SMALLEST = 0.25,
  LARGEST = 4,
  WIDEST = 32;
/** A turn sticks to a quarter turn within 3 degrees, as the phones' Resize does. */
const STICK_DEGREES = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (n: number) => Math.round(n * 10000) / 10000;

/** Degrees kept in (-180, 180]. */
export function turnOf(degrees: number) {
  let t = degrees % 360;
  if (t <= -180) t += 360;
  if (t > 180) t -= 360;
  return t === 0 ? 0 : t;
}
/** A turn within 3 degrees of a quarter turn sits on it. */
export function stuckTurn(degrees: number) {
  const quarter = Math.round(degrees / 90) * 90;
  return turnOf(Math.abs(degrees - quarter) <= STICK_DEGREES ? quarter : degrees);
}

/** The picture's width and height on the 9:16 canvas at zoom 1: whole and upright. */
function upright(w: number, h: number) {
  const s = Math.min(CW / w, CH / h);
  return { w: w * s, h: h * s };
}
/** The zoom at which the picture, turned `turn`, is as large as fits whole on the canvas (1 when upright). */
export function fitZoom(w: number, h: number, turn: number) {
  if (!w || !h) return 1;
  const p = upright(w, h),
    c = Math.abs(Math.cos((turn * Math.PI) / 180)),
    s = Math.abs(Math.sin((turn * Math.PI) / 180));
  return Math.min(CW / (p.w * c + p.h * s), CH / (p.w * s + p.h * c));
}
/** The zoom at which the picture, turned `turn` and centred, just covers the canvas (Fill). */
export function fillZoom(w: number, h: number, turn: number) {
  if (!w || !h) return 1;
  const p = upright(w, h),
    c = Math.abs(Math.cos((turn * Math.PI) / 180)),
    s = Math.abs(Math.sin((turn * Math.PI) / 180));
  return Math.max((CW * c + CH * s) / p.w, (CW * s + CH * c) / p.h);
}
/** How far the picture may be sized: its width a quarter of the canvas's, up to four times the canvas or four times Fill. */
export function zoomRange(w: number, h: number) {
  if (!w || !h) return { min: 0.5, max: 3 };
  const p = upright(w, h);
  const max = Math.min((WIDEST * CW) / p.w, Math.max((LARGEST * CW) / p.w, 4 * fillZoom(w, h, 0)));
  return { min: (SMALLEST * CW) / p.w, max };
}
/** True when the picture is placed as it was picked: whole, upright, in the middle. */
export const unmoved = (a: Artwork) => a.zoom === 1 && !turnOf(a.rotation) && !a.offset.x && !a.offset.y;

/** A video's placement from the Studio's picture (10c), for a video `w` x `h`. */
export function placementOf(w: number, h: number, a: Artwork): Placement {
  const p = upright(w, h);
  return {
    width: round(clamp((p.w * a.zoom) / CW, SMALLEST, WIDEST)),
    x: round(clamp(0.5 + a.offset.x, 0, 1)),
    y: round(clamp(0.5 + a.offset.y, 0, 1)),
    turn: round(clamp(turnOf(a.rotation), -180, 180)),
  };
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
/**
 * The picture's two colours: the average of its upright top third and bottom third, read from a copy 24 px square (as
 * the iPhone's Resize reads them). Null when the browser can't read the picture's pixels.
 */
export function backdropOf(source: CanvasImageSource): Backdrop | null {
  try {
    const side = 24;
    const { ctx } = canvasOf(side, side);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, side, side);
    ctx.drawImage(source, 0, 0, side, side);
    const data = ctx.getImageData(0, 0, side, side).data;
    const average = (from: number, to: number) => {
      const sum = [0, 0, 0];
      for (let row = from; row < to; row++)
        for (let col = 0; col < side; col++) for (let ch = 0; ch < 3; ch++) sum[ch] += data[(row * side + col) * 4 + ch];
      const n = (to - from) * side;
      return hex(sum[0] / n, sum[1] / n, sum[2] / n);
    };
    return { top: average(0, side / 3), bottom: average(side - side / 3, side) };
  } catch {
    return null;
  }
}
/** The backdrop as CSS: a top-to-bottom blend, as the canvas is drawn. */
export const backdropCss = (b: Backdrop) => `linear-gradient(to bottom, ${b.top}, ${b.bottom})`;

/**
 * The canvas `ctx` covers (9:16): the backdrop, then the picture whole and upright at zoom 1, sized, moved and turned as
 * the author left it. Nothing past the canvas's edges.
 */
export function paintPicture(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  a: Artwork,
  backdrop: Backdrop | null,
) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height,
    b = backdrop || DARK_BACKDROP;
  const blend = ctx.createLinearGradient(0, 0, 0, h);
  blend.addColorStop(0, b.top);
  blend.addColorStop(1, b.bottom);
  ctx.fillStyle = blend;
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / sw, h / sh) * a.zoom;
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(w * (0.5 + a.offset.x), h * (0.5 + a.offset.y));
  ctx.rotate((turnOf(a.rotation) * Math.PI) / 180);
  ctx.drawImage(source, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale);
  ctx.restore();
}

/** A moved photo as it goes up: the 1152 x 2048 canvas, the picture on its backdrop, the words and drawing over it. */
export async function bakePhoto(file: Blob, a: Artwork, backdrop: Backdrop | null): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { canvas, ctx } = canvasOf(CANVAS_W, CANVAS_H);
    paintPicture(ctx, img, img.naturalWidth, img.naturalHeight, a, backdrop);
    paintOverlay(ctx, a);
    return await jpeg(canvas, 0.91);
  } catch {
    throw new Error('This photo couldn’t be opened. Choose a JPEG, PNG or a photo your browser can display.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
