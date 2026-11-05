import type { ReactNode } from 'react';
import Link from 'next/link';
import { CrewDayCard, CrewDayTopBar } from './CrewDayParts';

// The two short pages the invitation's footer links to ("How Crew Day works", "Who sees what"): a title, an intro
// and numbered or plain rows in one card, then a link to the other page.

export type CrewDayInfoRow = { title: string; body: ReactNode };

export default function CrewDayInfoPage({
  title,
  intro,
  rows,
  numbered = false,
  closing,
  other,
}: {
  title: string;
  intro: string;
  rows: CrewDayInfoRow[];
  numbered?: boolean;
  closing?: string;
  other: { href: string; label: string };
}) {
  return (
    <main className="min-h-screen bg-app text-app-text">
      <div className="mx-auto w-full max-w-md pb-10">
        <CrewDayTopBar />
        <div className="flex flex-col gap-4 px-4 pt-6">
          <h1 className="text-2xl font-bold leading-[1.875rem] tracking-[-0.015em]">{title}</h1>
          <p className="text-[0.9375rem] leading-[1.375rem] text-app-text-strong">{intro}</p>
          <CrewDayCard className="flex flex-col gap-5 p-4">
            {rows.map((row, index) => (
              <section key={row.title} className="flex items-start gap-3">
                {numbered ? (
                  <span
                    className="grid h-7 w-7 flex-none place-items-center rounded-full bg-app-home-bg text-[0.8125rem] font-bold text-app-home"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                ) : null}
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-[0.9375rem] font-semibold leading-5 text-app-text">{row.title}</h2>
                  <p className="text-sm leading-5 text-app-text-secondary">{row.body}</p>
                </div>
              </section>
            ))}
          </CrewDayCard>
          {closing ? <p className="text-sm leading-5 text-app-text-strong">{closing}</p> : null}
          <p className="text-xs leading-4 text-app-text-secondary">
            <Link href={other.href} className="font-semibold text-app-link">
              {other.label}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
