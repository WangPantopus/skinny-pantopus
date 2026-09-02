'use client';

// Residency verification — submitted. The truthful waiting screen for the
// instant door: a person reviews it, usually within hours.

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Hourglass, Mail, Upload } from 'lucide-react';

export default function VerifyResidencySubmittedPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const homeId = params?.id ?? '';
  const returnQuery = searchParams?.get('return') === 'place' ? '?return=place' : '';
  const backHref = returnQuery ? '/app/place' : `/app/homes/${homeId}/dashboard`;

  return (
    <div className="min-h-screen bg-app-surface-raised">
      <main className="max-w-xl mx-auto px-4 py-12">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-app-text-secondary hover:text-app-text mb-8">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center mb-6">
            <Hourglass className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-app-text mb-3">A person is reviewing your document</h1>
          <p className="text-app-text-secondary text-base leading-relaxed mb-2 max-w-sm">
            Usually within hours, always within a business day. You&apos;ll get a notification the moment it&apos;s
            decided, and everything you have now stays available while you wait.
          </p>
          <p className="text-sm text-app-text-muted mb-10">Your document is seen by one reviewer, never by neighbors, and deleted once your claim is decided.</p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={() => router.push(`/app/homes/${homeId}/verify-residency${returnQuery}`)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold"
            >
              <Upload className="w-4 h-4" />
              Add another document
            </button>
            <button
              type="button"
              onClick={() => router.push(`/app/homes/${homeId}/verify-postcard${returnQuery}`)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-app-border text-app-text font-medium hover:bg-app-surface-sunken"
            >
              <Mail className="w-4 h-4" />
              Also mail me a code
            </button>
            <Link href={backHref} className="flex items-center justify-center py-3 px-4 text-sm text-app-text-secondary hover:text-app-text">
              Back to your place
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
