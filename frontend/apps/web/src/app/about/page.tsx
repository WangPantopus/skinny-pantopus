import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /about
// frontend/apps/web/src/app/about/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-app-surface">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950 pt-20 pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-primary-100/50 dark:bg-primary-900/20 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/60 dark:border-primary-700/30 bg-app-surface/80 px-4 py-1.5 text-sm text-primary-700 dark:text-primary-300 font-medium mb-8">
            Our story
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-6">
            About Pantopus
          </h1>
          <p className="text-xl md:text-2xl text-app-text-secondary dark:text-app-text-muted leading-relaxed max-w-2xl mx-auto">
            Your real-world network, built for real people, real homes, and the lives we actually live in them.
          </p>
        </div>
      </section>

      {/* Origin */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose-custom">
          <p className="text-xl text-app-text-strong leading-relaxed mb-6">
            Pantopus started with a simple frustration: real-world tools were fragmented. Neighborhood apps, home tools, task marketplaces, and public profiles all lived in separate places.
          </p>
          <p className="text-lg text-app-text-secondary dark:text-app-text-muted leading-relaxed mb-6">
            We wanted something grounded. Something that felt like your actual street — where the people you interact with are real, where your home is more than a pin on a map, where asking for help or offering a skill doesn&apos;t require navigating a corporate platform designed for the whole internet.
          </p>
          <p className="text-lg text-app-text-secondary dark:text-app-text-muted leading-relaxed">
            So we built Pantopus: a platform where your real-world identities can stay distinct, your home has its own command center, and Beacons, tasks, marketplace, mail, and local updates can live together.
          </p>
        </div>
      </section>

      {/* Beliefs */}
      <section className="bg-app-surface-raised/40 border-y border-app-border-subtle py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-app-text dark:text-white mb-4 text-center">
            What we believe
          </h2>
          <p className="text-app-text-secondary dark:text-app-text-muted text-center text-lg mb-14">
            These aren&apos;t just product decisions — they&apos;re convictions.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: '🎯',
                title: 'Intent over outrage',
                body: 'Posts should lead somewhere useful. Every Pantopus post starts with a clear purpose — Ask, Recommend, Event, Announce — so feeds produce outcomes, not noise.',
              },
              {
                icon: '🔒',
                title: 'Privacy by default',
                body: 'Your household life stays private unless you choose otherwise. Verification builds trust without requiring you to broadcast where you live or who you live with.',
              },
              {
                icon: '✅',
                title: 'Trust is earned, not assumed',
                body: 'Verification unlocks confidence in the platform, not exposure of your personal information. Real residency signals matter. Accountability without surveillance.',
              },
              {
                icon: '🔗',
                title: 'Everything stays connected',
                body: 'Post → chat → action → review. We built Pantopus so that nothing falls into the void between DMs, screenshots, and forgotten threads. One timeline, one receipt trail.',
              },
              {
                icon: '🤝',
                title: 'Local work has real value',
                body: 'The skills your neighbors need — yard work, handyman, tutoring, pet care — are exactly the kinds of work that machines cannot replace. We take that seriously.',
              },
              {
                icon: '🌐',
                title: 'Real identity in a world of AI noise',
                body: 'As the internet fills with AI-generated content, verified human presence in a real place becomes increasingly valuable. Pantopus is designed to make that identity count.',
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="bg-app-surface border border-app-border-subtle rounded-2xl p-6 shadow-sm"
              >
                <span className="text-3xl block mb-4">{icon}</span>
                <h3 className="text-lg font-bold text-app-text dark:text-white mb-2">{title}</h3>
                <p className="text-app-text-secondary dark:text-app-text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-app-text dark:text-white mb-4 text-center">
          Who Pantopus is for
        </h2>
        <p className="text-app-text-secondary dark:text-app-text-muted text-center text-lg mb-14">
          If you live somewhere, work nearby, or run something local — there&apos;s a lane for you.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: '🏘️',
              color: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30',
              label: 'Residents',
              body: 'A calmer, more useful local layer. Real people, real updates, real help.',
            },
            {
              icon: '💼',
              color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30',
              label: 'Earners',
              body: 'Find gigs or post tasks. Turn your skills into income without leaving your zip code.',
            },
            {
              icon: '🏠',
              color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/30',
              label: 'Households',
              body: 'A private command center for home tasks, packages, bills, and everyone who lives with you.',
            },
            {
              icon: '🏪',
              color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30',
              label: 'Local businesses',
              body: 'A trusted local storefront. Clean inbox, team roles, and discoverability without the noise.',
            },
          ].map(({ icon, color, label, body }) => (
            <div key={label} className={`border ${color} rounded-2xl p-6`}>
              <span className="text-3xl block mb-4">{icon}</span>
              <h3 className="font-bold text-app-text dark:text-white mb-2">{label}</h3>
              <p className="text-sm text-app-text-secondary dark:text-app-text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vision */}
      <section className="bg-gray-950 text-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-glass/10 text-gray-300 text-xs font-semibold px-3 py-1.5 mb-8 tracking-wide uppercase">
            Where we&apos;re going
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
            One system where your address, your network, and your work all make sense together.
          </h2>
          <p className="text-app-text-muted text-lg leading-relaxed mb-10">
            We&apos;re building the platform that turns a physical address into a full digital identity — one that earns trust, generates income, and keeps home life organized, without sacrificing privacy or becoming another place where the loudest voices win.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary-700 transition"
          >
            Join Pantopus
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

// ── Shared Nav ───────────────────────────────────────────────────────────────
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
            <Link href="/register" className="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-sm">
              Get started free
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ── Shared Footer ─────────────────────────────────────────────────────────────
function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-app-text-muted py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <LayoutDashboard className="w-5 h-5 text-primary-600" />
              <span className="text-lg font-bold text-white">Pantopus</span>
            </div>
            <p className="text-sm text-app-text-secondary leading-relaxed max-w-xs">
              Your real-world network. Verified people, real homes, local work, and Beacons in one place.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/#features" className="hover:text-white transition">Features</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-white transition">How it works</Link></li>
              <li><Link href="/#trust" className="hover:text-white transition">Security</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-white transition">About</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-sm text-app-text-secondary">
          <p>© 2026 Pantopus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
