'use client';

// ============================================================
// Sharing a Christmas card (launch key card_table): a sheet over the table with
// a picture, its size, the switch that puts the note in it, and what to do with
// it. Pictures are drawn on the device, so nothing private leaves it, and each
// is drawn before its button is pressed: phones only open their share sheet
// straight from a press. The note and name stay off until the person asks for
// them, an address never shows, and a sealed card shares as the sealed envelope.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '@pantopus/api';
import { APP_WEB_URL } from '@pantopus/utils';
import { firstNameOf } from './cardArt';
import { drawSharePicture, type ShareDetails, type ShareFormat } from './sharePicture';
import styles from './CardShareSheet.module.css';

type Picture = { url: string; file: File };
type Action = 'instagram' | 'facebook' | 'email' | 'link' | 'save' | 'more';

const SIZES: { format: ShareFormat; label: string }[] = [
  { format: 'story', label: 'Story' },
  { format: 'post', label: 'Post' },
  { format: 'link', label: 'Link preview' },
];

const ICONS: Record<Action, React.ReactNode> = {
  instagram: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><path d="M16.8 7.2h.01" strokeWidth="2.2" /></>,
  facebook: <path d="M14.5 20v-7h2.4l.5-3h-2.9V8.4c0-.9.3-1.4 1.5-1.4h1.5V4.3C16.9 4.2 16.2 4 15.2 4c-2.3 0-3.8 1.4-3.8 3.9V10H9v3h2.4v7" />,
  email: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  save: <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" />,
  more: <path d="M12 15V4M8 7.5L12 3.5l4 4M5.5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6.5" />,
};

const ACTION_LABELS: Record<Action, string> = { instagram: 'Instagram', facebook: 'Facebook', email: 'Email', link: 'Copy link', save: 'Save', more: 'More' };

/** The public page a shared card leads to. A sealed card leads to all the cards: its link mustn't give its picture away. */
export function cardPageLink(slug: string | null | undefined, sealed: boolean, inviteCode: string | null): string {
  const path = sealed || !slug ? '/cards' : `/cards/${encodeURIComponent(slug)}`;
  return `${APP_WEB_URL}${path}${inviteCode ? `?ref=${encodeURIComponent(inviteCode)}` : ''}`;
}

/** A phone or tablet in the hand: its share sheet is the way to Instagram and mail. A computer saves the picture instead. */
function inTheHand(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
}

function clickLink(attributes: Partial<HTMLAnchorElement>) {
  const a = document.createElement('a');
  Object.assign(a, attributes);
  document.body.append(a);
  a.click();
  a.remove();
}

