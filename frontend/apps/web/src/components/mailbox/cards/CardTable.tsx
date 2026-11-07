'use client';

// ============================================================
// The Christmas card on the table (launch key card_table): the whole screen
// becomes the table. The envelope is turned over, its flap pulled up and the
// card pulled out, by hand or with the button; then the card lies on the table
// with the envelope behind it. Morning light moves over everything. The first
// open plays it all; opened before, the card is already lying there. It knows
// nothing about the server: reading it marks nothing.
// ============================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cardStampFile, cardTrimmedPicture, daysUntil, firstNameOf, postmarkDay, TABLE_ART, tableEdge, tableTint } from './cardArt';
import { cardPen } from './cardFont';
import { PaperBack, PaperFront } from './CardPaper';
import { CardTableEngine, type TableState } from './cardTableEngine';
import { useDarkPage } from './useDarkPage';
import styles from './CardTable.module.css';

const art = (name: string) => `${TABLE_ART}${name}`;
const PEN = `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`;
const WAX_WHOLE = art('wax-gold.webp');
const WAX_CRACKED = art('wax-gold-cracked.webp');
// Everything the envelope is made of: it waits for these and the card's picture before it arrives.
const ALL_ART = ['env-front.webp', 'env-pocket.webp', 'env-flap-out.webp', 'env-flap-in.webp', 'env-inside.webp', 'env-flap-gold.webp',
  'env-pocket-shadow.webp', 'env-flap-shadow.webp', 'wax-gold.webp', 'wax-gold-cracked.webp', 'postmark-blank.webp', 'table-cloth.webp',
  'light.webp', 'grain.png', 'paper.webp'].map(art);

export type TableCard = {
  design: string;
  number?: number | null;
  caption: string | null;
  paper: string;
  table?: string | null;
  year: number;
  sealed: boolean;
  sealed_until?: string | null;
};

