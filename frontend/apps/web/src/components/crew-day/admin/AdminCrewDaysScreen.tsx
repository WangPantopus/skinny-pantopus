'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import * as api from '@pantopus/api';
import type { AdminCrewDayBooking, AdminCrewDayItem, AdminCrewDayRequest, AdminCrewDayTab } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { formatCrewDate, formatInstantDate, formatInstantTime, formatPrice, formatWindow, includedItems } from '@/lib/crewDay';
import { monthsText } from '../crewDayStatus';
import { ADMIN_CARD, ADMIN_FIELD, ADMIN_PRIMARY, ADMIN_QUIET, ADMIN_SECONDARY, CrewStanding, Pill, ProblemCard } from './AdminCrewDayParts';

// Screens 20, 22 and 23 (boards `AdminList`, `AdminProblems`, `AdminRequests`): the operator's Crew Days, as tabs.
// Waiting days show the crew's standing and the whole price list with Approve and Decline (a note is required to
// decline; it goes to the crew); Problems answers each open case; Street requests links an open Crew Day or says
// "No crew yet". The tab is in the address (`?tab=`) so the operator's alert emails can open it.
// GET /api/admin/crew-days?tab=…

const TABS: Array<{ key: AdminCrewDayTab; label: string }> = [
  { key: 'waiting', label: 'Waiting for approval' },
  { key: 'open', label: 'Open' },
  { key: 'today', label: 'Today' },
  { key: 'problems', label: 'Problems' },
  { key: 'done', label: 'Done' },
  { key: 'requests', label: 'Street requests' },
];

const REACH: Record<number, string> = { 150: 'just this street, about 150 m', 400: 'a few blocks, about 400 m', 800: 'the neighborhood, about 800 m' };

function priceList(day: AdminCrewDayItem): string {
  const options = day.price_options.map((o) => (o.needs_look || o.price_cents == null ? `${o.label} after a look` : `${o.label} ${formatPrice(o.price_cents)}`));
  const addOns = day.add_ons.map((a) => `${a.label} +${formatPrice(a.price_cents)}`);
  return [...options, ...addOns].join(' · ');
}

