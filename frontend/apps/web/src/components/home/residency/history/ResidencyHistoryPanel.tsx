'use client';
import Link from 'next/link';
import { useHistory } from './useHistory';
import { historyPath, historyRoles, type HistoryItem } from './historyModel';

const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const claimStatus = { pending: 'Waiting for household review', verified: 'Review recorded', rejected: 'Rejected' };
function Decision({ item, detailed = false }: { item: HistoryItem; detailed?: boolean }) {
  const { decision, current } = item;
  return <article aria-label={`${decision.action === 'approve' ? 'Approved' : 'Rejected'} residency request`}
    className="space-y-4 rounded-xl border border-app-border bg-app-surface p-4 sm:p-5">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{decision.action === 'approve' ? 'Approved residency request' : 'Rejected residency request'}</h2>
      <p className="text-sm text-app-text-secondary">Recorded <time dateTime={decision.created_at}>{formatDate(decision.created_at)}</time></p>
      {decision.result.role_base && <p className="text-sm">Role recorded: {historyRoles[decision.result.role_base]}</p>}
    </div>
    <div className="space-y-1 border-t border-app-border pt-3 text-sm">
      <h3 className="font-medium">Request at last check</h3>
      {current.applicant?.username
        ? <p className="break-words">Current applicant: @{current.applicant.username}</p>
        : <p>Applicant name unavailable. Claim reference: {decision.claim_id.slice(-8)}</p>}
      <p>{claimStatus[current.claim_status]}</p>
      <p className="text-app-text-secondary">This recorded decision does not confirm current household access.</p>
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
      {!detailed && <Link href={historyPath(decision.home_id, decision.id)} prefetch={false}
        className="inline-flex min-h-11 items-center font-medium text-blue-700 underline">View decision</Link>}
      <Link href={`/app/homes/${decision.home_id}/owners/review-claim/residency?claimId=${encodeURIComponent(decision.claim_id)}`}
        prefetch={false} className="inline-flex min-h-11 items-center font-medium text-blue-700 underline">Check current request</Link>
    </div>
  </article>;
}
export function ResidencyHistoryPanel({ homeId, receiptId = null }: { homeId: string; receiptId?: string | null }) {
  const history = useHistory(homeId, receiptId);
  const button = 'min-h-11 rounded-lg border border-app-border px-4 py-2 text-sm font-medium disabled:opacity-50';
  return <main aria-label="Your residency decisions" className="mx-auto max-w-3xl space-y-5 px-4 py-8 text-app-text">
    <Link href={receiptId ? historyPath(homeId) : `/app/homes/${homeId}/owners/review-claim?tab=residency`}
      prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">
      {receiptId ? 'Back to your decisions' : 'Back to residency claims'}</Link>
    <h1 className="text-2xl font-semibold">{receiptId ? 'Your recorded residency decision' : 'Your residency decisions'}</h1>
    <p className="text-sm text-app-text-secondary">Past decisions you made for this Home. The applicant and request status may have changed since your decision.</p>
    <div className="flex flex-wrap items-center gap-3">
      <Link href={`/app/homes/${homeId}/owners/review-claim/residency`} prefetch={false}
        className="inline-flex min-h-11 items-center text-sm text-blue-700 underline">Recover an unfinished decision</Link>
      {history.phase === 'ready' && <button className={button} disabled={history.busy} onClick={history.refresh}>Refresh decisions</button>}
    </div>
    {history.phase === 'loading' && <p role="status">Checking current access and your decisions…</p>}
    {history.phase === 'error' && <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p>{history.error}</p><button className={button} onClick={history.refresh}>Retry loading decisions</button>
    </div>}
    {history.phase === 'ready' && <>
      {receiptId && history.detail ? <Decision item={history.detail} detailed />
        : !receiptId && history.items.length === 0 ? <p>You have no recorded residency decisions for this Home.</p>
          : <div className="space-y-4">{history.items.map(item => <Decision key={item.decision.id} item={item} />)}</div>}
      {history.hasMore && <button className={button} disabled={history.busy} onClick={() => void history.loadMore()}>
        {history.busy ? 'Loading older decisions…' : 'Load older decisions'}</button>}
      {history.busy && <p role="status">Checking current access and loading older decisions…</p>}
    </>}
  </main>;
}
