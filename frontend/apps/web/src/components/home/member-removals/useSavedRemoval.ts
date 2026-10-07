import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { PendingRemovalStore } from './PendingRemovalStore';
import { removalBase } from './RemovalController';
import { validInvitationSession } from './removalModel';

/**
 * Whether this account has an unfinished member removal saved in this browser. Members and My Homes show
 * "Check an unfinished removal" only then, or when the saved removal can't be checked, so the recovery page can say why.
 */
export function useSavedRemoval(): boolean {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await api.apiClient.get<{ session: unknown }>(removalBase + '/session');
        const session = response.data?.session;
        if (!validInvitationSession(session)) throw new Error('Session unavailable');
        const found = await new PendingRemovalStore(api.getApiBaseUrl(), session.actor_id).load();
        if (live) setSaved(found !== null);
      } catch {
        if (live) setSaved(true);
      }
    })();
    return () => { live = false; };
  }, []);
  return saved;
}
