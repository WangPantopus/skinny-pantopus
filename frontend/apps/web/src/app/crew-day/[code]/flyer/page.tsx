import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ChevronLeft, House, Lock, ShieldCheck } from 'lucide-react';
import { buildCrewDayPath, buildCrewDayShareUrl } from '@pantopus/utils';
import { crewDayUnavailable, readCrewDayForPage } from '@/lib/crewDayServer';
import {
  crewDayServiceLabel,
  formatCrewDate,
  formatInstantDate,
  formatPrice,
  formatWindow,
  includedItems,
  streetInCity,
  type PublicCrewDay,
} from '@/lib/crewDay';
import QRCode from '@/components/ui/QRCode';
import CrewDayPrintButton from '@/components/crew-day/CrewDayPrintButton';
import { CrewDayLoadFailed, ServiceGlyph } from '@/components/crew-day/CrewDayParts';

// The printable flyer behind the share kit's "Printable flyer" (screen 12): one letter page a household or the crew
// tapes up or hands out, with the street, the date, the price list's lowest price, what the crew does and a QR code
// to the invitation. Like the invitation it shows counts and the street only, never an address or who booked. The
// paper keeps its light colors in dark mode: it's what comes out of the printer.
export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ code: string }> };

/** Why the flyer can't bring in homes any more, when it can't. */
function closedNotice(day: PublicCrewDay): string | null {
  switch (day.availability) {
    case 'full':
      return `All ${day.capacity} spots are taken, so this flyer can't bring in more homes.`;
    case 'closed':
      return `Booking closed on ${formatInstantDate(day.booking_closes_at, day.timezone)}, so this flyer can't bring in more homes.`;
    case 'cancelled':
      return 'This Crew Day was cancelled. Nobody was charged.';
    case 'done':
      return 'This Crew Day is done.';
    default:
      return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code: rawCode } = await params;
  const { code, day } = await readCrewDayForPage(rawCode);
  const base = { robots: { index: false, follow: false } };
  if (!code || !day) return { ...base, title: 'Crew Day not available | Pantopus' };
  return { ...base, title: `Flyer: ${day.title} | Pantopus` };
}

