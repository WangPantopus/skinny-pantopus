// A document's first content (lib/firstContent.ts) was read on the server, so no read
// in this browser has saved the Messages list for offline. It's saved once per page,
// after first paint, through the same path as any inbox read, unless that isn't known
// to be safe. Only the Messages screen loads this.
import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { authSessionMarker } from '@pantopus/api/client';
import { readChatHistoryFence, type HistoryFence } from '@/components/chat/chatStorage';
import { chatRetirementsSeen } from '@/components/chat/chatSession';
import { inboxBootFence, retainInbox, type ConversationsReply } from '@/lib/conversations';
import { queryKeys } from '@/lib/query-keys';

/** No fence could be captured before a read made on the server. Undefined when saving
 * it isn't known to be safe: an inbox read has begun on this page (it took the boot read,
 * and saves newer data itself), a retirement was seen here, or the fence last advanced
 * after this page began loading, so the server's read may predate that change. A fence
 * an older version wrote has no time: it has to be the one this page read at boot. */
async function fenceForServerRead(marker: string): Promise<HistoryFence | null | undefined> {
  const boot = inboxBootFence();
  if (!boot || boot.marker !== marker || boot.retirements !== chatRetirementsSeen()) return undefined;
  const [before, fence] = await Promise.all([boot.read, readChatHistoryFence()]);
  if (before === undefined || boot.retirements !== chatRetirementsSeen()) return undefined;
  if (!fence) return before ? undefined : null;
  if (fence.at !== undefined) return fence.at < performance.timeOrigin ? fence : undefined;
  return before?.account === fence.account && before.generation === fence.generation ? fence : undefined;
}

function retainFirstContent(client: QueryClient) {
  const key = queryKeys.conversations();
  const state = client.getQueryState<ConversationsReply>(key);
  // A copy restored from the store has no update time: saving it again would extend its life.
  if (!state?.data || !state.dataUpdatedAt) return;
  const reply = state.data;
  const marker = authSessionMarker();
  void fenceForServerRead(marker)
    .then((fence) => retainInbox(reply, client.getQueryData<{ id?: string }>(queryKeys.me())?.id, marker, fence, () => client.getQueryData(key) === reply))
    .catch(() => {});
}

let seen = false;

export function useRetainFirstContent() {
  const client = useQueryClient();
  useEffect(() => {
    if (seen) return;
    seen = true;
    const save = () => retainFirstContent(client);
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(save, { timeout: 2000 });
    else window.setTimeout(save, 1);
  }, [client]);
}
