'use client';

// ============================================================
// The public card pages (on with Christmas cards), where someone who came from a
// shared picture or an ad sees a card and can send one: the table in the picture's
// own colour, the card lying on it, and the way to send it. Never a person's name
// or note. Signing up from here credits whoever shared the link. On a phone the
// first way is the app, and getting it here carries the card through the install.
// ============================================================

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import { authPageHref } from '@/lib/auth-utils';
import StoreLink from '@/components/public-share/StoreLink';
import { cardPicture, isVerseReference, TABLE_ART, tableEdge, tableTint } from './cardArt';
import { cardHand } from './cardFont';
import { PaperFront } from './CardPaper';
import { openingPicks, Row, scrollToStart, useNearPicture } from './CardShelves';
import styles from './PublicCards.module.css';

const art = (name: string) => `${TABLE_ART}${name}`;
const SLATE = '#3b4c6e';
// Every picture on a public page prints the same postmark: there's no person's day to print.
const POSTMARK_DAY = '2026-12-25';
/** A thank-you card's page (Wave 5): a fixed postmark day too, never this browser's clock. */
const THANKS_POSTMARK_DAY = '2026-12-27';

export type PublicDesign = { id: string; number: number; slug: string; caption: string; paper: string; collection?: string | null; table: string; verse?: string | null;
  /** A thank-you card's design (Wave 5): its words, the cream envelope and "THANK YOU" under its picture. */
  kind?: 'thank_you' };
export type PublicCollection = {
  id: string; name: string; designs: string[];
  /** The shelves' facts (card shelves SPEC A3): the short name, the public name in a link, the line, the opening card, the parts. */
  short?: string; slug?: string; line?: string; pick?: string; parts?: { name: string; designs: string[] }[];
};

/**
 * A phone's store button that carries the sending flow through the install (`getStoreDownloadCta`): Google Play
 * hands it to the Android app on its first launch; on an iPhone the tap copies it for the app's Paste button.
 * `joins`: the page's `ref` is a creator's code, and it carries that code's join link instead (`cardsStoreLink`), so the
 * creator is credited when the account is made; the cards are then in the side menu's "Send a Christmas card".
 */
export type PublicCardsStore = { href: string; copyPath: string | null; platform: 'ios' | 'android'; joins?: boolean };

/** Getting the app on a phone, with the card waiting for them in it. */
function GetTheApp({ store, label, testId }: { store: PublicCardsStore; label: string; testId: string }) {
  const words = store.joins
    ? (store.platform === 'ios'
      ? 'Free on the App Store. When Pantopus opens, tap Paste and create your account, then tap Send a Christmas card in the menu.'
      : 'Free on Google Play. Create your account when Pantopus opens, then tap Send a Christmas card in the menu.')
    : (store.platform === 'ios'
      ? 'Free on the App Store. When Pantopus opens, tap Paste, and your card is ready once you sign up.'
      : 'Free on Google Play. Your card is ready when Pantopus opens and you sign up.');
  return (
    <>
      <StoreLink href={store.href} copyPath={store.copyPath} className={styles.primary} data-testid={testId}>{label}</StoreLink>
      <p className={styles.small}>{words}</p>
    </>
  );
}

const withRef = (path: string, ref: string | null) => (ref ? `${path}?ref=${encodeURIComponent(ref)}` : path);

function TablePage({ table, children }: { table?: string | null; children: ReactNode }) {
  return (
    <main className={styles.page} data-testid="publicCards">
      {/* Dark from the first paint, so the browser's own bars take the table's colour. */}
      <style>{`html,body{background:${tableEdge(table ?? SLATE)}}`}</style>
      <div className={styles.layers} aria-hidden="true" style={{ backgroundColor: tableEdge(table ?? SLATE) }}>
        <div className={styles.table} style={{ backgroundImage: `url(${art('table-cloth.webp')})`, backgroundColor: tableTint(table ?? SLATE) }} />
        <div className={styles.light} style={{ backgroundImage: `url(${art('light.webp')})` }} />
        <div className={styles.vignette} />
        <div className={styles.grain} style={{ backgroundImage: `url(${art('grain.png')})` }} />
      </div>
      {children}
    </main>
  );
}

