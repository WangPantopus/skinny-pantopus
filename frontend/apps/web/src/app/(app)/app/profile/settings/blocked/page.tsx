'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

function BlockedContent() {
  const router = useRouter();
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchBlocked = useCallback(async () => {
    try {
      const result = await api.relationships.getBlockedUsers();
      setBlocked((result as any)?.blocked || (result as any)?.relationships || []);
    } catch { toast.error('Failed to load blocked users'); }
  }, []);

  useEffect(() => { setLoading(true); fetchBlocked().finally(() => setLoading(false)); }, [fetchBlocked]);

  const handleUnblock = useCallback(async (relationship: any) => {
    const otherUser = relationship.other_user || relationship.addressee || relationship.requester;
    const displayName = otherUser?.name || otherUser?.username || 'this user';

    const yes = await confirmStore.open({
      title: 'Unblock User',
      description: `Are you sure you want to unblock ${displayName}? They will be able to find your profile and send you connection requests again.`,
      confirmLabel: 'Unblock',
      variant: 'destructive',
    });
    if (!yes) return;

    setUnblocking(relationship.id);
    try {
      await api.relationships.unblock(relationship.id);
      setBlocked((prev) => prev.filter((b) => b.id !== relationship.id));
      toast.success(`${displayName} unblocked`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unblock user');
    } finally {
      setUnblocking(null);
    }
  }, []);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Blocked Users</h1>
      </div>

      {blocked.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-14 h-14 mx-auto text-app-text-muted mb-4" />
          <h2 className="text-lg font-bold text-app-text-strong mb-2">No Blocked Users</h2>
          <p className="text-sm text-app-text-secondary max-w-xs mx-auto leading-relaxed">
            You haven&apos;t blocked anyone. When you block a user, they won&apos;t be able to contact you or see your profile.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-app-border-subtle">
          {blocked.map((relationship: any) => {
            const otherUser = relationship.other_user || relationship.addressee || relationship.requester;
            const avatarUrl = otherUser?.profile_picture_url || otherUser?.avatar_url;
            const name = otherUser?.name || `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || otherUser?.username || 'Unknown';
            const username = otherUser?.username;
            const isUnblocking = unblocking === relationship.id;

            return (
              <div key={relationship.id} className="flex items-center gap-3 py-3.5">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={name} width={44} height={44} sizes="44px" quality={75} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">{getInitials(name)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">{name}</p>
                  {username && <p className="text-xs text-app-text-secondary">@{username}</p>}
                </div>
                <button onClick={() => handleUnblock(relationship)} disabled={isUnblocking}
                  className="px-4 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50 transition min-w-[80px] flex items-center justify-center">
                  {isUnblocking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unblock'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BlockedUsersPage() { return <Suspense><BlockedContent /></Suspense>; }
