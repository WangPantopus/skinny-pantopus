'use client';

import { useEffect, useState } from 'react';
import { House, Link2, Lock, Printer, QrCode, Share } from 'lucide-react';
import { buildCrewDayPath } from '@pantopus/utils';
import BottomSheet from '@/components/ui/BottomSheet';
import QRCode from '@/components/ui/QRCode';
import { toast } from '@/components/ui/toast-store';
import { bookedLine, formatCrewDate, formatPrice } from '@/lib/crewDay';
import { StreetMiniMap } from './CrewDayParts';

// Screen 12, the share kit (board `Share`), from Your Crew Day: the count only (never which homes), a message the
// household can edit, the link's preview (the street and the date, never the address), and four ways to pass it
// on: copy the link, the system share sheet, a QR code to show a neighbor, and the printable flyer.

export type CrewDayShare = { url: string; flyer_url: string; message: string; booked_count: number; spots_left: number };

const TONAL =
  'flex min-h-11 items-center justify-center gap-2 rounded-xl bg-app-surface-sunken px-3 py-2 text-center text-[0.9375rem] font-semibold leading-5 text-app-text hover:bg-app-hover';

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'pantopus.com';
  }
}

export default function CrewDayShareSheet({
  open,
  onClose,
  code,
  title,
  street,
  serviceDate,
  priceFromCents,
  share,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  title: string;
  street: string;
  serviceDate: string;
  priceFromCents: number | null;
  share: CrewDayShare;
}) {
  const [message, setMessage] = useState(share.message);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    if (open) setShowQr(false);
  }, [open]);

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  };

  const shareNow = async () => {
    const text = message.trim() || share.message;
    if (typeof navigator.share !== 'function') {
      await copy(text, 'Message copied. Paste it in a text or your street group.');
      return;
    }
    try {
      // The link travels as the share's URL, so the message isn't sent with it twice.
      await navigator.share({ title, text: text.replace(share.url, '').trim(), url: share.url });
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') toast.error("Couldn't open sharing. Copy the link instead.");
    }
  };

  const preview = [formatCrewDate(serviceDate), priceFromCents != null ? `from ${formatPrice(priceFromCents)}` : null, hostOf(share.url)]
    .filter(Boolean)
    .join(' · ');

  return (
    <BottomSheet open={open} onClose={onClose} title="Share with neighbors">
      <div className="flex flex-col gap-[0.875rem] pb-2">
        <p className="flex items-center gap-2 text-sm font-semibold leading-5 text-app-text-strong">
          <House className="h-4 w-4 flex-none text-app-home" aria-hidden="true" />
          {bookedLine(share.booked_count, share.spots_left, share.booked_count + share.spots_left)}
        </p>

        <div className="flex flex-col gap-2">
          <label htmlFor="cd-share-message" className="text-xs font-semibold uppercase leading-4 tracking-[0.07em] text-app-text-secondary">
            Your message
          </label>
          <textarea
            id="cd-share-message"
            rows={5}
            maxLength={600}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[8.5rem] rounded-[0.875rem] border border-app-border-strong bg-app-surface px-[0.875rem] py-3 text-[0.9375rem] leading-[1.3125rem] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-[0.875rem] border border-app-border bg-app-surface-sunken p-[0.625rem]">
            <StreetMiniMap street={street} label={false} className="h-16 w-16 flex-none rounded-[0.625rem]" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold leading-5 text-app-text">{title}</span>
              <span className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary [font-variant-numeric:tabular-nums]">{preview}</span>
            </span>
          </div>
          <p className="flex items-start gap-2 text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
            <Lock className="mt-0.5 h-[0.875rem] w-[0.875rem] flex-none" aria-hidden="true" />
            The preview shows {street} and the date, never your address.
          </p>
        </div>

        {showQr ? (
          <div className="flex flex-col items-center gap-2 rounded-[0.875rem] border border-app-border bg-white p-4">
            <QRCode value={share.url} size={200} label={`QR code for ${title}`} />
            <p className="text-center text-[0.8125rem] leading-[1.125rem] text-[#374151]">Neighbors scan this to see their own price.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-[0.625rem]">
          <button type="button" onClick={() => void copy(share.url, 'Link copied.')} className={TONAL}>
            <Link2 className="h-4 w-4 flex-none" aria-hidden="true" />
            Copy link
          </button>
          <button
            type="button"
            onClick={() => void shareNow()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-center text-[0.9375rem] font-semibold leading-5 text-white shadow-[0_6px_16px_rgba(2,132,199,0.18)] hover:opacity-95"
          >
            <Share className="h-4 w-4 flex-none" aria-hidden="true" />
            Share…
          </button>
          <button type="button" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)} className={TONAL}>
            <QrCode className="h-4 w-4 flex-none" aria-hidden="true" />
            {showQr ? 'Hide QR code' : 'Show QR code'}
          </button>
          <a href={`${buildCrewDayPath(code)}/flyer`} target="_blank" rel="noopener" className={TONAL}>
            <Printer className="h-4 w-4 flex-none" aria-hidden="true" />
            Printable flyer
          </a>
        </div>
      </div>
    </BottomSheet>
  );
}
