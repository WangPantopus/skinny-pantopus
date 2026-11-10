'use client';

/**
 * "Report this card" in the admin Reports queue (memories plan; wave 4 drawing 7): the one card a report shares, and
 * nothing else of either person's mail. It opens only through the report's admin route, which logs every opening
 * (admin_opened_reported_card) and refuses one it can't log; its photo and voice greeting come through that route too,
 * never covered. Nothing is kept once it's closed.
 */
import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import CardFront from '@/components/mailbox/cards/CardFront';
import CardBack from '@/components/mailbox/cards/CardBack';

type Shared = api.admin.ReportedCard;

const when = (at: string | null) => (at
  ? new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : null);

function seconds(ms: number | null | undefined): string {
  const s = Math.max(1, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One of the card's own files as an object URL, loaded when `load` is true and dropped when this closes. */
function useReportedMedia(reportId: string, fileId: string | null, load: boolean) {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    if (!fileId || !load) return undefined;
    const controller = new AbortController();
    let url: string | null = null;
    api.admin.getReportedCardMediaBlob(reportId, fileId, controller.signal)
      .then((blob) => { url = URL.createObjectURL(blob); setState({ url, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ url: null, failed: true }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [reportId, fileId, load]);
  return state;
}

export default function ReportedCard({ reportId, reporter }: { reportId: string; reporter: string }) {
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listen, setListen] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    // One opening per press of "Open the card" (each is logged).
    if (opened.current) return;
    opened.current = true;
    api.admin.getReportedCard(reportId)
      .then((res) => setShared(res.card))
      .catch((err: { statusCode?: number; status?: number; message?: string }) => {
        const status = err?.statusCode ?? err?.status;
        setError(status === 404 ? 'This report doesn’t share a card any more.' : (err?.message || 'Couldn’t open the card just now. Try again in a moment.'));
      });
  }, [reportId]);

  const card = shared?.card ?? null;
  const photo = useReportedMedia(reportId, card?.photo?.file_id ?? null, true);
  const voice = useReportedMedia(reportId, card?.voice?.file_id ?? null, listen);

  if (error) return <p role="alert" className="mt-3 text-sm text-red-700" data-testid="admin-reported-card-error">{error}</p>;
  if (!shared) {
    return <div className="mt-3 flex items-center gap-2 text-sm text-app-text-secondary"><span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />Opening the card…</div>;
  }
  const from = shared.from_name || 'Someone';
  const year = card?.year ?? new Date(shared.sent_on || Date.now()).getFullYear();
  return (
    <section className="mt-3 rounded-xl border border-app-border bg-app-surface-sunken p-3" aria-label={`The card ${reporter} reported`} data-testid="admin-reported-card">
      <p className="text-xs text-app-text-secondary">
        {reporter} shared this card by reporting it. Only this card is shown, and each opening is logged.
      </p>
      <p className="mt-1 text-sm text-app-text">
        From <span className="font-semibold">{from}</span> to <span className="font-semibold">{shared.to_name || 'them'}</span>
        {when(shared.sent_on) ? ` · sent ${when(shared.sent_on)}` : ''}
        {when(shared.delivered_on) ? ` · delivered ${when(shared.delivered_on)}` : ''}
      </p>
      {card ? (
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2">
          <CardFront design={card.design} caption={card.caption} paper={card.paper || '#f7eee0'} year={year} mailedOn={shared.sent_on} />
          <CardBack number={card.number} paper={card.paper || '#f7eee0'} fromName={from} year={year} message={shared.note} signature={card.signature ?? null} />
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-app-surface px-3 py-2 text-sm text-app-text">{shared.note}</p>
      )}
      {card?.photo || card?.voice ? (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {card.photo ? (
            <figure className="m-0 w-[240px] max-w-full" data-testid="admin-reported-card-photo">
              {photo.url ? (
                // An object URL from the report's own route: next/image can't load it.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={card.photo.alt || `Photo from ${from}`} className="w-full rounded-md border border-app-border" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-app-border text-xs text-app-text-muted">
                  {photo.failed ? 'The photo couldn’t be loaded.' : 'Loading the photo…'}
                </div>
              )}
              <figcaption className="mt-1 text-xs text-app-text-secondary">
                Their photo{card.photo.alt ? `: “${card.photo.alt}”` : ' (no description)'}
              </figcaption>
            </figure>
          ) : null}
          {card.voice ? (
            <div className="min-w-[220px]" data-testid="admin-reported-card-voice">
              <p className="text-xs text-app-text-secondary">Their voice greeting ({seconds(card.voice.duration_ms)})</p>
              {listen && voice.url ? (
                <audio controls autoPlay src={voice.url} className="mt-1 w-full" />
              ) : listen && voice.failed ? (
                <p className="mt-1 text-xs text-red-700">The greeting couldn’t be loaded.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setListen(true)}
                  disabled={listen}
                  className="mt-1 rounded-lg border border-app-border px-3 py-1.5 text-sm font-medium text-app-text hover:bg-app-hover disabled:opacity-50"
                >
                  {listen ? 'Loading…' : `▶ Play the greeting (${seconds(card.voice.duration_ms)})`}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