// Under it, the way on from a card to the rest of Pantopus: the guide to sending one, what it costs, the app and help.
function Foot({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.foot} ${className}`}>
      <p>Pantopus — your household, organized. <Link href="/start">What is Pantopus?</Link></p>
      <nav className={styles.footLinks} aria-label="More of Pantopus">
        <Link href="/guides/how-to-send-a-christmas-card-online">How to send a Christmas card online</Link>
        <Link href="/mail">Mail</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/download">Get the app</Link>
        <Link href="/help">Help</Link>
      </nav>
    </div>
  );
}

/** Signed in, straight to the sending flow with this picture chosen; otherwise through sign-up, which keeps whoever shared the link. */
function SendThisCard({ designId, inviteCode, asLink = false }: { designId: string; inviteCode: string | null; asLink?: boolean }) {
  const flow = `/app/mailbox/cards?design=${encodeURIComponent(designId)}`;
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(api.hasActiveSession()); }, []);
  const href = signedIn ? flow : authPageHref('/register', flow, inviteCode ? { invite_code: inviteCode } : {});
  return asLink
    ? <Link href={href} className={styles.link} data-testid="publicCardSend">Or send it on the web</Link>
    : <Link href={href} className={styles.primary} data-testid="publicCardSend">Send this card to someone</Link>;
}

export function PublicCardPage({ design, year, inviteCode, store = null }: { design: PublicDesign; year: number; inviteCode: string | null; store?: PublicCardsStore | null }) {
  // A thank-you card (Wave 5): the cream linen envelope, "THANK YOU" under its picture (one page serves every year it
  // is open, so no year), and its own words.
  const thanks = design.kind === 'thank_you';
  const env = (name: string) => art(thanks ? `cream-${name}` : name);
  return (
    <TablePage table={design.table}>
      <div className={styles.one}>
        <div className={styles.lying} role="img" aria-label={`${thanks ? 'A thank-you card' : 'A Christmas card'}: ${design.caption}`}>
          <div className={styles.envelope}>
            {/* eslint-disable @next/next/no-img-element */}
            <img src={env('env-flap-in.webp')} alt="" className={styles.flapIn} />
            <img src={env('env-inside.webp')} alt="" />
            <img src={env('env-pocket-shadow.webp')} alt="" />
            <img src={env('env-pocket.webp')} alt="" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <div className={styles.card}>
            <PaperFront design={design.id} caption={design.caption} paper={design.paper} year={year} mailedOn={thanks ? THANKS_POSTMARK_DAY : POSTMARK_DAY} strip={thanks ? 'THANK YOU' : null} />
          </div>
        </div>
        {/* Beside the card on a wide screen, under it on a phone (`display: contents` there). */}
        <div className={styles.side}>
        <div className={styles.words}>
          <h1 className={`${styles.caption} ${isVerseReference(design.caption) ? styles.verse : cardHand.className}`}>{design.caption}</h1>
          {/* The whole verse printed on the picture, in readable type (design plan 6.2): here beside the card on a wide
              screen; under the first button when the words are under the card, so that button stays on the first
              screen beside a card as wide as the phone (SPEC E3). */}
          {design.verse ? <blockquote className={`${styles.verseText} ${styles.verseBeside}`} data-testid="publicCardVerse">{design.verse}</blockquote> : null}
          <p className={styles.line}>{thanks ? 'A thank-you card you can send on Pantopus' : 'A Christmas card you can send on Pantopus'}</p>
        </div>
        <div className={styles.actions}>
          {store ? (
            <>
              <GetTheApp store={store} label="Send this card with the Pantopus app" testId="publicCardGetApp" />
              <SendThisCard designId={design.id} inviteCode={inviteCode} asLink />
            </>
          ) : (
            <>
              <SendThisCard designId={design.id} inviteCode={inviteCode} />
              <p className={styles.small}>It arrives with their morning mail, and they open it like real mail.</p>
            </>
          )}
          {design.verse ? <blockquote className={`${styles.verseText} ${styles.verseUnder}`} data-testid="publicCardVerseUnder">{design.verse}</blockquote> : null}
          <Link href={withRef('/cards', inviteCode)} className={styles.link} data-testid="publicCardsAll">See all the cards</Link>
          <Foot />
        </div>
        </div>
      </div>
    </TablePage>
  );
}

/**
 * What sending costs and how the card gets there, which the page didn't say. `freeCards`: with digital stamps on, the
 * free cards an account starts with (the server's `free_cards`); a sender also gets one for each person their card
 * brings in. Without stamps a card is simply free.
 */
function HowSendingWorks({ freeCards, className = '' }: { freeCards: number | null; className?: string }) {
  return (
    <ul className={`${styles.how} ${className}`} data-testid="publicCardsHow">
      <li>
        {freeCards
          ? `Your first ${freeCards} cards are free, plus one more each time someone joins from your card.`
          : 'Sending a card is free.'}
      </li>
      <li>It arrives in their Pantopus mailbox. If they aren’t on Pantopus yet, they get an email from you.</li>
    </ul>
  );
}

export function PublicCardsPage({ designs, collections, inviteCode, store = null, freeCards = null, goal = null }: { designs: PublicDesign[]; collections: PublicCollection[]; inviteCode: string | null; store?: PublicCardsStore | null; freeCards?: number | null;
  /** All cards this Christmas (travelling card Part 8, D3): a small map and its line, drawn by the page; null while it's off. */
  goal?: ReactNode }) {
  const byId = new Map(designs.map((design) => [design.id, design]));
  // A server with no collections shows them as one shelf.
  const shelves = collections.length
    ? collections.map((shelf) => ({ id: shelf.id, name: shelf.name, designs: shelf.designs.flatMap((id) => byId.get(id) ?? []) })).filter((shelf) => shelf.designs.length)
    : [{ id: 'all', name: 'Christmas cards', designs }];
  return (
    <TablePage>
      <div className={styles.all}>
        <header className={styles.allHead}>
          <h1>Christmas cards</h1>
          <p>Pick one and send it to someone. It arrives with their morning mail, and they open it like real mail.</p>
          <HowSendingWorks freeCards={freeCards} />
          {store ? (
            <div className={styles.allApp}>
              <GetTheApp store={store} label="Send a card with the Pantopus app" testId="publicCardsGetApp" />
            </div>
          ) : null}
          {goal}
        </header>
        {shelves.map((shelf) => (
          <section key={shelf.id} className={styles.shelf} aria-labelledby={`shelf-${shelf.id}`}>
            <h2 id={`shelf-${shelf.id}`}>{shelf.name}</h2>
            <ul className={styles.grid}>
              {shelf.designs.map((design) => (
                <li key={design.id}>
                  <Link href={withRef(`/cards/${design.slug}`, inviteCode)} className={styles.tile} data-testid={`publicCard.${design.slug}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cardPicture(design.id, 'thumb')} alt="" loading="lazy" />
                    <span>{design.caption}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Foot className={styles.allFoot} />
      </div>
    </TablePage>
  );
}

