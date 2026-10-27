'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { parseDisplayDate } from '@pantopus/ui-utils';
import type { MailItemV2 } from '@/types/mailbox';
import { useDrawerTab } from '@/lib/mailbox-queries';
import { DRAWER_LABELS, isMailboxDrawer, type MailboxDrawer } from '@/components/mailbox/MailboxHeader';
import MailPiece, { pieceKind } from '@/components/mailbox/MailPiece';
import { calendarDay } from '@/components/mailbox/MailRow';
import { mailLoadMessage } from '@/components/mailbox/mailLoadMessage';
import useMailAddressee from '@/components/mailbox/useMailAddressee';
import ErrorState from '@/components/ui/ErrorState';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const TILTS = [5, -4, 3, -3];

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

type Waiting = { what: string; when: string | null; tone: 'due' | 'late' | 'plain'; tag: [string, string]; pay: string | null };

/** What a piece on the counter asks of you, and by when, in a few words. */
function waiting(item: MailItemV2, timeZone?: string): Waiting {
  const today = calendarDay(new Date(), timeZone);
  const due = item.due_date ? parseDisplayDate(item.due_date) : null;
  const dueOk = due && !Number.isNaN(due.getTime());
  const dueDay = dueOk ? item.due_date!.slice(0, 10) : null;
  const late = Boolean(dueDay && dueDay < today);
  const dueText = dueOk ? due!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  const tagDay = dueOk ? (dueDay === today ? 'TODAY' : due!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()) : '';

  const invoice = item.invoice;
  const payable = invoice && ['sent', 'viewed', 'overdue'].includes(invoice.status);
  // Key facts come as { label, value } from the server's summary, or { field, value } in older rows.
  const facts = (Array.isArray(item.key_facts) ? item.key_facts : []) as { label?: string; field?: string; value?: string }[];
  const amount = invoice
    ? money(invoice.total_cents, invoice.currency)
    : facts.find((fact) => /amount/i.test(fact.label || fact.field || ''))?.value ?? null;
  const isBill = pieceKind(item) === 'bill' || Boolean(invoice);

  if (isBill && amount) {
    return {
      what: `Pay ${amount}`,
      when: dueText ? (late ? `overdue since ${dueText}` : `due ${dueText}`) : null,
      tone: late ? 'late' : dueText ? 'due' : 'plain',
      tag: dueText ? [late ? 'LATE' : 'DUE', late ? (due!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()) : tagDay] : ['TO', 'PAY'],
      pay: payable ? `/app/invoice/${invoice!.id}` : null,
    };
  }
  if (item.ack_required && !item.acknowledged_at) {
    return { what: 'Acknowledge this letter', when: dueText ? `by ${dueText}` : null, tone: late ? 'late' : 'plain', tag: dueText ? ['BY', tagDay] : ['TO', 'DO'], pay: null };
  }
  return {
    what: item.display_title || item.subject || 'Needs you',
    when: dueText ? (late ? `overdue since ${dueText}` : `by ${dueText}`) : null,
    tone: late ? 'late' : 'plain',
    tag: dueText ? [late ? 'LATE' : 'BY', late ? (due!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()) : tagDay] : ['TO', 'DO'],
    pay: null,
  };
}

/**
 * The Counter (Mail tab drawings, R9-Counter): what's waiting on you in the
 * drawer chosen in the Mailbox's chips, soonest due first (the server's
 * order), each piece with its paper tag and what to do. Done goes to the Vault.
 */
