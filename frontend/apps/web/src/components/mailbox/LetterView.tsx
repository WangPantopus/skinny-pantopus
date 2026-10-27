'use client';

// ============================================================
// Reading a piece (Mail tab drawings, R5-Bill board): the opened envelope on
// top (tap it for who sent it and its trail), "Pantopus read this for you"
// clipped on as a note, the letter itself on cream paper, and what was
// enclosed, each opening from a fresh short-lived link.
// ============================================================

import { useState } from 'react';
import { FileText, Paperclip, Sparkles } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import { getEnclosureLink, MailboxApiError } from '@/lib/mailbox-api';
import MailPiece, { pieceKind, pieceOutside, pieceTrust } from './MailPiece';
import { mailLoadMessage } from './mailLoadMessage';

const SERIF = "'Iowan Old Style', 'Hoefler Text', Charter, Georgia, serif";

function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  // A postmark is a calendar day (YYYY-MM-DD): read it as that day, not UTC midnight.
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function sizeLabel(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Photo';
  return 'File';
}

type Enclosure = { id: string; name: string; mime_type: string; size_bytes: number };

/**
 * One enclosure: Open fetches a fresh link each time (links are short-lived),
 * in a tab opened at the click so a popup blocker doesn't stop it.
 */
function EnclosureRow({ itemId, enclosure }: { itemId: string; enclosure: Enclosure }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setError(null);
    setOpening(true);
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const { url } = await getEnclosureLink(itemId, enclosure.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      setError(`Couldn't open ${enclosure.name}. ${mailLoadMessage(err as MailboxApiError)}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <li className="py-1">
      <div className="flex items-center gap-3 rounded-lg border border-[#e2dccd] bg-white/70 px-3 py-2">
        <FileText className="h-5 w-5 flex-shrink-0 text-[#475569]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#111827]">Enclosed: {enclosure.name}</p>
          <p className="text-xs text-[#5f6775]">{[kindLabel(enclosure.mime_type), sizeLabel(enclosure.size_bytes)].filter(Boolean).join(' · ')}</p>
        </div>
        <button
          type="button"
          onClick={() => { void open(); }}
          disabled={opening}
          aria-label={`Open ${enclosure.name}`}
          className="min-h-[44px] flex-shrink-0 px-2 text-sm font-semibold text-[#0369a1] hover:underline disabled:opacity-60"
        >
          {opening ? 'Opening…' : 'Open'}
        </button>
      </div>
      {error ? <p role="alert" className="mt-1 px-1 text-xs text-[#a81a1a]">{error}</p> : null}
    </li>
  );
}

/** "Pantopus read this for you", clipped to the letter. */
export function SummaryNote({ summary, isBill }: { summary: NonNullable<MailItemV2['summary']>; isBill: boolean }) {
  return (
    <section aria-label="Pantopus read this for you" className="relative z-10 mx-1 rounded-2xl border border-app-border bg-app-surface px-4 pb-3.5 pt-4 shadow-md">
      <svg width="22" height="48" viewBox="0 0 22 48" aria-hidden="true" className="absolute -top-4 left-6">
        <path d="M7 30 V9 a4 4 0 0 1 8 0 V36 a6 6 0 0 1 -12 0 V14" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-primary-700">
        <Sparkles className="h-[15px] w-[15px]" aria-hidden />
        Pantopus read this for you
      </p>
      <p className="mt-1.5 text-[15px] leading-[22px] text-app-text">{summary.text}</p>
      {summary.key_facts?.length ? (
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {summary.key_facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="contents">
              <dt className="text-app-text-secondary">{fact.label}</dt>
              <dd className="font-semibold text-app-text">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-2.5 text-xs text-app-text-secondary">
        {isBill ? 'Read from the letter below. Check the amount before you pay.' : 'Read from the letter below.'}
      </p>
    </section>
  );
}

export default function LetterView({
  piece,
  recipientName,
  recipientLine,
  onOpenEnvelope,
}: {
  piece: MailItemV2;
  recipientName: string;
  recipientLine?: string | null;
  onOpenEnvelope: () => void;
}) {
  const kind = pieceKind(piece);
  const outside = pieceOutside(kind);
  const from = piece.sender_display || 'Unknown sender';
  const trust = pieceTrust(piece);
  const openedAt = piece.first_opened_at || piece.opened_at;
  const enclosures: Enclosure[] = piece.enclosures ?? (piece.attachments ?? []).map((url, index) => ({
    // Servers before private enclosures send public links only.
    id: `legacy-${index}`, name: decodeURIComponent(url.split('/').pop() || 'Attachment'), mime_type: '', size_bytes: 0, url,
  } as Enclosure & { url: string }));
  const body = piece.content || piece.preview_text || '';
  const title = piece.display_title || piece.subject || '';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-2">
      {/* The envelope it came in (or the postcard, booklet, parcel or bundle itself) */}
      <button
        type="button"
        onClick={onOpenEnvelope}
        aria-label={`${outside.charAt(0).toUpperCase()}${outside.slice(1)} from ${from}${openedAt ? `, opened ${longDate(openedAt)}` : ''}. Show who sent it and its trail`}
        className="block w-full max-w-[358px] rounded-lg text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <MailPiece item={piece} recipientName={recipientName} recipientLine={recipientLine} opened />
      </button>

      <div className="relative mt-[-6px] space-y-0">
        {piece.summary ? <SummaryNote summary={piece.summary} isBill={kind === 'bill'} /> : null}

        {/* The letter itself, on paper */}
        <article
          aria-label={`${kind === 'postcard' ? 'Message' : 'Letter'} from ${from}`}
          className={`relative rounded-md border border-[#ebe1cb] bg-[#fbf6ea] px-5 pb-6 text-[#1f2937] shadow-sm [@media(prefers-color-scheme:dark)]:brightness-[0.94] ${piece.summary ? '-mt-2 pt-7' : 'mt-3 pt-5'}`}
        >
          <header className="flex items-start gap-3 border-b border-[#e7dfcc] pb-3">
            {trust.mark ? (
              <div aria-hidden="true" className="h-9 w-9 flex-shrink-0 rounded-lg bg-[#1f2937] text-center text-base font-bold leading-9 text-white">{from.charAt(0).toUpperCase()}</div>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold uppercase tracking-[0.05em]">{from}</p>
              <p className="truncate text-xs text-[#5f6775]">{[piece.sender_address, piece.postmark?.town].filter(Boolean)[0] || trust.label}</p>
            </div>
          </header>
          <div className="mt-3 flex items-start justify-between gap-4 text-sm leading-5">
            <p>
              {recipientName}
              {recipientLine ? <><br />{recipientLine}</> : null}
            </p>
            <p className="flex-shrink-0 text-right text-[#4e5563]">{longDate(piece.postmark?.date || piece.delivered_at || piece.created_at)}</p>
          </div>
          {title ? <h2 className="mt-4 text-lg font-semibold leading-6" style={{ fontFamily: SERIF }}>{title}</h2> : null}
          {body ? (
            <div className="mt-2 whitespace-pre-line text-[15px] leading-[23px]" style={{ fontFamily: SERIF }}>{body}</div>
          ) : (
            <p className="mt-3 text-sm italic text-[#5f6775]">This piece has no letter inside. What it says is on the outside.</p>
          )}
          {enclosures.length ? (
            <section aria-label="Enclosed" className="mt-5">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#4e5563]">
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                Enclosed
              </p>
              <ul>
                {enclosures.map((enclosure) => ('url' in enclosure
                  ? (
                    <li key={enclosure.id} className="py-1">
                      <a href={(enclosure as Enclosure & { url: string }).url} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center gap-3 rounded-lg border border-[#e2dccd] bg-white/70 px-3 py-2 text-sm font-semibold text-[#0369a1] hover:underline">
                        <FileText className="h-5 w-5 flex-shrink-0 text-[#475569]" aria-hidden />
                        <span className="truncate">Open {enclosure.name}</span>
                      </a>
                    </li>
                  )
                  : <EnclosureRow key={enclosure.id} itemId={piece.id} enclosure={enclosure} />))}
              </ul>
            </section>
          ) : null}
        </article>
      </div>
    </div>
  );
}