function WaitingCard({ day, onChanged }: { day: AdminCrewDayItem; onChanged: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const tz = day.timezone;
  const act = async (which: 'approve' | 'decline') => {
    if (busy) return;
    if (which === 'decline' && !note.trim()) {
      toast.error('Write a note to the crew first: it says what needs to change.');
      return;
    }
    setBusy(which);
    try {
      if (which === 'approve') await api.adminCrewDays.approve(day.id, note.trim() || undefined);
      else await api.adminCrewDays.decline(day.id, note.trim());
      toast.success(which === 'approve' ? 'Approved. The invitation works now.' : 'Declined. The crew has your note.');
      onChanged();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(null);
    }
  };
  const included = includedItems(day);
  return (
    <li className={ADMIN_CARD}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{day.service_label}</Pill>
        <Pill tone="amber">Waiting for approval</Pill>
        {day.submitted_at ? (
          <span className="ml-auto text-xs text-app-text-muted">
            Sent {formatInstantDate(day.submitted_at, tz)} · {formatInstantTime(day.submitted_at, tz)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-app-text">
          <Link href={`/app/admin/crew-days/${encodeURIComponent(day.id)}`} className="hover:underline">
            {day.title}
          </Link>
        </h2>
        <p className="text-sm text-app-text-strong [font-variant-numeric:tabular-nums]">
          {[day.city, day.state].filter(Boolean).join(', ')} · {formatCrewDate(day.service_date)} · {formatWindow(day.window_start, day.window_end)} · {day.capacity}{' '}
          {day.capacity === 1 ? 'home' : 'homes'} · booking closes {formatInstantDate(day.booking_closes_at, tz)}, {formatInstantTime(day.booking_closes_at, tz)}
        </p>
        <p className="text-sm text-app-text-secondary">
          Reach: {REACH[day.radius_m] ?? `about ${day.radius_m} m`} around {day.street_label}
        </p>
      </div>
      <CrewStanding crew={day.crew} />
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(13.75rem,100%),1fr))] gap-x-5 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">Prices</dt>
          <dd className="text-sm text-app-text">{priceList(day)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">Included</dt>
          <dd className="text-sm text-app-text">{[...included, ...(day.outside_only ? ['Outside only'] : [])].join(' · ') || '—'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-app-text-secondary">Note for households</dt>
          <dd className="text-sm text-app-text">{day.prep_note || '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`decline-${day.id}`} className="text-[0.8125rem] font-medium text-app-text-strong">
          Note to the crew (needed to decline)
        </label>
        <textarea
          id={`decline-${day.id}`}
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What needs to change before this day can open"
          className={ADMIN_FIELD}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy} onClick={() => void act('approve')} className={ADMIN_PRIMARY}>
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void act('decline')} className={ADMIN_SECONDARY}>
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
        <Link href={`/app/admin/crew-days/${encodeURIComponent(day.id)}`} className="ml-auto text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
          Open the day
        </Link>
      </div>
    </li>
  );
}

function DayCard({ day }: { day: AdminCrewDayItem }) {
  const chip =
    day.status === 'cancelled'
      ? { label: 'Cancelled', tone: 'slate' as const }
      : day.status === 'done'
        ? { label: 'Done', tone: 'green' as const }
        : day.status === 'in_progress'
          ? { label: 'In progress', tone: 'sky' as const }
          : day.is_full
            ? { label: 'Full', tone: 'sky' as const }
            : { label: 'Open', tone: 'green' as const };
  return (
    <li className={ADMIN_CARD}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{day.service_label}</Pill>
        <Pill tone={chip.tone}>{chip.label}</Pill>
        {day.price_checks > 0 ? <Pill tone="amber">{day.price_checks} to price</Pill> : null}
        <span className="ml-auto text-xs text-app-text-muted [font-variant-numeric:tabular-nums]">
          {day.charged_cents > 0 ? `${formatPrice(day.charged_cents)} charged` : ''}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-app-text">
          <Link href={`/app/admin/crew-days/${encodeURIComponent(day.id)}`} className="hover:underline">
            {day.title}
          </Link>
        </h2>
        <p className="text-sm text-app-text-strong [font-variant-numeric:tabular-nums]">
          {day.crew.name} · {(day.dates?.length ? day.dates : [day.service_date]).map((d) => formatCrewDate(d)).join(', ')} ·{' '}
          {formatWindow(day.window_start, day.window_end)} · {day.booked_count} of {day.capacity} booked
          {day.done_count ? ` · ${day.done_count} done` : ''}
        </p>
      </div>
    </li>
  );
}

function RequestCard({ request, openDays, onChanged }: { request: AdminCrewDayRequest; openDays: AdminCrewDayItem[]; onChanged: () => void }) {
  const [mode, setMode] = useState<'offer' | 'none' | null>(null);
  const [dayId, setDayId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const answered = request.status !== 'requested';
  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'offer') await api.adminCrewDays.answerRequest(request.id, { action: 'offer_ready', crew_day_id: dayId, ...(note.trim() ? { note: note.trim() } : {}) });
      else await api.adminCrewDays.answerRequest(request.id, { action: 'no_crew', note: note.trim() });
      toast.success(mode === 'offer' ? 'We told them a crew can come.' : 'We told them there is no crew yet.');
      setMode(null);
      onChanged();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  // Open days that could serve it: the same service first, then the rest.
  const choices = [...openDays].sort((a, b) => Number(b.service === request.service) - Number(a.service === request.service));
  return (
    <li className={ADMIN_CARD}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{request.service_label}</Pill>
        <Pill tone={request.status === 'offer_ready' ? 'green' : request.status === 'no_crew' ? 'slate' : 'amber'}>
          {request.status === 'offer_ready' ? 'Offer ready' : request.status === 'no_crew' ? 'No crew yet' : 'Needs an answer'}
        </Pill>
        <span className="ml-auto text-xs text-app-text-muted">Asked {formatInstantDate(request.created_at, 'America/Los_Angeles')}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-app-text">{request.title}</h2>
        <p className="text-sm text-app-text-strong">
          {[request.city, request.state].filter(Boolean).join(', ')} · {monthsText(request.months)} · asked by {request.asked_by.first_name || 'a household'}
        </p>
      </div>
      {request.note ? <p className="whitespace-pre-wrap rounded-lg bg-app-surface-sunken px-3 py-2 text-sm text-app-text">{request.note}</p> : null}
      {answered && request.answer_note ? <p className="text-sm text-app-text-secondary">Your answer: {request.answer_note}</p> : null}
      {!answered ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-expanded={mode === 'offer'} onClick={() => setMode(mode === 'offer' ? null : 'offer')} className={ADMIN_PRIMARY}>
              Offer ready
            </button>
            <button type="button" aria-expanded={mode === 'none'} onClick={() => setMode(mode === 'none' ? null : 'none')} className={ADMIN_SECONDARY}>
              No crew yet
            </button>
          </div>
          {mode ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface-sunken p-3.5"
            >
              {mode === 'offer' ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`offer-${request.id}`} className="text-[0.8125rem] font-medium text-app-text-strong">
                    The open Crew Day that reaches them
                  </label>
                  <select id={`offer-${request.id}`} value={dayId} onChange={(e) => setDayId(e.target.value)} className={ADMIN_FIELD}>
                    <option value="">Pick an open Crew Day</option>
                    {choices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {formatCrewDate(d.service_date)} · {d.crew.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`answer-${request.id}`} className="text-[0.8125rem] font-medium text-app-text-strong">
                  {mode === 'offer' ? 'Note to the household (optional)' : 'Note to the household (required)'}
                </label>
                <textarea id={`answer-${request.id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={ADMIN_FIELD} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || (mode === 'offer' ? !dayId : !note.trim())} className={ADMIN_PRIMARY}>
                  {busy ? 'Sending…' : mode === 'offer' ? 'Send the offer' : 'Send'}
                </button>
                <button type="button" onClick={() => setMode(null)} className={ADMIN_QUIET}>
                  Not now
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export default function AdminCrewDaysScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tab = (TABS.find((t) => t.key === searchParams.get('tab'))?.key ?? 'waiting') as AdminCrewDayTab;
  const query = useQuery({ queryKey: ['crew-day', 'admin', tab], queryFn: () => api.adminCrewDays.list(tab), staleTime: 15_000, retry: false });
  const openDays = useQuery({
    queryKey: ['crew-day', 'admin', 'open'],
    queryFn: () => api.adminCrewDays.list('open'),
    enabled: tab === 'requests',
    staleTime: 30_000,
  });
  const denied = (query.error as { statusCode?: number } | null)?.statusCode === 403;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['crew-day', 'admin'] });
  const data = query.data;
  const count = data?.counts?.[tab] ?? 0;

  return (
    <div className="min-h-screen bg-app-surface">
      <div className="flex items-center gap-3 border-b border-app-border bg-app-surface px-4 py-3">
        <button type="button" onClick={() => router.back()} className="rounded-lg p-1.5 transition hover:bg-app-hover" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-app-text" />
        </button>
        <h1 className="flex-1 text-xl font-bold text-app-text">Crew Days</h1>
        {!denied && data ? (
          <span className="min-w-[24px] rounded-full bg-violet-600 px-2.5 py-1 text-center text-xs font-bold text-white">{count}</span>
        ) : null}
        <button type="button" onClick={refresh} className="rounded-lg p-1.5 transition hover:bg-app-hover" aria-label="Refresh">
          <RefreshCw className={`h-[1.125rem] w-[1.125rem] text-app-text-secondary ${query.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        {denied ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ShieldAlert className="mb-4 h-14 w-14 text-app-text-muted" />
            <p className="text-lg font-semibold text-app-text">Admins only</p>
            <p className="mt-1 text-sm text-app-text-secondary">You do not have admin access.</p>
            <Link href="/app" className="mt-4 rounded-lg border border-app-border px-4 py-2 text-sm font-medium text-app-text transition hover:bg-app-hover">
              Back to Pantopus
            </Link>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Crew Day lists" className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => router.replace(`/app/admin/crew-days?tab=${t.key}`)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-violet-600 text-white' : 'text-app-text-secondary hover:bg-app-hover'}`}
                >
                  {t.label}
                  {data?.counts?.[t.key] ? <span className="sr-only"> ({data.counts[t.key]})</span> : null}
                  {data?.counts?.[t.key] ? (
                    <span aria-hidden="true" className={`ml-1.5 text-xs ${tab === t.key ? 'text-violet-100' : 'text-app-text-muted'}`}>
                      {data.counts[t.key]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {query.isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
              </div>
            ) : query.isError ? (
              <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-app-border p-4">
                <p className="text-sm text-app-text-strong">We couldn&apos;t load this list. Check your connection and try again.</p>
                <button type="button" onClick={refresh} className={ADMIN_SECONDARY}>
                  Try again
                </button>
              </div>
            ) : !data?.items.length ? (
              <div className="flex flex-col items-center justify-center py-24">
                <CheckCircle className="mb-4 h-14 w-14 text-emerald-500" />
                <p className="text-lg font-semibold text-app-text">{tab === 'waiting' || tab === 'problems' ? 'All caught up' : 'Nothing here yet'}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {tab === 'waiting'
                  ? (data.items as AdminCrewDayItem[]).map((day) => <WaitingCard key={day.id} day={day} onChanged={refresh} />)
                  : tab === 'problems'
                    ? (data.items as AdminCrewDayBooking[]).map((booking) => <ProblemCard key={booking.id} booking={booking} onChanged={refresh} />)
                    : tab === 'requests'
                      ? (data.items as AdminCrewDayRequest[]).map((request) => (
                          <RequestCard key={request.id} request={request} openDays={(openDays.data?.items as AdminCrewDayItem[] | undefined) ?? []} onChanged={refresh} />
                        ))
                      : (data.items as AdminCrewDayItem[]).map((day) => <DayCard key={day.id} day={day} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
