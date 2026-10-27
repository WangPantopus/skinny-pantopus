import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'Identity check sent · Pantopus', robots: { index: false } };

/**
 * Where Stripe sends someone who started their claim's identity check in the iOS or
 * Android app (the app opened Stripe in its own browser). Nothing here reads the
 * check; the app does that when they come back.
 */
export default function IdentityCheckDonePage() {
  return (
    <main className="min-h-screen bg-app-surface-raised flex items-center justify-center px-4 py-12">
      <div className="max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-emerald-700 dark:text-emerald-300" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-app-text mb-3">Your ID is on its way</h1>
        <p className="text-app-text-secondary leading-relaxed">
          Close this window and go back to Pantopus. Your claim shows when your identity is confirmed,
          usually within a few minutes.
        </p>
      </div>
    </main>
  );
}
