import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /terms
// frontend/apps/web/src/app/terms/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-app-surface">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-rose-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950 pt-20 pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-rose-100/50 dark:bg-rose-900/20 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/60 dark:border-rose-700/30 bg-app-surface/80 px-4 py-1.5 text-sm text-rose-700 dark:text-rose-300 font-medium mb-8">
            The rules of the road
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-6">
            Terms of Service
          </h1>
          <p className="text-xl text-app-text-secondary dark:text-app-text-muted leading-relaxed max-w-2xl mx-auto mb-4">
            Plain language, no tricks. Here is what you agree to when you use Pantopus and what we commit to in return.
          </p>
          <p className="text-sm text-app-text-muted dark:text-app-text-secondary">
            Last updated: February 2026
          </p>
        </div>
      </section>

      {/* Summary cards */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200 mb-5 flex items-center gap-2">
            <span>📄</span> In plain terms
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '🤝', label: 'Be real', text: 'Use Pantopus as yourself, honestly, and treat others with respect.' },
              { icon: '📝', label: 'You own your content', text: 'Your posts are yours. We only use them to run the platform.' },
              { icon: '⚖️', label: 'Real commitments', text: 'Task agreements and transactions are between users. We facilitate, not guarantee.' },
            ].map(({ icon, label, text }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-rose-900 dark:text-rose-200 text-sm">{label}</p>
                  <p className="text-rose-800/80 dark:text-rose-300/80 text-sm mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terms content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12">

        <TermsSection title="1. Agreement">
          <p>
            By creating an account or using Pantopus, you agree to these Terms of Service and our{' '}
            <Link href="/privacy" className="text-rose-600 dark:text-rose-400 hover:underline">Privacy Policy</Link>.
            If you do not agree, please do not use Pantopus.
          </p>
          <p>
            These Terms apply to all users of Pantopus, including residents, gig workers, household members, and local businesses.
          </p>
        </TermsSection>

        <TermsSection title="2. Eligibility">
          <p>
            You must be at least 13 years old to use Pantopus. By using the platform, you represent that you are old enough to enter into a binding agreement under the laws of where you live. If you are under 18, please ensure a parent or guardian reviews these Terms.
          </p>
          <p>
            If you are using Pantopus on behalf of a business, you represent that you are authorized to bind that business to these Terms.
          </p>
        </TermsSection>

        <TermsSection title="3. Your account">
          <p>
            You are responsible for all activity under your account and for keeping your login credentials secure. If you believe your account has been compromised, contact us immediately at{' '}
            <a href="mailto:support@pantopus.com" className="text-rose-600 dark:text-rose-400 hover:underline">support@pantopus.com</a>.
          </p>
          <p>
            You may not create accounts on behalf of others, impersonate another person, or use a name that is misleading or deceptive. Pantopus is built on real identity — please treat it that way.
          </p>
        </TermsSection>

        <TermsSection title="4. Acceptable use">
          <p>Pantopus is designed to be a helpful, respectful real-world network. You agree not to:</p>
          <TermsList items={[
            'Harass, threaten, bully, stalk, or intimidate any person',
            'Impersonate another person, organization, or Pantopus itself',
            'Post false, misleading, or fraudulent information',
            'Spam, flood, or send unsolicited bulk messages',
            'Post illegal content or facilitate illegal activity',
            'Attempt to access, scrape, or extract data from accounts or systems that are not yours',
            'Abuse reporting, verification, or moderation systems',
            'Use the platform in ways that damage, disable, overburden, or impair it',
            'Use automated bots, scrapers, or tools to interact with Pantopus without permission',
          ]} />
          <p>
            We reserve the right to remove content and take action against accounts that violate these standards, up to and including permanent suspension.
          </p>
        </TermsSection>

        <TermsSection title="5. Content you post">
          <p>
            You own the content you post on Pantopus — your posts, messages, listings, photos, and reviews remain yours.
          </p>
          <p>
            By posting content on Pantopus, you grant us a non-exclusive, worldwide, royalty-free license to host, display, transmit, and distribute that content as part of operating the platform. This license ends when you delete your content or close your account.
          </p>
          <p>
            You are responsible for ensuring your content does not violate third-party rights, including intellectual property or privacy rights of others.
          </p>
        </TermsSection>

        <TermsSection title="6. Tasks, offers, and payments">
          <p>
            Pantopus may support posting tasks, placing bids, accepting offers, and processing payments between users. When you post or accept a task, you are entering into an agreement with another user — not with Pantopus.
          </p>
          <TermsList items={[
            'You are responsible for the accuracy of your listings and communications',
            'Completing a gig or delivering an offer is your commitment to the other party',
            'Disputes between users are the responsibility of those users to resolve',
            'Payment processing is handled by our payment partner, Stripe, subject to their terms',
            'Pantopus may facilitate but does not guarantee outcomes of any transaction',
          ]} />
          <p>
            As payment and gig features expand, additional terms specific to those features may apply. We will notify you when that happens.
          </p>
        </TermsSection>

        <TermsSection title="7. Home claims and verification">
          <p>
            Pantopus allows users to claim a home address and verify residency. Verification signals help build community trust, but claiming a home does not grant any legal rights to a property. You must only claim homes where you actually reside or have authorization to represent.
          </p>
          <p>
            Fraudulent home claims violate these Terms and may result in account suspension and notification to relevant parties.
          </p>
        </TermsSection>

        <TermsSection title="8. Safety and moderation">
          <p>
            Pantopus includes tools for reporting harmful content, disputing verification claims, and flagging unsafe behavior. We take these reports seriously and investigate them to the best of our ability.
          </p>
          <p>
            Verification and trust signals help communities function, but Pantopus cannot guarantee the identity, intentions, or behavior of every user in every interaction. Please use good judgment and report problems through the platform.
          </p>
        </TermsSection>

        <TermsSection title="9. Termination">
          <p>
            You may close your account at any time from account settings or by contacting us.
          </p>
          <p>
            We may suspend or terminate your account if you violate these Terms, harm other users, or engage in activity that damages the community or platform. We will make reasonable efforts to notify you when possible, except in cases of urgent safety concerns.
          </p>
        </TermsSection>

        <TermsSection title="10. Disclaimers">
          <p>
            Pantopus is provided &quot;as is&quot; without warranties of any kind, to the maximum extent permitted by applicable law. We do not warrant that the platform will be uninterrupted, error-free, or meet every requirement you may have.
          </p>
          <p>
            We are not liable for the actions of other users, the outcome of gig transactions, or content posted by third parties on the platform.
          </p>
        </TermsSection>

        <TermsSection title="11. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Pantopus and its affiliates will not be liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.
          </p>
        </TermsSection>

        <TermsSection title="12. Changes to these Terms">
          <p>
            We may update these Terms as the platform evolves. When we make material changes, we will notify you through the platform or by email with reasonable advance notice. Continued use of Pantopus after the effective date constitutes acceptance of the updated Terms.
          </p>
        </TermsSection>

        <TermsSection title="13. Contact">
          <p>
            Questions about these Terms? Reach us at{' '}
            <a href="mailto:support@pantopus.com" className="text-rose-600 dark:text-rose-400 hover:underline font-medium">
              support@pantopus.com
            </a>
          </p>
          <p>
            For privacy or data-related questions, see our{' '}
            <Link href="/privacy" className="text-rose-600 dark:text-rose-400 hover:underline">
              Privacy Policy
            </Link>{' '}
            or contact{' '}
            <a href="mailto:privacy@pantopus.com" className="text-rose-600 dark:text-rose-400 hover:underline">
              privacy@pantopus.com
            </a>.
          </p>
        </TermsSection>

      </section>

      <SiteFooter />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-app-border-subtle pt-10">
      <h2 className="text-2xl font-bold text-app-text dark:text-white mb-5">{title}</h2>
      <div className="space-y-4 text-app-text-secondary dark:text-app-text-muted leading-relaxed text-base">
        {children}
      </div>
    </div>
  );
}

function TermsList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="text-rose-400 mt-1.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span>{item}</span>
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
