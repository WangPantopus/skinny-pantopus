'use client';

// ============================================================
// "Help me write it" on the write step of Send a Christmas card (launch key
// card_note_help; the server says `note_help` on GET /cards while it can be
// used). The sender may add one line to mention; Pantopus AI offers up to
// three notes (heartfelt, light, brief) within the card's letter limit. They
// pick one, it goes on the card, and they edit it there like anything they
// typed. "Undo" brings back what they had written. Nothing is stored or sent
// from here: the card's own Seal it and Send do that.
// ============================================================

import { useCallback, useId, useRef, useState } from 'react';
import { mailbox } from '@pantopus/api';
import type { HolidayCardNoteIdea } from '@pantopus/api';
import { Loader2 } from 'lucide-react';
import { BACK_TEXT } from './CardBack';
import { Slip } from './AtTheTable';
import { WAX } from './cardArt';

const HINT_LIMIT = 200;
const FALLBACK = 'Couldn’t write a note just now. Try again, or write it yourself.';
const TONE_NAMES: Record<HolidayCardNoteIdea['tone'], string> = { heartfelt: 'Heartfelt', light: 'Light', brief: 'Brief' };

type Help =
  | { kind: 'closed' }
  | { kind: 'asking' }
  | { kind: 'writing' }
  | { kind: 'ideas'; notes: HolidayCardNoteIdea[] }
  | { kind: 'failed'; message: string };

const letters = (text: string) => [...text].length;

/** Who the notes are for, in the panel's first line. */
function forLine(names: string[], count: number): string {
  if (count > 2) return `One note for all ${count} people, so it names no one.`;
  if (names.length === count && names.length > 0) return `For ${names.join(' and ')}.`;
  return count === 2 ? 'One note for both of them.' : 'A note for them.';
}

/** The helper's state for one card: `use` puts a note on the card and remembers what was there, for Undo. */
export function useCardNoteHelp({ designId, names, count, message, limit, onMessage }: {
  designId: string;
  /** The first names the card is to, as this screen shows them. */
  names: string[];
  /** How many people the card goes to. */
  count: number;
  message: string;
  limit: number;
  onMessage: (text: string) => void;
}) {
  const [help, setHelp] = useState<Help>({ kind: 'closed' });
  const [hint, setHint] = useState('');
  // Every note shown for this card so far, so "Try again" gets different ones.
  const shown = useRef<string[]>([]);
  // What the person had written before a note went on the card, and that note: Undo stays until they edit it.
  const [before, setBefore] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const canUndo = before !== null && applied !== null && message === applied;

  const write = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setHelp({ kind: 'failed', message: 'You’re offline. Try again when you’re back online.' });
      return;
    }
    // After a note went on the card unedited, start again from the person's own words, not from that note.
    const written = canUndo && before !== null ? before : message;
    setHelp({ kind: 'writing' });
    try {
      const { notes } = await mailbox.suggestHolidayCardNote({
        design: designId,
        to: names,
        count,
        hint: hint.trim() || undefined,
        note: written.trim() ? written : undefined,
        passed_over: shown.current.length ? shown.current.slice(-6) : undefined,
      });
      const fits = (notes ?? []).filter((note) => note.text.trim() && letters(note.text) <= limit);
      if (fits.length === 0) {
        setHelp({ kind: 'failed', message: FALLBACK });
        return;
      }
      shown.current = [...shown.current, ...fits.map((note) => note.text)];
      setHelp({ kind: 'ideas', notes: fits });
    } catch (e) {
      setHelp({ kind: 'failed', message: e instanceof Error && e.message ? e.message : FALLBACK });
    }
  }, [before, canUndo, count, designId, hint, limit, message, names]);

  const use = useCallback((text: string) => {
    // A second pick keeps the first one's Undo: back to the person's own words.
    setBefore((kept) => (kept !== null && canUndo ? kept : message));
    setApplied(text);
    onMessage(text);
    setHelp({ kind: 'closed' });
  }, [canUndo, message, onMessage]);

  const undo = useCallback(() => {
    if (before === null) return;
    onMessage(before);
    setBefore(null);
    setApplied(null);
  }, [before, onMessage]);

  return {
    help, hint, setHint, canUndo, write, use, undo,
    open: () => setHelp((now) => (now.kind === 'closed' ? { kind: 'asking' } : now)),
    close: () => setHelp({ kind: 'closed' }),
    forWhom: forLine(names, count),
    startsFromNote: Boolean((canUndo && before !== null ? before : message).trim()),
  };
}

export type CardNoteHelp = ReturnType<typeof useCardNoteHelp>;

