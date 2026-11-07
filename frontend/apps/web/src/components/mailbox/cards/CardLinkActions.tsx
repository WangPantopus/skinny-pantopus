'use client';

// ============================================================
// A card's link (launch key card_table), for its sender: the link itself when
// just sent, Copy link, and Share with the device's own share sheet. Copied
// again later it's read from the server, which says in its own words what
// happened if the link has stopped working.
// ============================================================

import { useState } from 'react';
import { Copy, Loader2, Share2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { firstNameOf } from './cardArt';

const button = 'flex min-h-[44px] flex-1 basis-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[15px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] focus-visible:ring-offset-2 disabled:opacity-60';
const quiet = `${button} border border-[#d6cbb6] bg-[#fffdf8] text-[#374151] hover:bg-[#f5efe3]`;
const strong = `${button} bg-[#8b1d1d] text-[#fff7ed] hover:brightness-110`;

export default function CardLinkActions({
  cardId,
  link,
  fromName,
  again = false,
}: {
  cardId: string;
  /** Known just after sending: it's shown and copied as it is. */
  link?: string | null;
  fromName: string;
  /** "Copy link again", on a card sent earlier. */
  again?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ text: string; problem?: boolean; link?: string } | null>(null);
  const [known, setKnown] = useState<string | null>(link ?? null);

  /**
   * The link, read from the server when this page doesn't have it, and every time on a card sent earlier: someone may
   * have opened it, or it may have been taken back, since it was last read. Its refusal says what happened, as it comes.
   */
  const theLink = async (): Promise<string | null> => {
    if (known && !again) return known;
    setBusy(true);
    try {
      const answer = await api.mailbox.getHolidayCardLink(cardId);
      setKnown(answer.link);
      return answer.link;
    } catch (error) {
      const refused = error as { statusCode?: number; status?: number; message?: string } | null;
      const status = refused?.statusCode ?? refused?.status;
      setSaid({ text: status === 409 && refused?.message ? refused.message : 'Couldn’t get the link just now. Check your connection and try again.', problem: true });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setSaid(null);
    const url = await theLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setSaid({ text: 'Link copied' });
    } catch {
      setSaid({ text: 'Couldn’t copy it from here. Select the link and copy it:', link: url, problem: true });
    }
  };

  const share = async () => {
    setSaid(null);
    const url = await theLink();
    if (!url) return;
    try {
      await navigator.share({ text: `A Christmas card for you from ${firstNameOf(fromName)}: ${url}` });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      setSaid({ text: 'Couldn’t open the share sheet. Copy the link and send it yourself.', problem: true });
    }
  };

  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  return (
    <div>
      {link ? (
        <p data-testid="cardLinkShown" className="break-all rounded-xl border border-[#e3d8c3] bg-[#fffdf8] px-3.5 py-3 text-[14px] leading-5 text-[#111827]">{link}</p>
      ) : null}
      <div className={`flex flex-wrap gap-2.5 ${link ? 'mt-3' : ''}`}>
        <button type="button" data-testid="cardLinkCopy" disabled={busy} onClick={() => { void copy(); }} className={again ? quiet : strong}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {again ? 'Copy link again' : 'Copy link'}
        </button>
        {canShare ? (
          <button type="button" data-testid="cardLinkShare" disabled={busy} onClick={() => { void share(); }} className={quiet}>
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </button>
        ) : null}
      </div>
      <div aria-live="polite">
        {said ? (
          <p data-testid="cardLinkSaid" className={`mt-2 text-[14px] leading-5 ${said.problem ? 'font-medium text-[#a81a1a]' : 'text-[#374151] [@media(prefers-color-scheme:dark)]:text-app-text-secondary'}`}>
            {said.text}{said.link ? <span className="mt-1 block select-all break-all font-normal text-[#111827] [@media(prefers-color-scheme:dark)]:text-app-text">{said.link}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
