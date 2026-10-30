'use client';

// ============================================================
// Look it over (holiday_cards): what the other person will get, before the
// card is sent, drawn with the parts their own Mailbox draws it with: the
// envelope in their Mailbox and the line under it, the sealed notice, the card
// sliding out of its envelope and its back. By email: the email, the page its
// link opens, and the card once they join with that address. It comes from
// the server's preview, which runs every check sending runs and keeps nothing.
// ============================================================

import { useState, type ReactNode } from 'react';
import type { HolidayCardPreview } from '@pantopus/api';
import { Mail } from 'lucide-react';
import type { MailItemV2 } from '@/types/mailbox';
import MailPiece, { pieceSentence } from '../MailPiece';
import { PieceLine, pieceLineBits } from '../MailRow';
import { LINK_PAGE_PANEL, LinkPageSignIn, LinkPageSummary, type LinkPageLetter } from '../OpenLetterView';
import CardFront from './CardFront';
import CardBack from './CardBack';
import CardFlip from './CardFlip';
import { CardFromEnvelope, SealedNotice, useCardOpening } from './HolidayCardView';
import { daysAway, longDay, SERIF } from './cardArt';

// Their morning mail comes at 7 a.m. where they live: that's when it's in their Mailbox.
const MORNING = '7:00 a.m.';
// The email's small print, for a server that doesn't send it with the email's words.
const EMAIL_FOOTER = ['Pantopus — Your household, organized.', 'If you don’t know the sender, you can safely ignore this email.'];

