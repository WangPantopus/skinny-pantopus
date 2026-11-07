import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import credits from './credits.json';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /about/data-sources
// frontend/apps/web/src/app/(site)/about/data-sources/page.tsx
//
// The credit each publisher of an address or property file asks for. credits.json holds the list;
// scripts/property-index/credits-report.cjs compares it with the rights register.
// ─────────────────────────────────────────────────────────────────────────────

type CreditRow = {
  id: string;
  publisher: string;
  url: string;
  license: string;
  license_url?: string;
  dataset?: string;
  statement?: string;
};

export default function DataSourcesPage() {
  return (
    <div className="min-h-screen bg-app-surface">
      <SiteNav />

      <main>
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-5">
            Data sources
          </h1>
          <p className="text-lg text-app-text-secondary dark:text-app-text-muted leading-relaxed mb-4">
            Pantopus&apos;s address and property records come from public files. These publishers ask to be credited.
          </p>
          <p className="text-app-text-secondary dark:text-app-text-muted leading-relaxed mb-4">
            We standardize each file and combine it with others, so what you see in Pantopus has been changed from the original. No publisher here endorses Pantopus or its use of their data, and each provides its data as is, without warranty.
          </p>
          <p className="text-sm text-app-text-muted dark:text-app-text-secondary">
            Last updated: {credits.updated}
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12">
          {credits.groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-2xl font-bold text-app-text dark:text-white mb-2">{group.title}</h2>
              {group.note ? (
                <p className="text-app-text-secondary dark:text-app-text-muted leading-relaxed mb-2">{group.note}</p>
              ) : null}
              <ul className="divide-y divide-app-border-subtle">
                {(group.sources as CreditRow[]).map((source) => (
                  <CreditItem key={source.id} source={source} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function CreditItem({ source }: { source: CreditRow }) {
  const linkClass = 'text-primary-700 dark:text-primary-300 underline underline-offset-2 hover:decoration-2 break-words';
  return (
    <li className="py-4">
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={`font-semibold ${linkClass}`}>
        {source.publisher}
      </a>
      {source.dataset ? (
        <p className="mt-1 text-sm text-app-text-secondary dark:text-app-text-muted leading-relaxed">{source.dataset}</p>
      ) : null}
      {source.statement ? (
        <p className="mt-1 text-sm text-app-text-secondary dark:text-app-text-muted leading-relaxed break-words">{source.statement}</p>
      ) : null}
      <p className="mt-1 text-sm text-app-text-muted dark:text-app-text-secondary">
        {source.license_url ? (
          <a href={source.license_url} target="_blank" rel="noopener noreferrer" className={linkClass}>{source.license}</a>
        ) : source.license}
      </p>
    </li>
  );
}

function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 bg-app-surface/90 backdrop-blur-md border-b border-app-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <LayoutDashboard className="w-7 h-7 text-primary-600" />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-bold tracking-tight text-primary-700 dark:text-primary-400">Pantopus</span>
              <span className="hidden sm:block text-[10px] font-medium text-app-text-muted dark:text-app-text-secondary tracking-wide uppercase">Your real-world network</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-app-text-strong hover:text-primary-700 dark:hover:text-primary-300 px-3 py-2 transition">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition">
              Get started free
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-slate-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-sm">
          <Link href="/about" className="hover:text-white transition">About</Link>
          <Link href="/contact" className="hover:text-white transition">Contact</Link>
          <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition">Terms</Link>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-sm text-slate-400">
          <p>© 2026 Pantopus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
