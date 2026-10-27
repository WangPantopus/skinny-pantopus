'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Clock, IdCard, FileText, AlertCircle } from 'lucide-react';
import * as api from '@pantopus/api';
import type { ClaimApprovalProgress } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { failureMessage } from '@/components/home/share/shareFailure';

type Tone = 'done' | 'todo' | 'waiting' | 'retry';

/** The identity step: why the claim waits on it and what the claimant does next. */
export function identityStep(approval: ClaimApprovalProgress): { tone: Tone; title: string; detail: string; action: string | null } {
  if (approval.identity === 'verified') {
    return { tone: 'done', title: 'Identity confirmed', detail: 'Stripe checked your ID and selfie.', action: null };
  }
  if (approval.identity === 'processing') {
    return { tone: 'waiting', title: 'Checking your ID', detail: 'Stripe is checking your ID and selfie. This usually takes a few minutes.', action: null };
  }
  if (!approval.identity_check_available) {
    return { tone: 'todo', title: 'Identity confirmation', detail: 'A Pantopus reviewer confirms who you are before approving your claim.', action: null };
  }
  if (approval.identity === 'requires_input') {
    return { tone: 'retry', title: 'Your ID check didn’t go through', detail: 'Try again with a clear photo of your ID and your face in good light.', action: 'Try again' };
  }
  if (approval.identity === 'started') {
    return { tone: 'todo', title: 'Finish confirming your identity', detail: 'Pick up where you left off: a photo of your ID and a selfie.', action: 'Continue' };
  }
  return { tone: 'todo', title: 'Confirm your identity', detail: 'Take a photo of your driver’s license, passport or ID card and a selfie. Stripe, our identity partner, checks them.', action: 'Confirm identity' };
}

/** The document step, in the claim's own words (ownership or residency). */
export function proofStep(approval: ClaimApprovalProgress, residency: boolean): { tone: Tone; title: string; detail: string; action: string | null } {
  if (approval.proof === 'verified') {
    return { tone: 'done', title: 'Document checked', detail: 'A Pantopus reviewer checked your document.', action: null };
  }
  if (approval.proof === 'pending') {
    return { tone: 'waiting', title: 'Document waiting for review', detail: 'A Pantopus reviewer will check it.', action: null };
  }
  return residency
    ? { tone: 'todo', title: 'Upload proof you live here', detail: 'A lease or utility bill with your name and this address.', action: 'Upload document' }
    : { tone: 'todo', title: 'Upload proof you own this home', detail: 'A deed, closing disclosure or property tax bill with your name and this address.', action: 'Upload document' };
}

/** A short label for what the claim is waiting on. */
export function approvalSummary(approval: ClaimApprovalProgress): string {
  const identityDone = approval.identity === 'verified';
  const proofDone = approval.proof === 'verified';
  if (identityDone && proofDone) return 'Waiting for approval';
  if (!identityDone && approval.proof === 'missing') return 'Identity and document needed';
  if (!identityDone) return approval.identity === 'processing' ? 'Checking your ID' : 'Identity check needed';
  return approval.proof === 'pending' ? 'Document in review' : 'Document needed';
}

/** A claim's chip on My Homes and Place: its kind, then what it is waiting on. */
export function claimStatusLabel(claim: { claim_type: string; approval?: ClaimApprovalProgress | null; has_evidence?: boolean | null }): string {
  const waiting = claim.approval ? approvalSummary(claim.approval)
    : claim.has_evidence === false ? 'Document needed' : claim.has_evidence === true ? 'Under review' : 'Check document status';
  return `${claim.claim_type === 'resident' ? 'Residency claim' : 'Ownership claim'} · ${waiting}`;
}

function StepIcon({ tone }: { tone: Tone }) {
  if (tone === 'done') return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />;
  if (tone === 'waiting') return <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden />;
  if (tone === 'retry') return <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />;
  return <Circle className="w-5 h-5 text-app-text-muted shrink-0" aria-hidden />;
}

/**
 * Why a claim in review isn't approved yet and what the claimant does about it: approval
 * needs a confirmed identity and a document a reviewer checked (the same tests approval uses).
 */
export default function ClaimApprovalChecklist({ homeId, claimId, residency, approval, onUpload }: {
  homeId: string;
  claimId: string;
  residency: boolean;
  approval: ClaimApprovalProgress;
  onUpload: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const identity = identityStep(approval);
  const proof = proofStep(approval, residency);
  const ready = approval.identity === 'verified' && approval.proof === 'verified';

  const startIdentity = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { verification_url: url } = await api.homeOwnership.startClaimIdentityCheck(homeId, claimId);
      // Stripe's page; it brings them back to My Homes when they're done.
      if (url && /^https:\/\//.test(url)) { window.location.assign(url); return; }
      toast.info('Stripe is still checking your ID. Check back in a few minutes.');
    } catch (e: unknown) {
      toast.error(failureMessage(e, 'Your identity check couldn’t start. Please try again.'));
    }
    setStarting(false);
  };

  const steps = [
    { key: 'identity', icon: <IdCard className="w-4 h-4" aria-hidden />, step: identity, onAction: startIdentity, busy: starting },
    { key: 'proof', icon: <FileText className="w-4 h-4" aria-hidden />, step: proof, onAction: onUpload, busy: false },
  ];

  return (
    <div className="mt-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-white/70 dark:bg-app-surface/40 p-4" data-testid="claim-approval-checklist">
      <p className="text-sm font-semibold text-app-text">
        {ready ? 'Everything’s in. A Pantopus reviewer will approve your claim.' : 'Before we can approve your claim'}
      </p>
      <ul className="mt-3 space-y-3">
        {steps.map(({ key, step, onAction, busy }) => (
          <li key={key} className="flex items-start gap-3" data-testid={`claim-approval-${key}`}>
            <StepIcon tone={step.tone} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-app-text">{step.title}</p>
              <p className="text-xs text-app-text-secondary mt-0.5">{step.detail}</p>
            </div>
            {step.action ? (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); void onAction(); }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {busy ? 'Opening…' : step.action}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!ready ? (
        <p className="mt-3 text-xs text-app-text-muted">Then a Pantopus reviewer approves your claim.</p>
      ) : null}
    </div>
  );
}
