'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { Handshake, Mailbox, Send, Ban } from 'lucide-react';
import Image from 'next/image';
import { confirmStore } from '@/components/ui/confirm-store';
import { queryKeys } from '@/lib/query-keys';
import type { Relationship, ConnectionRequest, RelationshipUser } from '@pantopus/types';

type Tab = 'connections' | 'pending' | 'sent' | 'blocked';
type BlockedUserEntry = {
  id: string;
  created_at: string;
  responded_at?: string | null;
  blocked_user?: RelationshipUser | null;
};

function ConnectionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'connections';

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch all 4 relationship collections in parallel via useQueries
  const [connectionsQ, pendingQ, sentQ, blockedQ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.connections(),
        queryFn: async (): Promise<Relationship[]> => {
          const res = await api.relationships.getConnections();
          return res.relationships || [];
        },
        staleTime: 30_000,
      },
      {
        queryKey: queryKeys.connectionRequests('pending'),
        queryFn: async (): Promise<ConnectionRequest[]> => {
          const res = await api.relationships.getPendingRequests();
          return res.requests || [];
        },
        staleTime: 30_000,
      },
      {
        queryKey: queryKeys.connectionRequests('sent'),
        queryFn: async (): Promise<ConnectionRequest[]> => {
          const res = await api.relationships.getSentRequests();
          return res.requests || [];
        },
        staleTime: 30_000,
      },
      {
        queryKey: queryKeys.blockedUsers(),
        queryFn: async (): Promise<BlockedUserEntry[]> => {
          const res = await api.relationships.getBlockedUsers();
          return res.blocked || [];
        },
        staleTime: 30_000,
      },
    ],
  });

  const connections: Relationship[] = connectionsQ.data ?? [];
  const pendingRequests: ConnectionRequest[] = pendingQ.data ?? [];
  const sentRequests: ConnectionRequest[] = sentQ.data ?? [];
  const blockedUsers: BlockedUserEntry[] = blockedQ.data ?? [];
  const loading =
    connectionsQ.isPending || pendingQ.isPending || sentQ.isPending || blockedQ.isPending;

  // Invalidate all 4 relationship queries after a mutation so they refetch
  const loadData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.connections() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.connectionRequests('pending') }),
      queryClient.invalidateQueries({ queryKey: queryKeys.connectionRequests('sent') }),
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() }),
    ]);
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await api.relationships.acceptRequest(requestId);
      await loadData();
    } catch (err) {
      console.error('Failed to accept:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await api.relationships.rejectRequest(requestId);
      await loadData();
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (relationshipId: string) => {
    const yes = await confirmStore.open({ title: 'Remove this connection?', description: 'You can reconnect by sending a new request.', confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    setActionLoading(relationshipId);
    try {
      await api.relationships.disconnect(relationshipId);
      await loadData();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (relationshipId: string) => {
    setActionLoading(relationshipId);
    try {
      await api.relationships.unblock(relationshipId);
      await loadData();
    } catch (err) {
      console.error('Failed to unblock:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'connections', label: 'Connections', count: connections.length },
    { key: 'pending', label: 'Requests', count: pendingRequests.length },
    { key: 'sent', label: 'Sent', count: sentRequests.length },
    { key: 'blocked', label: 'Blocked', count: blockedUsers.length },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-app-text">Connections</h1>
        <p className="text-app-text-secondary mt-1">Manage your connections and requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-app-surface-sunken rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-app-surface text-app-text shadow-sm'
                : 'text-app-text-secondary hover:text-app-text'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-app-text-secondary">Loading...</p>
        </div>
      ) : (
        <>
          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="space-y-3">
              {connections.length === 0 ? (
                <EmptyState
                  icon={<Handshake className="w-10 h-10 text-app-text-muted" />}
                  title="No connections yet"
                  description="Connect with people you know and trust to unlock private messaging and deeper access."
                />
              ) : (
                connections.map((rel) => (
                  <UserCard
                    key={rel.id}
                    user={rel.other_user}
                    subtitle={`Connected since ${new Date(rel.accepted_at || rel.created_at).toLocaleDateString()}`}
                    onNavigate={() => router.push(`/${rel.other_user?.username}`)}
                    actions={
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/${rel.other_user?.username}`)}
                          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDisconnect(rel.id)}
                          disabled={actionLoading === rel.id}
                          className="px-3 py-1.5 text-sm border border-app-border text-app-text-secondary rounded-lg hover:bg-app-hover disabled:opacity-50"
                        >
                          {actionLoading === rel.id ? '...' : 'Remove'}
                        </button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <EmptyState
                  icon={<Mailbox className="w-10 h-10 text-app-text-muted" />}
                  title="No pending requests"
                  description="When someone sends you a connection request, it will appear here."
                />
              ) : (
                pendingRequests.map((req) => (
                  <UserCard
                    key={req.id}
                    user={req.requester}
                    subtitle={`Sent ${new Date(req.created_at).toLocaleDateString()}`}
                    onNavigate={() => router.push(`/${req.requester?.username}`)}
                    actions={
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(req.id)}
                          disabled={actionLoading === req.id}
                          className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                          {actionLoading === req.id ? '...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                          className="px-4 py-1.5 text-sm border border-app-border text-app-text-secondary rounded-lg hover:bg-app-hover disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          )}

          {/* Sent Requests Tab */}
          {activeTab === 'sent' && (
            <div className="space-y-3">
              {sentRequests.length === 0 ? (
                <EmptyState
                  icon={<Send className="w-10 h-10 text-app-text-muted" />}
                  title="No sent requests"
                  description="Connection requests you've sent will appear here."
                />
              ) : (
                sentRequests.map((req) => (
                  <UserCard
                    key={req.id}
                    user={req.addressee}
                    subtitle={`Sent ${new Date(req.created_at).toLocaleDateString()}`}
                    onNavigate={() => router.push(`/${req.addressee?.username}`)}
                    actions={
                      <span className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-lg">
                        Pending
                      </span>
                    }
                  />
                ))
              )}
            </div>
          )}

          {/* Blocked Tab */}
          {activeTab === 'blocked' && (
            <div className="space-y-3">
              {blockedUsers.length === 0 ? (
                <EmptyState
                  icon={<Ban className="w-10 h-10 text-app-text-muted" />}
                  title="No blocked users"
                  description="Users you block won't be able to see your content or contact you."
                />
              ) : (
                blockedUsers.map((rel) => (
                  <UserCard
                    key={rel.id}
                    user={rel.blocked_user}
                    subtitle={`Blocked ${new Date(rel.responded_at || rel.created_at).toLocaleDateString()}`}
                    onNavigate={() => {}}
                    actions={
                      <button
                        onClick={() => handleUnblock(rel.id)}
                        disabled={actionLoading === rel.id}
                        className="px-4 py-1.5 text-sm border border-app-border text-app-text-secondary rounded-lg hover:bg-app-hover disabled:opacity-50"
                      >
                        {actionLoading === rel.id ? '...' : 'Unblock'}
                      </button>
                    }
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ Sub-Components ============

function UserCard({
  user,
  subtitle,
  onNavigate,
  actions,
}: {
  user: RelationshipUser | null | undefined;
  subtitle: string;
  onNavigate: () => void;
  actions: React.ReactNode;
}) {
  if (!user) return null;
  const displayName = user.name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : null) || user.username;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4 flex items-center gap-4">
      {/* Avatar */}
      <div className="flex-shrink-0 cursor-pointer" onClick={onNavigate}>
        {user.profile_picture_url ? (
          <Image src={user.profile_picture_url!} alt={displayName} width={48} height={48} sizes="48px" quality={75} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <h3 className="font-semibold text-app-text truncate">{displayName}</h3>
        <p className="text-sm text-app-text-secondary truncate">@{user.username}</p>
        {(user.city || user.state) && (
          <p className="text-xs text-app-text-muted mt-0.5">{[user.city, user.state].filter(Boolean).join(', ')}</p>
        )}
        <p className="text-xs text-app-text-muted">{subtitle}</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0">{actions}</div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="text-center py-16 bg-app-surface rounded-xl border border-app-border">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h3 className="text-lg font-semibold text-app-text mb-2">{title}</h3>
      <p className="text-app-text-secondary max-w-sm mx-auto">{description}</p>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense>
      <ConnectionsPageContent />
    </Suspense>
  );
}
