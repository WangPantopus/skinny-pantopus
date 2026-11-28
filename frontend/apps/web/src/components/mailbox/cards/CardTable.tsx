'use client';

// ============================================================
// The Christmas card on the table (launch key card_table): the whole screen
// becomes the table. The envelope is turned over, its flap pulled up and the
// card pulled out, by hand or with the button; then the card lies on the table
// with the envelope behind it. Morning light moves over everything. The first
// open plays it all; opened before, the card is already lying there. It knows
// nothing about the server: reading it marks nothing.
// ============================================================

import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import TravelPostmarks, { travelCameLine } from './TravelPostmarks';
import travelStyles from './CardTravel.module.css';
import { cardMood, cardStampFile, cardTrimmedPicture, daysUntil, firstNameOf, postmarkDay, seededRandom, TABLE_ART, tableEdge, tableTint } from './cardArt';
import { cardPen } from './cardFont';
import { playCardSound, preloadCardSounds } from './cardSounds';
import type { CardPhoto, CardSignature, CardVoice, CardTravel } from '@pantopus/api';
import CardPrint, { useCardMediaUrl, type PrintSource } from './CardPrint';
import { PhotoFrontContext, type PhotoFront } from './PhotoCardFront';
import CardGreeting, { spokenLength } from './CardGreeting';
import { PaperBack, PaperFront, PaperLeaf, useNoteLeaves } from './CardPaper';
import { CardTableEngine, type TableState } from './cardTableEngine';
import { useDarkPage } from './useDarkPage';
import styles from './CardTable.module.css';

const art = (name: string) => `${TABLE_ART}${name}`;
const PEN = `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`;
const WAX_WHOLE = art('wax-gold.webp');
const WAX_CRACKED = art('wax-gold-cracked.webp');
// A letter (design plan Part 10): the same envelope made in cream, with a red seal, on a slate cloth.
const LETTER_WAX_WHOLE = art('wax-red.webp');
const LETTER_WAX_CRACKED = art('wax-red-cracked.webp');
const LETTER_STAMP = art('stamp-peak.webp');
// Everything the envelope is made of: it waits for these and the card's picture before it arrives.
const ALL_ART = ['env-front.webp', 'env-pocket.webp', 'env-flap-out.webp', 'env-flap-in.webp', 'env-inside.webp', 'env-flap-gold.webp',
  'env-pocket-shadow.webp', 'env-flap-shadow.webp', 'wax-gold.webp', 'wax-gold-cracked.webp', 'postmark-blank.webp', 'table-cloth.webp',
  'light.webp', 'grain.png', 'paper.webp'].map(art);

// Snow outside the window (design plan Part 7, nostalgia and Santa): soft specks of shadow drifting down through the
// patch of window light only, 12-18 in it at a time, 6-9 s each, 10% dark. Fixed, so every visit looks the same.
const SNOW = (() => {
  const random = seededRandom(1225);
  return Array.from({ length: 18 }, () => ({
    left: 8 + random() * 80,
    size: 4 + random() * 5,
    seconds: 6 + random() * 3,
    delay: -random() * 9,
    drift: (random() - 0.5) * 36,
  }));
})();

export type TableCard = {
  design: string;
  number?: number | null;
  caption: string | null;
  paper: string;
  table?: string | null;
  /** The table it opens on, as the server names it (absent: by its number, cardMood). */
  mood?: string | null;
  year: number;
  sealed: boolean;
  sealed_until?: string | null;
  /** The whole verse printed on a Christmas with Jesus Christ picture: "Read the verse" (design plan 6.2). */
  verse?: string | null;
  /** Signed beside FROM (design plan 8.2); like the note, not while it's sealed. */
  signature?: CardSignature | null;
  /** The card's own photo (memories plan step 4); null while sealed. `covered` until the reader taps it. */
  photo?: CardPhoto | null;
  /** The card's own voice greeting (memories plan step 7); null while sealed. Plays only when pressed. */
  voice?: CardVoice | null;
  /** A card that travels (server key card_travel): the postmarks of the towns on the way, and how far it came. */
  travel?: Pick<CardTravel, 'postmarks' | 'miles' | 'towns'> | null;
  /** A photo card (Wave 4.2): its `photo` is its front, in this frame. Null while sealed. */
  front?: { frame: 'heirloom' | 'midnight' | 'arch'; caption: string | null } | null;
};

/** A line in the ⋯ menu, or a quiet button under the card. A quiet button may also carry its short words (used when two
 *  don't fit side by side) and what a screen reader says (the full words, whichever show). */
export type TableMenuItem = { label: string; onSelect: () => void; short?: string; spoken?: string };

/** A quiet button in the one row under the card (Fix 1 of the November 17 design check). */
type QuietButton = { key: string; full: string; short: string; spoken: string; testId: string; onSelect: () => void };

/** A reply lying on the card (Write back, mail-cards-experience Part 3): the replier's sheet, drawn as the card's back. */
export type TableReply = {
  note: string;
  fromName: string;
  signature?: CardSignature | null;
  /** The day it was written, for Read it in print. */
  writtenOn?: string | null;
};

/** Sealing it by hand (design plan Part 2): the sender's own moment on the table, before the card goes. */
export type SendMoment = {
  /** Who it's for, as the words say it ("Maya"). */
  firstName: string;
  /** Several cards (a list): a stack of envelope edges shows behind the top one. */
  count?: number;
  /** The seal is pressed home: send it now. Answers whether it went, or the words saying why it didn't. */
  onSeal: () => Promise<{ ok: true } | { ok: false; message: string | null }>;
  /** Step 5, once the envelope has gone: the words at the top, and the line and buttons under the table. */
  goneWords: string;
  gone: ReactNode;
  /** Quick seal (Wave 3.5, `improved`, after the first full sealing on this device): a quiet link under the button. */
  quickSeal?: boolean;
};

/** A failed picture tries again rather than showing broken: a weak connection is no reason to lose the envelope. */
function retryImage(el: HTMLImageElement) {
  const src = el.getAttribute('src');
  const tries = Number(el.dataset.tries || 0);
  if (!src || tries >= 5) return;
  el.dataset.tries = String(tries + 1);
  window.setTimeout(() => { el.removeAttribute('src'); el.setAttribute('src', src); }, 400 * (tries + 1));
}

/** The largest size, up to `largest`, at which `text` stays within `share` of the envelope's width (as shares of it). */
function fitOnEnvelope(text: string, largest: number, share: number): number {
  const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!context) return largest;
  context.font = `100px ${PEN}`;
  const width = context.measureText(text || ' ').width / 100;
  return Math.min(largest, share / Math.max(width, 0.01));
}

