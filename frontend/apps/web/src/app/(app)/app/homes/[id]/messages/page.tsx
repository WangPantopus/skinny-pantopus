'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MessageCircle, Mail } from 'lucide-react';
import * as api from '@pantopus/api';

// Why no chat opens: the viewer can't read who the admin is, a read failed, the
// viewer is the only admin, or the member list shows no admin.
type NoChatReason = 'unavailable' | 'failed' | 'self' | 'none';

const NO_CHAT_COPY: Record<NoChatReason, { title: string; body: string }> = {
  unavailable: {
    title: 'Can\'t message the admin from here',
    body: 'Your access to this home doesn\'t show who manages it, so a chat with them can\'t be opened from here. For help with verification, use Request help.',
  },
  failed: {
    title: 'Can\'t message the admin right now',
    body: 'We couldn\'t check who manages this home. Try again in a moment, or use Request help.',
  },
  self: {
    title: 'You\'re this home\'s admin',
    body: 'There\'s no other household admin to message.',
  },
  none: {
    title: 'No household admin yet',
    body: 'This home doesn\'t have a household admin yet. Once someone claims the address and becomes the admin, you\'ll be able to message them here.',
  },
};

export default function HomeMessagesPage() {
  const router = useRouter();
  const params = useParams();
  const homeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [reason, setReason] = useState<NoChatReason>('unavailable');

  const load = useCallback(async () => {
    setLoading(true);
    setAdminUserId(null);

    try {
      // Try to get home, occupants and the viewer to find an admin other than the viewer
      const [homeRes, occupantsRes, meRes] = await Promise.allSettled([
        api.homes.getHome(homeId),
        api.homes.getHomeOccupants(homeId),
        api.users.getMyProfile(),
      ]);

      const home = homeRes.status === 'fulfilled' ? (homeRes.value as { home?: { owner?: { id: string } | null } })?.home : null;
      const occupants = occupantsRes.status === 'fulfilled'
        ? (occupantsRes.value as { occupants?: Array<{ user_id: string; role?: string; can_manage_home?: boolean }> })?.occupants
        ?? (occupantsRes.value as { members?: Array<{ user_id: string; role_base?: string }> })?.members
        : [];

      const list = Array.isArray(occupants) ? occupants : [];
      const myId = meRes.status === 'fulfilled' ? (meRes.value as { id?: string })?.id ?? null : null;

      // Prefer the permitted verified primary owner, then a current owner, admin, or someone who can manage home.
      const admins = [
        home?.owner?.id,
        ...list
          .filter((o: { role?: string; role_base?: string; can_manage_home?: boolean }) =>
            o.role === 'owner' || o.role_base === 'owner' ||
            o.role === 'admin' || o.role_base === 'admin' ||
            o.can_manage_home === true)
          .map((o) => (o as { user_id: string }).user_id),
      ].filter((id): id is string => Boolean(id));
      // Never a chat with yourself; without the viewer's id, no chat opens.
      const targetUserId = myId ? admins.find((id) => id !== myId) ?? null : null;

      if (targetUserId) {
        setAdminUserId(targetUserId);
      } else if (admins.length === 0 && homeRes.status === 'fulfilled' && occupantsRes.status === 'fulfilled') {
        // Only a member list the viewer could read shows there is no admin; a denied read shows nothing.
        setReason('none');
      } else if (myId && admins.length > 0 && admins.every((id) => id === myId)) {
        setReason('self');
      } else {
        // A 403 means the viewer may not see who manages the home; any other failure is just a failure.
        const failed = [homeRes, occupantsRes, meRes].some((r) =>
          r.status === 'rejected' && (r.reason as { statusCode?: number } | undefined)?.statusCode !== 403);
        setReason(failed ? 'failed' : 'unavailable');
      }
    } catch {
      setReason('failed');
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Redirect to chat when we have an admin
  useEffect(() => {
    if (!loading && adminUserId) {
      const returnTo = `/app/homes/${homeId}/dashboard`;
      router.replace(`/app/chat/conversation/${adminUserId}?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [loading, adminUserId, homeId, router]);

  if (loading || adminUserId) {
    return (
      <div className="min-h-screen bg-app-surface-raised">
        <main className="max-w-xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="animate-spin inline-block w-8 h-8 border-2 border-app-border border-t-app-text rounded-full" />
            <p className="text-sm text-app-text-secondary">
              {adminUserId ? 'Opening chat...' : 'Loading...'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // No chat to open: say why instead of 404
  return (
    <div className="min-h-screen bg-app-surface-raised">
      <main className="max-w-xl mx-auto px-4 py-8">
        <Link
          href={`/app/homes/${homeId}/dashboard`}
          className="inline-flex items-center gap-1 text-sm text-app-text-secondary hover:text-app-text mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <div className="flex flex-col items-center text-center py-12">
          <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mb-6">
            <MessageCircle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>

          <h1 className="text-2xl font-bold text-app-text mb-3">{NO_CHAT_COPY[reason].title}</h1>
          <p className="text-app-text-secondary text-base leading-relaxed mb-6 max-w-sm">
            {NO_CHAT_COPY[reason].body}
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <a
              href="mailto:help@pantopus.com?subject=Verification%20Help"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold"
            >
              <Mail className="w-4 h-4" />
              Request help
            </a>
            <Link
              href={`/app/homes/${homeId}/dashboard`}
              className="flex items-center justify-center py-3 px-4 rounded-xl border border-app-border text-app-text font-medium hover:bg-app-surface-sunken"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
