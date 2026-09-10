'use client';

import { useEffect, useRef, useState } from 'react';
import { claimEvidence, onTokenChange, AUTH_SESSION_CHANGE_KEY, type ClaimEvidenceSession } from '@pantopus/api';

export default function ClaimEvidenceReview({ scope, evidenceId, reviewToken, platformAdmin = false, alreadyVerified = false, onVerified }: {
  scope: ClaimEvidenceSession; evidenceId: string; reviewToken: string; platformAdmin?: boolean; alreadyVerified?: boolean; onVerified: () => Promise<void>;
}) {
  const opening = useRef({ scope, evidenceId, reviewToken });
  const [viewer, setViewer] = useState<string | null>(null);
  const [inspection, setInspection] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const identity = JSON.stringify([scope, evidenceId, reviewToken]);
  const isOpening = !retired && JSON.stringify([opening.current.scope, opening.current.evidenceId, opening.current.reviewToken]) === identity;
  useEffect(() => () => { generation.current++; }, [identity]);
  useEffect(() => {
    const invalidate = () => { generation.current++; setRetired(true); setViewer(null); setInspection(null); };
    const unsubscribe = onTokenChange(invalidate);
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === AUTH_SESSION_CHANGE_KEY) invalidate(); };
    window.addEventListener('storage', changed);
    return () => { unsubscribe(); window.removeEventListener('storage', changed); };
  }, []);
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer); }, [viewer]);
  const inspect = async () => {
    if (inFlight.current || !isOpening) return;
    inFlight.current = true; setBusy(true); setError(''); setInspection(null); setConfirmed(false);
    const request = generation.current;
    try {
      const result = alreadyVerified
        ? { bytes: await claimEvidence.readClaimEvidence(scope, evidenceId, platformAdmin), inspection: null }
        : await claimEvidence.inspectClaimEvidence(scope, evidenceId, reviewToken, platformAdmin);
      if (request !== generation.current) return;
      setViewer(URL.createObjectURL(result.bytes)); setInspection(result.inspection);
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : 'Could not open the document. Retry.');
    } finally { if (request === generation.current) { inFlight.current = false; setBusy(false); } }
  };
  const verify = async () => {
    if (inFlight.current || !isOpening || alreadyVerified || !inspection || !confirmed) return;
    inFlight.current = true; setBusy(true); setError('');
    const request = generation.current;
    try {
      await claimEvidence.verifyClaimEvidence(scope, evidenceId, reviewToken, inspection, platformAdmin);
      if (request !== generation.current) return;
      await onVerified();
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : 'Could not confirm the evidence review. Retry.');
    } finally { if (request === generation.current) { inFlight.current = false; setBusy(false); } }
  };
  if (!isOpening) return <p role="alert">Your review context changed. Reopen the claim.</p>;
  return <div className="space-y-2">
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" disabled={busy} onClick={() => void inspect()} className="underline text-sm">Open private document</button>
    {viewer && <div className="space-y-2">
      <iframe src={viewer} sandbox="" title="Private claim evidence" className="w-full h-80 border rounded" />
      {!alreadyVerified && <>
      <p className="text-xs">Check that this document supports the stated claim and address. This verifies one evidence item; claim approval is separate.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy}
        onChange={event => setConfirmed(event.target.checked)} />I inspected this document and confirm it supports this claim.</label>
      <button type="button" disabled={busy || !confirmed || !inspection} onClick={() => void verify()}
        className="rounded border px-3 py-2 disabled:opacity-50">Confirm evidence verification</button>
      </>}
    </div>}
  </div>;
}
