'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useResidencyProgress } from '@/components/homes/useResidencyProgress';
import { residencyRequestLabel, residencyReviewLabel } from '@/components/homes/residencyProgressModel';

const guidance = {
  home: { title: 'Household access is available', body: 'Your current access allows you to open this Home. Your role and permissions still apply.' },
  household_review: { title: 'Waiting for household review', body: 'Your request is saved for a household reviewer. You do not need to upload an ownership document for this step. Refresh to check for a decision.' },
  address_verification: { title: 'Address verification is required', body: 'Saving a request does not verify residency or request a postcard. Review mail verification to check for an existing code request and its delivery status.' },
  resubmit: { title: 'Review your request', body: 'Check your address, apartment and relationship before submitting again. A new request does not restore previous household access.' },
  access_review: { title: 'Household access needs review', body: 'The saved residency record does not grant current household access. A household reviewer must resolve your access before it can be restored.' },
  ownership_verification: { title: 'Continue ownership verification', body: 'Your ownership request has a separate review. Residency verification cannot grant or restore ownership.' },
  unavailable: { title: 'Verification is unavailable for this Home', body: 'Your personal request remains visible. This Home cannot continue the verification flow right now.' },
};

export default function ResidencyStatusPage() {
  const { id: homeId } = useParams<{ id: string }>();
  const { progress, loading, error, refresh } = useResidencyProgress(homeId);
  const needsRequest = progress?.next_step === 'address_verification' && progress.request === null;
  const next = progress ? needsRequest ? {
    title: 'Request residency review',
    body: 'Confirm this Home’s address, apartment and your relationship before submitting a residency request. Checking an address does not grant household access or send mail.',
  } : guidance[progress.next_step] : null;
  return <main className="mx-auto max-w-lg px-4 py-6 pb-28">
    <Link href="/app/homes" className="inline-block rounded-lg py-2 text-sm font-semibold text-app-text-secondary">← My Homes</Link>
    <h1 className="mt-3 text-2xl font-semibold text-app-text">Residency status</h1>
    {loading ? <p role="status" className="mt-6 text-app-text-secondary">Checking your current status…</p>
      : error ? <div role="alert" className="mt-6 rounded-xl border border-app-border p-5">
        <p className="text-app-text">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-4 rounded-lg border border-app-border px-4 py-2 font-semibold">Retry</button>
      </div> : progress && next && <div className="mt-6 space-y-5">
        {progress.request && <section className="rounded-xl border border-app-border bg-app-surface p-5" aria-label="Your saved request">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">Address from your request</p>
          <p className="mt-2 break-words text-lg font-semibold text-app-text">{residencyRequestLabel(progress.request)}</p>
          <p className="mt-3 text-sm text-app-text-secondary">{residencyReviewLabel(progress.request.status)}</p>
          {progress.request.created_at && <p className="mt-1 text-sm text-app-text-secondary">Submitted {new Date(progress.request.created_at).toLocaleDateString()}</p>}
          <p className="mt-3 text-sm text-app-text-secondary">A saved review and current household access are separate.</p>
        </section>}
        <section className="rounded-xl border border-app-border bg-app-surface p-5" aria-label="Current next step">
          <h2 className="text-lg font-semibold text-app-text">{next.title}</h2>
          <p className="mt-2 text-sm leading-6 text-app-text-secondary">{next.body}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {progress.next_step === 'home' && <Link href={`/app/homes/${homeId}/dashboard`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Open Home</Link>}
            {progress.next_step === 'resubmit' && <Link href={`/app/homes/new?joinHome=${homeId}`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Check address and resubmit</Link>}
            {needsRequest && <Link href={`/app/homes/new?joinHome=${homeId}`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Check address and request residency</Link>}
            {progress.next_step === 'address_verification' && !needsRequest && <Link href={`/app/homes/${homeId}/verify-postcard`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Review mail verification</Link>}
            {progress.next_step === 'ownership_verification' && <Link href={`/app/homes/${homeId}/claim-owner/evidence`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Ownership verification</Link>}
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-app-border px-4 py-2 font-semibold text-app-text">Refresh status</button>
          </div>
        </section>
        {progress.current_access === 'private_setup' && <section className="rounded-xl border border-app-border p-5">
          <h2 className="font-semibold text-app-text">Your private tasks are available</h2>
          <p className="mt-2 text-sm text-app-text-secondary">You can organize your own tasks while verification is pending.</p>
          <Link href={`/app/homes/${homeId}/tasks`} className="mt-3 inline-block rounded-lg border border-app-border px-4 py-2 font-semibold">My tasks</Link>
        </section>}
      </div>}
  </main>;
}
