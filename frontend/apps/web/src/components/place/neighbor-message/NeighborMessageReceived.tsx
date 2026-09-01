// ============================================================
// NeighborMessageReceived — authed container for a received message (W2.6).
//
// Fetches the anonymized message (the API never returns the sender) and
// owns the in-control actions: templated reply, "not helpful", block, and
// report. None of these notify the sender. Block reuses UserBlock on the
// server (the sender id is resolved there, never exposed here).
//
// Owns the page states: auth gate, shimmer, error (retry), not-found.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { MailQuestion } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import { DetailHeader } from '@/components/archetypes/place';
import NeighborMessageReceivedView, { type ManageFlags } from './NeighborMessageReceivedView';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[640px]">{children}</div>;
}

function ReceivedSkeleton() {
  return (
    <div className="px-4 sm:px-5 pt-3 pb-16" aria-hidden="true">
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[17px]">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="w-11 h-11 rounded-full" />
          <div className="flex-1 flex flex-col gap-2">
            <ShimmerBlock className="h-4 w-2/3" />
            <ShimmerBlock className="h-3 w-1/3" />
          </div>
        </div>
        <ShimmerBlock className="h-4 w-full mt-4" />
        <ShimmerBlock className="h-4 w-5/6 mt-2" />
      </div>
      <ShimmerBlock className="h-9 w-full rounded-full mt-6" />
    </div>
  );
}

export default function NeighborMessageReceived({ messageId }: { messageId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [editingReply, setEditingReply] = useState(false);
  const [flags, setFlags] = useState<ManageFlags>({ notHelpful: false, blocked: false, reported: false });

  const redirectTo = encodeURIComponent(`/app/place/neighbor-message/${messageId}`);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !getAuthToken()) router.replace(`/login?redirectTo=${redirectTo}`);
  }, [mounted, router, redirectTo]);
  const authed = mounted && !!getAuthToken();

  const messageQuery = useQuery({
    queryKey: queryKeys.neighborMessage(messageId),
    queryFn: () => api.neighborMessages.getNeighborMessage(messageId),
    enabled: authed && !!messageId,
    retry: false,
  });

  // The templated quick-replies — same server catalog the compose screen uses.
  const templatesQuery = useQuery({
    queryKey: queryKeys.neighborMessageTemplates(),
    queryFn: () => api.neighborMessages.getNeighborMessageTemplates(),
    enabled: authed,
    staleTime: 5 * 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.neighborMessage(messageId) });

  const replyMutation = useMutation({
    mutationFn: (replyTemplateId: string) => api.neighborMessages.replyToNeighborMessage(messageId, replyTemplateId),
    onSuccess: () => {
      setEditingReply(false);
      invalidate();
    },
  });
  const notHelpfulMutation = useMutation({
    mutationFn: () => api.neighborMessages.markNeighborMessageNotHelpful(messageId),
    onSuccess: () => setFlags((f) => ({ ...f, notHelpful: true })),
  });
  const blockMutation = useMutation({
    mutationFn: () => api.neighborMessages.blockNeighborMessageSender(messageId),
    onSuccess: () => setFlags((f) => ({ ...f, blocked: true })),
  });
  const reportMutation = useMutation({
    mutationFn: () => api.neighborMessages.reportNeighborMessage(messageId),
    onSuccess: () => setFlags((f) => ({ ...f, reported: true })),
  });

  // ── States ───────────────────────────────────────────────
  if (!mounted || !authed || messageQuery.isPending) {
    return (
      <Shell>
        <DetailHeader title="Message" address="Inbox · verified neighbors" backHref="/app/place" />
        <ReceivedSkeleton />
      </Shell>
    );
  }

  const status = (messageQuery.error as { response?: { status?: number } })?.response?.status;
  if (messageQuery.isError && status === 404) {
    return (
      <Shell>
        <DetailHeader title="Message" backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <EmptyState
            icon={MailQuestion}
            title="Message not found"
            description="This message may have been removed, or it isn't addressed to you."
            actionLabel="Back to Place"
            onAction={() => router.push('/app/place')}
          />
        </div>
      </Shell>
    );
  }

  if (messageQuery.isError || !messageQuery.data) {
    return (
      <Shell>
        <DetailHeader title="Message" backHref="/app/place" />
        <div className="px-4 sm:px-5">
          <ErrorState message="We couldn't load this message. Check your connection and try again." onRetry={() => messageQuery.refetch()} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <NeighborMessageReceivedView
        message={messageQuery.data}
        replies={templatesQuery.data?.replies ?? []}
        onReply={(id) => replyMutation.mutate(id)}
        onChangeReply={() => setEditingReply(true)}
        onNotHelpful={() => notHelpfulMutation.mutate()}
        onBlock={() => blockMutation.mutate()}
        onReport={() => reportMutation.mutate()}
        replying={replyMutation.isPending}
        flags={flags}
        editingReply={editingReply}
      />
    </Shell>
  );
}
