// Before and after in the Studio (Pulse, reinvented, phase 2; coord/CONTRACT.md §7g, LEAD-3 05:19): the two photos go out
// side by side, the same size and shape, as ONE picture (left before, right after). No second upload: today's screens
// and the apps in the stores show that picture as it is; the new viewer shows one half over the other.

import { canvasOf, edited, jpeg, paintOverlay, type Artwork } from '@/components/moments/momentArtwork';
import { backdropOf, paintPicture } from './whole';

// The posted picture's widest side (both halves together).
const MAX_WIDE = 3200;

async function load(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const unreadable = () => new Error('This photo couldn’t be opened. Choose a JPEG, PNG or a photo your browser can display.');

/**
 * The after photo cut to the before's shape (`shape`: the before's own width and height), centred, as a new JPEG, so
 * the Studio shows it, and blurs it, exactly as it goes out.
 */
export async function cutToShape(file: File, shape: { w: number; h: number }): Promise<File> {
  let img: HTMLImageElement;
  try {
    img = await load(file);
  } catch {
    throw unreadable();
  }
  const nw = img.naturalWidth,
    nh = img.naturalHeight,
    ratio = shape.w / shape.h;
  let cw = nw,
    ch = nh;
  if (nw / nh > ratio) cw = nh * ratio;
  else ch = nw / ratio;
  const scale = Math.min(1, 2048 / Math.max(cw, ch));
  const { ctx, canvas } = canvasOf(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(ch * scale)));
  ctx.drawImage(img, (nw - cw) / 2, (nh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
  const blob = await jpeg(canvas, 0.92);
  return new File([blob], 'after.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * The picture that is posted: `before` (already prepared: blurs, words, drawing and crop drawn in) on the left and the
 * after on the right, drawn the same way (the same crop, words and drawing; a moved after sits on its own colours, as
 * the before does: PHASE-5 A), so the halves line up.
 */
export async function sideBySide(before: Blob, after: File, art: Artwork): Promise<Blob> {
  let left: HTMLImageElement, right: HTMLImageElement;
  try {
    [left, right] = await Promise.all([load(before), load(after)]);
  } catch {
    throw unreadable();
  }
  const k = Math.min(1, MAX_WIDE / (left.naturalWidth * 2));
  const w = Math.max(1, Math.round(left.naturalWidth * k)),
    h = Math.max(1, Math.round(left.naturalHeight * k));
  const half = canvasOf(w, h);
  if (edited(art)) {
    paintPicture(half.ctx, right, right.naturalWidth, right.naturalHeight, art, backdropOf(right));
    paintOverlay(half.ctx, art);
  } else half.ctx.drawImage(right, 0, 0, w, h);
  const { ctx, canvas } = canvasOf(w * 2, h);
  ctx.drawImage(left, 0, 0, w, h);
  ctx.drawImage(half.canvas, w, 0);
  return jpeg(canvas, 0.91);
}
