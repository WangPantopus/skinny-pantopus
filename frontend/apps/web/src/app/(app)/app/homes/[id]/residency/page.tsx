'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useResidencyProgress } from '@/components/homes/useResidencyProgress';
import { residencyRequestLabel, residencyReviewLabel } from '@/components/homes/residencyProgressModel';

const guidance = {
  home: { title: 'You’re part of this household', body: 'Open the Home to see your household. What you can see and change depends on your role.' },
  household_review: { title: 'Waiting for household review', body: 'Someone in the household will review your request. You don’t need to upload any documents. Check back here for their answer.' },
  address_verification: { title: 'Your address isn’t verified yet', body: 'Your request is saved. To finish, verify your address by mail: request a postcard, then enter the code printed on it.' },
  resubmit: { title: 'Send your request again', body: 'Check the street, apartment and how you live here, then send your request again.' },
  access_review: { title: 'You don’t have household access', body: 'To come back, add this Home again or ask someone in the household to invite you.' },
  ownership_verification: { title: 'Continue ownership verification', body: 'Ownership has its own review. Meanwhile, you can verify your address by mail to use this Home. That doesn’t make you an owner.' },
  unavailable: { title: 'This Home can’t be verified right now', body: 'This Home isn’t accepting changes right now. Your request is still saved.' },
};

export default function ResidencyStatusPage() {
  const { id: homeId } = useParams<{ id: string }>();
  const { progress, loading, error, refresh } = useResidencyProgress(homeId);
  const needsRequest = progress?.next_step === 'address_verification' && progress.request === null;
  const next = progress ? needsRequest ? {
    title: 'Confirm your address',
    body: 'Check this Home’s address, apartment and how you live here, then send your request. We don’t mail anything until you ask for a postcard.',
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
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">Your request</p>
          <p className="mt-2 break-words text-lg font-semibold text-app-text">{residencyRequestLabel(progress.request)}</p>
          <p className="mt-3 text-sm text-app-text-secondary">{residencyReviewLabel(progress.request.status)}</p>
          {progress.request.created_at && <p className="mt-1 text-sm text-app-text-secondary">Submitted {new Date(progress.request.created_at).toLocaleDateString()}</p>}
        </section>}
        <section className="rounded-xl border border-app-border bg-app-surface p-5" aria-label="Current next step">
          <h2 className="text-lg font-semibold text-app-text">{next.title}</h2>
          <p className="mt-2 text-sm leading-6 text-app-text-secondary">{next.body}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {progress.next_step === 'home' && <Link href={`/app/homes/${homeId}/dashboard`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Open Home</Link>}
            {progress.next_step === 'resubmit' && <Link href={`/app/homes/new?joinHome=${homeId}`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Check address and send again</Link>}
            {needsRequest && <Link href={`/app/homes/new?joinHome=${homeId}`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Check address</Link>}
            {progress.next_step === 'address_verification' && !needsRequest && <Link href={`/app/homes/${homeId}/verify-postcard`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Verify by mail</Link>}
            {progress.next_step === 'ownership_verification' && <Link href={`/app/homes/${homeId}/claim-owner/evidence`} className="rounded-lg bg-app-text px-4 py-2 font-semibold text-app-surface">Continue ownership verification</Link>}
            {/* While ownership waits, a pending owner can still prove the address by mail (founder decision, 2026-10-06). */}
            {progress.next_step === 'ownership_verification' && <Link href={`/app/homes/${homeId}/verify-postcard`} className="rounded-lg border border-app-border px-4 py-2 font-semibold text-app-text">Verify by mail</Link>}
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
