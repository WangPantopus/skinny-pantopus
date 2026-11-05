'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, LifeBuoy, X } from 'lucide-react';
import * as api from '@pantopus/api';
import { formatPrice } from '@/lib/crewDay';
import { CREW_DAY_OVERLINE, CREW_DAY_PRIMARY_BUTTON, CrewDayCard, CrewDayStepBar } from './CrewDayParts';
import CrewDayFooterBar from './CrewDayFooterBar';

// Screen 7, Something needs attention (board `Problem`): what's wrong, what happened (required, up to 1,000
// characters) and up to 4 photos, sent to Pantopus support; the charge waits. On a case that's already open it adds
// a note or photos. POST /api/crew-days/uploads (each photo), then POST /api/crew-days/bookings/:id/problem.

const KINDS = [
  { id: 'missed', label: 'The crew missed something' },
  { id: 'damage', label: 'Something was damaged' },
  { id: 'no_show', label: "The crew didn't come" },
  { id: 'charge', label: 'A problem with the charge' },
  { id: 'other', label: 'Something else' },
] as const;

type Kind = (typeof KINDS)[number]['id'];
type Photo = { name: string; preview: string; path: string | null; failed: boolean };

export default function CrewDayProblemScreen({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const bookingPath = `/app/crew-days/bookings/${encodeURIComponent(bookingId)}`;
  const query = useQuery({ queryKey: ['crew-day', 'booking', bookingId], queryFn: () => api.crewDays.getBooking(bookingId) });
  const b = query.data;
  const adding = b?.problem?.status === 'open';
  const [kind, setKind] = useState<Kind>('missed');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = 4 - photos.length;
    for (const file of Array.from(files).slice(0, room)) {
      const preview = URL.createObjectURL(file);
      setPhotos((list) => [...list, { name: file.name, preview, path: null, failed: false }]);
      try {
        const { path } = await api.crewDays.uploadPhoto(bookingId, 'problem', file);
        setPhotos((list) => list.map((p) => (p.preview === preview ? { ...p, path } : p)));
      } catch {
        setPhotos((list) => list.map((p) => (p.preview === preview ? { ...p, failed: true } : p)));
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const uploading = photos.some((p) => !p.path && !p.failed);
  const send = async () => {
    if (sending || !note.trim() || uploading) return;
    setSending(true);
    setError(null);
    try {
      const { booking } = await api.crewDays.reportProblem(bookingId, {
        ...(adding ? {} : { kind }),
        note: note.trim(),
        photo_paths: photos.filter((p) => p.path).map((p) => p.path as string),
      });
      queryClient.setQueryData(['crew-day', 'booking', bookingId], booking);
      router.replace(bookingPath);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "We couldn't send this to Pantopus support. Check your connection and try again.");
      setSending(false);
    }
  };

  const crew = b?.crew_day.crew.name || 'The crew';
  const price = b?.price_cents != null ? formatPrice(b.price_cents) : null;
  const close = (
    <Link href={bookingPath} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-app-surface-sunken text-app-text hover:bg-app-hover">
      <X className="h-5 w-5" aria-hidden="true" />
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col text-app-text">
      <CrewDayStepBar title="Something needs attention" leading={close} />
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-1">
        <p className="text-base leading-6 text-app-text-strong">
          {adding
            ? 'Add to what you told Pantopus support. Your charge still waits.'
            : `Tell us what's wrong. Pantopus support owns it until it's fixed, and your ${price ? `${price} ` : ''}charge waits.`}
        </p>

        {!adding ? (
          <fieldset className="min-w-0">
            <legend className={`mb-2 ${CREW_DAY_OVERLINE}`}>What&apos;s wrong?</legend>
            <CrewDayCard className="divide-y divide-app-border overflow-hidden">
              {KINDS.map((k) => (
                <label key={k.id} className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-[0.875rem] py-3 hover:bg-app-hover">
                  <input
                    type="radio"
                    name="cd-problem-kind"
                    checked={kind === k.id}
                    onChange={() => setKind(k.id)}
                    className="h-[1.375rem] w-[1.375rem] flex-none accent-[rgb(var(--accent-primary-fill))]"
                  />
                  <span className="text-base leading-[1.3125rem]">{k.label}</span>
                </label>
              ))}
            </CrewDayCard>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="cd-problem-note" className={CREW_DAY_OVERLINE}>
            What happened?
          </label>
          <textarea
            id="cd-problem-note"
            required
            rows={4}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[7.25rem] rounded-[0.875rem] border border-app-border-strong bg-app-surface px-[0.875rem] py-3 text-base leading-[1.375rem] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="self-end text-xs leading-4 text-app-text-secondary [font-variant-numeric:tabular-nums]">
            {note.length.toLocaleString('en-US')} / 1,000
          </span>
        </div>

        <section aria-labelledby="cd-problem-photos" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="cd-problem-photos" className={CREW_DAY_OVERLINE}>
              Photos (optional)
            </h2>
            <span className="text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">Up to 4</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <button
                key={p.preview}
                type="button"
                aria-label={`Photo ${i + 1}${p.failed ? ", didn't upload" : ''}, remove`}
                onClick={() => setPhotos((list) => list.filter((x) => x.preview !== p.preview))}
                className="relative aspect-square overflow-hidden rounded-xl bg-app-surface-sunken"
              >
                {/* A local preview of the chosen file. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className={`h-full w-full object-cover ${p.path ? '' : 'opacity-50'}`} />
                {p.failed ? <span className="absolute inset-x-0 bottom-0 bg-app-error-bg px-1 text-[0.6875rem] font-semibold text-app-error">Failed</span> : null}
              </button>
            ))}
            {photos.length < 4 ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-app-border-strong bg-app-surface text-xs font-semibold text-app-link"
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
                Add photo
              </button>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void addPhotos(e.target.files)}
          />
        </section>

        <p className="flex items-start gap-2.5 text-sm leading-5 text-app-text-secondary">
          <LifeBuoy className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          We reply within one business day. {crew} sees your note so they can make it right.
        </p>
      </div>
      <CrewDayFooterBar>
        {error ? (
          <p role="alert" className="text-center text-[0.8125rem] leading-[1.125rem] text-app-error">
            {error}
          </p>
        ) : null}
        <button type="button" disabled={!note.trim() || sending || uploading || !b} onClick={() => void send()} className={CREW_DAY_PRIMARY_BUTTON}>
          {sending ? 'Sending…' : uploading ? 'Adding photos…' : 'Send to Pantopus support'}
        </button>
      </CrewDayFooterBar>
    </div>
  );
}
