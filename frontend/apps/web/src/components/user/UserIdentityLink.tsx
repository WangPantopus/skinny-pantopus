'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import * as api from '@pantopus/api';

type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';

interface Props {
  userId?: string | null;
  username?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  city?: string | null;
  state?: string | null;
  textClassName?: string;
  className?: string;
  stopPropagation?: boolean;
}

export default function UserIdentityLink({
  userId,
  username,
  displayName,
  avatarUrl,
  city,
  state,
  textClassName = 'text-primary-600 hover:underline',
  className = '',
  stopPropagation = true,
}: Props) {
  const router = useRouter();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [relationship, setRelationship] = useState<RelationshipState>('none');
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const canShowHover = Boolean(userId && username);
  const locationText = useMemo(() => [city, state].filter(Boolean).join(', '), [city, state]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeWithDelay = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  const openNow = () => {
    if (!canShowHover) return;
    clearCloseTimer();
    setOpen(true);
  };

  const updatePopoverPosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = 288; // w-72
    const estimatedHeight = relationship === 'connected' ? 220 : 180;
    const viewportPad = 8;

    let left = rect.left;
    if (left + width + viewportPad > window.innerWidth) {
      left = window.innerWidth - width - viewportPad;
    }
    if (left < viewportPad) left = viewportPad;

    let top = rect.bottom + 8;
    if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight - 8 > viewportPad) {
      top = rect.top - estimatedHeight - 8;
    }

    setPopoverPos({ top, left });
  }, [relationship]);

  useEffect(() => {
    const load = async () => {
      if (!open || !canShowHover || loaded) return;
      try {
        const status = await api.users.getRelationshipStatus(String(userId));
        setFollowing(!!status.following);
        setRelationship(status.relationship || 'none');
      } catch {
        setFollowing(false);
        setRelationship('none');
      } finally {
        setLoaded(true);
      }
    };
    void load();
  }, [open, canShowHover, loaded, userId]);

  useEffect(() => {
    if (!open || !canShowHover) return;
    updatePopoverPosition();
    const onWindowMove = () => updatePopoverPosition();
    window.addEventListener('resize', onWindowMove);
    window.addEventListener('scroll', onWindowMove, true);
    return () => {
      window.removeEventListener('resize', onWindowMove);
      window.removeEventListener('scroll', onWindowMove, true);
    };
  }, [open, canShowHover, relationship, updatePopoverPosition]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  const withMaybeStop = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const resolveConnectionId = async (targetUserId: string, mode: 'pending' | 'connected') => {
    if (mode === 'pending') {
      const pending = await api.relationships.getPendingRequests();
      const rel = (pending.requests || []).find((r) => r.requester?.id === targetUserId);
      return rel?.id || null;
    }
    const connected = await api.relationships.getConnections();
    const rel = (connected.relationships || []).find((r) => r.other_user?.id === targetUserId);
    return rel?.id || null;
  };

  const handleFollow = async (e: React.MouseEvent) => {
    withMaybeStop(e);
    if (!userId) return;
    setActionLoading(true);
    try {
      if (following) {
        await api.users.unfollowUser(String(userId));
        setFollowing(false);
      } else {
        await api.users.followUser(String(userId));
        setFollowing(true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async (e: React.MouseEvent) => {
    withMaybeStop(e);
    if (!userId) return;
    setActionLoading(true);
    try {
      if (relationship === 'none') {
        await api.relationships.sendRequest(String(userId));
        setRelationship('pending_sent');
      } else if (relationship === 'pending_received') {
        const relId = await resolveConnectionId(String(userId), 'pending');
        if (relId) {
          await api.relationships.acceptRequest(relId);
          setRelationship('connected');
        }
      } else if (relationship === 'connected') {
        const relId = await resolveConnectionId(String(userId), 'connected');
        if (relId) {
          await api.relationships.disconnect(relId);
          setRelationship('none');
        }
      }
    } finally {
      setActionLoading(false);
    }
  };

  const connectLabel =
    relationship === 'connected'
      ? 'Connected'
      : relationship === 'pending_sent'
      ? 'Request Sent'
      : relationship === 'pending_received'
      ? 'Accept Request'
      : relationship === 'blocked'
      ? 'Blocked'
      : 'Connect';

  return (
    <span
      ref={anchorRef}
      className={`inline-flex ${className}`}
      onMouseEnter={openNow}
      onMouseLeave={closeWithDelay}
    >
      {username ? (
        <Link
          href={`/${username}`}
          className={textClassName}
          onClick={withMaybeStop}
        >
          {displayName}
        </Link>
      ) : (
        <span className="text-app-text-strong">{displayName}</span>
      )}

      {open && canShowHover && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[120] w-72 rounded-xl border border-app-border bg-app-surface shadow-xl p-3"
              style={{ top: popoverPos.top, left: popoverPos.left }}
              onMouseEnter={openNow}
              onMouseLeave={closeWithDelay}
              onClick={withMaybeStop}
            >
              <div className="flex items-start gap-3">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover border border-app-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white text-sm font-semibold flex items-center justify-center">
                    {(displayName || username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <Link href={`/${username}`} className="font-semibold text-app-text hover:underline" onClick={withMaybeStop}>
                    {displayName}
                  </Link>
                  <p className="text-xs text-app-text-secondary truncate">@{username}</p>
                  {locationText ? <p className="text-xs text-app-text-secondary">{locationText}</p> : null}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleConnect}
                  disabled={actionLoading || relationship === 'pending_sent' || relationship === 'blocked'}
                  className="flex-1 rounded-lg border border-app-border px-2 py-1.5 text-xs font-medium text-app-text-strong disabled:opacity-50"
                >
                  {actionLoading ? '...' : connectLabel}
                </button>
                <button
                  onClick={handleFollow}
                  disabled={actionLoading}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                    following ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-app-border text-app-text-strong'
                  } disabled:opacity-50`}
                >
                  {actionLoading ? '...' : following ? 'Following' : 'Follow'}
                </button>
              </div>

              {relationship === 'connected' && (
                <button
                  onClick={(e) => {
                    withMaybeStop(e);
                    api.chat
                      .createDirectChat(String(userId))
                      .then((res: { roomId?: string; room?: { id?: string } }) => {
                        const roomId = res?.roomId || res?.room?.id;
                        if (roomId) router.push(`/app/chat?room=${roomId}`);
                      })
                      .catch(() => {});
                  }}
                  className="mt-2 w-full rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-black"
                >
                  Message
                </button>
              )}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
