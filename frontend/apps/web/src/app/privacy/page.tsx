import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /privacy
// frontend/apps/web/src/app/privacy/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
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
            Your data, your control
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-6">
            Privacy Policy
          </h1>
          <p className="text-xl text-app-text-secondary dark:text-app-text-muted leading-relaxed max-w-2xl mx-auto mb-4">
            We built Pantopus around real homes and real people, so we treat privacy as a default — not a setting you have to hunt for.
          </p>
          <p className="text-sm text-app-text-muted dark:text-app-text-secondary">
            Last updated: February 2026
          </p>
        </div>
      </section>

      {/* Plain-English Summary */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
            <span>📋</span> The short version
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '📦', label: 'Minimum data', text: 'We collect only what we need to run the platform.' },
              { icon: '🔒', label: 'Private by default', text: 'Household and home information stays private unless you choose otherwise.' },
              { icon: '🚫', label: 'No selling', text: 'We do not sell your personal data. Ever.' },
            ].map(({ icon, label, text }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-indigo-900 dark:text-indigo-200 text-sm">{label}</p>
                  <p className="text-indigo-800/80 dark:text-indigo-300/80 text-sm mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policy content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12">

        <PolicySection title="1. Who we are">
          <p>
            Pantopus is a real-world network that connects verified people, homes, local work, businesses, and Beacons. We are the data controller for information collected through Pantopus.
          </p>
          <p>
            For privacy questions, contact us at{' '}
            <a href="mailto:privacy@pantopus.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              privacy@pantopus.com
            </a>.
          </p>
        </PolicySection>

        <PolicySection title="2. What we collect">
          <p>We collect the minimum data needed to operate the platform and keep communities safe. Here is what that includes:</p>
          <PolicyList items={[
            { label: 'Account information', detail: 'Name, email address or phone number, and profile details you choose to provide (bio, photo, skills, interests).' },
            { label: 'Content you create', detail: 'Posts, messages, gig listings, offers, reviews, and any files you upload.' },
            { label: 'Home and residency information (optional)', detail: 'If you claim or join a home, we collect address details and residency relationship (owner, tenant, etc.) used for home features and mailbox routing. Your precise address is not publicly displayed.' },
            { label: 'Location data (optional)', detail: 'General location for map and local discovery features, only if you grant permission. You can use most features without sharing precise location.' },
            { label: 'Usage and device data', detail: 'Basic analytics such as feature usage patterns, device type, and error logs used to improve reliability and prevent abuse.' },
            { label: 'Payment information', detail: 'If you use gig payments or wallet features, payment details are handled through our payment provider (Stripe). We do not store full card numbers.' },
          ]} />
        </PolicySection>

        <PolicySection title="3. How we use your information">
          <PolicyList items={[
            { label: 'Core features', detail: 'Powering the Pulse, gig marketplace, messaging, home management tools, mailbox, and business profiles.' },
            { label: 'Verification and trust', detail: 'Confirming residency, calculating reliability scores, and surfacing verified signals to other users appropriately.' },
            { label: 'Safety and moderation', detail: 'Detecting fraud, preventing abuse, enforcing community standards, and responding to reports.' },
            { label: 'Product improvement', detail: 'Understanding how features are used so we can make the platform more reliable and useful.' },
            { label: 'Communications', detail: 'Sending you notifications, important updates, and (with your consent) relevant product announcements.' },
          ]} />
        </PolicySection>

        <PolicySection title="4. How sharing works">
          <p>
            This is the most important section for a real-world trust platform, so we want to be clear.
          </p>
          <div className="space-y-4 mt-4">
            <div className="bg-app-surface-raised/60 border border-app-border-subtle rounded-xl p-5">
              <p className="font-semibold text-app-text dark:text-white text-sm mb-1">Your address is not publicly displayed by default.</p>
              <p className="text-app-text-secondary dark:text-app-text-muted text-sm">Home claim and residency information is used internally for routing and feature access. Neighborhood-level presence (e.g., posts shown as &quot;nearby&quot;) does not reveal your exact address.</p>
            </div>
            <div className="bg-app-surface-raised/60 border border-app-border-subtle rounded-xl p-5">
              <p className="font-semibold text-app-text dark:text-white text-sm mb-1">Audience controls are yours to set.</p>
              <p className="text-app-text-secondary dark:text-app-text-muted text-sm">When you post, you choose the audience: Nearby, Followers, Household, or Connections. Household posts are only visible to verified household members.</p>
            </div>
            <div className="bg-app-surface-raised/60 border border-app-border-subtle rounded-xl p-5">
              <p className="font-semibold text-app-text dark:text-white text-sm mb-1">We do not sell your data.</p>
              <p className="text-app-text-secondary dark:text-app-text-muted text-sm">We do not sell, rent, or trade your personal information to third parties for advertising or any commercial purpose.</p>
            </div>
            <div className="bg-app-surface-raised/60 border border-app-border-subtle rounded-xl p-5">
              <p className="font-semibold text-app-text dark:text-white text-sm mb-1">Third-party service providers.</p>
              <p className="text-app-text-secondary dark:text-app-text-muted text-sm">We use trusted vendors (e.g., Stripe for payments, Supabase for database infrastructure) who process data on our behalf and are bound by data processing agreements.</p>
            </div>
          </div>
        </PolicySection>

        <PolicySection title="5. Data retention">
          <p>
            We keep your data for as long as your account is active and as needed to provide services, comply with legal obligations, resolve disputes, and enforce agreements.
          </p>
          <p>
            When you delete your account, we begin the process of removing your personal information from our systems. Some data may be retained in anonymized or aggregated form for platform safety and analytics purposes.
          </p>
        </PolicySection>

        <PolicySection title="6. Your rights and choices">
          <PolicyList items={[
            { label: 'Update your profile', detail: 'Edit or remove profile details, bio, skills, and interests at any time from account settings.' },
            { label: 'Control post audiences', detail: 'Every post lets you choose exactly who can see it: Nearby, Followers, Household, or Connections.' },
            { label: 'Location permissions', detail: 'Grant or revoke location access from your device settings at any time.' },
            { label: 'Request your data', detail: 'You can request a copy of the personal data we hold about you.' },
            { label: 'Request deletion', detail: 'You can request account deletion and removal of associated personal data.' },
          ]} />
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@pantopus.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              privacy@pantopus.com
            </a>.
          </p>
        </PolicySection>

        <PolicySection title="7. Children's privacy">
          <p>
            Pantopus is not directed at children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will promptly delete it.
          </p>
        </PolicySection>

        <PolicySection title="8. Changes to this policy">
          <p>
            We may update this Privacy Policy as our features evolve. When we make material changes, we will notify you through the platform or by email. Continued use of Pantopus after a change constitutes acceptance of the updated policy.
          </p>
        </PolicySection>

        <PolicySection title="9. Contact">
          <p>
            For privacy-related questions, data requests, or concerns, reach us at:{' '}
            <a href="mailto:privacy@pantopus.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              privacy@pantopus.com
            </a>
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
