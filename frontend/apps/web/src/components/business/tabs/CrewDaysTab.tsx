'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, Plus, Truck } from 'lucide-react';
import * as api from '@pantopus/api';
import type { CrewDayBusiness, CrewDayDayCard } from '@pantopus/types';
import { formatCrewDate, formatPrice, formatWindow } from '@/lib/crewDay';

// Screen 13 on the web (board `CrewDashboard`): the business dashboard's Crew Days tab, after Invoices. The crew's
// street days as one table by section (today, upcoming, waiting for Pantopus, drafts, past), the readiness card
// while the business can't start one yet, and New Crew Day for owners and editors. GET /api/crew-days/business/:id.

const CHIP: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-surface-muted text-app-strong',
};

function statusChip(day: CrewDayDayCard, section: string): { label: string; tone: keyof typeof CHIP } {
  const past = section === 'past';
  if (day.status === 'cancelled') return { label: 'Cancelled', tone: 'gray' };
  if (day.status === 'draft') return { label: 'Draft', tone: 'gray' };
  if (day.status === 'pending_review') return { label: 'Waiting for approval', tone: 'amber' };
  if (day.status === 'declined') return { label: 'Not approved', tone: 'red' };
  if (past) return day.paid_out ? { label: 'Paid out', tone: 'green' } : { label: 'Done', tone: 'gray' };
  if (day.status === 'in_progress' || section === 'today') return { label: 'Today', tone: 'blue' };
  if (day.is_full) return { label: 'Full', tone: 'blue' };
  if (day.is_closed) return { label: 'Booking closed', tone: 'gray' };
  return { label: 'Open', tone: 'green' };
}

function dateLine(day: CrewDayDayCard): string {
  if (day.status === 'draft' && !day.service_date) return 'No date yet';
  const dates = day.dates?.length ? day.dates : [day.service_date];
  const arrival = formatWindow(day.window_start, day.window_end);
  if (dates.length > 1) return dates.map((d) => formatCrewDate(d)).join(', ');
  return [formatCrewDate(dates[0]), arrival].filter(Boolean).join(' · ');
}

const SECTIONS: Array<{ key: keyof Pick<CrewDayBusiness, 'today' | 'upcoming' | 'pending' | 'drafts' | 'past'>; title: string }> = [
  { key: 'today', title: 'Today' },
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'pending', title: 'Waiting for Pantopus' },
  { key: 'drafts', title: 'Drafts' },
  { key: 'past', title: 'Past' },
];

const MISSING_STEP: Record<string, { label: string; tab: string }> = {
  publish_page: { label: 'Publish your business page', tab: 'profile' },
  set_up_payouts: { label: 'Set up payouts', tab: 'payments' },
};

