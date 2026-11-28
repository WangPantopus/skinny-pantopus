'use client';

// ============================================================
// The photo card studio (Wave 4.2, card improvements, only while GET /cards carries `photo_card`): one focused screen
// on the dark cloth. The card's front with the photo in its frame; drag to move it and pinch (or scroll) to zoom within
// the chosen shape, the shape taken from the photo's orientation with a one-tap change; "Change photo"; STYLE with the
// three frames; FRONT CAPTION (optional, to `caption_limit`); and "Use this photo card", which crops the photo here, on
// the device, to that shape and hands it to the flow's own photo upload.
// ============================================================

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { CardFrame, CardShape, HolidayCards } from '@pantopus/api';
import PhotoCardFront, { FRAME_NAMES, type PhotoFront } from './PhotoCardFront';
import { TABLE_ART, WAX } from './cardArt';
import { useDarkPage } from './useDarkPage';

type PhotoCardConfig = NonNullable<HolidayCards['photo_card']>;
export type PhotoCardMade = { file: File; frame: CardFrame; caption: string; shape: CardShape; aspect: number };

const SHAPE_NAMES: Record<CardShape, string> = { portrait: 'Portrait', square: 'Square', landscape: 'Landscape' };

/** Whitespace folded and trimmed, at most `limit` letters (the server's rule for the front caption). */
export const foldCaption = (typed: string, limit: number) => [...typed.replace(/\s+/g, ' ').trimStart()].slice(0, limit).join('');

/** The shape a photo's own orientation suggests. */
function shapeFor(width: number, height: number, shapes: PhotoCardConfig['shapes']): CardShape {
  const ratio = width / height;
  const ids = shapes.map((s) => s.id);
  const want: CardShape = ratio > 1.1 ? 'landscape' : ratio < 0.9 ? 'portrait' : 'square';
  return ids.includes(want) ? want : ids[0];
}

type Crop = { zoom: number; x: number; y: number };

/** The photo's size within the box as percentages of the box, covering it at zoom 1. */
function coverSize(imageRatio: number, boxRatio: number, zoom: number) {
  return { w: Math.max(1, imageRatio / boxRatio) * 100 * zoom, h: Math.max(1, boxRatio / imageRatio) * 100 * zoom };
}
/** Keep the photo covering the box: the offset (in % of the box) can't uncover an edge. */
function clampCrop(crop: Crop, imageRatio: number, boxRatio: number): Crop {
  const zoom = Math.min(5, Math.max(1, crop.zoom));
  const { w, h } = coverSize(imageRatio, boxRatio, zoom);
  const mx = (w - 100) / 2;
  const my = (h - 100) / 2;
  return { zoom, x: Math.min(mx, Math.max(-mx, crop.x)), y: Math.min(my, Math.max(-my, crop.y)) };
}

/** The photo as the box shows it, drawn into a JPEG of the shape (long side at most `longSide`). */
async function cropToShape(image: HTMLImageElement, crop: Crop, shape: { w: number; h: number }, longSide: number): Promise<Blob> {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const boxRatio = shape.w / shape.h;
  const { w, h } = coverSize(iw / ih, boxRatio, crop.zoom);
  // The box in the photo's own pixels.
  const sw = (100 / w) * iw;
  const sh = (100 / h) * ih;
  const sx = ((w - 100) / 2 - crop.x) / w * iw;
  const sy = ((h - 100) / 2 - crop.y) / h * ih;
  const scale = Math.min(1, longSide / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(boxRatio >= 1 ? sw * scale : sh * scale * boxRatio));
  const outH = Math.max(1, Math.round(outW / boxRatio));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.9));
}