type PublicShelf = PublicCollection & { slug: string; cards: PublicDesign[] };

function shelvesFrom(designs: PublicDesign[], collections: PublicCollection[]): PublicShelf[] {
  const byId = new Map(designs.map((design) => [design.id, design]));
  return collections
    .map((c) => ({ ...c, slug: c.slug as string, cards: c.designs.flatMap((id) => byId.get(id) ?? []) }))
    .filter((shelf) => shelf.cards.length);
}

/** A card on the shelves: its picture as it comes near (thumbnail, then sharp on screen), its caption, and its page. */
function PublicTile({ design, inviteCode, eager = false }: { design: PublicDesign; inviteCode: string | null; eager?: boolean }) {
  const picture = useNearPicture(design.id, eager);
  return (
    <Link href={withRef(`/cards/${design.slug}`, inviteCode)} className={styles.tile} data-testid={`publicCard.${design.slug}`}>
      {/* The first cards come in the page from the server and load at once, being on screen. loading="lazy" keeps React
          from adding a preload for them, which Safari fetches a second time. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={picture.ref} src={picture.src} alt="" loading="lazy" decoding="async" />
      <span>{design.caption}</span>
    </Link>
  );
}

const shelfAnchor = (slug: string) => `shelf-${slug}`;

/** A tap on a collection's name (or the line under its large card) goes to its shelf, below the row of names. */
function goToShelf(event: MouseEvent<HTMLAnchorElement>, slug: string) {
  const shelf = document.getElementById(shelfAnchor(slug));
  if (!shelf) return;
  event.preventDefault();
  const index = document.querySelector<HTMLElement>('[data-testid="publicShelvesIndex"]');
  scrollToStart(shelf, (index?.offsetHeight ?? 0) + 12, true);
  window.history.replaceState(window.history.state, '', `#${shelfAnchor(slug)}`);
}

/**
 * pantopus.com/cards as shelves (card shelves SPEC Part D, server key card_shelves): the head, a row of the collections'
 * short names that stays at the top of the window (the shelf in view is the marked one), "One from each collection",
 * then a shelf per collection with its first 12 cards and "See all <N>", which opens the collection's own page.
 */
export function PublicShelvesPage({ designs, collections, opening = null, inviteCode, store = null, freeCards = null, goal = null }: {
  designs: PublicDesign[];
  collections: PublicCollection[];
  /** The opening row's order of collections (the server's `opening`, SPEC E2). */
  opening?: string[] | null;
  inviteCode: string | null;
  store?: PublicCardsStore | null;
  freeCards?: number | null;
  goal?: ReactNode;
}) {
  const shelves = shelvesFrom(designs, collections);
  const picks = openingPicks(shelves, opening);
  const indexRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const line = (indexRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let now: string | null = null;
      for (const shelf of shelves) {
        const top = document.getElementById(shelfAnchor(shelf.slug))?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) now = shelf.id;
      }
      setInView(now);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
    // The shelves don't change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The marked name stays in sight in its row.
  useEffect(() => {
    const row = indexRef.current;
    const name = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row || !name) return;
    const box = row.getBoundingClientRect();
    const at = name.getBoundingClientRect();
    if (at.left < box.left + 16) row.scrollLeft -= box.left + 16 - at.left;
    else if (at.right > box.right - 16) row.scrollLeft += at.right - (box.right - 16);
  }, [inView]);
  return (
    <TablePage>
      <div className={`${styles.all} ${styles.shelves}`} data-testid="publicShelves">
        <header className={styles.shelvesHead}>
          <div>
            <h1>Christmas cards</h1>
            <p>Pick one and send it to someone. It arrives with their morning mail, and they open it like real mail.</p>
          </div>
          {/* On a phone the cards come first: what sending costs and the goal follow "One from each collection". */}
          <HowSendingWorks freeCards={freeCards} className={styles.wideOnly} />
          {store ? (
            <div className={styles.allApp}>
              <GetTheApp store={store} label="Send a card with the Pantopus app" testId="publicCardsGetApp" />
            </div>
          ) : null}
          {goal ? <div className={`${styles.goalSlot} ${styles.wideOnly}`}>{goal}</div> : null}
        </header>
        <nav ref={indexRef} className={styles.index} aria-label="Collections" data-testid="publicShelvesIndex">
          {shelves.map((shelf) => (
            <a
              key={shelf.id}
              href={`#${shelfAnchor(shelf.slug)}`}
              aria-current={inView === shelf.id ? 'true' : undefined}
              onClick={(event) => goToShelf(event, shelf.slug)}
              data-testid={`publicShelvesIndex.${shelf.slug}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardPicture(shelf.pick || shelf.cards[0].id, 'thumb')} alt="" loading="lazy" />
              {shelf.short || shelf.name}
            </a>
          ))}
        </nav>
        {picks.length ? (
          <section aria-labelledby="public-picks">
            <p id="public-picks" className={styles.picksTitle}>One from each collection</p>
            <Row name="One from each collection" cardWidth="var(--open-w)" testId="publicPicks" rowClass={styles.row} dark>
              {picks.map(({ shelf, card }, i) => (
                <div key={shelf.id} className={styles.pick}>
                  <PublicTile design={card} inviteCode={inviteCode} eager={i < 2} />
                  <a href={`#${shelfAnchor(shelf.slug)}`} onClick={(event) => goToShelf(event, shelf.slug)} className={styles.pickLine} data-testid={`publicPickLine.${shelf.slug}`}>
                    {shelf.name} · {shelf.cards.length} cards
                  </a>
                </div>
              ))}
            </Row>
          </section>
        ) : null}
        <div className={`${styles.afterPicks} ${styles.phoneOnly}`}>
          <HowSendingWorks freeCards={freeCards} />
          {goal}
        </div>
        {shelves.map((shelf) => (
          <section key={shelf.id} id={shelfAnchor(shelf.slug)} className={styles.shelfRow} aria-labelledby={`${shelfAnchor(shelf.slug)}-name`} data-testid={`publicShelf.${shelf.slug}`}>
            <div className={styles.shelfHead}>
              <h2 id={`${shelfAnchor(shelf.slug)}-name`}>{shelf.name}</h2>
              <p>{shelf.line}</p>
              <Link href={withRef(`/cards/collection/${shelf.slug}`, inviteCode)} aria-label={`See all ${shelf.cards.length}, ${shelf.name}`} data-testid={`publicSeeAll.${shelf.slug}`}>
                See all {shelf.cards.length}
              </Link>
            </div>
            <Row name={shelf.name} cardWidth="var(--shelf-w)" testId={`publicShelfRow.${shelf.slug}`} rowClass={styles.row} dark>
              {shelf.cards.slice(0, 12).map((card) => (
                <div key={card.id} className={styles.shelfCard}>
                  <PublicTile design={card} inviteCode={inviteCode} />
                </div>
              ))}
            </Row>
          </section>
        ))}
        <Foot className={styles.allFoot} />
      </div>
    </TablePage>
  );
}

/**
 * A collection's own page, /cards/collection/<slug> (card shelves SPEC Part D): its name, its line, its parts where it
 * has them, and all its cards in today's grid; "All the cards" goes back to /cards.
 */
export function PublicCollectionPage({ collection, designs, inviteCode, store = null }: {
  collection: PublicCollection;
  designs: PublicDesign[];
  inviteCode: string | null;
  store?: PublicCardsStore | null;
}) {
  const [shelf] = shelvesFrom(designs, [collection]);
  const cards = shelf?.cards ?? [];
  const byId = new Map(cards.map((card) => [card.id, card]));
  const parts = (collection.parts ?? [])
    .map((part) => ({ name: part.name, cards: part.designs.flatMap((id) => byId.get(id) ?? []) }))
    .filter((part) => part.cards.length);
  const grid = (list: PublicDesign[], first = false) => (
    <ul className={styles.grid}>
      {list.map((card, i) => <li key={card.id}><PublicTile design={card} inviteCode={inviteCode} eager={first && i < 2} /></li>)}
    </ul>
  );
  return (
    <TablePage>
      <div className={`${styles.all} ${styles.collection}`} data-testid={`publicCollection.${collection.slug}`}>
        <Link href={withRef('/cards', inviteCode)} className={styles.back} data-testid="publicCollectionBack">All the cards</Link>
        <h1>{collection.name}</h1>
        {collection.line ? <p>{collection.line}</p> : null}
        {store ? (
          <div className={styles.allApp}>
            <GetTheApp store={store} label="Send a card with the Pantopus app" testId="publicCardsGetApp" />
          </div>
        ) : null}
        {parts.length ? parts.map((part, i) => (
          <section key={part.name} className={styles.part} aria-labelledby={`part-${i}`}>
            <h2 id={`part-${i}`}>{part.name} <span>· {part.cards.length} cards</span></h2>
            {grid(part.cards, i === 0)}
          </section>
        )) : <div className={styles.part}>{grid(cards, true)}</div>}
        <Foot className={styles.allFoot} />
      </div>
    </TablePage>
  );
}

/** The server didn't answer: say so, and what to do. */
export function PublicCardsTrouble() {
  return (
    <TablePage>
      <div className={styles.trouble}>
        <h1>Couldn’t show the cards</h1>
        <p>Check your connection and try again in a moment.</p>
        <Link href="/cards" className={styles.link}>Try again</Link>
        <Foot />
      </div>
    </TablePage>
  );
}
