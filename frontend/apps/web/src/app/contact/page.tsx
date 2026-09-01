import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /contact
// frontend/apps/web/src/app/contact/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-app-surface">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950 pt-20 pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 dark:border-emerald-700/30 bg-app-surface/80 px-4 py-1.5 text-sm text-emerald-700 dark:text-emerald-300 font-medium mb-8">
            Get in touch
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-6">
            Contact us
          </h1>
          <p className="text-xl text-app-text-secondary dark:text-app-text-muted leading-relaxed max-w-xl mx-auto">
            Questions, feedback, partnership ideas, or just want to say hi — we&apos;d genuinely love to hear from you.
          </p>
          <p className="mt-3 text-sm text-app-text-muted dark:text-app-text-secondary">
            We typically reply within 1–2 business days.
          </p>
        </div>
      </section>

      {/* Contact cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <ContactCard
            icon="💬"
            color="bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30"
            iconBg="bg-primary-100 dark:bg-primary-900/40"
            iconText="text-primary-700 dark:text-primary-300"
            title="General support"
            description="Questions about your account, features, or anything platform-related."
            contact="support@pantopus.com"
            note="For account, billing, and feature questions"
          />
          <ContactCard
            icon="🤝"
            color="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30"
            iconBg="bg-emerald-100 dark:bg-emerald-900/40"
            iconText="text-emerald-700 dark:text-emerald-300"
            title="Business inquiries"
            description="Partnerships, integrations, community programs, or press inquiries."
            contact="business@pantopus.com"
            note="Partnerships, press, and community programs"
          />
          <ContactCard
            icon="🔒"
            color="bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800/30"
            iconBg="bg-violet-100 dark:bg-violet-900/40"
            iconText="text-violet-700 dark:text-violet-300"
            title="Privacy & legal"
            description="Data requests, DMCA notices, privacy concerns, or legal correspondence."
            contact="privacy@pantopus.com"
            note="Data requests, DMCA, legal correspondence"
          />
        </div>
      </section>

      {/* FAQ / helpful links */}
      <section className="bg-app-surface-raised/40 border-y border-app-border-subtle py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-app-text dark:text-white mb-2 text-center">
            Looking for something specific?
          </h2>
          <p className="text-app-text-secondary dark:text-app-text-muted text-center mb-10">
            These pages might have what you need before reaching out.
          </p>

          <div className="space-y-3">
            {[
              {
                href: '/#trust',
                label: 'Security & verification',
                detail: 'How identity verification and privacy controls work on Pantopus.',
                icon: '🛡️',
              },
              {
                href: '/privacy',
                label: 'Privacy policy',
                detail: 'What data we collect, how we use it, and how you can control it.',
                icon: '📋',
              },
              {
                href: '/terms',
                label: 'Terms of service',
                detail: 'The rules and expectations for using Pantopus.',
                icon: '📄',
              },
              {
                href: '/about',
                label: 'About Pantopus',
                detail: 'What we believe, who we built this for, and where we are going.',
                icon: <LayoutDashboard className="w-7 h-7 text-primary-600" />,
              },
            ].map(({ href, label, detail, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 bg-app-surface border border-app-border-subtle rounded-xl p-5 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-sm transition group"
              >
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-app-text dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 transition">{label}</p>
                  <p className="text-sm text-app-text-secondary dark:text-app-text-muted mt-0.5">{detail}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 dark:text-app-text-secondary group-hover:text-primary-400 transition flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-app-text-secondary dark:text-app-text-muted mb-2">Not a user yet?</p>
        <h2 className="text-2xl font-bold text-app-text dark:text-white mb-6">
          Join Pantopus
        </h2>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-primary-700 transition shadow-md shadow-primary-200 dark:shadow-primary-900/30"
        >
          Get started free
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}

function ContactCard({
  icon,
  color,
  iconBg,
  iconText,
  title,
  description,
  contact,
  note,
}: {
  icon: string;
  color: string;
  iconBg: string;
  iconText: string;
  title: string;
  description: string;
  contact: string;
  note: string;
}) {
  return (
    <div className={`border ${color} rounded-2xl p-6 flex flex-col`}>
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center text-2xl mb-5`}>
        {icon}
      </div>
      <h3 className="font-bold text-app-text dark:text-white text-lg mb-2">{title}</h3>
      <p className="text-app-text-secondary dark:text-app-text-muted text-sm leading-relaxed mb-5 flex-1">{description}</p>
      <a
        href={`mailto:${contact}`}
        className={`font-semibold text-sm ${iconText} hover:underline break-all`}
      >
        {contact}
      </a>
      <p className="text-xs text-app-text-muted dark:text-app-text-secondary mt-1">{note}</p>
    </div>
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
            <Link href="/register" className="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-sm">
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
