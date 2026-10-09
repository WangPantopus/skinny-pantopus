import { useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { PendingRelationshipStore } from '../relationships/PendingRelationshipStore';
import { PendingResidencyReviewStore } from './PendingResidencyReviewStore';
import { fetchMe } from '@/lib/me';

/**
 * Whether this account has an unfinished residency or ownership (relationship) decision for this Home saved in this
 * browser. The review links show only then, or when the saved decision can't be checked, so the review can say why.
 */
export function useSavedReviewDecisions(homeId: string): { residency: boolean; relationship: boolean } {
  const [saved, setSaved] = useState({ residency: false, relationship: false });
  useEffect(() => {
    let live = true;
    const found = async (load: () => Promise<unknown>) => { try { return (await load()) !== null; } catch { return true; } };
    void (async () => {
      let actor: string;
      try { actor = (await fetchMe()).id; } catch {
        if (live) setSaved({ residency: true, relationship: true });
        return;
      }
      const origin = api.getApiBaseUrl();
      const [residency, relationship] = await Promise.all([
        found(() => new PendingResidencyReviewStore(origin, actor, homeId).load()),
        found(() => new PendingRelationshipStore(origin, actor, homeId).load()),
      ]);
      if (live) setSaved({ residency, relationship });
    })();
    return () => { live = false; };
  }, [homeId]);
  return saved;
}
