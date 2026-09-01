import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /child-safety
// Child Safety Standards (CSAE policy for Google Play compliance)
// frontend/apps/web/src/app/child-safety/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export default function ChildSafetyPage() {
  return (
    <div className="min-h-screen bg-app-surface">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950 pt-20 pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-indigo-100/50 dark:bg-indigo-900/20 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/60 dark:border-indigo-700/30 bg-app-surface/80 px-4 py-1.5 text-sm text-indigo-700 dark:text-indigo-300 font-medium mb-8">
            Safety first
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-6">
            Child Safety Standards
          </h1>
          <p className="text-xl text-app-text-secondary dark:text-app-text-muted leading-relaxed max-w-2xl mx-auto mb-4">
            Pantopus is committed to protecting children and preventing child sexual abuse and exploitation (CSAE) on our platform.
          </p>
          <p className="text-sm text-app-text-muted dark:text-app-text-secondary">
            Last updated: March 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12 pt-12">

        <PolicySection title="1. Our commitment">
          <p>
            Pantopus has zero tolerance for child sexual abuse material (CSAM) and any form of child exploitation. We are committed to maintaining a safe platform and complying with all applicable child safety laws, including reporting obligations to regional and national authorities.
          </p>
        </PolicySection>

        <PolicySection title="2. Age requirements">
          <p>
            Pantopus is designed for users aged 13 and older. We do not knowingly allow children under 13 to create accounts or use our services. If we discover that a user is under 13, we will promptly disable their account and delete their personal information.
          </p>
        </PolicySection>

        <PolicySection title="3. Prevention measures">
          <p>We employ a range of measures to prevent CSAE on our platform:</p>
          <PolicyList items={[
            { label: 'Content moderation', detail: 'We use a combination of automated systems and human review to detect and remove prohibited content, including CSAM.' },
            { label: 'User reporting', detail: 'Users can report concerning content or behavior directly within the app. All reports involving potential child exploitation are prioritized for immediate review.' },
            { label: 'Account verification', detail: 'Our verification systems help ensure accountability and reduce anonymous misuse of the platform.' },
            { label: 'Blocking and privacy controls', detail: 'Users can block other users and control who can contact them or view their content.' },
          ]} />
        </PolicySection>

        <PolicySection title="4. Detection and reporting">
          <p>
            When we become aware of apparent CSAM or child exploitation, we take the following actions:
          </p>
          <PolicyList items={[
            { label: 'Immediate removal', detail: 'Any content that constitutes or promotes CSAM is immediately removed from the platform.' },
            { label: 'Account action', detail: 'Accounts found to be involved in CSAE are permanently banned.' },
            { label: 'Law enforcement reporting', detail: 'We report instances of apparent CSAM to the National Center for Missing & Exploited Children (NCMEC) and cooperate with law enforcement as required by law.' },
            { label: 'Record keeping', detail: 'We maintain records of actions taken in response to CSAE reports in accordance with legal requirements.' },
          ]} />
        </PolicySection>

        <PolicySection title="5. In-app reporting">
          <p>
            Pantopus allows users to report child safety concerns directly within the app. To report concerning content or behavior:
          </p>
          <PolicyList items={[
            { label: 'Report a post', detail: 'Tap the menu icon on any post and select "Report." Choose the appropriate category related to child safety.' },
            { label: 'Report a user', detail: 'Visit the user\'s profile, tap the menu icon, and select "Report." Describe the concern and our team will review it promptly.' },
            { label: 'Contact us directly', detail: 'You can also email safety concerns to safety@pantopus.com for immediate attention.' },
          ]} />
        </PolicySection>

        <PolicySection title="6. Compliance">
          <p>
            Pantopus complies with all relevant child safety laws and regulations, including but not limited to:
          </p>
          <PolicyList items={[
            { label: 'COPPA', detail: 'The Children\'s Online Privacy Protection Act (United States).' },
            { label: 'NCMEC reporting', detail: 'We fulfill our obligation to report apparent CSAM to the National Center for Missing & Exploited Children.' },
            { label: 'Regional authorities', detail: 'We report to relevant regional and national authorities as required by applicable law in all jurisdictions where we operate.' },
          ]} />
        </PolicySection>

        <PolicySection title="7. Contact">
          <p>
            For child safety concerns or questions about our child safety standards, contact us at:{' '}
            <a href="mailto:safety@pantopus.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              safety@pantopus.com
            </a>
          </p>
          <p>
            For general privacy inquiries, see our{' '}
            <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              Privacy Policy
            </Link>.
          </p>
        </PolicySection>

      </section>

      <SiteFooter />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-app-border-subtle pt-10">
      <h2 className="text-2xl font-bold text-app-text dark:text-white mb-5">{title}</h2>
      <div className="space-y-4 text-app-text-secondary dark:text-app-text-muted leading-relaxed text-base">
        {children}
      </div>
    </div>
  );
}

function PolicyList({ items }: { items: { label: string; detail: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map(({ label, detail }) => (
        <li key={label} className="flex items-start gap-3">
          <span className="text-indigo-400 mt-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span>
            <span className="font-semibold text-app-text dark:text-white">{label}: </span>
            {detail}
          </span>
        </li>
      ))}
    </ul>
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
            <Link href="/login" className="text-sm font-medium text-app-text-strong hover:text-primary-700 dark:hover:text-primary-300 px-3 py-2 transition">Log in</Link>
            <Link href="/register" className="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-sm">Get started free</Link>
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
              <li><Link href="/child-safety" className="hover:text-white transition">Child Safety</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-sm text-app-text-secondary">
          <p>&copy; 2026 Pantopus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
