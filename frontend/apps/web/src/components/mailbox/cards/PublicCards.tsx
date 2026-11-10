'use client';

// ============================================================
// The public card pages (launch key card_table), where someone who came from a
// shared picture sees a card and can send one: the table in the picture's own
// colour, the card lying on it, and the way to send it. Never a person's name
// or note. Signing up from here credits whoever shared the link.
// ============================================================

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import { authPageHref } from '@/lib/auth-utils';
import { cardPicture, isVerseReference, TABLE_ART, tableEdge, tableTint } from './cardArt';
import { cardHand } from './cardFont';
import { PaperFront } from './CardPaper';
import styles from './PublicCards.module.css';

const art = (name: string) => `${TABLE_ART}${name}`;
const SLATE = '#3b4c6e';
// Every picture on a public page prints the same postmark: there's no person's day to print.
const POSTMARK_DAY = '2026-12-25';

export type PublicDesign = { id: string; number: number; slug: string; caption: string; paper: string; collection?: string | null; table: string };
export type PublicCollection = { id: string; name: string; designs: string[] };

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

function Foot({ className = '' }: { className?: string }) {
  return <p className={`${styles.foot} ${className}`}>Pantopus — your household, organized. <Link href="/start">What is Pantopus?</Link></p>;
}

/** Signed in, straight to the sending flow with this picture chosen; otherwise through sign-up, which keeps whoever shared the link. */
function SendThisCard({ designId, inviteCode }: { designId: string; inviteCode: string | null }) {
  const flow = `/app/mailbox/cards?design=${encodeURIComponent(designId)}`;
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(api.hasActiveSession()); }, []);
  const href = signedIn ? flow : authPageHref('/register', flow, inviteCode ? { invite_code: inviteCode } : {});
  return <Link href={href} className={styles.primary} data-testid="publicCardSend">Send this card to someone</Link>;
}

export function PublicCardPage({ design, year, inviteCode }: { design: PublicDesign; year: number; inviteCode: string | null }) {
  return (
    <TablePage table={design.table}>
      <div className={styles.one}>
        <div className={styles.lying} role="img" aria-label={`A Christmas card: ${design.caption}`}>
          <div className={styles.envelope}>
            {/* eslint-disable @next/next/no-img-element */}
            <img src={art('env-flap-in.webp')} alt="" className={styles.flapIn} />
            <img src={art('env-inside.webp')} alt="" />
            <img src={art('env-pocket-shadow.webp')} alt="" />
            <img src={art('env-pocket.webp')} alt="" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <div className={styles.card}>
            <PaperFront design={design.id} caption={design.caption} paper={design.paper} year={year} mailedOn={POSTMARK_DAY} />
          </div>
        </div>
        <div className={styles.words}>
          <h1 className={`${styles.caption} ${isVerseReference(design.caption) ? styles.verse : cardHand.className}`}>{design.caption}</h1>
          <p className={styles.line}>A Christmas card you can send on Pantopus</p>
        </div>
        <div className={styles.actions}>
          <SendThisCard designId={design.id} inviteCode={inviteCode} />
          <p className={styles.small}>It arrives with their morning mail, and they open it like real mail.</p>
          <Link href={withRef('/cards', inviteCode)} className={styles.link} data-testid="publicCardsAll">See all the cards</Link>
          <Foot />
        </div>
      </div>
    </TablePage>
  );
}

export function PublicCardsPage({ designs, collections, inviteCode }: { designs: PublicDesign[]; collections: PublicCollection[]; inviteCode: string | null }) {
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
