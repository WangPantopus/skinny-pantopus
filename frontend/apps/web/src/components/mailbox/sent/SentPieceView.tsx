'use client';

// ============================================================
// A card you sent (Mail drawings M3, M4, M5): the envelope as it reached
// them, the card you sent (both sides side by side on wider screens; turn it
// over on phones) with your own note, its trail, and while it can still be
// taken back, "Changed your mind?". Like real mail, a card never tells you
// when it was opened. Only its sender can open this page.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, ChevronLeft, Loader2, Lock } from 'lucide-react';
import { useSentCard, useTakeBackHolidayCard } from '@/lib/mailbox-queries';
import { toast } from '@/components/ui/toast-store';
import MailPiece from '../MailPiece';
import { calendarDay } from '../MailRow';
import { mailLoadMessage } from '../mailLoadMessage';
import useMailAddressee from '../useMailAddressee';
import CardFront from '../cards/CardFront';
import CardBack from '../cards/CardBack';
import CardFlip from '../cards/CardFlip';
import { askTakeBack, takeBackMessage } from '../cards/takeBack';
import { shortDay, WAX } from '../cards/cardArt';
import { firstName, sentEnvelope, sentStatusLine, trailLabel, trailWhen } from './sentWords';

const label = 'text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary';
const shadow = 'rounded-[3px] shadow-[0_14px_30px_rgba(60,40,10,0.28)]';
const button = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

/** "4:00 a.m.", by your clock. */
function clock(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(' AM', ' a.m.').replace(' PM', ' p.m.');
}

// The trail's dots: wax red when you sealed it, green once it's with them, dark for the carrier and the email.
const DOT: Record<string, string> = { sealed: WAX, delivered: '#047857', joined: '#047857', opens: '#047857', picked_up: '#1f2937', emailed: '#1f2937', returned: '#6b7280' };

function BackToSent({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-shrink-0 items-center px-2 py-1.5 md:hidden">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-app-text-secondary hover:bg-app-hover hover:text-app-text"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
        Sent
      </button>
    </div>
  );
}

