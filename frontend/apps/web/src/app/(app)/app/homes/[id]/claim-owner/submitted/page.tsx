'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Hourglass, ShieldCheck, Upload, Users } from 'lucide-react';

export default function ClaimSubmittedPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const homeId = params.id as string;
  const showParallelNotice = searchParams.get('parallel') === '1';
  const showChallengeNotice = searchParams.get('challenge') === '1';

  return (
    <div className="min-h-screen bg-app-surface-raised">
      <main className="max-w-xl mx-auto px-4 py-12">
        <Link
          href={`/app/homes/${homeId}/dashboard`}
          className="inline-flex items-center gap-1 text-sm text-app-text-secondary hover:text-app-text mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center mb-6">
            <Hourglass className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-app-text mb-3">Status: Under review</h1>
          <p className="text-app-text-secondary text-base leading-relaxed mb-2 max-w-sm">
            We&apos;re verifying ownership for this address. You&apos;ll be notified when complete.
          </p>
          <p className="text-sm text-app-text-muted mb-10">Reviews may require additional documentation.</p>

          {showParallelNotice ? (
            <div className="w-full max-w-md flex gap-3 p-4 mb-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-left">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-100">
                Another claimant is also in progress for this address. Your evidence stays attached to your claim only.
              </p>
            </div>
          ) : null}

          {showChallengeNotice ? (
            <div className="w-full max-w-md flex gap-3 p-4 mb-8 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-left">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                Your ownership proof opened a challenge against the current household verification. Sensitive ownership actions stay restricted while that review is pending.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={() => router.push(`/app/homes/${homeId}/claim-owner/evidence`)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold"
            >
              <Upload className="w-4 h-4" />
              Upload more documents
            </button>
            <Link
              href={`/app/homes/${homeId}/dashboard`}
              className="flex items-center justify-center py-3 px-4 rounded-xl border border-app-border text-app-text font-medium hover:bg-app-surface-sunken"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