function CropArea({ src, imageRatio, boxRatio, crop, onCrop, onImage }: {
  src: string; imageRatio: number; boxRatio: number; crop: Crop; onCrop: (next: Crop) => void; onImage: (img: HTMLImageElement | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ crop: Crop; spread: number; cx: number; cy: number } | null>(null);
  const { w, h } = coverSize(imageRatio, boxRatio, crop.zoom);
  const spreadNow = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };
  const centre = () => {
    const pts = [...pointers.current.values()];
    return { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
  };
  const begin = () => { const c = centre(); start.current = { crop, spread: spreadNow(), cx: c.x, cy: c.y }; };
  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    begin();
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !start.current || !box.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = box.current.getBoundingClientRect();
    const c = centre();
    const spread = spreadNow();
    const zoom = start.current.spread > 0 && spread > 0 ? start.current.crop.zoom * (spread / start.current.spread) : start.current.crop.zoom;
    onCrop(clampCrop({
      zoom,
      x: start.current.crop.x + ((c.x - start.current.cx) / rect.width) * 100,
      y: start.current.crop.y + ((c.y - start.current.cy) / rect.height) * 100,
    }, imageRatio, boxRatio));
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) begin(); else start.current = null;
  };
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    // Scroll (or a trackpad pinch) zooms; the page itself doesn't scroll under it.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      onCrop(clampCrop({ ...crop, zoom: crop.zoom * Math.exp(-event.deltaY / 400) }, imageRatio, boxRatio));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [crop, imageRatio, boxRatio, onCrop]);
  return (
    <div
      ref={box}
      className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="img"
      aria-label="Your photo. Drag to move it, pinch or scroll to zoom."
      data-testid="photoCardCrop"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={onImage}
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{ width: `${w}%`, height: `${h}%`, left: `${(100 - w) / 2 + crop.x}%`, top: `${(100 - h) / 2 + crop.y}%` }}
      />
    </div>
  );
}