export default function CardShareSheet({
  details,
  slug,
  mine = false,
  onClose,
}: {
  details: ShareDetails;
  /** The picture's public page. */
  slug?: string | null;
  /** A card you sent: the words talk about your own note. */
  mine?: boolean;
  onClose: () => void;
}) {
  const { card, note } = details;
  const [format, setFormat] = useState<ShareFormat>('story');
  const [withNote, setWithNote] = useState(false);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [said, setSaid] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const pictures = useRef(new Map<string, Picture>());
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const hasNote = !card.sealed && Boolean(note.trim());
  const noteInPicture = hasNote && withNote && format !== 'link';
  const key = `${format}-${noteInPicture ? 'note' : 'card'}`;
  const from = firstNameOf(details.fromName);
  const link = cardPageLink(slug, card.sealed, inviteCode);
  const words = mine
    ? { subject: 'A Christmas card I sent', body: `I sent this Christmas card on Pantopus. You can send one too: ${link}` }
    : { subject: 'Look what came in the mail', body: `I got this Christmas card on Pantopus. You can send one too: ${link}` };

  // Shared links credit the person who shared them; without a code the link still works.
  useEffect(() => {
    let live = true;
    api.users.getInviteCode().then((answer) => { if (live) setInviteCode(answer.invite_code || null); }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    const known = pictures.current.get(key);
    setFailed(false);
    setPicture(known ?? null);
    if (known) return undefined;
    const making = format === 'link'
      ? fetch(`/holiday-cards/share/${card.sealed ? 'sealed' : card.design}-link.jpg`).then((answer) => {
        if (!answer.ok) throw new Error(`Couldn't load the link picture: ${answer.status}`);
        return answer.blob();
      })
      : drawSharePicture(details, format, noteInPicture);
    making.then((blob) => {
      const made = { url: URL.createObjectURL(blob), file: new File([blob], `pantopus-christmas-card-${format}.jpg`, { type: 'image/jpeg' }) };
      pictures.current.set(key, made);
      if (live) setPicture(made);
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
    // A picture depends only on the card (fixed for this sheet) and its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  useEffect(() => {
    const made = pictures.current;
    return () => { made.forEach((item) => URL.revokeObjectURL(item.url)); };
  }, []);

  // Focus stays in the sheet while it's open, and goes back where it was when it closes. Escape closes it.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab' && sheetRef.current) {
        const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input')].filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!sheetRef.current.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const count = useCallback((kind: Action) => {
    api.mailbox.recordHolidayCardShare({ design: card.design, kind, format, with_note: noteInPicture }).catch(() => {});
  }, [card.design, format, noteInPicture]);

  const canSheet = Boolean(picture) && inTheHand() && Boolean(picture && navigator.canShare?.({ files: [picture.file] }));

  const saveFile = (made: Picture) => clickLink({ href: made.url, download: made.file.name });

  /** The phone's share sheet. Backing out of it isn't a failure, so nothing is said or counted. */
  const shareSheet = async (made: Picture, kind: Action, extras: ShareData = {}): Promise<void> => {
    try {
      await navigator.share({ files: [made.file], ...extras });
      count(kind);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      saveFile(made);
      count('save');
      setSaid('Couldn\'t open the share sheet, so the picture went to your downloads. Post it from there.');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      count('link');
      setSaid('Link copied');
    } catch {
      setSaid(`Couldn't copy it from here. Select the link and copy it: ${link}`);
    }
  };

  const act = (action: Action) => {
    setSaid('');
    if (action === 'link') { void copyLink(); return; }
    if (action === 'facebook' && format === 'link') {
      count('facebook');
      clickLink({ href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, target: '_blank', rel: 'noopener noreferrer' });
      return;
    }
    if (!picture) return;
    if (action === 'save') {
      saveFile(picture);
      count('save');
      setSaid('Saved to your downloads.');
      return;
    }
    if (action === 'more') { void shareSheet(picture, 'more', { title: words.subject, text: words.body }); return; }
    if (action === 'email') {
      if (canSheet) { void shareSheet(picture, 'email', { title: words.subject, text: words.body }); return; }
      saveFile(picture);
      count('email');
      setSaid('Your mail app opens with the words in place. The picture is in your downloads, so attach it from there.');
      // The download goes first; some browsers drop it if the mail app takes over in the same moment.
      window.setTimeout(() => clickLink({ href: `mailto:?subject=${encodeURIComponent(words.subject)}&body=${encodeURIComponent(words.body)}` }), 300);
      return;
    }
    // Instagram, and Facebook with a Story or Post picture.
    if (canSheet) { void shareSheet(picture, action); return; }
    saveFile(picture);
    count(action);
    setSaid(`Saved to your downloads. Post it on ${action === 'instagram' ? 'Instagram' : 'Facebook'} from there.`);
  };

  const needsPicture = (action: Action) => action !== 'link' && !(action === 'facebook' && format === 'link');
  const actions: Action[] = ['instagram', 'facebook', 'email', 'link', 'save'];
  if (canSheet) actions.push('more');
  const shown = failed ? actions.filter((action) => !needsPicture(action)) : actions;

  return createPortal(
    <div className={styles.wrap} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="cardShareTitle" data-testid="cardShareSheet">
        <div className={styles.head}>
          <h2 id="cardShareTitle">{card.sealed ? 'Share the sealed card' : 'Share this card'}</h2>
          <button ref={closeRef} type="button" className={styles.round} aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className={styles.preview}>
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture.url} alt="The picture that would be shared" data-testid="cardSharePicture" />
          ) : failed ? (
            <div className={styles.failed} role="alert">
              <span>Couldn&apos;t draw this picture. Check your connection and try again, or copy the link instead.</span>
              <button type="button" className={styles.retry} onClick={() => setAttempt((n) => n + 1)}>Try again</button>
            </div>
          ) : <div className={styles.drawing} data-format={format} role="status" aria-label="Drawing the picture" />}
        </div>
        <div className={styles.seg} role="group" aria-label="Size">
          {SIZES.map((size) => (
            <button key={size.format} type="button" aria-pressed={format === size.format} onClick={() => { setFormat(size.format); setSaid(''); }}>{size.label}</button>
          ))}
        </div>
        {hasNote && format !== 'link' ? (
          <div className={styles.noteRow}>
            <label htmlFor="cardShareNote">
              <b>Show the note</b>
              <small>
                {mine
                  ? (withNote ? 'This picture shows your words and first name.' : 'Your words and name stay private. Your address never shows.')
                  : (withNote ? `This picture shows ${from}'s words and first name. Only share them if ${from} wouldn't mind.` : `${from}'s words and name stay private. Your address never shows.`)}
              </small>
            </label>
            <input id="cardShareNote" className={styles.switch} type="checkbox" role="switch" checked={withNote} onChange={(event) => setWithNote(event.target.checked)} />
          </div>
        ) : null}
        <div className={styles.acts}>
          {shown.map((action) => (
            <button key={action} type="button" data-action={action} disabled={needsPicture(action) && !picture} onClick={() => act(action)}>
              <span className={styles.ic}><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[action]}</svg></span>
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
        <div className={styles.say} aria-live="polite" data-testid="cardShareSay">{said}</div>
      </div>
    </div>,
    document.body,
  );
}
