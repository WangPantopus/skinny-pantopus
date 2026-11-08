"use client";

// Digital stamps in the Christmas card composer: a small stamp count in the
// header, the postage line by Seal and send, and a sheet of stamp books that
// opens from either (or when a card needs a stamp and none are left).
/* eslint-disable @next/next/no-img-element -- the stamp art is a few small static pictures, drawn at fixed sizes */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { get, post } from "@pantopus/api";
import { X } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { SERIF, TABLE_ART, WAX, cardStampFile } from "./cardArt";

type Balance = {
  available: number;
  free_remaining: number;
  paid_remaining: number;
  /** False once books stop selling for the season (sending goes on until December 31). */
  sales_open?: boolean;
  books: {
    id: string;
    credits: number;
    price_cents: number;
    currency: string;
  }[];
};
const path = "/api/mailbox/stamp-books";
const STAMP_ART = ["fir", "peak", "river"].map((s) => `${TABLE_ART}stamp-${s}.webp`);
// What each book is for, in a sender's words.
const BOOK_USE: Record<number, string> = { 5: "A few close friends", 20: "Your Christmas list", 50: "The whole street" };
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The balance and books, refreshed when the page comes back into view and after each card, take-back or purchase. */
export function useStamps(enabled: boolean, refreshKey: string) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<{ product: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    try {
      setBalance(await get<Balance>(path));
    } catch {
      setMessage("Could not load your stamps. Try again in a moment.");
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, refresh, refreshKey]);
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    const session = url.searchParams.get("stamp_session");
    if (!session) return;
    void post(path + "/confirm", { provider: "stripe", reference: session })
      .then(async () => {
        setMessage("Your stamps are ready. You can go back to the tab with your card.");
        url.searchParams.delete("stamp_session");
        window.history.replaceState(window.history.state, "", url);
        await refresh();
      })
      .catch(() => setMessage("Your payment is being checked. Check again in a moment; don’t pay twice."));
  }, [enabled, refresh]);
  async function buy(product: string) {
    // Checkout opens in its own tab during the click (before the request, so no popup blocker), and the card stays here.
    const checkout = window.open("about:blank", "_blank");
    if (!checkout) {
      setMessage("Allow a new tab to open checkout. Your card will stay here.");
      return;
    }
    checkout.opener = null;
    setBusy(true);
    setMessage(null);
    request.current = request.current?.product === product ? request.current : { product, id: crypto.randomUUID() };
    try {
      const result = await post<{ url: string }>(path + "/checkout", { product_id: product, request_id: request.current.id });
      checkout.location.href = result.url;
      request.current = null;
      setMessage("Finish paying in the checkout tab. Your stamps show up here when you come back.");
    } catch {
      checkout.close();
      setMessage("Checkout couldn’t open. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return { balance, message, busy, refresh, buy };
}
export type Stamps = ReturnType<typeof useStamps>;

/** The header's stamp count: opens the stamp books. */
export function StampChip({ stamps, onOpen }: { stamps: Stamps; onOpen: () => void }) {
  const b = stamps.balance;
  if (!b) return null;
  const out = b.available === 0;
  return (
    <button
      type="button"
      data-testid="stampChip"
      onClick={onOpen}
      aria-label={out ? "No stamps left. Get a stamp book" : `${plural(b.available, "stamp")} left. Stamp books`}
      className="mr-1.5 flex h-9 items-center gap-1.5 rounded-full border border-[#e7dcc6] bg-[#fffdf8] py-1 pl-1.5 pr-3 text-[14px] font-semibold text-[#374151] shadow-[0_1px_2px_rgba(60,40,10,0.08)] transition hover:bg-[#f5efe3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]"
    >
      <img src={STAMP_ART[0]} alt="" className="h-[26px] w-[21px] -rotate-6 drop-shadow-[0_1px_1px_rgba(60,40,10,0.25)]" />
      <span style={out ? { color: WAX } : undefined}>{b.available}</span>
    </button>
  );
}

/** What's left, in words: "1 free card and 2 stamps". */
function haveWords(b: Balance): string {
  const paid = Math.max(0, b.paid_remaining);
  const free = b.free_remaining;
  if (b.available === 0) return "none left";
  if (paid && free) return `${plural(free, "free card")} and ${plural(paid, "stamp")}`;
  return paid ? plural(paid, "stamp") : plural(free, "free card");
}

/** What `count` cards on a list cost: free cards first, then stamps; or how many they need. */
function listPostage(b: Balance, count: number): string {
  if (b.available < count) return `${count} cards need ${plural(count, "stamp")}. You have ${haveWords(b)}.`;
  const free = Math.min(b.free_remaining, count);
  const paid = count - free;
  const left = b.available - count;
  if (free && paid) return `${plural(free, "free card")} first, then ${plural(paid, "stamp")}. ${plural(left, "stamp")} left after this.`;
  if (free) return `Free: uses ${free} of your free cards (${b.free_remaining - free} left after this).`;
  return `${plural(paid, "stamp")} (${plural(left, "stamp")} left after this).`;
}

/** What this card costs, beside Seal and send, in the card's own stamp; `count` cards on a list, one stamp each. */
export function PostageLine({ stamps, design, count = 1 }: { stamps: Stamps; design: string; count?: number }) {
  const b = stamps.balance;
  if (!b) return null;
  const short = b.available < count;
  const line =
    count > 1
      ? listPostage(b, count)
      : b.available === 0
        ? "No stamps left. Get a stamp book to send this card."
        : b.free_remaining > 1
          ? `Free: uses 1 of your free cards (${b.free_remaining - 1} left after this).`
          : b.free_remaining === 1
            ? "Free: this is your last free card."
            : `1 stamp (${plural(b.available - 1, "stamp")} left after this).`;
  return (
    <div data-testid="postageLine" className="flex items-center gap-3 rounded-xl border border-dashed border-[#d6cbb6] bg-[#fffdf8] px-3 py-2.5">
      <img src={cardStampFile(null, design)} alt="" className="h-[40px] w-[32px] rotate-3 drop-shadow-[0_1px_2px_rgba(60,40,10,0.3)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a7f6c]">
          {count > 1 ? `Postage · ${count} people · ${plural(count, "stamp")}` : "Postage"}
        </p>
        <p className="text-[14px] leading-[19px] text-[#1f2937]" style={short ? { color: WAX } : undefined}>{line}</p>
      </div>
    </div>
  );
}

/** A fanned book of stamps; bigger books fan more stamps. */
function Booklet({ credits }: { credits: number }) {
  const shown = credits >= 50 ? 4 : credits >= 20 ? 3 : 2;
  return (
    <span aria-hidden className="relative block h-[62px] w-[64px] flex-none">
      {Array.from({ length: shown }, (_, i) => {
        const turn = (i - (shown - 1) / 2) * 9;
        return (
          <img
            key={i}
            src={STAMP_ART[i % 3]}
            alt=""
            className="absolute left-1/2 top-1 h-[52px] w-[42px] drop-shadow-[0_2px_2px_rgba(60,40,10,0.28)]"
            style={{ transform: `translateX(-50%) translateX(${turn * 0.9}px) rotate(${turn}deg)`, transformOrigin: "50% 100%" }}
          />
        );
      })}
    </span>
  );
}

/**
 * The stamp books: what's left, the three books, and what a stamp does. `short`: opened for a list whose cards need more
 * stamps than are left.
 */
export function StampSheet({ open, onClose, stamps, short = null }: {
  open: boolean;
  onClose: () => void;
  stamps: Stamps;
  short?: { cards: number; missing: number } | null;
}) {
  const headingId = useId();
  const b = stamps.balance;
  const paid = Math.max(0, b?.paid_remaining ?? 0);
  const free = b?.free_remaining ?? 0;
  const have = !b
    ? ""
    : b.available === 0
      ? "You’re out of stamps."
      : paid && free
        ? `You have ${plural(paid, "stamp")} and ${plural(free, "free card")}.`
        : paid
          ? `You have ${plural(paid, "stamp")}.`
          : `You have ${plural(free, "free card")} left.`;
  return (
    <BottomSheet open={open} onClose={onClose} labelledBy={headingId} className="!bg-[#f7f1e6] !border-[#e7dcc6]">
      <div data-testid="stampSheet" className="px-1 pb-1 text-[#1f2937]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="text-[26px] leading-8" style={{ fontFamily: SERIF }}>Stamp books</h2>
            <p className="mt-1 text-[14px] text-[#4e5563]">One stamp sends one Christmas card to one person.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full text-[#4e5563] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {short && short.missing > 0 ? (
          <p data-testid="stampSheetShort" className="mt-3 text-[15px] font-semibold leading-5" style={{ color: WAX }}>
            These {short.cards} cards need {plural(short.missing, "more stamp", "more stamps")}.
          </p>
        ) : null}
        {have ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#efe6d6] px-3 py-1 text-[13px] font-semibold text-[#374151]" style={b?.available === 0 ? { color: WAX } : undefined}>
            {have}
          </p>
        ) : null}
        {b?.sales_open === false ? (
          <p className="mt-4 rounded-xl border border-[#e7dcc6] bg-[#fffdf8] px-3.5 py-3 text-[14px] text-[#374151]">
            Stamp books aren’t on sale any more this year. You can use your stamps until December 31.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {(b?.books ?? []).map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  disabled={stamps.busy}
                  onClick={() => void stamps.buy(book.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-[#fffdf8] py-2.5 pl-2 pr-3 text-left shadow-[0_1px_3px_rgba(60,40,10,0.1)] transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d] disabled:opacity-60"
                  style={{ borderColor: book.credits === 20 ? "rgba(139,29,29,0.45)" : "#e7dcc6" }}
                >
                  <Booklet credits={book.credits} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-semibold leading-6">{book.credits} stamps</span>
                    <span className="block text-[13px] leading-[18px] text-[#4e5563]">
                      {BOOK_USE[book.credits] ? `${BOOK_USE[book.credits]} · ` : ""}
                      {money(Math.round(book.price_cents / book.credits), book.currency)} a card
                    </span>
                  </span>
                  <span className="flex-none rounded-full px-3.5 py-2 text-[15px] font-semibold text-[#fff7ed]" style={{ backgroundColor: WAX }}>
                    {money(book.price_cents, book.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[12.5px] leading-[18px] text-[#6b6458]">
          Digital delivery only. Christmas cards can be sent until December 31; unused stamps stay in your account.
          Receiving cards and replying are always free.
        </p>
        {stamps.message ? <p role="status" className="mt-3 text-[13.5px] font-medium text-[#374151]">{stamps.message}</p> : null}
        <button type="button" onClick={() => void stamps.refresh()} className="mt-3 text-[13.5px] font-semibold underline decoration-[#d6cbb6] underline-offset-4" style={{ color: WAX }}>
          Already paid? Check for your stamps
        </button>
      </div>
    </BottomSheet>
  );
}