export default function CrewDaysTab({ businessId }: { businessId: string }) {
  const query = useQuery({
    queryKey: ['crew-day', 'business', businessId],
    queryFn: () => api.crewDays.getBusinessCrewDays(businessId),
    staleTime: 30_000,
  });
  const data = query.data;
  const dashPath = `/app/businesses/${encodeURIComponent(businessId)}/dashboard`;
  const dayPath = (day: CrewDayDayCard) =>
    day.status === 'draft' || day.status === 'declined'
      ? `/app/businesses/${encodeURIComponent(businessId)}/crew-days/${encodeURIComponent(day.id)}/edit`
      : `/app/businesses/${encodeURIComponent(businessId)}/crew-days/${encodeURIComponent(day.id)}`;

  if (query.isLoading) return <p className="text-sm text-app-secondary">Loading Crew Days…</p>;
  if (!data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-app bg-surface p-4">
        <p className="text-sm text-app-strong">We couldn&apos;t load your Crew Days. Check your connection and try again.</p>
        <button type="button" onClick={() => void query.refetch()} className="rounded-lg border border-app-strong px-3 py-1.5 text-sm font-medium text-app-strong hover:bg-surface-raised">
          Try again
        </button>
      </div>
    );
  }

  const ready = data.readiness.missing.length === 0;
  const rows = SECTIONS.map((section) => ({ ...section, days: data[section.key] ?? [] })).filter((section) => section.days.length > 0);
  const fee = `${data.fee.rate_pct}%${data.fee.founding ? ' founding' : ''} fee`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-xl font-semibold text-app">Crew Days</h2>
          <p className="text-sm text-app-secondary">Street days your crew runs. Pantopus approves each one before its invitation works.</p>
        </div>
        {data.can_edit && ready ? (
          <Link
            href={`/app/businesses/${encodeURIComponent(businessId)}/crew-days/new`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Crew Day
          </Link>
        ) : null}
      </div>

      {!ready || !data.readiness.documents_verified ? (
        <section aria-labelledby="cd-ready" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <h3 id="cd-ready" className="flex items-center gap-2 text-base font-semibold text-app">
            <CircleAlert className="h-5 w-5 flex-none text-amber-700 dark:text-amber-400" aria-hidden="true" />
            {ready ? 'One more step for the badge' : 'Before you can start a Crew Day'}
          </h3>
          <ul className="flex flex-col gap-2">
            {data.readiness.missing.map((key) =>
              MISSING_STEP[key] ? (
                <li key={key}>
                  <Link href={`${dashPath}?tab=${MISSING_STEP[key].tab}`} className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">
                    {MISSING_STEP[key].label}
                  </Link>
                </li>
              ) : null,
            )}
            {!data.readiness.documents_verified ? (
              <li className="text-sm text-app-strong">
                <Link href={`${dashPath}?tab=legal`} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
                  Add your insurance and registration
                </Link>{' '}
                (optional: it shows &ldquo;Insured and registered&rdquo; on your invitations)
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-app bg-surface px-6 py-10 text-center">
          <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
            <Truck className="h-6 w-6" />
          </span>
          <h3 className="text-lg font-semibold text-app">No Crew Days yet</h3>
          <p className="max-w-md text-sm text-app-secondary">
            Offer a street day: the homes on one street each book and pay their own price, and you work them in one trip.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-app bg-surface">
          <table className="w-full min-w-[45rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-muted text-left">
                {['Crew Day', 'Date', 'Homes', 'Status', 'Charged'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className={`border-b border-app px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-app-secondary ${h === 'Charged' ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {rows.map((section) => (
              <tbody key={section.key}>
                <tr>
                  <th colSpan={5} scope="colgroup" className="px-4 pb-1.5 pt-3 text-left text-[0.8125rem] font-semibold text-app-strong">
                    {section.title}
                  </th>
                </tr>
                {section.days.map((day) => {
                  const chip = statusChip(day, section.key);
                  const homes =
                    day.status === 'cancelled'
                      ? '—'
                      : section.key === 'past'
                        ? `${day.done_count} ${day.done_count === 1 ? 'home' : 'homes'}`
                        : ['open', 'in_progress'].includes(day.status)
                          ? `${day.booked_count} of ${day.capacity} booked`
                          : '—';
                  return (
                    <tr key={day.id} className="border-b border-app last:border-b-0">
                      <td className="px-4 py-3 align-top">
                        <Link href={dayPath(day)} className="font-semibold text-app hover:underline">
                          {day.title}
                        </Link>
                        <div className="text-[0.8125rem] text-app-secondary">{[day.street_label, day.city].filter(Boolean).join(', ')}</div>
                        {day.status === 'declined' && day.review_note ? (
                          <div className="mt-1 text-[0.8125rem] text-red-700 dark:text-red-400">Pantopus: {day.review_note}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-app-strong [font-variant-numeric:tabular-nums]">{dateLine(day)}</td>
                      <td className="px-4 py-3 align-top text-app-strong [font-variant-numeric:tabular-nums]">
                        {homes}
                        {day.price_checks > 0 ? (
                          <div className="text-[0.8125rem] font-semibold text-amber-800 dark:text-amber-400">
                            {day.price_checks} {day.price_checks === 1 ? 'price' : 'prices'} to confirm
                          </div>
                        ) : null}
                        {day.release_asks > 0 ? (
                          <div className="text-[0.8125rem] font-semibold text-amber-800 dark:text-amber-400">
                            {day.release_asks} {day.release_asks === 1 ? 'home asks' : 'homes ask'} to cancel
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[chip.tone]}`}>{chip.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-semibold text-app [font-variant-numeric:tabular-nums]">
                        {day.charged_cents > 0 ? formatPrice(day.charged_cents) : <span className="font-normal text-app-secondary">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <p className="text-[0.8125rem] text-app-secondary">
        Charges reach your bank 48 hours after each one, minus the {fee}. Each charge is also in{' '}
        <Link href={`${dashPath}?tab=invoices`} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
          Invoices
        </Link>
        .
      </p>
    </div>
  );
}
