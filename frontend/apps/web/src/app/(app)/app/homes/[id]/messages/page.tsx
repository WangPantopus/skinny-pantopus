'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MessageCircle, Mail } from 'lucide-react';
import * as api from '@pantopus/api';

export default function HomeMessagesPage() {
  const router = useRouter();
  const params = useParams();
  const homeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAdminUserId(null);

    try {
      // Try to get home and occupants to find admin
      const [homeRes, occupantsRes] = await Promise.allSettled([
        api.homes.getHome(homeId),
        api.homes.getHomeOccupants(homeId),
      ]);

      const home = homeRes.status === 'fulfilled' ? (homeRes.value as { home?: { owner_id?: string } })?.home : null;
      const occupants = occupantsRes.status === 'fulfilled'
        ? (occupantsRes.value as { occupants?: Array<{ user_id: string; role?: string; can_manage_home?: boolean }> })?.occupants
        ?? (occupantsRes.value as { members?: Array<{ user_id: string; role_base?: string }> })?.members
        : [];

      const list = Array.isArray(occupants) ? occupants : [];

      // Prefer owner_id from home, then find owner/admin from occupants
      let targetUserId = home?.owner_id || null;

      if (!targetUserId && list.length > 0) {
        // Find first owner, admin, or someone who can manage home
        const ownerOrAdmin = list.find(
          (o: { role?: string; role_base?: string; can_manage_home?: boolean }) =>
            o.role === 'owner' || o.role_base === 'owner' ||
            o.role === 'admin' || o.role_base === 'admin' ||
            o.can_manage_home === true
        );
        if (ownerOrAdmin) {
          targetUserId = (ownerOrAdmin as { user_id: string }).user_id;
        } else {
          // Fallback: first member
          targetUserId = (list[0] as { user_id: string }).user_id;
        }
      }

      if (targetUserId) {
        setAdminUserId(targetUserId);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
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

  // No admin: show friendly message instead of 404
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

          <h1 className="text-2xl font-bold text-app-text mb-3">No household admin yet</h1>
          <p className="text-app-text-secondary text-base leading-relaxed mb-6 max-w-sm">
            {error
              ? 'We couldn\'t load the household members. This home may not have an admin yet.'
              : 'This home doesn\'t have a household admin yet. Once someone claims the address and becomes the admin, you\'ll be able to message them here.'}
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