function daysWords(until: string | null | undefined) {
  const days = until ? daysUntil(until) : 0;
  return {
    opens: days <= 0 ? 'It opens this morning.' : `It opens Christmas morning, in ${days} ${days === 1 ? 'day' : 'days'}.`,
    notYet: days <= 0 ? 'Not yet. It opens this morning.' : `Not yet. ${days} ${days === 1 ? 'day' : 'days'} until Christmas morning.`,
  };
}

/** The print's first line: "FROM MAYA · NOVEMBER 15", the day it was mailed (just "FROM MAYA" without one). */
function printFrom(first: string, mailedOn: string | null | undefined): string {
  const date = mailedOn ? new Date(mailedOn.length === 10 ? `${mailedOn}T12:00:00` : mailedOn) : null;
  const day = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
  return `FROM ${first}${day ? ` · ${day}` : ''}`.toUpperCase();
}

function Art({ src, ...rest }: { src: string; alt?: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" {...rest} />;
}

function SidePieces({ side }: { side: 'Front' | 'Back' }) {
  return (
    <>
      <div className={styles.sheen} data-el={`sheen${side}`} />
      <div className={styles.turnShade} data-el={`shade${side}`} />
    </>
  );
}

/** The welcome letter folded in three (design plan Part 10): cream paper, its heading, a few lines, the fold. */
function LetterSheet({ className, title, children }: { className: string; title: string; children?: ReactNode }) {
  return (
    <div className={`${styles.letterSheet} ${className}`} style={{ position: 'absolute', inset: 0 }}>
      <div className={styles.letterHead}>{title}</div>
      <div className={styles.letterLines}><i /><i /><i /><i /><i /><i /></div>
      <div className={styles.letterFold} />
      {children}
    </div>
  );
}

export default function CardTable({
  card,
  note,
  fromName,
  toName,
  mailedOn,
  startOnTable = false,
  replay = 0,
  paused = false,
  closeLabel = 'Back to the Mailbox',
  menu = [],
  sendBack = null,
  writeBack = null,
  reply = null,
  nextCard = null,
  sendMoment = null,
  passOn = null,
  journey = null,
  onShare,
  onClose,
  overlay,
  letter = null,
  mediaFrom = null,
  improved = false,
}: {
  /**
   * The card improvements of November 28 (the read the page drew from said `improved`): a sealed card's "Not yet" line
   * lies just under the words above it, on dark glass, and the words stay (Wave 3.6).
   */
  improved?: boolean;
  card: TableCard;
  /** The note. A sealed card's never reaches this far. */
  note: string;
  fromName: string;
  toName: string;
  /** The day it was mailed, for the postmarks. */
  mailedOn?: string | null;
  /** It was opened before: the card already lies on the table. */
  startOnTable?: boolean;
  /** Counts up to play it again from the start ("Open it again"). */
  replay?: number;
  /** Something is open over the table: it stops moving, and Escape belongs to that. */
  paused?: boolean;
  closeLabel?: string;
  menu?: TableMenuItem[];
  /** Send one back (design plan Part 3): a quiet button under "Turn it back" once the card is turned over. */
  sendBack?: TableMenuItem | null;
  /** "Write back to {first name}" or "You wrote back" (Part 3): a quiet button once the card is turned over; "Share this
   *  card" then keeps only its corner button and its line in the ⋯ menu. */
  writeBack?: TableMenuItem | null;
  /** The reply on the card (the joined pair): it lands over the card's lower part. The table keeps room for it. */
  reply?: TableReply | null;
  /** Open the next card (mail-cards-experience Part 4): how many more wait, and the move to the oldest of them. */
  nextCard?: { count: number; onOpen: () => void } | null;
  /** Sealing it by hand instead of opening it. */
  sendMoment?: SendMoment | null;
  /** "Pass it on" (travelling card Part 4): beside "Turn it back" once the card is turned over; filled, or quiet after one. */
  passOn?: (TableMenuItem & { quiet?: boolean }) | null;
  /** "See its journey" (Part 4): the first quiet button once the card is turned over. */
  journey?: TableMenuItem | null;
  onShare?: () => void;
  onClose: () => void;
  /** Sheets and dialogs that belong over the table. */
  overlay?: ReactNode;
  /**
   * A letter, not a card (design plan Part 10, the welcome letter): the cream envelope with the red seal on slate, the
   * same moves, and the folded sheet that comes out opens the letter itself (`onOut`).
   */
  letter?: { onOut: () => void } | null;
  /** Where the card's photo and greeting load from: the reader's piece, the sender's Sent, or their own upload (Look it over). */
  mediaFrom?: ((fileId: string) => PrintSource) | null;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  // The reply on the card (Part 3): in front as it lands; a tap on the card or on the sheet brings either forward.
  const replyRef = useRef(reply);
  replyRef.current = reply;
  const [replyFront, setReplyFront] = useState(true);
  const replyFrontRef = useRef(replyFront);
  replyFrontRef.current = replyFront;
  const [replyLanded, setReplyLanded] = useState(false);
  const engineRef = useRef<CardTableEngine | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ui, setUi] = useState<TableState>({ step: startOnTable && !card.sealed ? 'out' : 'front', backUp: false, turnedOnce: false, envTurnedOnce: false, heldOnce: false, send: sendMoment ? 'ready' : null });
  // Why the seal didn't take, in place of the words until the next press.
  const [refusal, setRefusal] = useState<string | null>(null);
  const momentRef = useRef(sendMoment);
  momentRef.current = sendMoment;
  const [menuOpen, setMenuOpen] = useState(false);
  // The quiet row's words: both full, both short, or only the first (full, else short) where two don't fit side by side.
  const quietRowRef = useRef<HTMLDivElement | null>(null);
  const quietMeasureRef = useRef<HTMLDivElement | null>(null);
  const [rowFit, setRowFit] = useState<'full' | 'short' | 'one' | 'oneShort'>('full');
  const fitQuietRow = useCallback(() => {
    const row = quietRowRef.current;
    const measure = quietMeasureRef.current;
    const bottom = row?.closest('[data-el="bottom"]') as HTMLElement | null;
    if (!row || !measure || !bottom) return;
    const box = getComputedStyle(bottom);
    const room = bottom.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const widths = (which: string) => Array.from(measure.querySelectorAll<HTMLElement>(`[data-words="${which}"]`))
      .map((el) => el.getBoundingClientRect().width);
    const across = (list: number[]) => list.reduce((a, b) => a + b, 0) + gap * Math.max(0, list.length - 1);
    const full = widths('full');
    const short = widths('short');
    if (!full.length || room <= 0) return;
    setRowFit(across(full) <= room ? 'full' : across(short) <= room ? 'short' : full[0] <= room ? 'one' : 'oneShort');
  }, []);
  // Measured after every render (the words change with the card's side and the reply), and again when the controls
  // change size (window width, larger text).
  useLayoutEffect(() => { fitQuietRow(); });
  const [controlsHidden, setControlsHidden] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);
  const from = firstNameOf(fromName);
  // The collection's mood (design plan Part 7): snow, candlelight or Santa's bounce. Off with Reduce Motion (CSS).
  const mood = cardMood(card.number, card.design, card.mood);
  // A photo from someone who isn't the reader's connection stays covered until it's tapped (memories contract 10).
  const [uncovered, setUncovered] = useState(false);
  // The photo is fetched only once the card has been turned over, as on the phones: nothing at open or after a reload,
  // and it stays once fetched (turning back or enlarging doesn't fetch it again).
  const [mediaSeen, setMediaSeen] = useState(false);
  const isLetter = Boolean(letter);
  // A photo card (Wave 4.2): the photo is the card's front, in its frame, veiled first while it's covered; it isn't laid
  // on the table a second time. Without a way to read it here (the sealing table), the page's own front (its context).
  const frontPhoto = !isLetter && !card.sealed && card.front && card.photo ? card.photo : null;
  const [frontUncovered, setFrontUncovered] = useState(false);
  const frontSource = frontPhoto && mediaFrom && (!frontPhoto.covered || frontUncovered) ? mediaFrom(frontPhoto.file_id) : null;
  const { url: frontUrl } = useCardMediaUrl(frontSource);
  const pageFront = useContext(PhotoFrontContext);
  const frontCoverRef = useRef<(() => void) | null>(null);
  const tableFront: PhotoFront | null = frontPhoto && card.front && mediaFrom ? {
    design: card.design,
    frame: card.front.frame,
    caption: card.front.caption,
    aspect: frontPhoto.width && frontPhoto.height ? frontPhoto.width / frontPhoto.height : null,
    src: frontUrl,
    alt: frontPhoto.alt,
    covered: frontPhoto.covered && !frontUncovered ? { name: firstNameOf(fromName), onUncover: () => setFrontUncovered(true) } : null,
  } : pageFront;
  // The card's own photo and voice greeting lie on the table beside it once it's turned over (wave 4 drawings 3 and 4).
  const photo = !isLetter && !card.sealed && !sendMoment && mediaFrom && !frontPhoto ? card.photo ?? null : null;
  const voice = !isLetter && !card.sealed && !sendMoment && mediaFrom ? card.voice ?? null : null;
  const hasMedia = Boolean(photo || voice);
  // A long note runs onto a second leaf on a table that can be turned (Part 9); the sealing moment keeps one side.
  const leavesOn = !isLetter && !card.sealed && !sendMoment;
  const leaves = useNoteLeaves(leavesOn ? note : '', card.number, leavesOn);
  // The envelope's pictures: the cream set for a letter.
  const envArt = (name: string) => art(isLetter ? `cream-${name}` : name);
  const waxWhole = isLetter ? LETTER_WAX_WHOLE : WAX_WHOLE;
  const waxCracked = isLetter ? LETTER_WAX_CRACKED : WAX_CRACKED;
  const stampSrc = isLetter ? LETTER_STAMP : cardStampFile(card.number, card.design, card.mood);
  const letterRef = useRef(letter);
  letterRef.current = letter;
  const days = daysWords(card.sealed_until);

  // Wave 3.6: where the line goes, just under the words (null: its usual place).
  const [toastTop, setToastTop] = useState<number | null>(null);
  const say = useCallback((text: string) => {
    if (improved) {
      const stage = stageRef.current;
      const words = stage?.querySelector<HTMLElement>('[data-el="words"]');
      const box = words?.textContent?.trim() ? words.getBoundingClientRect() : null;
      setToastTop(stage && box ? Math.round(box.bottom - stage.getBoundingClientRect().top + 12) : null);
    }
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, [improved]);

  useEffect(() => { setMounted(true); }, []);
  useDarkPage(mounted, tableEdge(card.table));

  // The engine lives as long as the screen; fold-like resizes only lay it out again.
  useEffect(() => {
    const stage = stageRef.current;
    if (!mounted || !stage) return undefined;
    const engine = new CardTableEngine(stage, {
      sealed: card.sealed,
      sending: Boolean(momentRef.current),
      mood: isLetter ? undefined : mood,
      media: hasMedia,
      reply: Boolean(replyRef.current),
      wholeSrc: waxWhole,
      crackedSrc: waxCracked,
      callbacks: {
        onState: setUi,
        onRefused: () => say(daysWords(card.sealed_until).notYet),
        onTableTap: () => setControlsHidden((hidden) => !hidden),
        // The joined pair: a tap on the card, with the reply in front, brings the card to the front instead of turning it.
        onCardTap: () => {
          // A photo card's covered front (Wave 4.2): a tap on its picture side shows the photo instead of turning it.
          if (frontCoverRef.current) { frontCoverRef.current(); return true; }
          if (!replyRef.current || !replyFrontRef.current) return false;
          setReplyFront(false);
          return true;
        },
        onPress: () => setMenuOpen(false),
        // Quiet paper sounds (design plan 8.3), when they're on in Mail Day settings.
        onSound: playCardSound,
        // The card goes the moment the seal is on; one press sends one card (the engine takes no second press).
        onSeal: () => {
          const moment = momentRef.current;
          if (!moment) return;
          setRefusal(null);
          void moment.onSeal().then((answer) => {
            if (!answer.ok) setRefusal(answer.message);
            engineRef.current?.sealResult(answer.ok);
          }, () => engineRef.current?.sealResult(false));
        },
      },
    });
    engineRef.current = engine;
    preloadCardSounds();
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __cardTable?: CardTableEngine }).__cardTable = engine;
    const onImageError = (event: Event) => { if ((event.target as HTMLElement).tagName === 'IMG') retryImage(event.target as HTMLImageElement); };
    stage.addEventListener('error', onImageError, true);
    // iOS sometimes hands a touch to the page as a scroll; keep the page itself still.
    const stillPage = (event: TouchEvent) => { if (stage.contains(event.target as Node) && !(event.target as Element).closest?.('[data-scroll]')) event.preventDefault(); };
    document.addEventListener('touchmove', stillPage, { passive: false });
    const page = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    engine.layout();
    let begun = false;
    const begin = () => {
      if (begun || engineRef.current !== engine) return;
      begun = true;
      if (momentRef.current) engine.startSending({ sealedMark: card.sealed });
      else if (startOnTable && !card.sealed) engine.startOnTable();
      else engine.restart(true);
    };
    // The art and the card's picture are ready before the envelope arrives; after 5 seconds it comes anyway.
    engine.restart(false);
    (stage.querySelector('[data-el="lFront"]') as HTMLElement).style.visibility = 'hidden';
    const pictures = isLetter
      ? [...ALL_ART.map((src) => src.replace(/\/(env-|wax-gold)([^/]*)$/, (_, a: string, b: string) => (a === 'env-' ? `/cream-env-${b}` : `/wax-red${b}`))), stampSrc]
      : [...ALL_ART, ...(card.design ? [cardTrimmedPicture(card.design)] : []), stampSrc];
    const ready = pictures.map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => {});
    });
    const startTimer = window.setTimeout(begin, 5000);
    void Promise.all([...ready, document.fonts?.load(`48px ${PEN}`).catch(() => {})]).then(() => {
      (stage.querySelector('[data-el="lFront"]') as HTMLElement).style.visibility = '';
      begin();
    });
    return () => {
      window.clearTimeout(startTimer);
      engineRef.current = null;
      engine.destroy();
      stage.removeEventListener('error', onImageError, true);
      document.removeEventListener('touchmove', stillPage);
      document.documentElement.style.overflow = page;
    };
    // The engine is made once per screen; a different card gets a new table (the host keys it by card).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // The engine knows when the note runs onto a second leaf (Part 9): then "Read on" and a tap lift its first leaf.
  const twoLeaves = Boolean(leaves);
  useEffect(() => { if (mounted) engineRef.current?.setLeaves(twoLeaves); }, [mounted, twoLeaves]);

  // Read the verse (design plan 6.2): the bookmark over the table.
  const [verseOpen, setVerseOpen] = useState(false);
  const verseCloseRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (verseOpen) verseCloseRef.current?.focus(); }, [verseOpen]);
  // Read it in print (mail-cards-experience Part 2): the note in plain type on the same bookmark. The browser's Back
  // closes it too: opening it adds a history entry with the page's own state, which Back (or closing it) takes away.
  const [printOpen, setPrintOpen] = useState(false);
  // What the bookmark prints: the card's note, or the reply lying on it (Part 3).
  const [printWhat, setPrintWhat] = useState<'card' | 'reply'>('card');
  const printCloseRef = useRef<HTMLButtonElement | null>(null);
  const printPushed = useRef(false);
  useEffect(() => { if (printOpen) printCloseRef.current?.focus({ preventScroll: true }); }, [printOpen]);
  const openPrint = useCallback((what: 'card' | 'reply' = 'card') => {
    setMenuOpen(false);
    setPrintWhat(what);
    setPrintOpen(true);
    try { window.history.pushState(window.history.state, ''); printPushed.current = true; } catch { /* no history: Close still works */ }
  }, []);
  const closePrint = useCallback(() => {
    setPrintOpen(false);
    if (printPushed.current) { printPushed.current = false; window.history.back(); }
  }, []);
  useEffect(() => {
    if (!printOpen) return undefined;
    const onBack = () => { printPushed.current = false; setPrintOpen(false); };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [printOpen]);
  // The reply lands on the card once it lies out (Part 3): the set-down sound, and one tap you can feel where the phone
  // lets the page ask for it.
  useEffect(() => {
    if (!reply || replyLanded || ui.step !== 'out') return undefined;
    const timer = window.setTimeout(() => {
      setReplyLanded(true);
      playCardSound('card-down');
      try { navigator.vibrate?.(12); } catch { /* not offered */ }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [reply, replyLanded, ui.step]);
  // Larger text than the browser's default (1.15 times or more, as on Android): "Read it in print" is a full button.
  const [largeText, setLargeText] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    setLargeText(parseFloat(getComputedStyle(document.documentElement).fontSize) >= 16 * 1.15);
  }, [mounted]);
  // The card has been enlarged once, so the hint that says how has done its job.
  const [enlargedOnce, setEnlargedOnce] = useState(false);
  if (ui.enlarged && !enlargedOnce) setEnlargedOnce(true);
  // The card's own photo, opened over the window from its print: the table rests under it, and its keys are the photo's.
  const [photoOpen, setPhotoOpen] = useState(false);
  useEffect(() => { engineRef.current?.setPaused(paused || verseOpen || photoOpen || printOpen); }, [paused, verseOpen, photoOpen, printOpen]);

  // "Open it again".
  const playedRef = useRef(replay);
  useEffect(() => {
    if (playedRef.current === replay) return;
    playedRef.current = replay;
    setMenuOpen(false);
    setControlsHidden(false);
    engineRef.current?.restart(true);
  }, [replay]);

  // Large text changes the height of what sits below the card.
  useEffect(() => {
    const stage = stageRef.current;
    if (!mounted || !stage || typeof ResizeObserver === 'undefined') return undefined;
    const bottom = stage.querySelector('[data-el="bottom"]') as HTMLElement;
    const observer = new ResizeObserver(() => { fitQuietRow(); engineRef.current?.layout(); engineRef.current?.wake(); });
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [mounted, fitQuietRow]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (paused || photoOpen) return;
      const stage = stageRef.current;
      const active = document.activeElement;
      const here = !active || active === document.body || Boolean(stage?.contains(active));
      if (!here) return;
      if (event.key === 'Escape' && verseOpen) {
        event.preventDefault();
        setVerseOpen(false);
      } else if (event.key === 'Escape' && printOpen) {
        event.preventDefault();
        closePrint();
      } else if (event.key === 'Escape' && ui.enlarged) {
        // An enlarged card comes back to its size first.
        event.preventDefault();
        engineRef.current?.resetZoom();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (menuOpen) { setMenuOpen(false); moreRef.current?.focus(); } else onClose();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        engineRef.current?.arrow(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'ArrowUp' && (ui.step === 'back' || ui.step === 'flap')) {
        event.preventDefault();
        engineRef.current?.primary();
      } else if (event.key === 'Tab' && stage) {
        // Focus stays on the table while it's open.
        const focusable = [...stage.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!stage.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, paused, photoOpen, menuOpen, onClose, ui.step, ui.enlarged, verseOpen, printOpen, closePrint]);

  // Focus comes to the table as it opens, and goes back where it was when it closes.
  useEffect(() => {
    if (!mounted) return undefined;
    const before = document.activeElement as HTMLElement | null;
    stageRef.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, [mounted]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // A letter out of its envelope opens as the letter page, after a moment to see it come out.
  useEffect(() => {
    if (!isLetter || ui.step !== 'out') return undefined;
    const reduceNow = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => letterRef.current?.onOut(), reduceNow ? 300 : 1100);
    return () => window.clearTimeout(timer);
  }, [isLetter, ui.step]);

  if (!mounted) return null;

  const { step, backUp, turnedOnce, envTurnedOnce, heldOnce, send } = ui;
  frontCoverRef.current = tableFront?.covered && step === 'out' && !backUp ? tableFront.covered.onUncover : null;
  // Sealing it, the card isn't sealed to the sender: only its envelope says so once it's addressed.
  const sealed = card.sealed && !sendMoment;
  let words = '';
  let wordsSub: string | null = null;
  let primary = '';
  let hint = '';
  const reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  if (sendMoment) {
    if (send === 'ready') {
      words = `For ${sendMoment.firstName}.`;
      primary = reduce ? 'Seal and send' : 'Put it in the envelope';
      hint = reduce ? '' : 'or push it up into the envelope';
    } else if (send === 'in') {
      primary = reduce ? 'Seal and send' : 'Close the flap';
      hint = reduce ? '' : 'or pull the flap down';
    } else if (send === 'seal') {
      words = refusal ?? (reduce ? '' : 'Press and hold to seal it.');
      primary = reduce ? 'Seal and send' : 'Seal it';
      hint = reduce ? '' : 'or press and hold anywhere';
    } else if (send === 'gone') {
      words = sendMoment.goneWords;
    }
  } else if (isLetter) {
    // The welcome letter: turn it over, open it, take the letter out; out, it opens as a letter page.
    if (step === 'front') { words = `A letter from ${from}.`; primary = 'Turn it over'; hint = 'or swipe it, the way you’d turn it in your hand'; }
    else if (step === 'back') { primary = 'Open it'; hint = 'or pull the flap up with your finger'; }
    else if (step === 'flap') { primary = 'Take the letter out'; hint = 'or pull it out with your finger'; }
    else if (step === 'out') { primary = 'Read the letter'; }
  } else if (step === 'front') {
    words = sealed ? `${from} sealed this card.` : `A Christmas card from ${from}.`;
    // A travelling card past its first stop (Part 3): how far it came, under the words.
    if (!sealed) wordsSub = travelCameLine(card.travel);
    primary = 'Turn it over';
    hint = envTurnedOnce ? 'or swipe it' : 'or swipe it, the way you’d turn it in your hand';
  } else if (step === 'back') {
    if (sealed) { words = days.opens; primary = 'Try to open it'; hint = 'or pull the flap up'; }
    else { primary = 'Open it'; hint = 'or pull the flap up with your finger'; }
  } else if (step === 'flap') {
    primary = 'Take the card out';
    hint = 'or pull it out with your finger';
  } else if (step === 'out') {
    // A long note's first leaf (Part 9): "Read on" lifts it; the card's own back, the second leaf, turns it back.
    primary = backUp ? (twoLeaves && ui.leafUp ? 'Read on' : 'Turn it back') : 'Turn it over';
    if (!turnedOnce) hint = 'or swipe it';
    // Until it's been enlarged once (the card could always be enlarged, but nothing said so).
    else if (!enlargedOnce) hint = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches ? 'double-tap the card to enlarge it' : 'double-click the card to enlarge it';
    else if (!heldOnce && typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) hint = 'press and hold, then move your finger: the light moves';
  }
  // Enlarged (design plan 6.1): how to bring it back. A verse card on the table offers its verse in place of the hint.
  if (!sendMoment && step === 'out' && ui.enlarged) {
    hint = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches ? 'double-tap to bring it back' : 'double-click to bring it back';
  }
  // Read it in print (Part 2): note side up, the card not sealed and not enlarged, in place of that side's hint. A verse
  // card keeps "Read the verse" on its picture side.
  const cardPrintable = !sendMoment && !isLetter && !sealed && Boolean(note.trim());
  // A reply in front prints its own words (Part 3).
  const replyPrintable = !sendMoment && Boolean(reply?.note.trim());
  const printable = cardPrintable || replyPrintable;
  const printsReply = replyPrintable && replyLanded && replyFront && step === 'out' && !ui.enlarged;
  const readPrint = printsReply || (cardPrintable && step === 'out' && backUp && !ui.enlarged);
  const readVerse = !sendMoment && !isLetter && !sealed && step === 'out' && !ui.enlarged && Boolean(card.verse) && !readPrint;
  // With larger text it is a full button beside "Turn it back", and the line under it stays empty.
  const printButton = readPrint && largeText;
  const printLine = readPrint && !largeText;
  const turnedOver = step === 'out' && backUp;
  // Once the card has been turned over (and after it's turned back), while it lies on the table, not enlarged.
  const nextShown = Boolean(nextCard) && !sendMoment && !isLetter && step === 'out' && turnedOnce && !ui.enlarged;
  const quietShare = Boolean(onShare) && !sendMoment && !isLetter && !sealed;
  // Under the line slot, ONE row of quiet buttons, at most two side by side, never a second row (the design check of
  // November 17, Fix 1): Open the next card when cards wait, then Write back (or You wrote back), then Send {first name}
  // a card, as on the iPhone and Android. On a reader's card (it has a ⋯ menu) "Share this card" is never in the row: it
  // keeps its corner button and its ⋯ line. The sender's own look at a card from Sent keeps it as its one quiet button.
  // The row's room is kept while any of them can be offered, so the card never moves when they show.
  const rowRoom = !sendMoment && !isLetter && Boolean(nextCard || journey || writeBack || sendBack || (quietShare && !menu.length));
  const quietButtons = ([
    nextCard && nextShown ? {
      key: 'next', full: `Open the next card (${nextCard.count} more)`, short: `Next card (${nextCard.count} more)`,
      spoken: `Open the next card, ${nextCard.count} more waiting`, testId: 'cardTableNextCard', onSelect: nextCard.onOpen,
    } : null,
    // A travelling card (Part 4): "See its journey" joins the row, before "Write back"; what doesn't fit is under ⋯.
    journey && turnedOver ? {
      key: 'journey', full: journey.label, short: journey.short || journey.label, spoken: journey.spoken || journey.label,
      testId: 'cardTableJourney', onSelect: journey.onSelect,
    } : null,
    writeBack && turnedOver ? {
      key: 'write', full: writeBack.label, short: writeBack.short || writeBack.label, spoken: writeBack.spoken || writeBack.label,
      testId: 'cardTableWriteBack', onSelect: writeBack.onSelect,
    } : null,
    sendBack && turnedOver ? {
      key: 'send', full: sendBack.label, short: sendBack.short || sendBack.label, spoken: sendBack.spoken || sendBack.label,
      testId: 'cardTableSendBack', onSelect: sendBack.onSelect,
    } : null,
    quietShare && turnedOver && !menu.length ? {
      key: 'share', full: 'Share this card', short: 'Share', spoken: 'Share this card', testId: 'cardTableShareQuiet', onSelect: () => onShare?.(),
    } : null,
  ].filter(Boolean) as QuietButton[]).slice(0, 2);
  const showTopRight = !sendMoment && !isLetter && (step === 'out' || (sealed && (step === 'back' || step === 'front')));
  // The button is there only when there's something to press: never while things move by themselves.
  const sendButton = !sendMoment || send === 'ready' || send === 'in' || send === 'seal';

  // Read aloud as one sentence, as today's card is. The envelope reads as what it is.
  const caption = card.caption || 'A Christmas picture';
  const captionSentence = /[.!?]$/.test(caption) ? caption : `${caption}.`;
  // What lies with it, said once it's turned over (the photo and the greeting are on the table, not in the card).
  const mediaSentence = photo || voice
    ? ` With it: ${[photo ? 'a photo' : '', voice ? `a voice greeting, ${spokenLength(voice.duration_ms)}` : ''].filter(Boolean).join(' and ')}.`
    : '';
  const spoken = isLetter
    ? (step === 'out' ? `The letter from ${fromName}. Opening it.` : `A letter from ${fromName}`)
    : sendMoment
    ? [words, send === 'addressed' ? `Addressed to ${toName}.` : '', send === 'sending' ? 'Sealing it.' : ''].filter(Boolean).join(' ')
    : step === 'out' && !sealed
    ? `Card from ${fromName}: ${captionSentence} On the back: ${note}${mediaSentence}${reply ? ` ${reply.fromName} wrote back: ${reply.note}` : ''}`
    : `Christmas card from ${fromName}${sealed ? ', sealed until Christmas morning' : ''}${wordsSub ? `. ${wordsSub}` : ''}`;
  const day = postmarkDay(mailedOn || new Date().toISOString());
  const [month, date] = day.split(' ');
  // On the table once it's turned over (how much of them shows follows the card's own turn, from the engine), and not
  // while it's enlarged (it would lie over them).
  const mediaShown = hasMedia && turnedOver && !ui.enlarged;
  if (mediaShown && !mediaSeen) setMediaSeen(true);

  return createPortal(
    <>
      <div
        ref={stageRef}
        className={styles.stage}
        role="dialog"
        aria-modal="true"
        aria-label={sendMoment ? `Your card for ${sendMoment.firstName}` : isLetter ? `Letter from ${fromName}` : `Christmas card from ${fromName}`}
        tabIndex={-1}
        data-send={sendMoment ? '1' : undefined}
        data-mood={isLetter ? 'letter' : mood}
      >
        <div className={styles.safe} data-el="safe" />
        <div
          className={styles.table}
          data-el="table"
          style={{ backgroundImage: `url(${art('table-cloth.webp')})`, backgroundColor: tableTint(card.table) }}
        />
        <div className={styles.objects} aria-hidden="true">
          <div className={`${styles.shadow} ${styles.envShadow}`} data-el="envShadow" />
          <div className={`${styles.layer} ${styles.lInside}`} data-el="lInside"><Art src={envArt('env-inside.webp')} /></div>
          <div className={`${styles.layer} ${styles.lFlapIn}`} data-el="lFlapIn">
            <div className={styles.flapIn} data-el="flapIn">
              <Art src={envArt('env-flap-in.webp')} />
              <div className={styles.flapGold} style={{ WebkitMaskImage: `url(${envArt('env-flap-gold.webp')})`, maskImage: `url(${envArt('env-flap-gold.webp')})` }}>
                <div className={styles.flapGlint} data-el="flapGlint" />
                {/* Reverence: one slow glint crosses the gold when the flap opens (this side shows from then on). */}
                {!isLetter && mood === 'reverence' ? <div className={styles.flapSweep} /> : null}
              </div>
            </div>
          </div>
          <div className={`${styles.shadow} ${styles.cardShadow}`} data-el="cardShadowWide" />
          <div className={`${styles.shadow} ${styles.cardShadow}`} data-el="cardShadowTight" />
          <div className={styles.card} data-el="card">
            <div className={styles.flip} data-el="flip">
              {isLetter ? (
                <>
                  <LetterSheet className={styles.side} title={`Welcome to ${fromName}`}><SidePieces side="Front" /></LetterSheet>
                  <LetterSheet className={`${styles.side} ${styles.sideBack}`} title={`Welcome to ${fromName}`}><SidePieces side="Back" /></LetterSheet>
                </>
              ) : (<>
              {card.design ? (
                <PhotoFrontContext.Provider value={tableFront}>
                <PaperFront
                  design={card.design}
                  caption={card.caption}
                  paper={card.paper}
                  year={card.year}
                  mailedOn={mailedOn}
                  className={styles.side}
                  style={{ position: 'absolute', inset: 0, aspectRatio: 'auto' }}
                >
                  <SidePieces side="Front" />
                </PaperFront>
                </PhotoFrontContext.Provider>
              ) : (
                <div className={styles.side} style={{ position: 'absolute', inset: 0, background: card.paper }}>
                  <SidePieces side="Front" />
                </div>
              )}
              <PaperBack
                number={card.number}
                paper={card.paper}
                fromName={fromName}
                year={card.year}
                note={sealed ? '' : note}
                signature={sealed ? null : card.signature}
                leaves={leaves}
                className={`${styles.side} ${styles.sideBack}`}
                style={{ position: 'absolute', inset: 0, aspectRatio: 'auto' }}
              >
                <SidePieces side="Back" />
              </PaperBack>
              {/* A long note's first leaf (Part 9): on the back, a hair in front of it, and lifted about its top edge
                  with the card's own depth (this flip's perspective). */}
              {leaves ? (
                <PaperLeaf
                  leaves={leaves}
                  paper={card.paper}
                  lifted={!ui.leafUp}
                  lying="rotateY(180deg) translateZ(1px)"
                  className={styles.side}
                  style={{ position: 'absolute', inset: 0, aspectRatio: 'auto' }}
                />
              ) : null}
              </>)}
            </div>
            {/* The reply lying on the card (Part 3): over its printed strip, turned 2°, lower with the note side up (Fix 3 of the
                design check); a tap on it brings it to the front, a
                tap on the card takes the card back to the front (the engine's onCardTap). Screen readers hear it in the
                table's words, and Read it in print prints it. */}
            {reply ? (
              <div
                className={`${styles.replySheet} ${replyLanded ? styles.replyLanded : ''} ${replyFront ? styles.replyFront : ''} ${backUp ? styles.replyOnNote : ''}`}
                data-ui
                data-testid="cardTableReply"
                onClick={() => setReplyFront(true)}
              >
                <PaperBack
                  number={card.number}
                  paper={card.paper}
                  fromName={reply.fromName}
                  year={card.year}
                  note={reply.note}
                  signature={reply.signature ?? null}
                  style={{ position: 'absolute', inset: 0, aspectRatio: 'auto' }}
                />
              </div>
            ) : null}
          </div>
          <div className={`${styles.layer} ${styles.lPocketShadow}`} data-el="lPocketShadow"><Art src={envArt('env-pocket-shadow.webp')} /></div>
          <div className={`${styles.layer} ${styles.lPocket}`} data-el="lPocket"><Art src={envArt('env-pocket.webp')} /></div>
          <div className={`${styles.layer} ${styles.lFlapShadow}`} data-el="lFlapShadow"><Art src={envArt('env-flap-shadow.webp')} /></div>
          <div className={`${styles.layer} ${styles.lFlapOut}`} data-el="lFlapOut">
            <div className={styles.flapOut} data-el="flapOut">
              <Art src={envArt('env-flap-out.webp')} />
              <Art className={styles.seal} data-el="seal" src={waxWhole} />
              {sendMoment ? (
                <>
                  <div className={styles.sealRing} />
                  <div className={styles.press} data-el="press" />
                </>
              ) : null}
            </div>
          </div>
          {sendMoment && (sendMoment.count ?? 1) > 1 ? (
            <div className={`${styles.layer} ${styles.lStack}`} data-el="lStack">
              <Art src={envArt('env-front.webp')} />
              <Art src={envArt('env-front.webp')} />
            </div>
          ) : null}
          <div className={`${styles.layer} ${styles.lFront}`} data-el="lFront">
            <Art src={envArt('env-front.webp')} />
            <div className={styles.frontWords}>
              <Art className={styles.stampImg} src={stampSrc} />
              {/* A letter Pantopus puts straight in the box has no postmark (and the postmark says Christmas). A travelling
                  card carries a postmark for every town on its way (Part 3). */}
              {!isLetter && card.travel?.postmarks?.length ? (
                <TravelPostmarks marks={card.travel.postmarks} arrive={!sendMoment && !startOnTable && replay === 0} />
              ) : isLetter ? null : (
                <div className={styles.pmBox}>
                  <Art src={art('postmark-blank.webp')} />
                  <svg viewBox="0 0 622 365" aria-hidden="true">
                    <text x="165" y="161.6" textAnchor="middle" fontFamily="ui-serif, 'New York', Georgia, serif" fontWeight="700" fontSize="39.8" letterSpacing="1.74" fill="rgb(19, 13, 15)" fillOpacity="0.8" transform="rotate(7 165 161.6)">{month}{date ? ` ${date}` : ''}</text>
                    <text x="160.3" y="199.6" textAnchor="middle" fontFamily="ui-serif, 'New York', Georgia, serif" fontWeight="700" fontSize="32.5" letterSpacing="1.49" fill="rgb(19, 13, 15)" fillOpacity="0.8" transform="rotate(7 160.3 199.6)">{card.year}</text>
                  </svg>
                </div>
              )}
              <div className={styles.fromName} style={{ fontFamily: PEN, fontSize: `calc(var(--ew) * ${fitOnEnvelope(fromName, 0.05, 0.62).toFixed(4)})` }}>{fromName}</div>
              <div className={styles.toName} style={{ fontFamily: PEN, fontSize: `calc(var(--ew) * ${fitOnEnvelope(toName, 0.094, 0.78).toFixed(4)})` }}>{toName}</div>
              {card.sealed
                ? <div className={styles.sealedMark}>Do not open<br />until Christmas</div>
                : <div className={styles.kind}>{isLetter ? 'A letter for you' : 'Christmas card'}</div>}
            </div>
          </div>
        </div>
        {/* The card's own photo and voice greeting, lying on the table beside the card once it's turned over (wave 4
            drawings 3 and 4), or under it on a narrow table, where the engine keeps them room. Not part of the card: they
            stay put while it moves, and screen readers reach them. */}
        {hasMedia ? (
          <div
            className={`${styles.media} ${mediaShown ? styles.mediaShown : ''} ${ui.enlarged ? styles.mediaAway : ''}`}
            inert={!mediaShown}
            data-testid="cardTableMedia"
          >
            {photo ? (
              <div
                className={styles.mediaPrint}
                // How tall the print is for its width: a portrait one lies narrower, so either fits the room.
                style={{ '--print-k': `${(0.88 * (photo.height && photo.width ? photo.height / photo.width : 0.75) + 0.2).toFixed(3)}` } as CSSProperties}
                data-ui
                data-testid="cardTablePrint"
              >
                <CardPrint
                  source={mediaSeen ? mediaFrom!(photo.file_id) : null}
                  width={photo.width}
                  height={photo.height}
                  alt={photo.alt}
                  covered={photo.covered && !uncovered}
                  fromName={fromName}
                  onUncover={() => setUncovered(true)}
                  datedOn={mood === 'nostalgia' ? mailedOn : null}
                  tilt={-3}
                  className="w-full"
                  opens
                  onViewing={setPhotoOpen}
                  live={photo.live && mediaSeen && !(photo.covered && !uncovered) ? mediaFrom!(photo.live.file_id) : null}
                />
              </div>
            ) : null}
            {voice ? (
              <div className={`${styles.mediaVoice} ${mood === 'reverence' ? styles.mediaVoiceGift : ''} ${photo ? '' : styles.mediaVoiceAlone}`} data-ui>
                <CardGreeting
                  source={mediaFrom!(voice.file_id)}
                  durationMs={voice.duration_ms}
                  forName={toName}
                  fromName={fromName}
                  gift={mood === 'reverence'}
                  tilt={3}
                  active={mediaShown}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {!isLetter && mood === 'reverence' ? <div className={styles.candle} /> : null}
        <div className={styles.snow} data-el="snow" style={{ WebkitMaskImage: `url(${art('light.webp')})`, maskImage: `url(${art('light.webp')})` }}>
          {!isLetter && mood !== 'reverence' ? SNOW.map((speck, i) => (
            <i
              key={i}
              className={styles.speck}
              style={{ left: `${speck.left.toFixed(2)}%`, '--s': `${speck.size.toFixed(1)}px`, '--drift': `${speck.drift.toFixed(1)}px`,
                animationDuration: `${speck.seconds.toFixed(2)}s`, animationDelay: `${speck.delay.toFixed(2)}s` } as CSSProperties}
            />
          )) : null}
        </div>
        <div className={styles.light} data-el="light" style={{ backgroundImage: `url(${art('light.webp')})` }} />
        <div className={styles.vignette} />
        <div className={styles.grain} style={{ backgroundImage: `url(${art('grain.png')})` }} />
        <div className={styles.ui}>
          <p className={styles.srOnly} aria-live="polite">{spoken}</p>
          <div className={`${styles.top} ${controlsHidden ? styles.hidden : ''}`}>
            <button type="button" className={styles.round} data-ui aria-label={closeLabel} onClick={onClose}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <div className={`${styles.topRight} ${showTopRight ? '' : styles.hidden}`}>
              {onShare ? (
                <button type="button" className={styles.round} data-ui aria-label={sealed ? 'Share the sealed card' : 'Share this card'} onClick={() => { setMenuOpen(false); onShare(); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 7.5L12 3.5l4 4M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5" /></svg>
                </button>
              ) : null}
              {menu.length ? (
                <button ref={moreRef} type="button" className={styles.round} data-ui aria-label="More" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth="2.6" /></svg>
                </button>
              ) : null}
            </div>
          </div>
          {menuOpen ? (
            <div className={styles.menu} data-ui data-scroll role="menu" aria-label="More">
              {menu.map((item) => (
                <button key={item.label} type="button" role="menuitem" className={styles.menuItem} onClick={() => { setMenuOpen(false); item.onSelect(); }}>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className={`${styles.words} ${words && (!toast || improved) ? '' : styles.hidden}`} data-el="words" aria-live="polite">
            {words}
            {wordsSub && words ? <small className={travelStyles.wordsSub} data-el="wordsSub" data-testid="cardTableTravelLine">{wordsSub}</small> : null}
          </div>
          <div
            className={`${styles.toast} ${improved ? styles.toastClear : ''} ${toast ? styles.toastOn : ''}`}
            style={improved && toastTop !== null ? { top: toastTop } : undefined}
            role="status"
          >
            {toast}
          </div>
          {verseOpen && card.verse ? (
            <div className={styles.bookmarkShade} data-ui onClick={() => setVerseOpen(false)}>
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="cardTableVerseRef"
                className={styles.bookmark}
                data-scroll
                data-testid="cardTableVerse"
                onClick={(event) => event.stopPropagation()}
              >
                <span className={styles.ribbon} aria-hidden="true" />
                <p className={styles.bookmarkVerse}>{card.verse}</p>
                <p id="cardTableVerseRef" className={styles.bookmarkRef}>{card.caption}</p>
                <button ref={verseCloseRef} type="button" className={styles.bookmarkClose} data-testid="cardTableVerseClose" onClick={() => setVerseOpen(false)}>Close</button>
              </section>
            </div>
          ) : null}
          {printOpen && printable ? (
            <div className={styles.bookmarkShade} data-ui onClick={closePrint}>
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="cardTablePrintFrom"
                className={`${styles.bookmark} ${styles.printSheet}`}
                data-scroll
                data-testid="cardTableInPrint"
                onClick={(event) => event.stopPropagation()}
              >
                <span className={styles.ribbon} aria-hidden="true" />
                <p id="cardTablePrintFrom" className={styles.printFrom}>
                  {printWhat === 'reply' && reply ? printFrom(firstNameOf(reply.fromName), reply.writtenOn) : printFrom(from, mailedOn)}
                </p>
                <p className={styles.printWords} dir="auto" data-testid="cardTablePrintWords">{printWhat === 'reply' && reply ? reply.note.trim() : note.trim()}</p>
                <button ref={printCloseRef} type="button" className={styles.bookmarkClose} data-testid="cardTablePrintClose" onClick={closePrint}>Close</button>
              </section>
            </div>
          ) : null}
          <div className={styles.bottom} data-el="bottom">
            {sendMoment && send === 'gone' ? <div className={styles.gone} data-ui data-testid="cardTableGone">{sendMoment.gone}</div> : null}
            <div className={`${styles.act} ${controlsHidden || (sendMoment && send === 'gone') ? styles.hidden : ''}`} data-el="act" style={sendMoment && send === 'gone' ? { display: 'none' } : undefined}>
              <div className={styles.primaryRow}>
                <button
                  type="button"
                  className={`${styles.primary} ${sendButton ? '' : styles.hidden}`}
                  data-ui
                  data-testid={sendMoment ? 'cardTableSendStep' : undefined}
                  aria-hidden={!sendButton}
                  tabIndex={sendButton ? 0 : -1}
                  aria-label={primary === 'Read on' ? 'Read on, the note continues on a second leaf' : undefined}
                  onClick={() => { setRefusal(null); if (isLetter && step === 'out') { letter?.onOut(); return; } engineRef.current?.primary(); }}
                >
                  {primary || 'Turn it over'}
                </button>
                {/* "Pass it on" beside "Turn it back" (travelling card Part 4): filled, or quiet once it went to one person. */}
                {passOn && turnedOver && !sendMoment && !ui.enlarged ? (
                  <button
                    type="button"
                    className={passOn.quiet ? styles.primary : travelStyles.passOnFilled}
                    data-ui
                    data-testid="cardTablePassOn"
                    onClick={() => { setMenuOpen(false); passOn.onSelect(); }}
                  >
                    {passOn.label}
                  </button>
                ) : null}
                {printButton ? (
                  <button type="button" className={styles.primary} data-ui data-testid="cardTableReadInPrint" onClick={() => openPrint(printsReply ? 'reply' : 'card')}>Read it in print</button>
                ) : null}
              </div>
              {/* A verse card: the hint becomes "Read the verse" once the card lies on the table (design plan 6.2); note
                  side up, any card's hint becomes "Read it in print" (Part 2). */}
              {(card.verse || printable) && !sendMoment ? (
                // One slot for all three, so the card doesn't move when one replaces another.
                <div className={styles.hintSlot}>
                  {readVerse ? (
                    <button type="button" className={styles.verseLink} data-ui data-testid="cardTableReadVerse" onClick={() => { setMenuOpen(false); setVerseOpen(true); }}>
                      Read the verse
                    </button>
                  ) : printLine ? (
                    <button type="button" className={styles.verseLink} data-ui data-testid="cardTableReadInPrint" onClick={() => openPrint(printsReply ? 'reply' : 'card')}>
                      Read it in print
                    </button>
                  ) : <div className={styles.hint}>{readPrint ? '' : hint}</div>}
                </div>
              ) : sendMoment?.quickSeal && sendButton ? (
                // Quick seal (Wave 3.5): one quiet link in the hint's slot, in the style of "Read it in print".
                <div className={styles.hintSlot}>
                  <button type="button" className={styles.verseLink} data-ui data-testid="cardTableQuickSeal" onClick={() => { setRefusal(null); engineRef.current?.quickSeal(); }}>
                    Quick seal
                  </button>
                </div>
              ) : <div className={styles.hint}>{hint}</div>}
              {/* One row of quiet buttons, at most two (Fix 1). Its room is kept while any can be offered, so the card never
                  moves when they show; screen readers get the full words whichever show. */}
              {rowRoom ? (
                <div
                  ref={quietRowRef}
                  className={`${styles.quietRow} ${quietButtons.length ? '' : styles.hidden}`}
                  aria-hidden={!quietButtons.length}
                  data-testid="cardTableQuietRow"
                >
                  {(rowFit === 'one' || rowFit === 'oneShort' ? quietButtons.slice(0, 1) : quietButtons).map((button) => (
                    <button
                      key={button.key}
                      type="button"
                      className={styles.quiet}
                      data-ui
                      data-testid={button.testId}
                      aria-label={button.spoken}
                      onClick={() => { setMenuOpen(false); button.onSelect(); }}
                    >
                      {rowFit === 'short' || rowFit === 'oneShort' ? button.short : button.full}
                    </button>
                  ))}
                  <div ref={quietMeasureRef} className={styles.quietMeasure} aria-hidden="true">
                    {quietButtons.map((button) => (
                      <span key={button.key}>
                        <span className={styles.quiet} data-words="full">{button.full}</span>
                        <span className={styles.quiet} data-words="short">{button.short}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className={styles.turnTip} data-ui>
          Hold your phone upright for the card.
          <button type="button" className={styles.tipClose} onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
      {overlay}
    </>,
    document.body,
  );
}