export default function CounterPage() {
  const router = useRouter();
  const drawerParam = useSearchParams().get('drawer');
  const drawer: Exclude<MailboxDrawer, 'earn'> = isMailboxDrawer(drawerParam) && drawerParam !== 'earn' ? drawerParam : 'personal';
  const pieces = useDrawerTab(drawer, 'counter');
  const { addressee, timeZone } = useMailAddressee();
  const items = pieces.data?.pages.flatMap((page) => page.items) ?? [];
  const total = pieces.data?.pages[0]?.total ?? items.length;

  const open = (item: MailItemV2) => router.push(`/app/mailbox/${item.drawer}/${item.id}`);

  return (
    <div className="mx-auto w-full max-w-2xl pb-8 md:h-full md:overflow-y-auto">
      <section
        aria-labelledby="counter-heading"
        className="mx-3 mt-3.5 rounded-[20px] bg-[#eeeae3] px-3 pb-4 pt-3.5 text-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-2px_0_rgba(0,0,0,0.04)] dark:bg-[#2b2925] dark:text-app-text dark:shadow-none"
      >
        {pieces.isPending ? (
          <div role="status" aria-label="Loading your counter">
            <div className="mx-1 h-6 w-40 rounded bg-black/5 animate-pulse dark:bg-white/10" />
            <div className="mt-4 h-[131px] w-[286px] max-w-full rounded-md bg-black/5 animate-pulse dark:bg-white/10" />
          </div>
        ) : pieces.isError && items.length === 0 ? (
          <ErrorState title="Couldn't load your counter" message={mailLoadMessage(pieces.error)} onRetry={() => { void pieces.refetch(); }} />
        ) : items.length === 0 ? (
          <div className="px-1 py-6 text-center">
            <h2 id="counter-heading" className="text-lg font-semibold leading-6">Nothing waiting on you.</h2>
            <p className="mt-1 text-[13px] leading-[18px] text-[#4e5563] dark:text-app-text-secondary">
              Bills and letters that need something from you land here, soonest first.
              <span className="sr-only"> ({DRAWER_LABELS[drawer]})</span>
            </p>
          </div>
        ) : (
          <>
            <h2 id="counter-heading" className="mx-1 text-lg font-semibold leading-6">
              {total} waiting on you<span className="sr-only"> in {DRAWER_LABELS[drawer]}</span>
            </h2>
            <p className="mx-1 text-[13px] leading-[18px] text-[#4e5563] dark:text-app-text-secondary">Soonest first. Done pieces go to the Vault.</p>

            <ul className="mt-[18px] flex flex-col gap-5" aria-label="Waiting on you">
              {items.map((item, index) => {
                const to = addressee(item);
                const w = waiting(item, timeZone);
                return (
                  <li key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => open(item)}
                      aria-label={`${w.what}${w.when ? `, ${w.when}` : ''}. ${item.sender_display || 'Unknown sender'}: ${item.display_title || item.subject || 'mail'}. Open it`}
                      className="block rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <div className="w-[358px] max-w-[calc(100vw-48px)]" style={{ zoom: 0.8 }}>
                        <MailPiece item={item} recipientName={to.name} recipientLine={to.line} opened={Boolean(item.opened_at || item.viewed)} />
                      </div>
                    </button>
                    {/* The paper tag tied to it */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0.5 top-[18px] rounded-[3px_9px_9px_3px] border border-[#d9c48c] bg-[#f3e3b5] py-1.5 pl-[18px] pr-2.5 text-[10px] font-bold leading-3 tracking-[0.08em] text-[#5c4410] shadow-[0_2px_4px_rgba(0,0,0,0.12)]"
                      style={{ transform: `rotate(${TILTS[index % TILTS.length]}deg)`, fontFamily: MONO }}
                    >
                      <span className="absolute left-1.5 top-[9px] h-[5px] w-[5px] rounded-full border border-[#c9b47a] bg-[#eeeae3]" />
                      {w.tag[0]}<br />{w.tag[1]}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 text-sm leading-5">
                        <span className="font-semibold">{w.what}</span>
                        {w.when ? (
                          <span className={w.tone === 'late' ? 'text-[#a81a1a] dark:text-red-300' : w.tone === 'due' ? 'text-[#9a4a08] dark:text-amber-300' : 'text-[#4e5563] dark:text-app-text-secondary'}>
                            {' '}· {w.when}
                          </span>
                        ) : null}
                      </p>
                      {w.pay ? (
                        <Link href={w.pay} className="inline-flex min-h-[40px] flex-shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-black/5 dark:text-primary-300 dark:hover:bg-white/10">
                          Pay
                        </Link>
                      ) : (
                        <button type="button" onClick={() => open(item)} className="inline-flex min-h-[40px] flex-shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-black/5 dark:text-primary-300 dark:hover:bg-white/10">
                          Open
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {pieces.isFetchNextPageError ? (
              <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-app-surface px-4 py-3 text-sm text-app-text-strong">
                <p>Couldn&apos;t load more. {mailLoadMessage(pieces.error)}</p>
                <button type="button" onClick={() => { void pieces.fetchNextPage(); }} className="flex-shrink-0 font-semibold text-primary-600 hover:underline">Try again</button>
              </div>
            ) : pieces.hasNextPage ? (
              <button type="button" onClick={() => { void pieces.fetchNextPage(); }} disabled={pieces.isFetchingNextPage} className="mt-4 w-full rounded-xl bg-app-surface py-3 text-sm font-semibold text-primary-600 hover:bg-app-hover disabled:opacity-60">
                {pieces.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
