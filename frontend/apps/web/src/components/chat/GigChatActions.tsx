'use client';

import Link from 'next/link';

interface GigChatActionsProps {
  room: any;
  currentUserId: string | undefined;
}

export default function GigChatActions({ room, currentUserId }: GigChatActionsProps) {
  const gigId = room?.gig_id || room?.metadata?.gig_id || room?.metadata?.gigId;
  const status = room?.gig_status || room?.metadata?.gig_status;
  if (!gigId || !currentUserId || status === 'completed' || status === 'cancelled') return null;
  const isOwner = room?.gig_poster_id === currentUserId || room?.metadata?.gig_poster_id === currentUserId;
  return (
    <div className="px-3 py-2 bg-app-surface-sunken border-t border-app-border">
      <Link href={`/app/gigs/${encodeURIComponent(gigId)}#gig-offers`} className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">
        {isOwner ? 'Review offers' : 'View gig and your offer'}
      </Link>
    </div>
  );
}