export type TableMenuItem = { label: string; onSelect: () => void };

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
  onShare,
  onClose,
  overlay,
}: {
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
  onShare?: () => void;
  onClose: () => void;
  /** Sheets and dialogs that belong over the table. */
  overlay?: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CardTableEngine | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ui, setUi] = useState<TableState>({ step: startOnTable && !card.sealed ? 'out' : 'front', backUp: false, turnedOnce: false, envTurnedOnce: false, heldOnce: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);
  const from = firstNameOf(fromName);
  const days = daysWords(card.sealed_until);

  const say = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => { setMounted(true); }, []);
  useDarkPage(mounted, tableEdge(card.table));

  // The engine lives as long as the screen; fold-like resizes only lay it out again.
  useEffect(() => {
    const stage = stageRef.current;
    if (!mounted || !stage) return undefined;
    const engine = new CardTableEngine(stage, {
      sealed: card.sealed,
      wholeSrc: WAX_WHOLE,
      crackedSrc: WAX_CRACKED,
      callbacks: {
        onState: setUi,
        onRefused: () => say(daysWords(card.sealed_until).notYet),
        onTableTap: () => setControlsHidden((hidden) => !hidden),
        onPress: () => setMenuOpen(false),
      },
    });
    engineRef.current = engine;
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
      if (startOnTable && !card.sealed) engine.startOnTable();
      else engine.restart(true);
    };
    // The art and the card's picture are ready before the envelope arrives; after 5 seconds it comes anyway.
    engine.restart(false);
    (stage.querySelector('[data-el="lFront"]') as HTMLElement).style.visibility = 'hidden';
    const ready = [...ALL_ART, cardTrimmedPicture(card.design), cardStampFile(card.number, card.design)].map((src) => {
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

  useEffect(() => { engineRef.current?.setPaused(paused); }, [paused]);

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
    const observer = new ResizeObserver(() => { engineRef.current?.layout(); engineRef.current?.wake(); });
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (paused) return;
      const stage = stageRef.current;
      const active = document.activeElement;
      const here = !active || active === document.body || Boolean(stage?.contains(active));
      if (!here) return;
      if (event.key === 'Escape') {
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
  }, [mounted, paused, menuOpen, onClose, ui.step]);

  // Focus comes to the table as it opens, and goes back where it was when it closes.
  useEffect(() => {
    if (!mounted) return undefined;
    const before = document.activeElement as HTMLElement | null;
    stageRef.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, [mounted]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  if (!mounted) return null;

  const { step, backUp, turnedOnce, envTurnedOnce, heldOnce } = ui;
  const { sealed } = card;
  let words = '';
  let primary = '';
  let hint = '';
  if (step === 'front') {
    words = sealed ? `${from} sealed this card.` : `A Christmas card from ${from}.`;
    primary = 'Turn it over';
    hint = envTurnedOnce ? 'or swipe it' : 'or swipe it, the way you’d turn it in your hand';
  } else if (step === 'back') {
    if (sealed) { words = days.opens; primary = 'Try to open it'; hint = 'or pull the flap up'; }
    else { primary = 'Open it'; hint = 'or pull the flap up with your finger'; }
  } else if (step === 'flap') {
    primary = 'Take the card out';
    hint = 'or pull it out with your finger';
  } else if (step === 'out') {
    primary = backUp ? 'Turn it back' : 'Turn it over';
    if (!turnedOnce) hint = 'or swipe it';
    else if (!heldOnce && typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) hint = 'press and hold, then move your finger: the light moves';
  }
  const showTopRight = step === 'out' || (sealed && (step === 'back' || step === 'front'));

  // Read aloud as one sentence, as today's card is. The envelope reads as what it is.
  const caption = card.caption || 'A Christmas picture';
  const captionSentence = /[.!?]$/.test(caption) ? caption : `${caption}.`;
  const spoken = step === 'out' && !sealed
    ? `Card from ${fromName}: ${captionSentence} On the back: ${note}`
    : `Christmas card from ${fromName}${sealed ? ', sealed until Christmas morning' : ''}`;
  const day = postmarkDay(mailedOn || new Date().toISOString());
  const [month, date] = day.split(' ');

  return createPortal(
    <>
      <div
        ref={stageRef}
        className={styles.stage}
        role="dialog"
        aria-modal="true"
        aria-label={`Christmas card from ${fromName}`}
        tabIndex={-1}
      >
        <div className={styles.safe} data-el="safe" />
        <div
          className={styles.table}
          data-el="table"
          style={{ backgroundImage: `url(${art('table-cloth.webp')})`, backgroundColor: tableTint(card.table) }}
        />
        <div className={styles.objects} aria-hidden="true">
          <div className={`${styles.shadow} ${styles.envShadow}`} data-el="envShadow" />
          <div className={`${styles.layer} ${styles.lInside}`} data-el="lInside"><Art src={art('env-inside.webp')} /></div>
          <div className={`${styles.layer} ${styles.lFlapIn}`} data-el="lFlapIn">
            <div className={styles.flapIn} data-el="flapIn">
              <Art src={art('env-flap-in.webp')} />
              <div className={styles.flapGold} style={{ WebkitMaskImage: `url(${art('env-flap-gold.webp')})`, maskImage: `url(${art('env-flap-gold.webp')})` }}>
                <div className={styles.flapGlint} data-el="flapGlint" />
              </div>
            </div>
          </div>
          <div className={`${styles.shadow} ${styles.cardShadow}`} data-el="cardShadowWide" />
          <div className={`${styles.shadow} ${styles.cardShadow}`} data-el="cardShadowTight" />
          <div className={styles.card} data-el="card">
            <div className={styles.flip} data-el="flip">
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
              <PaperBack
                number={card.number}
                paper={card.paper}
                fromName={fromName}
                year={card.year}
                note={sealed ? '' : note}
                className={`${styles.side} ${styles.sideBack}`}
                style={{ position: 'absolute', inset: 0, aspectRatio: 'auto' }}
              >
                <SidePieces side="Back" />
              </PaperBack>
            </div>
          </div>
          <div className={`${styles.layer} ${styles.lPocketShadow}`} data-el="lPocketShadow"><Art src={art('env-pocket-shadow.webp')} /></div>
          <div className={`${styles.layer} ${styles.lPocket}`} data-el="lPocket"><Art src={art('env-pocket.webp')} /></div>
          <div className={`${styles.layer} ${styles.lFlapShadow}`} data-el="lFlapShadow"><Art src={art('env-flap-shadow.webp')} /></div>
          <div className={`${styles.layer} ${styles.lFlapOut}`} data-el="lFlapOut">
            <div className={styles.flapOut} data-el="flapOut">
              <Art src={art('env-flap-out.webp')} />
              <Art className={styles.seal} data-el="seal" src={WAX_WHOLE} />
            </div>
          </div>
          <div className={`${styles.layer} ${styles.lFront}`} data-el="lFront">
            <Art src={art('env-front.webp')} />
            <div className={styles.frontWords}>
              <Art className={styles.stampImg} src={cardStampFile(card.number, card.design)} />
              <div className={styles.pmBox}>
                <Art src={art('postmark-blank.webp')} />
                <svg viewBox="0 0 622 365" aria-hidden="true">
                  <text x="165" y="161.6" textAnchor="middle" fontFamily="ui-serif, 'New York', Georgia, serif" fontWeight="700" fontSize="39.8" letterSpacing="1.74" fill="rgb(19, 13, 15)" fillOpacity="0.8" transform="rotate(7 165 161.6)">{month}{date ? ` ${date}` : ''}</text>
                  <text x="160.3" y="199.6" textAnchor="middle" fontFamily="ui-serif, 'New York', Georgia, serif" fontWeight="700" fontSize="32.5" letterSpacing="1.49" fill="rgb(19, 13, 15)" fillOpacity="0.8" transform="rotate(7 160.3 199.6)">{card.year}</text>
                </svg>
              </div>
              <div className={styles.fromName} style={{ fontFamily: PEN, fontSize: `calc(var(--ew) * ${fitOnEnvelope(fromName, 0.05, 0.62).toFixed(4)})` }}>{fromName}</div>
              <div className={styles.toName} style={{ fontFamily: PEN, fontSize: `calc(var(--ew) * ${fitOnEnvelope(toName, 0.094, 0.78).toFixed(4)})` }}>{toName}</div>
              {sealed
                ? <div className={styles.sealedMark}>Do not open<br />until Christmas</div>
                : <div className={styles.kind}>Christmas card</div>}
            </div>
          </div>
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
          <div className={`${styles.words} ${words && !toast ? '' : styles.hidden}`} data-el="words" aria-live="polite">{words}</div>
          <div className={`${styles.toast} ${toast ? styles.toastOn : ''}`} role="status">{toast}</div>
          <div className={styles.bottom} data-el="bottom">
            <div className={`${styles.act} ${controlsHidden ? styles.hidden : ''}`} data-el="act">
              <button type="button" className={styles.primary} data-ui onClick={() => engineRef.current?.primary()}>{primary || 'Turn it over'}</button>
              <div className={styles.hint}>{hint}</div>
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
