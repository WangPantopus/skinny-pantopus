'use client';

// ============================================================
// /dev/place-neighbor-message — visual preview of neighbor messaging
// (W2.6). Renders both presentational screens against mock data: the
// template-only compose (with recipient + selected note) and the received
// message (with an unsent reply state). Public route, no fetching — a
// verification surface, not a shipped screen.
// ============================================================

import { useState } from 'react';
import type {
  NeighborMessageTemplate,
  NeighborReplyTemplate,
  ReceivedNeighborMessage,
} from '@pantopus/api';
import NeighborMessageComposeView from '@/components/place/neighbor-message/NeighborMessageComposeView';
import NeighborMessageReceivedView from '@/components/place/neighbor-message/NeighborMessageReceivedView';

const TEMPLATES: NeighborMessageTemplate[] = [
  { id: 'noise', icon: 'volume-2', category: 'Late-night noise', body: 'A verified neighbor mentioned some noise after 10pm. Just a friendly heads-up — no need to reply.' },
  { id: 'package', icon: 'package', category: 'Misdelivered package', body: 'A package may have been left at the wrong door near you. You might want to check around.' },
  { id: 'vehicle', icon: 'car', category: 'Parked vehicle', body: 'A friendly heads-up that a vehicle has been parked nearby for a while. Nothing urgent.' },
  { id: 'pet', icon: 'dog', category: 'Pet in the yard', body: 'A neighbor noticed a pet out in the yard. Just making sure everything is okay.' },
  { id: 'gate', icon: 'door-open', category: 'Open gate or door', body: 'A gate or door nearby looks like it was left open. Thought you would want to know.' },
];

const REPLIES: NeighborReplyTemplate[] = [
  { id: 'thanks', body: 'Thanks for the heads-up' },
  { id: 'will_check', body: "Got it — I'll check" },
  { id: 'nothing', body: 'Nothing on my end, thanks' },
];

const RECEIVED: ReceivedNeighborMessage = {
  id: 'demo',
  category: 'Misdelivered package',
  body: 'A package may have been left at the wrong door near you. You might want to check around.',
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  sender: { label: 'A verified neighbor nearby', block_label: 'On your block', verified: true },
  reply: null,
  can_reply: true,
  not_helpful: false,
  reported: false,
  read_at: null,
};

export default function DevNeighborMessagePage() {
  const [selectedId, setSelectedId] = useState<string | null>('package');

  return (
    <div className="bg-app-bg min-h-screen pb-20">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="px-4 pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted">Compose</div>
        <NeighborMessageComposeView
          templates={TEMPLATES}
          recipient={{ address: '1425 SE Oak St', relativeLabel: 'Two doors down · on your block' }}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSend={() => {}}
          onChangeRecipient={() => {}}
          sending={false}
        />
        <div className="px-4 pt-10 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted">Received</div>
        <NeighborMessageReceivedView
          message={RECEIVED}
          replies={REPLIES}
          onReply={() => {}}
          onChangeReply={() => {}}
          onNotHelpful={() => {}}
          onBlock={() => {}}
          onReport={() => {}}
          replying={false}
          flags={{ notHelpful: false, blocked: false, reported: false }}
          editingReply={false}
        />
      </div>
    </div>
  );
}
