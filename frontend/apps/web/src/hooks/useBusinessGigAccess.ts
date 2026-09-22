'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';

/** Both gig detail layouts use current business permissions. A late response
 * from another account, owner or session cannot expose manager actions. */
export function useBusinessGigAccess(actorId: string | undefined, ownerId: string | undefined, isBusiness: boolean, revision: unknown): boolean {
  const token = api.getAuthToken();
  const origin = api.getApiBaseUrl();
  const scopeRef = useRef({ actorId, token, origin, retired: false });
  if (scopeRef.current.actorId !== actorId) scopeRef.current = { actorId, token, origin, retired: false };
  const scope = scopeRef.current;
  if (scope.token !== token || scope.origin !== origin) scope.retired = true;
  const key = JSON.stringify([actorId, ownerId, isBusiness, origin]);
  const [result, setResult] = useState({ key: '', allowed: false });
  useEffect(() => {
    let active = true;
    // A refresh of the same permission keeps its existing UI until the result
    // arrives. Clearing it would unmount recovery forms on every gig event.
    setResult((previous) => previous.key === key ? previous : { key, allowed: false });
    // The access endpoint does not identify the responding actor. Retire this
    // actor's screen on any session signal, even if the cookie marker is equal;
    // a data refresh must not silently bind its old profile to a new session.
    const invalidate = () => { scope.retired = true; setResult({ key, allowed: false }); };
    const current = () => active && scopeRef.current === scope && !scope.retired
      && api.getAuthToken() === scope.token && api.getApiBaseUrl() === scope.origin;
    const unsubscribe = api.onTokenChange(invalidate);
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) invalidate();
    };
    window.addEventListener('storage', changed);
    if (current() && scope.token && actorId && ownerId && actorId !== ownerId && isBusiness) {
      void api.businessIam.getMyBusinessAccess(ownerId).then((access) => {
        if (!current()) return;
        setResult({ key, allowed: access?.hasAccess === true && (access.isOwner === true
          || Array.isArray(access.permissions) && access.permissions.some((permission) => permission === 'gigs.manage' || permission === 'gigs.post')) });
      }).catch(() => { if (current()) setResult({ key, allowed: false }); });
    }
    return () => { active = false; unsubscribe(); window.removeEventListener('storage', changed); };
  }, [actorId, ownerId, isBusiness, key, revision, scope]);
  return !scope.retired && result.key === key && result.allowed;
}