export default function SentPieceView({ id }: { id: string }) {
  const router = useRouter();
  const { timeZone } = useMailAddressee();
  const { data: piece, isLoading, error, refetch } = useSentCard(id);
  const takeBack = useTakeBackHolidayCard();
  const [showBack, setShowBack] = useState(false);
  const [takeBackError, setTakeBackError] = useState<string | null>(null);
  const backToSent = () => router.push('/app/mailbox/sent');

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto" role="status" aria-label="Opening your card">
        <BackToSent onBack={backToSent} />
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
          <div className="h-6 w-56 rounded bg-app-surface-sunken animate-pulse" />
          <div className="h-3 w-40 rounded bg-app-surface-sunken animate-pulse" />
          <div className="h-[150px] max-w-[358px] rounded-md bg-app-surface-sunken animate-pulse" />
        </div>
      </div>
    );
  }

  // Not theirs, or taken back: the server's sentence ("This card isn’t here any more."); trouble: try again.
  if (error || !piece) {
    const gone = error?.status === 404;
    return (
      <div className="flex h-full flex-col">
        <BackToSent onBack={backToSent} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div role="alert" className="max-w-sm text-center">
            <h2 className="mb-1 text-base font-semibold text-app-text">{gone ? mailLoadMessage(error) : 'Couldn’t open this card'}</h2>
            {gone ? null : <p className="mb-4 text-sm text-app-text-secondary">{mailLoadMessage(error)}</p>}
            <button
              type="button"
              onClick={gone ? backToSent : () => { void refetch(); }}
              className={`${button} mt-3 bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500`}
            >
              {gone ? 'Back to Sent' : 'Try again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const name = piece.to_name || 'them';
  const first = firstName(piece.to_name) || 'them';
  const card = piece.card;
  const front = card.design ? (
    <CardFront design={card.design} caption={card.caption} paper={card.paper ?? '#f7eee0'} year={card.year ?? new Date(piece.sent_at).getFullYear()} mailedOn={piece.envelope.postmarked_on ?? piece.sent_at} className={shadow} />
  ) : null;
  const back = <CardBack paper={card.paper ?? '#f7eee0'} fromName={piece.envelope.from} year={card.year ?? new Date(piece.sent_at).getFullYear()} message={piece.note} className={shadow} />;
  const theirMailbox = piece.by_email && piece.status !== 'claimed' ? 'Once they join with that address' : `In ${first}’s Mailbox`;

  const doTakeBack = async () => {
    const sentToday = calendarDay(new Date(piece.sent_at), timeZone) === calendarDay(new Date(), timeZone);
    if (!(await askTakeBack({ byEmail: piece.by_email, sentToday }))) return;
    setTakeBackError(null);
    takeBack.mutate(piece.id, {
      onSuccess: () => { toast.success('You took your card back.'); router.push('/app/mailbox/sent'); },
      // Too late (the carrier has it, or they have it): the card stays, as it is now.
      onError: (err) => { setTakeBackError(takeBackMessage(err)); void refetch(); },
    });
  };

  return (
    <div className="flex h-full flex-col md:overflow-hidden" data-testid="mailSentPiece">
      <BackToSent onBack={backToSent} />
      <div className="flex-1 md:min-h-0 md:overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-1 md:px-7 md:pt-6">
          <h2 className="text-2xl font-bold leading-8 tracking-tight text-app-text">Your card to {name}</h2>
          <p className="mt-0.5 text-sm leading-5 text-app-text-secondary">Sent {shortDay(piece.sent_at)} · {sentStatusLine(piece)}</p>

          <div className="mt-5 grid gap-5 [grid-template-areas:'envelope'_'card'_'trail'_'take'] md:grid-cols-[340px_minmax(0,1fr)] md:[grid-template-areas:'envelope_trail'_'card_card'_'take_take']">
            <section aria-label={theirMailbox} className="[grid-area:envelope]">
              <h3 className={label}>{theirMailbox}</h3>
              <div className="mt-2.5 max-w-[358px]">
                <MailPiece item={sentEnvelope(piece)} recipientName={piece.to_name || ''} opened={false} />
              </div>
            </section>

            <section aria-label="The card you sent" className="[grid-area:card]">
              <h3 className={label}>The card you sent</h3>
              <div className="mt-3.5 grid max-w-[584px] items-start gap-5 md:grid-cols-2">
                <div className="mx-auto w-full max-w-[300px] md:max-w-none">
                  {front ? <CardFlip showBack={showBack} front={front} back={back} /> : back}
                  {front ? (
                    <div className="mt-4 flex justify-center md:hidden">
                      <button
                        type="button"
                        onClick={() => setShowBack((side) => !side)}
                        aria-pressed={showBack}
                        className={`${button} border border-[#d6cbb6] bg-[#fffdf8] px-5 text-[15px] text-[#374151] hover:bg-[#f5efe3] focus-visible:ring-[#8b1d1d]`}
                      >
                        {showBack ? 'Turn it back' : 'Turn it over'}
                      </button>
                    </div>
                  ) : null}
                </div>
                {front ? (
                  <div className="mx-auto w-full max-w-[300px] md:max-w-none">
                    <CardFlip showBack front={front} back={back} />
                  </div>
                ) : null}
              </div>
            </section>

            <section aria-label="Its trail" data-testid="mailSentTrail" className="rounded-[20px] border border-app-border bg-app-surface p-4 [grid-area:trail] md:self-start">
              <h3 className={`${label} mb-3`}>Its trail</h3>
              <ol>
                {piece.trail.map((step, index, all) => {
                  const when = step.done ? trailWhen(step) : null;
                  return (
                    <li key={step.step} className={`relative pl-7 ${index < all.length - 1 ? 'pb-4' : ''}`}>
                      {index < all.length - 1 ? <span aria-hidden className="absolute bottom-[-8px] left-[7px] top-2 w-0.5 bg-app-border" /> : null}
                      <span
                        aria-hidden
                        className={`absolute left-px top-[3px] h-3.5 w-3.5 rounded-full ${step.done ? '' : 'border-2 border-gray-400 bg-app-surface'}`}
                        style={step.done ? { backgroundColor: DOT[step.step] ?? '#1f2937' } : undefined}
                      />
                      <p className={`text-[15px] leading-5 ${step.done ? 'font-semibold text-app-text' : 'text-app-text-secondary'}`}>{trailLabel(step, piece)}</p>
                      {when ? <p className="font-mono text-xs leading-4 text-app-text-secondary">{when}</p> : null}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-app-surface-sunken px-3 py-2.5 text-[13px] leading-[18px] text-app-text-strong">
                <Lock className="mt-px h-[15px] w-[15px] flex-shrink-0" aria-hidden />
                <span>Like real mail, a card never tells you when it was opened.</span>
              </p>
            </section>

            {piece.can_take_back ? (
              <div className="[grid-area:take]">
                <section aria-label="Take it back" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e7dcc6] bg-[#fbf6ec] px-4 py-3.5 text-[#111827] [@media(prefers-color-scheme:dark)]:brightness-[0.94]">
                  <CalendarClock className="h-5 w-5 flex-shrink-0 text-[#7c4a2d]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5">Changed your mind?</p>
                    <p className="text-[13px] leading-[18px] text-[#4e5563]">
                      {piece.by_email
                        ? 'You can take it back until they open it.'
                        : `It waits for the carrier until ${clock(piece.take_back_until)} ${shortDay(piece.take_back_until)} (your clock).`}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="mailSentPieceTakeBack"
                    onClick={() => { void doTakeBack(); }}
                    disabled={takeBack.isPending}
                    className={`${button} border-[1.5px] border-[#8b1d1d] bg-transparent text-[#8b1d1d] hover:bg-[#8b1d1d]/5 focus-visible:ring-[#8b1d1d] disabled:opacity-60`}
                  >
                    {takeBack.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Take it back
                  </button>
                </section>
                {takeBackError ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{takeBackError}</p> : null}
              </div>
            ) : takeBackError ? (
              <p role="alert" className="text-sm font-medium text-red-700 [grid-area:take]">{takeBackError}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
