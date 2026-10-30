'use client';

// ============================================================
// One card in Sent (Mail drawings M2, M5): the envelope as it reached them
// (no postmark while it waits for the carrier, never torn), the card's thumb,
// who it went to and where it is now. "Take it back" while it still can be.
// ============================================================

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SentPiece } from '@pantopus/api';
import { Loader2 } from 'lucide-react';
import MailPiece from '../MailPiece';
import { cardPicture } from '../cards/cardArt';
import { sentEnvelope, sentStatusLine, sentToLine } from './sentWords';

export default function SentRow({
  piece,
  selected = false,
  takingBack = false,
  onTakeBack,
}: {
  piece: SentPiece;
  selected?: boolean;
  takingBack?: boolean;
  onTakeBack: (piece: SentPiece) => void;
}) {
  const router = useRouter();
  const href = `/app/mailbox/sent/${piece.id}`;
  const toLine = sentToLine(piece);
  const statusLine = sentStatusLine(piece);
  // Read out as a sentence: "Your card to Maya O. In their mailbox since Sat, Oct 31."
  const who = `your card to ${(piece.to_name || 'them').replace(/\.$/, '')}${piece.by_email ? ' by email' : ''}`;

  // Wider screens keep Sent in place beside the card (as Incoming does); phones open it as its own screen.
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || window.innerWidth < 768) return;
    event.preventDefault();
    router.push(href, { scroll: false });
  };

  return (
    <div className="relative" data-testid={`mailSentRow.${piece.id}`}>
      <Link
        href={href}
        onClick={open}
        aria-label={`${who.charAt(0).toUpperCase()}${who.slice(1)}. ${statusLine}.`}
        aria-current={selected ? 'true' : undefined}
        className={`block w-full rounded-lg p-1 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          selected ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-app-bg' : ''
        }`}
      >
        <MailPiece item={sentEnvelope(piece)} recipientName={piece.to_name || ''} opened={false} />
        <span aria-hidden="true" className={`mt-2 flex items-center gap-2.5 ${piece.can_take_back ? 'pr-[124px]' : ''}`}>
          {piece.card.design ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardPicture(piece.card.design, 'thumb')}
              alt=""
              className="w-[30px] flex-shrink-0 -rotate-3 rounded-[2px] shadow-[0_2px_6px_rgba(60,40,10,0.25)]"
            />
          ) : null}
          <span className="min-w-0 text-[13px] leading-[18px]">
            <span className="block break-words text-app-text-strong">{toLine}</span>
            <span className="block text-app-text-secondary">{statusLine}</span>
          </span>
        </span>
      </Link>
      {piece.can_take_back ? (
        <button
          type="button"
          data-testid={`mailSentTakeBack.${piece.id}`}
          onClick={() => onTakeBack(piece)}
          disabled={takingBack}
          aria-label={`Take back ${who}`}
          className="absolute bottom-1 right-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-app-text-strong transition-colors hover:bg-app-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
        >
          {takingBack ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Take it back
        </button>
      ) : null}
    </div>
  );
}
