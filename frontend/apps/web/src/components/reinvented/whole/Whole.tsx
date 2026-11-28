'use client';

// A picture shown as its author composed it (PHASE-5 A6, coord/CONTRACT.md 10c), in the new viewer. One rule for every
// viewer (LEAD-6, 02:09): a Moment with `whole: true` is fitted by its own width and height, as large as fits, never
// assumed 9:16 (today's viewer already draws every picture so, `object-fit: contain`), and the space around it carries
// its backdrop: the Moment's `backdrop` colours, else the picture's own top and bottom colours. A video with `placement`
// is drawn on its 9:16 canvas as the author placed it, nothing past the canvas's edges. Only a switch-on reader gets
// `whole`, `placement` and `backdrop`, and only the new viewer draws this: a switched-off reader sees today's viewer.

import { useEffect, useRef, useState } from 'react';
import type { Moment } from '@pantopus/api/endpoints/moments';
import { backdropOf, type Backdrop, type Placement } from '../studio/whole';
import './whole.css';

type WholeMoment = Moment & { whole?: boolean; placement?: Placement | null; backdrop?: Backdrop | null };
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The Moment's composition when it is a whole picture: its placement (a video only) and its backdrop, if any. */
export function wholeOf(m: Moment): { placement: Placement | null; backdrop: Backdrop | null } | null {
  const w = m as WholeMoment;
  if (w.whole !== true || !m.media_url || (m.kind !== 'photo' && m.kind !== 'video')) return null;
  return { placement: m.kind === 'video' ? w.placement ?? null : null, backdrop: w.backdrop ?? null };
}

/** The 9:16 canvas, as large as fits in a stage `sw` x `sh`, centred. */
export function canvasBox(sw: number, sh: number): Box {
  const width = Math.min(sw, (sh * 9) / 16),
    height = (width * 16) / 9;
  return { left: (sw - width) / 2, top: (sh - height) / 2, width, height };
}

/** The picture's own two colours, read once per link; null when the browser may not read its pixels. */
const read = new Map<string, Promise<Backdrop | null>>();
function ownColours(src: string): Promise<Backdrop | null> {
  let made = read.get(src);
  if (!made) {
    made = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(backdropOf(img));
      img.onerror = () => resolve(null);
      img.src = src;
    });
    read.set(src, made);
  }
  return made;
}

/**
 * Behind the picture: its backdrop over the whole stage, the top colour above the picture's box (the canvas for a
 * placed video), the blend across it and the bottom colour below, so it continues the picture's own edges. For a
 * placed video, today's video is laid on the canvas by its placement while this Moment shows.
 */
export function WholeBackdrop({ moment }: { moment: Moment }) {
  const ref = useRef<HTMLDivElement>(null);
  const whole = wholeOf(moment);
  const placement = whole?.placement ?? null;
  const [colours, setColours] = useState<Backdrop | null>(whole?.backdrop ?? null);
  const [box, setBox] = useState<Box | null>(null);
  const given = whole?.backdrop ?? null;
  // Without the author's colours, the picture's own (a video's from its still).
  const still = moment.kind === 'video' ? moment.poster_url : moment.media_url;
  useEffect(() => {
    let live = true;
    if (given) setColours(given);
    else if (whole && still) void ownColours(still).then((c) => live && setColours(c));
    else setColours(null);
    return () => {
      live = false;
    };
  }, [given?.top, given?.bottom, !!whole, still]); // eslint-disable-line react-hooks/exhaustive-deps
  // Where the picture is: today's media fitted whole in the stage, or the canvas for a placed video, which is laid on
  // the canvas here (its own style is put back when this Moment closes or changes).
  useEffect(() => {
    const stage = ref.current?.parentElement;
    if (!stage || !whole) return;
    const media = stage.querySelector<HTMLImageElement | HTMLVideoElement>('.mo-watch-media');
    const before = media?.getAttribute('style') ?? null;
    const measure = () => {
      const sw = stage.clientWidth,
        sh = stage.clientHeight;
      if (!media || !sw || !sh) return setBox(null);
      const nw = media instanceof HTMLImageElement ? media.naturalWidth : media.videoWidth,
        nh = media instanceof HTMLImageElement ? media.naturalHeight : media.videoHeight;
      if (!nw || !nh) return setBox(null);
      if (placement && media instanceof HTMLVideoElement) {
        const c = canvasBox(sw, sh);
        const w = placement.width * c.width,
          h = (w * nh) / nw;
        const cx = c.left + placement.x * c.width,
          cy = c.top + placement.y * c.height;
        // The canvas's corners in the video's own box, so nothing shows past the canvas's edges.
        const t = (-placement.turn * Math.PI) / 180,
          cos = Math.cos(t),
          sin = Math.sin(t);
        const corner = (x: number, y: number) => {
          const dx = x - cx,
            dy = y - cy;
          return `${(dx * cos - dy * sin + w / 2).toFixed(1)}px ${(dx * sin + dy * cos + h / 2).toFixed(1)}px`;
        };
        Object.assign(media.style, {
          position: 'absolute',
          left: cx - w / 2 + 'px',
          top: cy - h / 2 + 'px',
          width: w + 'px',
          height: h + 'px',
          maxWidth: 'none',
          objectFit: 'fill',
          transform: `rotate(${placement.turn}deg)`,
          clipPath: `polygon(${corner(c.left, c.top)}, ${corner(c.left + c.width, c.top)}, ${corner(c.left + c.width, c.top + c.height)}, ${corner(c.left, c.top + c.height)})`,
        });
        return setBox(c);
      }
      const bw = media.clientWidth,
        bh = media.clientHeight,
        s = Math.min(bw / nw, bh / nh);
      setBox({ left: media.offsetLeft + (bw - nw * s) / 2, top: media.offsetTop + (bh - nh * s) / 2, width: nw * s, height: nh * s });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(stage);
    media?.addEventListener('load', measure);
    media?.addEventListener('loadedmetadata', measure);
    return () => {
      watch.disconnect();
      media?.removeEventListener('load', measure);
      media?.removeEventListener('loadedmetadata', measure);
      if (media && placement) {
        if (before == null) media.removeAttribute('style');
        else media.setAttribute('style', before);
      }
    };
  }, [moment.id, moment.media_url, !!whole, placement?.width, placement?.x, placement?.y, placement?.turn]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!whole) return null;
  const sh = ref.current?.parentElement?.clientHeight || 0;
  const background =
    colours && box && sh
      ? `linear-gradient(to bottom, ${colours.top} 0px, ${colours.top} ${box.top}px, ${colours.bottom} ${box.top + box.height}px, ${colours.bottom} 100%)`
      : colours
        ? `linear-gradient(to bottom, ${colours.top}, ${colours.bottom})`
        : undefined;
  return <div ref={ref} className="wh-backdrop" style={background ? { background } : undefined} aria-hidden="true" />;
}
