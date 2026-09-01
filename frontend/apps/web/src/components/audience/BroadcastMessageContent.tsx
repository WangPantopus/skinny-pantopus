'use client';

/**
 * Body + media renderer for one broadcast message. The rendering helpers
 * live in ./broadcastMedia so this and BroadcastTimeline share one copy —
 * see the note at the top of that module.
 */

import type { BroadcastMessage } from '@pantopus/types';
import { BroadcastMediaGrid, renderBodyWithLinks } from './broadcastMedia';

export default function BroadcastMessageContent({
  message,
  bodyClassName = 'whitespace-pre-wrap text-sm leading-6 text-app',
}: {
  message: BroadcastMessage;
  bodyClassName?: string;
}) {
  const body = message.body || message.teaser || '';
  return (
    <>
      {body ? <p className={bodyClassName}>{renderBodyWithLinks(body)}</p> : null}
      <BroadcastMediaGrid media={message.media} />
    </>
  );
}