const label = 'text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-[#6b5a3e] [@media(prefers-color-scheme:dark)]:text-app-text-secondary';
const body = 'text-[15px] leading-[22px] text-[#374151] [@media(prefers-color-scheme:dark)]:text-app-text-strong';
const button = 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-[15px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2';
const shadow = 'rounded-[3px] shadow-[0_14px_30px_rgba(60,40,10,0.28)]';

/** Their Mailbox around the piece: the grey page and its day heading, as their Incoming shows it. */
function MailboxFrame({ day, children }: { day: string; children: ReactNode }) {
  return (
    <div className="mt-2 rounded-[20px] border border-[#e3d8c3] bg-app px-3.5 pb-4 pt-3.5 [@media(prefers-color-scheme:dark)]:border-app-border">
      <p className="px-1 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-app-text-secondary">{day}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** The back on its own, the size of the picture side (the flip lays it there). */
function Back({ piece }: { piece: MailItemV2 }) {
  const card = piece.card!;
  return (
    <CardFlip
      showBack
      front={<CardFront design={card.design} caption={card.caption} paper={card.paper} year={card.year} mailedOn={piece.postmark?.date || piece.created_at} className={shadow} />}
      back={<CardBack paper={card.paper} fromName={piece.sender_display || 'Someone'} year={card.year} message={piece.content || ''} className={shadow} />}
    />
  );
}

/** The email's first line names the sender in bold, as the email does. */
function EmailLine({ line, sender }: { line: string; sender: string }) {
  if (!sender || !line.startsWith(sender)) return <>{line}</>;
  return <><strong>{sender}</strong>{line.slice(sender.length)}</>;
}

export default function LookItOver({
  preview,
  toName,
  toFirstName,
  byEmail,
}: {
  preview: HolidayCardPreview;
  /** Their name as step 1 showed it, or the address typed for them. */
  toName: string;
  toFirstName: string;
  byEmail: boolean;
}) {
  const { piece, email } = preview;
  const card = piece.card!;
  const from = piece.sender_display || 'Someone';
  const first = toFirstName || toName;
  const sealed = card.sealed;
  // On the envelope: their own name, as their Mailbox addresses it; never an address line.
  const addressee = piece.recipient_name || toName;
  const { stage, plays, open } = useCardOpening(false);
  const [showBack, setShowBack] = useState(false);
  // On Christmas morning the seal is off: the card leaves its envelope the way an unsealed one does.
  const unsealed: MailItemV2 = sealed ? { ...piece, card: { ...card, sealed: false } } : piece;

  const intro = byEmail
    ? 'They aren’t on Pantopus yet. The email never shows the card; they open it in Pantopus once they join with this address.'
    : sealed
      ? 'It comes sealed and stays shut until Christmas morning. Use Back to change anything.'
      : card.arrival === 'christmas_morning'
        ? 'It comes on Christmas morning with the 7 a.m. mail. Use Back to change anything.'
        : `Open the envelope and turn the card over, the way ${first} will. Use Back to change anything.`;

  const linkPage: LinkPageLetter | null = preview.link_page ? {
    senderName: preview.link_page.sender_name,
    senderVerified: preview.link_page.sender_verified,
    senderKind: 'person',
    subject: piece.subject || 'A Christmas card',
    previewText: null,
    outcomeDescription: null,
    sentTo: preview.link_page.sent_to,
    createdAt: preview.link_page.sent_on,
    card: { holiday: card.holiday, year: card.year, sealed: preview.link_page.sealed },
  } : null;

  return (
    <div>
      <div className="px-4 pt-3.5">
        <h2 className="text-[22px] font-normal leading-7 text-[#0f172a] [@media(prefers-color-scheme:dark)]:text-app-text" style={{ fontFamily: SERIF }}>
          {byEmail ? 'This is what they will see' : `This is what ${toName} will see`}
        </h2>
        <p className="mt-1 text-[14px] leading-5 text-[#4e5563] [@media(prefers-color-scheme:dark)]:text-app-text-secondary">{intro}</p>
      </div>

      {byEmail ? (
        <>
          {email ? (
            <section aria-label="The email they get" data-testid="sendCardLookEmail" className="mx-3 mt-[18px]">
              <h3 className={`${label} px-1`}>{sealed ? 'The email they get, now' : 'The email they get, right away'}</h3>
              <div className="mt-2 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white text-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="border-b border-[#f3f4f6] px-3.5 py-2.5 text-[12px] leading-[17px] text-[#4e5563]">
                  <p className="truncate"><span className="font-semibold text-[#111827]">Pantopus</span> · to {toName}</p>
                  <p className="mt-0.5 text-[14px] font-semibold leading-[19px] text-[#111827]">{email.subject}</p>
                </div>
                <div className="bg-[#8b1d1d] px-4 pb-4 pt-5 text-center">
                  <Mail className="mx-auto h-[30px] w-[30px] text-[#fff7ed]" strokeWidth={1.8} aria-hidden />
                  <p className="mt-1.5 text-[17px] font-semibold leading-[22px] text-[#fff7ed]">{email.heading}</p>
                </div>
                <div className="px-[18px] pb-4 pt-[18px]">
                  {email.lines.map((line, index) => (
                    <p key={line} className={`text-[14px] leading-[21px] text-[#374151] ${index > 0 ? 'mt-2.5' : ''}`}>
                      {index === 0 ? <EmailLine line={line} sender={from} /> : line}
                    </p>
                  ))}
                  <p className="mt-4 text-center">
                    <span className="inline-block rounded-[10px] bg-[#8b1d1d] px-6 py-[11px] text-[14px] font-semibold text-[#fff7ed]">{email.button}</span>
                  </p>
                  <p className="mt-3.5 text-center text-[11px] leading-4 text-[#5f6775]">{email.footnote}</p>
                </div>
                <div className="border-t border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-center text-[10px] leading-[15px] text-[#5f6775]">
                  {(email.footer ?? EMAIL_FOOTER).map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
            </section>
          ) : null}

          {linkPage ? (
            <section aria-label="The page its link opens" data-testid="sendCardLookLinkPage" className="mx-3 mt-[26px]">
              <h3 className={`${label} px-1`}>The page its link opens</h3>
              <div className={`mt-2 ${LINK_PAGE_PANEL}`}>
                <LinkPageSummary letter={linkPage} />
                <LinkPageSignIn letter={linkPage} />
              </div>
            </section>
          ) : null}

          <section aria-label="After they join with that address" className="mx-3 mt-[26px]">
            <h3 className={`${label} px-1`}>After they join with that address</h3>
            <MailboxFrame day="In their Mailbox">
              <div role="img" aria-label={pieceSentence(piece, false)}>
                <MailPiece item={piece} recipientName={addressee} opened={false} />
              </div>
              <div className="mt-4 grid grid-cols-2 items-start gap-3">
                <CardFront design={card.design} caption={card.caption} paper={card.paper} year={card.year} mailedOn={piece.postmark?.date || piece.created_at} className={shadow} />
                <Back piece={piece} />
              </div>
            </MailboxFrame>
          </section>
        </>
      ) : (
        <>
          <section aria-label={`In ${first}’s Mailbox`} className="mx-3 mt-[18px]">
            <h3 className={`${label} px-1`}>In {first}’s Mailbox · {longDay(preview.arrives_on)}</h3>
            <MailboxFrame day="Today">
              <div role="img" aria-label={`${pieceSentence(piece, false)}. Comes at ${MORNING}`} className="p-1">
                <MailPiece item={piece} recipientName={addressee} opened={false} />
                <PieceLine bits={pieceLineBits(piece, MORNING, false)} />
              </div>
            </MailboxFrame>
          </section>

          {sealed ? (
            <section aria-label={`If ${first} taps it before Christmas`} className="mx-4 mt-7">
              <h3 className={label}>If {first} taps it before Christmas</h3>
              <SealedNotice
                from={from}
                day={longDay(preview.opens_on) || 'December 25'}
                when={preview.sealed_days != null ? daysAway(preview.sealed_days) : null}
                className="mt-2.5"
              />
            </section>
          ) : null}

          <section aria-label={sealed ? 'On Christmas morning' : `When ${first} opens it`} className="mx-4 mt-7">
            <h3 className={label}>{sealed ? 'On Christmas morning' : `When ${first} opens it`}</h3>
            <p className={`mt-1.5 ${body}`}>
              {sealed
                ? `The seal lifts at 7 a.m. where ${first} lives. The card slides out of the envelope picture side up.`
                : `A Christmas card from ${from.replace(/\.$/, '')}. It slides out of the envelope picture side up.`}
            </p>
            <div className="mx-auto mt-4 max-w-[300px]">
              <CardFromEnvelope piece={unsealed} recipientName={addressee} opening={stage === 'opening'} plays={plays} showBack={showBack}>
                <div className="mt-[18px] flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBack((back) => !back)}
                    aria-pressed={showBack}
                    className={`${button} border border-[#d6cbb6] bg-[#fffdf8] text-[#374151] hover:bg-[#f5efe3]`}
                  >
                    {showBack ? 'Turn it back' : 'Turn it over'}
                  </button>
                  <button
                    type="button"
                    data-testid="sendCardLookOpenAgain"
                    onClick={() => { setShowBack(false); open(); }}
                    className={`${button} px-3.5 text-[#7c4a2d] hover:bg-black/5 [@media(prefers-color-scheme:dark)]:text-[#e8b996]`}
                  >
                    Open it again
                  </button>
                </div>
              </CardFromEnvelope>
            </div>
          </section>

          <section aria-label="On the back" className="mx-4 mt-6">
            <h3 className={label}>On the back</h3>
            <div className="mx-auto mt-3.5 max-w-[300px]">
              <Back piece={piece} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
