import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Pantopus — /delete-account
// How to delete an account, and what is deleted or kept (the "Delete account
// URL" Google Play's Data safety form asks for). The text is the founder-
// approved docs/compliance/account-deletion-page.md; keep the two in step.
// frontend/apps/web/src/app/delete-account/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Delete your Pantopus account',
  description: 'How to delete your Pantopus account in the app or on the web, and what is deleted or kept.',
};

const SUPPORT_EMAIL = 'support@pantopus.com';

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-app-surface">
      <SiteNav />

      <main>
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-app-text dark:text-white leading-tight tracking-tight mb-6">
            Delete your Pantopus account
          </h1>
          <p className="text-xl text-app-text-secondary dark:text-app-text-muted leading-relaxed">
            You can delete your account yourself in the Pantopus app or on the web.
          </p>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12 pt-4">
          <PolicySection title="How to delete it">
            <PolicyList items={[
              { label: 'In the app (iPhone or Android)', detail: 'Open the menu, tap Profile & Privacy, then Delete account at the bottom, and confirm with your password.' },
              { label: 'On the web', detail: 'Sign in at pantopus.com, open your profile settings and choose Delete Account, then confirm.' },
            ]} />
            <p>Deletion is permanent.</p>
            <p>
              If you can&apos;t sign in, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:decoration-2 font-medium">
                {SUPPORT_EMAIL}
              </a>{' '}
              from the address on your account and we&apos;ll help you delete it.
            </p>
          </PolicySection>

          <PolicySection title="Before you can delete">
            <PlainList items={[
              'Finish or cancel any task that is in progress, including tasks you’re helping with.',
              'Let any payment that is still being processed or held finish.',
              'If you own a home where other people still live, hand ownership to one of them first.',
              `If your account has payment history, contact ${SUPPORT_EMAIL} to close it. We keep records of completed payments where the law requires it.`,
            ]} />
          </PolicySection>

          <PolicySection title="What we delete">
            <PlainList items={[
              'Your profile, sign-in and devices.',
              'Your posts, comments and the messages you sent.',
              'Your Support Train sign-ups: open ones are cancelled so organizers can fill the slot.',
              'Homes only you used: a home in private setup is deleted; if you were its last member, its household records are removed too.',
            ]} />
          </PolicySection>

          <PolicySection title="What stays">
            <PlainList items={[
              'Homes where other people still live keep their shared household records, without your name.',
              'Records of completed payments that the law requires us to keep.',
            ]} />
            <p>
              More about the data we keep and why is in our{' '}
              <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:decoration-2 font-medium">
                Privacy Policy
              </Link>.
            </p>
          </PolicySection>
        </section>
      </main>

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
        <li key={label}>
          <span className="font-semibold text-app-text dark:text-white">{label}: </span>
          {detail}
        </li>
      ))}
    </ul>
  );
}

function PlainList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
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
            <LayoutDashboard className="w-7 h-7 text-primary-600" aria-hidden="true" />
            <span className="text-xl font-bold tracking-tight text-primary-700 dark:text-primary-400">Pantopus</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-app-text-strong hover:text-primary-700 dark:hover:text-primary-300 px-3 py-2 transition">Log in</Link>
        </div>
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-6 justify-between text-sm">
        <p>&copy; 2026 Pantopus. All rights reserved.</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
          <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
          <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
        </ul>
      </div>
    </footer>
  );
}
