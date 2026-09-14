'use client';
import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';

/** No file selection or write starts before the page has its own authenticated read. */
export function useClaimUploadSession(homeId: string) {
  const [opening, setOpening] = useState<{ homeId: string; generation: number; actor_id: string; session_scope: string } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const scope = opening?.homeId === homeId ? opening : null;
  useEffect(() => {
    const request = ++generation.current; setOpening(null); setError('');
    const retireGeneration = () => { generation.current++; };
    const invalidate = () => {
      generation.current++; setOpening(null); setError('Your session changed. Reopen the claim before uploading.');
    };
    const unsubscribe = api.onTokenChange(invalidate);
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) invalidate(); };
    window.addEventListener('storage', changed);
    api.homeOwnership.getMyOwnershipClaims().then(result => {
      if (request !== generation.current) return;
      if (!result.upload_session?.actor_id || !/^[a-f0-9]{64}$/.test(result.upload_session.session_scope)) throw new Error('Could not verify your current session.');
      setOpening({ homeId, generation: request, ...result.upload_session });
    }).catch(failure => { if (request === generation.current) setError(failure instanceof Error ? failure.message : 'Could not verify your current session.'); });
    return () => { retireGeneration(); unsubscribe(); window.removeEventListener('storage', changed); };
  }, [homeId, revision]);
  const assertCurrent = async () => {
    const request = generation.current;
    if (!scope) throw new Error('Reload this page before uploading evidence.');
    if (scope.generation !== request) throw new Error('Your session changed. Reopen this claim before uploading.');
    const result = await api.homeOwnership.getMyOwnershipClaims(scope.session_scope);
    if (request !== generation.current || result.upload_session?.session_scope !== scope.session_scope || result.upload_session.actor_id !== scope.actor_id) {
      throw new Error('Your session changed. Reopen this claim before uploading.');
    }
  };
  return { scope, error, assertCurrent, retry: () => setRevision(value => value + 1) };
}
