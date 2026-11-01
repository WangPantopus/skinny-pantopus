'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ProfileAvatar from '@/components/profile/public/atoms/ProfileAvatar';
import { useOwnLocalProfile } from '@/lib/me';

/**
 * How neighbors see you: the name and photo other people see on your posts, comments, chats, tasks and notices (your
 * Local Profile). They are edited in one place, Edit profile → "Neighbors see this"; this row shows them and opens it.
 */
export default function NeighborsSeeYouCard({ enabled, accountId }: { enabled: boolean; accountId?: string | null }) {
  const query = useOwnLocalProfile({ enabled });
  const view = query.data;

  // Not offered when the server has no Local Profiles (the identity firewall switched off answers 404).
  if ((query.error as { statusCode?: number } | null)?.statusCode === 404) return null;

  return (
    <Link
      href="/app/profile/edit#neighbors"
      className="flex items-center gap-4 bg-surface rounded-xl border border-app p-4 sm:p-5 hover-bg-app"
      data-testid="neighbors-see-you"
    >
      {view ? (
        <ProfileAvatar name={view.profile.displayName} seed={accountId} photoUrl={view.profile.avatarUrl ?? null} size={48} />
      ) : (
        <span aria-hidden="true" className="w-12 h-12 shrink-0 rounded-full bg-surface-muted" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-app">How neighbors see you</span>
        <span className="block text-sm text-app-secondary [overflow-wrap:anywhere]" data-testid="neighbors-see-you-name">
          {view
            ? `${view.profile.displayName}${view.profile.handle ? ` · @${view.profile.handle}` : ''}`
            : query.isError ? 'Your name and photo for neighbors' : 'Loading…'}
        </span>
        <span className="block text-xs text-app-muted mt-0.5">
          The name and photo on your profile, posts, comments and chats. Change them in Edit profile.
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="w-5 h-5 shrink-0 text-app-muted" />
    </Link>
  );
}