/** The row under the card: the button, or Undo right after a note went on the card. */
export function CardNoteHelpRow({ help, ghost, quiet }: { help: CardNoteHelp; ghost: string; quiet: string }) {
  const open = help.help.kind !== 'closed';
  return (
    <div className="mx-auto mt-2 flex max-w-[420px] flex-wrap items-center gap-2">
      <button type="button" data-testid="sendCardNoteHelp" aria-expanded={open} onClick={open ? help.close : help.open} className={ghost}>
        Help me write it
      </button>
      {help.canUndo ? (
        <>
          <button type="button" data-testid="sendCardNoteUndo" onClick={help.undo} className={ghost}>Undo</button>
          <span role="status" className={`text-[13px] ${quiet}`}>It’s on the card. Change anything you like.</span>
        </>
      ) : !open ? (
        <span className={`text-[13px] ${quiet}`}>Three notes to pick from and edit.</span>
      ) : null}
    </div>
  );
}

/** The panel under that row: one line to mention, then the notes to pick from. */
export function CardNoteHelpPanel({ help, limit, onCloth }: { help: CardNoteHelp; limit: number; onCloth: boolean }) {
  const hintId = useId();
  const state = help.help;
  if (state.kind === 'closed') return null;
  const button = 'inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#d6cbb6] bg-[#fffdf8] px-3.5 text-[14px] font-semibold text-[#374151] hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-50';
  const writing = state.kind === 'writing';
  const body = (
    <div data-testid="sendCardNoteHelpPanel">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-semibold text-[#111827]">Help me write it</h3>
        <button type="button" onClick={help.close} className="text-[14px] font-semibold text-[#6b2a2a] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]">Close</button>
      </div>
      <p className="mt-1 text-[14px] leading-5 text-[#4b5563]">
        {help.forWhom}{help.startsFromNote ? ' It starts from what you’ve written.' : ''}
      </p>
      <label htmlFor={hintId} className="mt-3 block text-[14px] font-semibold text-[#1f2937]">Anything to mention? <span className="font-normal text-[#4b5563]">(optional)</span></label>
      <input
        id={hintId}
        type="text"
        value={help.hint}
        maxLength={HINT_LIMIT}
        onChange={(event) => help.setHint(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && !writing) { event.preventDefault(); void help.write(); } }}
        placeholder="We missed you at Thanksgiving"
        data-testid="sendCardNoteHint"
        className="mt-1 block w-full rounded-lg border border-[#d6cbb6] bg-[#fffdf8] px-3 py-2 text-[15px] text-[#1f2937] placeholder:text-[#6b7280] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
      />
      {state.kind === 'ideas' ? (
        <ul className="mt-3 space-y-2.5" aria-label="Notes to pick from" data-testid="sendCardNoteIdeas">
          {state.notes.map((note) => (
            <li key={note.tone} className="rounded-lg border border-[#e2d6bf] bg-[#fffdf8] p-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6b2a2a]">{TONE_NAMES[note.tone]}</p>
              <p className="mt-1 whitespace-pre-wrap [container-type:inline-size]">
                <span style={{ ...BACK_TEXT, fontSize: '17px', lineHeight: '23px' }}>{note.text}</span>
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[13px] text-[#4b5563]">{letters(note.text)} of {limit} letters</span>
                <button type="button" data-testid={`sendCardNoteUse-${note.tone}`} onClick={() => help.use(note.text)} className={button}>Use this one</button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {state.kind === 'failed' ? <p role="alert" className="mt-3 text-[14px] font-semibold text-[#8b1d1d]" data-testid="sendCardNoteFailed">{state.message}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state.kind === 'asking' || writing ? (
          <button
            type="button"
            data-testid="sendCardNoteWrite"
            disabled={writing}
            onClick={() => void help.write()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-[15px] font-semibold text-[#fff7ed] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2 disabled:opacity-70"
            style={{ backgroundColor: WAX }}
          >
            {writing ? <><Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Writing…</> : 'Write three notes'}
          </button>
        ) : (
          <button type="button" data-testid="sendCardNoteAgain" onClick={() => void help.write()} className={button}>Try again</button>
        )}
        <span aria-live="polite" className="sr-only">{writing ? 'Writing three notes.' : state.kind === 'ideas' ? `${state.notes.length} notes to pick from.` : ''}</span>
      </div>
      <p className="mt-3 text-[13px] leading-[18px] text-[#4b5563]">Written by Pantopus AI. Pick one, then make it sound like you.</p>
    </div>
  );
  return (
    <div className="mx-auto mt-3 max-w-[420px]">
      {onCloth ? <Slip>{body}</Slip> : <div className="rounded-xl border border-[#e7dcc6] bg-[#fbf6ec] p-4">{body}</div>}
    </div>
  );
}