export default async function CrewDayFlyerPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const page = await readCrewDayForPage(rawCode);
  if (crewDayUnavailable(page) || !page.code) notFound();
  const { code, day } = page;
  if (!day) return <CrewDayLoadFailed code={code} retryHref={`${buildCrewDayPath(code)}/flyer`} />;

  const link = buildCrewDayShareUrl(code);
  const arrival = formatWindow(day.window_start, day.window_end);
  const included = includedItems(day);
  const notice = closedNotice(day);
  const crew = day.crew.name || 'A local crew';

  return (
    <main className="min-h-screen bg-app text-app-text print:min-h-0 print:bg-white">
      <style>{'@page { size: letter; margin: 0.5in; } @media print { html, body { background: #fff !important; } }'}</style>
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-4 px-4 py-4 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={buildCrewDayPath(code)} className="inline-flex min-h-11 items-center gap-1 text-[0.9375rem] font-semibold text-app-link">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            Back to the invitation
          </Link>
          <CrewDayPrintButton />
        </div>
        {notice ? (
          <p role="status" className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm leading-5 text-app-text-strong print:hidden">
            {notice}
          </p>
        ) : null}

        <article
          aria-labelledby="cd-flyer-title"
          className="flex flex-col gap-7 rounded-[1.25rem] border border-[#e5e7eb] bg-white p-5 text-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <header className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[1.375rem] font-bold leading-7 tracking-[-0.02em]">Pantopus</span>
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[#dcfce7] py-1 pl-1 pr-3 text-sm font-semibold leading-5 text-[#14532d]">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-[#15803d] text-white">
                <ServiceGlyph service={day.service} className="h-[0.875rem] w-[0.875rem]" />
              </span>
              {crewDayServiceLabel(day.service)}
            </span>
          </header>

          <div className="flex flex-col gap-3">
            <p className="text-lg leading-7 text-[#374151]">A local crew is coming to {streetInCity(day)}.</p>
            <h1 id="cd-flyer-title" className="text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[3.25rem]">
              {day.title}
            </h1>
            <p className="text-xl font-semibold leading-8 [font-variant-numeric:tabular-nums] sm:text-2xl">
              {[formatCrewDate(day.service_date, 'long'), arrival ? `Arriving ${arrival}` : null].filter(Boolean).join(' · ')}
            </p>
            <p className="text-lg leading-7 text-[#374151]">
              {day.price_from_cents != null ? (
                <>
                  <span className="font-semibold text-[#111827]">From {formatPrice(day.price_from_cents)} a home</span>, including tax. Your
                  home gets its own price.
                </>
              ) : (
                "The crew confirms each home's price after a look."
              )}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-7 sm:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-[minmax(0,1fr)_auto]">
            <section aria-labelledby="cd-flyer-does" className="flex flex-col gap-3">
              <h2 id="cd-flyer-does" className="text-xs font-semibold uppercase leading-4 tracking-[0.07em] text-[#4b5563]">
                What the crew does
              </h2>
              <ul className="flex flex-col gap-2.5">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-base leading-6">
                    <Check className="mt-1 h-4 w-4 flex-none text-[#15803d]" strokeWidth={2.6} aria-hidden="true" />
                    {item}
                  </li>
                ))}
                {day.outside_only ? (
                  <li className="flex items-start gap-2.5 text-base leading-6">
                    <House className="mt-1 h-4 w-4 flex-none text-[#4b5563]" aria-hidden="true" />
                    Outside only. You don&apos;t need to be home.
                  </li>
                ) : null}
              </ul>
              <ul className="mt-2 flex flex-col gap-2 text-[0.9375rem] leading-[1.375rem] text-[#374151]">
                <li>Pay once it&apos;s done: your card is charged the day after the crew finishes your home.</li>
                <li>Rain never changes your price. Cancelling is free until 48 hours before.</li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-1 h-[0.875rem] w-[0.875rem] flex-none" aria-hidden="true" />
                  Your address stays private. Neighbors see how many homes booked, never which ones.
                </li>
              </ul>
            </section>

            <section aria-labelledby="cd-flyer-scan" className="flex flex-col items-center gap-2 rounded-2xl border border-[#e5e7eb] p-4 text-center">
              <h2 id="cd-flyer-scan" className="text-lg font-semibold leading-6">
                Scan to see your price
              </h2>
              <div className="w-full max-w-[13rem] [&_svg]:h-auto [&_svg]:w-full">
                <QRCode value={link} size={208} label={`QR code: ${link}`} />
              </div>
              <p className="max-w-[16rem] break-words text-sm font-semibold leading-5">
                {/* A long host breaks before the code, never inside it. */}
                {link.replace(/^https?:\/\//, '').slice(0, -code.length)}
                <wbr />
                {code}
              </p>
              <p className="max-w-[16rem] text-[0.8125rem] leading-[1.125rem] text-[#4b5563]">
                No account needed to see your price.
                {day.availability === 'open' ? ` Booking closes ${formatInstantDate(day.booking_closes_at, day.timezone, 'long')}.` : ''}
              </p>
            </section>
          </div>

          <footer className="flex flex-col gap-1 border-t border-[#e5e7eb] pt-4 text-sm leading-5 text-[#4b5563]">
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold text-[#111827]">{crew}</span>
              {day.crew.verified ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[#15803d]">
                  <ShieldCheck className="h-[0.875rem] w-[0.875rem]" aria-hidden="true" />
                  Insured and registered
                </span>
              ) : null}
            </p>
            <p>Pantopus organizes this Crew Day. {crew} does the work.</p>
          </footer>
        </article>
      </div>
    </main>
  );
}
