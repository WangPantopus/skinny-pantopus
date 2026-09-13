'use client';

import { useEffect, useRef, useState } from 'react';
import { claimEvidence, onTokenChange, AUTH_SESSION_CHANGE_KEY, type ClaimEvidenceSession } from '@pantopus/api';
import PrivateClaimEvidencePreview, { prepareEvidencePreview, type EvidencePreview } from './PrivateClaimEvidencePreview';

function failureDetails(failure: unknown) {
  const value = failure && typeof failure === 'object' ? failure as { message?: unknown; statusCode?: unknown } : {};
  return { message: typeof value.message === 'string' ? value.message : 'Could not confirm this document request. Retry.',
    final: typeof value.statusCode === 'number' && value.statusCode >= 400 && value.statusCode < 500 && ![408, 429].includes(value.statusCode) };
}

export default function ClaimEvidenceReview({ scope, evidenceId, reviewToken, platformAdmin = false, alreadyVerified = false, onVerified }: {
  scope: ClaimEvidenceSession; evidenceId: string; reviewToken: string; platformAdmin?: boolean; alreadyVerified?: boolean; onVerified: () => Promise<void>;
}) {
  const identity = JSON.stringify([scope, evidenceId, reviewToken, platformAdmin, alreadyVerified]);
  const opening = useRef(identity);
  const [viewer, setViewer] = useState<{ preview: EvidencePreview; url: string | null } | null>(null);
  const [inspection, setInspection] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const isOpening = !retired && opening.current === identity;
  const pendingVerification = !viewer && !!inspection && confirmed;
  useEffect(() => {
    if (opening.current !== identity) { setRetired(true); setViewer(null); setInspection(null); setConfirmed(false); }
    return () => { generation.current++; };
  }, [identity]);
  useEffect(() => {
    const invalidate = () => { generation.current++; setRetired(true); setViewer(null); setInspection(null); };
    const unsubscribe = onTokenChange(invalidate);
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === AUTH_SESSION_CHANGE_KEY) invalidate(); };
    window.addEventListener('storage', changed);
    return () => { unsubscribe(); window.removeEventListener('storage', changed); };
  }, []);
  useEffect(() => () => { if (viewer?.url) URL.revokeObjectURL(viewer.url); }, [viewer]);
  const inspect = async () => {
    if (inFlight.current || !isOpening || pendingVerification) return;
    inFlight.current = true; setBusy(true); setError(''); setViewer(null); setInspection(null); setConfirmed(false);
    const request = generation.current;
    try {
      const result = alreadyVerified
        ? { bytes: await claimEvidence.readClaimEvidence(scope, evidenceId, platformAdmin), inspection: null }
        : await claimEvidence.inspectClaimEvidence(scope, evidenceId, reviewToken, platformAdmin);
      if (request !== generation.current) return;
      const preview = await prepareEvidencePreview(result.bytes);
      if (request !== generation.current) return;
      setViewer({ preview, url: preview.kind === 'text' ? null : URL.createObjectURL(preview.bytes) }); setInspection(result.inspection);
    } catch (failure) {
      if (request === generation.current) setError(failureDetails(failure).message);
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
      if (request === generation.current) {
        const details = failureDetails(failure);
        setViewer(null); setError(details.message);
        if (details.final) { setInspection(null); setConfirmed(false); }
      }
    } finally { if (request === generation.current) { inFlight.current = false; setBusy(false); } }
  };
  if (!isOpening) return <p role="alert">Your review context changed. Reopen the claim.</p>;
  return <div className="space-y-2">
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" disabled={busy || pendingVerification} onClick={() => void inspect()} className="underline text-sm">Open private document</button>
    {viewer && <div className="space-y-2">
      <PrivateClaimEvidencePreview key={viewer.url || 'text'} preview={viewer.preview} url={viewer.url} />
      {!alreadyVerified && <>
      <p className="text-xs">Check that this document supports the stated claim and address. This verifies one evidence item; claim approval is separate.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy}
        onChange={event => setConfirmed(event.target.checked)} />I inspected this document and confirm it supports this claim.</label>
      <button type="button" disabled={busy || !confirmed || !inspection} onClick={() => void verify()}
        className="rounded border px-3 py-2 disabled:opacity-50">Confirm evidence verification</button>
      </>}
    </div>}
    {!alreadyVerified && pendingVerification && <div className="space-y-2">
      <p className="text-sm">The verification result was not confirmed. Retry the same decision to check your current access and recover its result.</p>
      <button type="button" disabled={busy} onClick={() => void verify()} className="rounded border px-3 py-2 disabled:opacity-50">Retry evidence verification</button>
    </div>}
  </div>;
}
