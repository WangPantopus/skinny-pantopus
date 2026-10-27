'use client';

import { CheckCircle2, Clock, Circle, IdCard, FileText } from 'lucide-react';
import type { ClaimReviewApproval } from '@pantopus/api';

/** One line for a disabled Approve: what approval is still waiting for. */
export function approvalBlockedReason(approval: ClaimReviewApproval): string | null {
  if (approval.can_approve) return null;
  const identity = !approval.identity_confirmed;
  const proof = approval.proof !== 'verified';
  if (identity && proof) return 'Can’t approve yet: the claimant hasn’t confirmed their identity, and no document has been checked.';
  if (identity) return 'Can’t approve yet: the claimant hasn’t confirmed their identity.';
  return approval.proof === 'pending'
    ? 'Can’t approve yet: check the claimant’s document first.'
    : 'Can’t approve yet: the claimant hasn’t uploaded a document.';
}

function identityLine(approval: ClaimReviewApproval): { done: boolean; waiting: boolean; title: string; detail: string } {
  if (approval.identity_confirmed) {
    return { done: true, waiting: false, title: 'Identity confirmed by Stripe',
      detail: approval.identity_name ? `Name on ID: ${approval.identity_name}. Compare it with the document.` : 'Compare the claimant’s name with the document.' };
  }
  switch (approval.identity) {
    case 'processing': return { done: false, waiting: true, title: 'Identity check in progress', detail: 'Stripe is checking the claimant’s ID.' };
    case 'requires_input': return { done: false, waiting: false, title: 'Identity check didn’t pass', detail: 'The claimant can try again.' };
    case 'started': return { done: false, waiting: false, title: 'Identity not confirmed', detail: 'The claimant started the ID check but hasn’t finished.' };
    default: return { done: false, waiting: false, title: 'Identity not confirmed', detail: 'The claimant hasn’t done the ID check yet. They’re asked to on their claim.' };
  }
}

function proofLine(approval: ClaimReviewApproval): { done: boolean; waiting: boolean; title: string; detail: string } {
  if (approval.proof === 'verified') return { done: true, waiting: false, title: 'Document checked', detail: 'A reviewer verified an ownership document.' };
  if (approval.proof === 'pending') return { done: false, waiting: true, title: 'Document waiting for your check', detail: 'Open the document below and verify it.' };
  return { done: false, waiting: false, title: 'No document yet', detail: 'The claimant is asked to upload one.' };
}

/** What approval needs (a confirmed identity and a checked document), as the reviewer sees it. */
export default function ClaimReviewApprovalPanel({ approval }: { approval: ClaimReviewApproval }) {
  const rows = [
    { key: 'identity', icon: IdCard, line: identityLine(approval) },
    { key: 'proof', icon: FileText, line: proofLine(approval) },
  ];
  return (
    <section data-testid="claim-review-approval">
      <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-2">Before you approve</h3>
      <div className="bg-app-surface border border-app-border rounded-xl divide-y divide-app-border">
        {rows.map(({ key, icon: Icon, line }) => (
          <div key={key} className="flex items-start gap-3 p-3">
            <Icon className="w-5 h-5 text-app-text-muted flex-shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text">{line.title}</p>
              <p className="text-xs text-app-text-secondary mt-0.5">{line.detail}</p>
            </div>
            {line.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-label="Done" />
              : line.waiting ? <Clock className="w-5 h-5 text-sky-600 flex-shrink-0" aria-label="Waiting" />
                : <Circle className="w-5 h-5 text-app-text-muted flex-shrink-0" aria-label="Not done" />}
          </div>
        ))}
      </div>
    </section>
  );
}
