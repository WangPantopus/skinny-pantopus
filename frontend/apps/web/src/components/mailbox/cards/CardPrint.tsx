'use client';

/**
 * A card's own photo as a print (memories plan step 4, launch key holiday_card_memories; wave 4 drawings 2, 3, 4, 5): a
 * white-bordered print lying a little askew, its bytes loaded only through the card's reader-checked routes (never a
 * storage link) into an object URL that is dropped when the print goes. A nostalgia card's print has the 1990s orange
 * date; a covered one (a photo from someone who isn't the reader's connection) shows "Photo from {name}. Tap to show."
 * and loads nothing until the tap.
 */
import { useEffect, useState } from 'react';
import { mailbox } from '@pantopus/api';
import { SERIF } from './cardArt';

export type PrintSource = { own: string } | { sent: string; fileId: string } | { piece: string; fileId: string };

/** The photo's bytes as an object URL (null while loading, or `failed`), for as long as the caller shows it. */
export function useCardMediaUrl(source: PrintSource | null): { url: string | null; failed: boolean } {
  const key = source ? JSON.stringify(source) : '';
  const [state, setState] = useState<{ key: string; url: string | null; failed: boolean }>({ key: '', url: null, failed: false });
  useEffect(() => {
    if (!source) return undefined;
    const controller = new AbortController();
    let url: string | null = null;
    mailbox.getHolidayCardMediaBlob(source, controller.signal)
      .then((blob) => { url = URL.createObjectURL(blob); setState({ key, url, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, url: null, failed: true }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
    // `key` stands for `source`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? { url: state.url, failed: state.failed } : { url: null, failed: false };
}

/** "'26 11 10": the day, as a 1990s camera printed it. */
function printedDate(at: string | null | undefined): string | null {
  if (!at) return null;
  const day = new Date(at);
  if (Number.isNaN(day.getTime())) return null;
  const two = (n: number) => String(n).padStart(2, '0');
  return `'${two(day.getFullYear() % 100)} ${two(day.getMonth() + 1)} ${two(day.getDate())}`;
}

export default function CardPrint({
  source,
  localUrl = null,
  width,
  height,
  alt,
  datedOn = null,
  covered = false,
  fromName = '',
  onUncover,
  uploading = false,
  tilt = -3,
  className = '',
}: {
  /** Where its bytes come from; null while it uploads (the chosen file shows from `localUrl`). */
  source: PrintSource | null;
  localUrl?: string | null;
  width?: number | null;
  height?: number | null;
  /** The sender's description, read by screen readers. */
  alt?: string | null;
  /** A nostalgia card: the day printed in orange (the card's own date, never the photo's). */
  datedOn?: string | null;
  covered?: boolean;
  fromName?: string;
  onUncover?: () => void;
  /** Uploading: a bar runs along the print until it's stored. */
  uploading?: boolean;
  tilt?: number;
  className?: string;
}) {
  const { url, failed } = useCardMediaUrl(covered ? null : source);
  const shown = url || localUrl;
  const ratio = width && height ? `${width} / ${height}` : '4 / 3';
  const date = printedDate(datedOn);
  const first = fromName.split(/\s+/)[0] || 'them';
  return (
    <figure
      className={`relative m-0 inline-block bg-[#fbfaf6] p-[6%] pb-[14%] shadow-[0_14px_26px_rgba(4,3,2,0.45),0_2px_4px_rgba(4,3,2,0.25)] ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
      data-testid="cardPrint"
    >
      {covered ? (
        <button
          type="button"
          onClick={onUncover}
          data-testid="cardPrintCover"
          className="flex w-full items-center justify-center bg-[#e7dfcd] px-4 text-center text-[#3a2f22] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
          style={{ aspectRatio: ratio, fontFamily: SERIF, fontSize: 'clamp(13px, 4.2cqi, 17px)', lineHeight: 1.35 }}
        >
          Photo from {first}. Tap to show.
        </button>
      ) : (
        <div className="relative overflow-hidden bg-[#d9d4c8]" style={{ aspectRatio: ratio }}>
          {shown ? (
            // An object URL from the card's own route: next/image can't load it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={alt || `Photo from ${first}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] text-[#5b5346]">
              {failed ? 'This photo couldn’t be loaded.' : ''}
            </span>
          )}
          {/* A soft gloss across the print. */}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.22),rgba(255,255,255,0)_40%)]" />
          {date && shown ? (
            <span
              aria-hidden
              className="absolute bottom-[6%] right-[6%] font-mono font-bold tracking-[0.08em] text-[#ff8a1f]"
              style={{ fontSize: 'clamp(10px, 4cqi, 15px)', textShadow: '0 0 4px rgba(255,120,20,0.75)' }}
            >
              {date}
            </span>
          ) : null}
        </div>
      )}
      {uploading ? (
        <span aria-hidden className="absolute bottom-0 left-0 h-[5px] w-full animate-pulse bg-[#8b1d1d] motion-reduce:animate-none" />
      ) : null}
    </figure>
  );
}