export default function PhotoCardStudio({ config, year, busy = false, error = null, onClose, onUse }: {
  config: PhotoCardConfig;
  year: number;
  /** The upload that follows "Use this photo card" (the flow's own). */
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onUse: (made: PhotoCardMade) => void;
}) {
  useDarkPage(true, '#1a1612');
  const titleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [photo, setPhoto] = useState<{ url: string; ratio: number; name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [shape, setShape] = useState<CardShape>(config.shapes[0]?.id ?? 'portrait');
  const [frame, setFrame] = useState<CardFrame>(config.default_frame);
  const [caption, setCaption] = useState('');
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [making, setMaking] = useState(false);
  const shapeSpec = config.shapes.find((s) => s.id === shape) ?? { id: shape, w: 4, h: 5 };
  const boxRatio = shapeSpec.w / shapeSpec.h;

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setPhoto({ url, ratio: probe.naturalWidth / probe.naturalHeight, name: file.name });
      setShape(shapeFor(probe.naturalWidth, probe.naturalHeight, config.shapes));
      setCrop({ zoom: 1, x: 0, y: 0 });
    };
    probe.onerror = () => { URL.revokeObjectURL(url); setProblem('This photo can’t be opened here. Choose a JPEG or PNG.'); };
    probe.src = url;
  };
  const onCrop = useCallback((next: Crop) => setCrop(next), []);
  const changeShape = (next: CardShape) => { setShape(next); setCrop({ zoom: 1, x: 0, y: 0 }); };

  const use = async () => {
    if (!photo || !image.current || making || busy) return;
    setMaking(true);
    setProblem(null);
    try {
      const blob = await cropToShape(image.current, clampCrop(crop, photo.ratio, boxRatio), shapeSpec, 2400);
      const file = new File([blob], 'photo-card.jpg', { type: 'image/jpeg' });
      onUse({ file, frame, caption: caption.trim(), shape, aspect: boxRatio });
    } catch {
      setProblem('Couldn’t make the photo card from this photo. Try another photo.');
    } finally {
      setMaking(false);
    }
  };

  const front: PhotoFront = {
    design: 'studio',
    frame,
    caption: caption.trim() || null,
    aspect: boxRatio,
    src: null,
    crop: photo ? (
      <CropArea src={photo.url} imageRatio={photo.ratio} boxRatio={boxRatio} crop={crop} onCrop={onCrop} onImage={(img) => { image.current = img; }} />
    ) : (
      <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#efe6d4] text-[15px] font-semibold text-[#3a2f24]" data-testid="photoCardChoose">
        <ImagePlus className="h-7 w-7" aria-hidden />
        Choose a photo
      </button>
    ),
  };
  const left = config.caption_limit - [...caption].length;
  const chip = (on: boolean) => `min-h-11 rounded-full px-3.5 text-[14px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f] ${on ? 'bg-[#f6ecd9] text-[#2a1c14]' : 'bg-white/10 text-[#f6ecd9] shadow-[inset_0_0_0_1px_rgba(246,236,217,0.24)] hover:bg-white/15'}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="photoCardStudio"
      className="fixed inset-0 z-[1200] overflow-y-auto text-[#f6ecd9]"
      style={{ backgroundColor: '#2a2320', backgroundImage: `url(${TABLE_ART}table-cloth.webp)`, backgroundBlendMode: 'multiply', backgroundSize: 'cover', colorScheme: 'dark' }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f]" data-testid="photoCardClose">
            <X className="h-5 w-5" aria-hidden />
          </button>
          <h1 id={titleId} className="flex-1 text-center text-[18px] font-semibold">Make a photo card</h1>
          <span className="w-11" aria-hidden />
        </div>

        <div className="mx-auto mt-4 w-full max-w-[340px] rotate-[-1deg] drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)]">
          <PhotoCardFront front={front} year={year} />
        </div>
        {photo ? <p className="mt-3 text-center text-[13px] text-[#f6ecd9]/75">Drag to move it. Pinch or scroll to zoom.</p> : null}
        <span className="sr-only" aria-live="polite">{photo ? `${SHAPE_NAMES[shape]}, ${FRAME_NAMES[frame]}` : ''}</span>

        <input ref={input} type="file" accept="image/*" className="hidden" data-testid="photoCardInput" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
        {photo ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Shape">
            {config.shapes.map((s) => (
              <button key={s.id} type="button" aria-pressed={shape === s.id} onClick={() => changeShape(s.id)} className={chip(shape === s.id)} data-testid={`photoCardShape.${s.id}`}>
                {SHAPE_NAMES[s.id]}
              </button>
            ))}
            <button type="button" onClick={() => input.current?.click()} className="min-h-11 px-2 text-[14px] font-semibold text-[#f6ecd9] underline decoration-[#f6ecd9]/40 underline-offset-4" data-testid="photoCardChange">
              Change photo
            </button>
          </div>
        ) : null}

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#f6ecd9]/80">Style</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Style">
          {config.frames.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={frame === f} onClick={() => setFrame(f)} data-testid={`photoCardFrame.${f}`}
              className={`flex min-h-12 items-center justify-center rounded-xl px-2 text-center text-[13px] font-semibold leading-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f] ${frame === f ? 'bg-[#f6ecd9] text-[#2a1c14]' : 'bg-white/10 text-[#f6ecd9] shadow-[inset_0_0_0_1px_rgba(246,236,217,0.24)]'}`}>
              {FRAME_NAMES[f]}
            </button>
          ))}
        </div>

        <label htmlFor={`${titleId}-caption`} className="mt-5 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-[#f6ecd9]/80">
          <span>Front caption <span className="normal-case tracking-normal text-[#f6ecd9]/60">(optional)</span></span>
          <span className="tracking-normal" aria-hidden>{left}</span>
        </label>
        <input
          id={`${titleId}-caption`}
          type="text"
          value={caption}
          onChange={(event) => setCaption(foldCaption(event.target.value, config.caption_limit))}
          placeholder="Merry Christmas from the Riveras"
          autoComplete="off"
          data-testid="photoCardCaptionInput"
          aria-describedby={`${titleId}-left`}
          className="mt-2 h-12 w-full rounded-xl border-0 bg-white/10 px-4 text-[16px] text-[#f6ecd9] shadow-[inset_0_0_0_1px_rgba(246,236,217,0.24)] placeholder:text-[#f6ecd9]/45 focus:outline-none focus:ring-2 focus:ring-[#d8b76f]"
        />
        <span id={`${titleId}-left`} className="sr-only">{left} letters left</span>

        {problem || error ? <p role="alert" className="mt-3 text-center text-[14px] text-[#ffd9cf]">{problem ?? error}</p> : null}
        <div className="mt-auto pt-6">
          <button type="button" disabled={!photo || making || busy} onClick={() => void use()} data-testid="photoCardUse"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold text-[#fff7ed] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f] disabled:opacity-50"
            style={{ backgroundColor: WAX }}>
            {making || busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            Use this photo card
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
