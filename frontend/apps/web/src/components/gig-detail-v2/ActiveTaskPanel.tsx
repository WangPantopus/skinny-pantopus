'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Car,
  MapPin,
  Hammer,
  CheckCircle,
  Check,
  MessageCircle,
  Phone,
  XCircle,
  Star,
  ShieldAlert,
} from 'lucide-react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import type { Socket } from 'socket.io-client';

type FulfillmentStatus =
  | 'on_the_way'
  | 'arrived'
  | 'picked_up'
  | 'dropped_off'
  | 'in_progress'
  | null;

interface ActiveTaskPanelProps {
  gig: any;
  isOwner: boolean;
  isWorker: boolean;
  socket: Socket | null;
  onOpenChat: () => void;
  onCancel: () => void;
  onStatusChange: () => void;
}

const STATUS_STEPS: { key: string; label: string; icon: typeof Car }[] = [
  { key: 'on_the_way', label: 'On the way', icon: Car },
  { key: 'arrived', label: 'Arrived', icon: MapPin },
  { key: 'in_progress', label: 'In progress', icon: Hammer },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

const STATUS_ORDER: Record<string, number> = {
  on_the_way: 0,
  arrived: 1,
  picked_up: 1,
  dropped_off: 2,
  in_progress: 2,
  completed: 3,
};

function getStatusBadge(status: FulfillmentStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case 'on_the_way':
      return { label: 'On the way', color: 'text-blue-600', bg: 'bg-blue-100' };
    case 'arrived':
      return { label: 'Arrived', color: 'text-purple-600', bg: 'bg-purple-100' };
    case 'picked_up':
      return { label: 'Picked up', color: 'text-green-600', bg: 'bg-green-100' };
    case 'dropped_off':
      return { label: 'Dropped off', color: 'text-green-600', bg: 'bg-green-100' };
    case 'in_progress':
      return { label: 'In progress', color: 'text-amber-600', bg: 'bg-amber-100' };
    default:
      return { label: 'Waiting', color: 'text-gray-500', bg: 'bg-gray-100' };
  }
}

export default function ActiveTaskPanel({
  gig,
  isOwner,
  isWorker,
  socket,
  onOpenChat,
  onCancel,
  onStatusChange,
}: ActiveTaskPanelProps) {
  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<FulfillmentStatus>(null);
  const [helperEta, setHelperEta] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);

  // Parse initial status from gig.urgent_details
  useEffect(() => {
    try {
      const details =
        typeof gig.urgent_details === 'string'
          ? JSON.parse(gig.urgent_details)
          : gig.urgent_details;
      if (details) {
        setFulfillmentStatus(details.current_fulfillment_status || null);
        setHelperEta(details.helper_eta_minutes ?? null);
      }
    } catch {
      // ignore parse errors
    }
  }, [gig.urgent_details]);

  // Fetch active status on mount
  useEffect(() => {
    api.gigs
      .getActiveStatus(gig.id)
      .then((result) => {
        setFulfillmentStatus(
          (result.fulfillment_status as FulfillmentStatus) || null,
        );
        setHelperEta(result.helper_eta_minutes);
      })
      .catch(() => {});
  }, [gig.id]);

  // Listen for real-time status updates
  useEffect(() => {
    if (!socket || !gig.id) return;

    const onStatusUpdate = (data: any) => {
      if (data.gigId !== gig.id) return;
      setFulfillmentStatus(data.fulfillmentStatus || null);
      if (data.helper_eta_minutes != null) setHelperEta(data.helper_eta_minutes);
      onStatusChange();
    };

    socket.on('gig_status_update', onStatusUpdate);
    return () => {
      socket.off('gig_status_update', onStatusUpdate);
    };
  }, [socket, gig.id, onStatusChange]);

  const updateStatus = useCallback(
    async (status: string) => {
      if (updating) return;
      setUpdating(true);
      try {
        await api.gigs.updateUrgentStatus(gig.id, {
          status: status as any,
        });
        setFulfillmentStatus(status as FulfillmentStatus);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update status');
      } finally {
        setUpdating(false);
      }
    },
    [gig.id, updating],
  );

  const handleMarkComplete = useCallback(async () => {
    const yes = await confirmStore.open({
      title: 'Mark Complete',
      description:
        'Are you sure you want to mark this task as complete?',
      confirmLabel: 'Complete',
      variant: 'primary',
    });
    if (!yes) return;
    try {
      await api.gigs.markGigCompleted(gig.id, {});
      onStatusChange();
    } catch {
      toast.error('Failed to mark completed');
    }
  }, [gig.id, onStatusChange]);

  const handleConfirmComplete = useCallback(async () => {
    const yes = await confirmStore.open({
      title: 'Confirm Completion',
      description: 'Confirm this task is fully complete?',
      confirmLabel: 'Confirm',
      variant: 'primary',
    });
    if (!yes) return;
    try {
      await api.gigs.confirmGigCompletion(gig.id, {});
      onStatusChange();
    } catch {
      toast.error('Failed to confirm completion');
    }
  }, [gig.id, onStatusChange]);

  // User info
  const worker = gig.acceptedBy || gig.accepted_by_user;
  const workerName = worker?.name || worker?.username || 'Helper';
  const workerAvatar = worker?.profile_picture_url || null;
  const workerRating = worker?.average_rating;

  const poster = gig.creator || gig.user || gig.poster;
  const posterName = poster?.name || poster?.username || 'Poster';

  const badge = getStatusBadge(fulfillmentStatus);
  const currentStepIndex = fulfillmentStatus
    ? (STATUS_ORDER[fulfillmentStatus] ?? -1)
    : -1;

  return (
    <div className="space-y-4">
      {/* Helper/Poster card */}
      <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
        {isOwner && workerAvatar ? (
          <Image
            src={workerAvatar}
            alt={workerName}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover"
            sizes="48px"
            quality={75}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {(isOwner ? workerName : posterName)[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-app-text truncate">
            {isOwner ? workerName : posterName}
          </p>
          {isOwner && workerRating && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-sm text-app-text-secondary">
                {Number(workerRating).toFixed(1)}
              </span>
            </div>
          )}
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      {/* ETA banner */}
      {helperEta != null && fulfillmentStatus === 'on_the_way' && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Car className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">
            ETA: ~{helperEta} min
          </span>
        </div>
      )}

      {/* Status timeline */}
      <div className="bg-app-surface border border-app-border rounded-xl p-4">
        {STATUS_STEPS.map((step, i) => {
          const isCompleted = currentStepIndex >= i;
          const isCurrent = currentStepIndex === i;
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                    isCompleted
                      ? 'bg-emerald-600 border-emerald-600'
                      : isCurrent
                        ? 'border-emerald-600 bg-white border-[3px]'
                        : 'border-app-border bg-app-surface-sunken'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <StepIcon
                      className={`w-3.5 h-3.5 ${
                        isCurrent ? 'text-emerald-600' : 'text-app-text-muted'
                      }`}
                    />
                  )}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-3 ${
                      isCompleted ? 'bg-emerald-600' : 'bg-app-border'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-sm pt-1 ${
                  isCurrent
                    ? 'text-emerald-600 font-bold'
                    : isCompleted
                      ? 'text-app-text font-medium'
                      : 'text-app-text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action buttons: Chat, Call, Cancel */}
      <div className="flex gap-2">
        <button
          onClick={onOpenChat}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-app-border rounded-lg text-sm font-semibold text-emerald-600 bg-app-surface hover:bg-app-hover transition"
        >
          <MessageCircle className="w-4 h-4" /> Chat
        </button>
        {isOwner && worker?.phone && (
          <a
            href={`tel:${worker.phone}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-app-border rounded-lg text-sm font-semibold text-emerald-600 bg-app-surface hover:bg-app-hover transition"
          >
            <Phone className="w-4 h-4" /> Call
          </a>
        )}
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-200 rounded-lg text-sm font-semibold text-red-600 bg-app-surface hover:bg-red-50 transition"
        >
          <XCircle className="w-4 h-4" /> Cancel
        </button>
      </div>

      {/* Status update buttons */}
      {updating ? (
        <div className="flex justify-center py-3">
          <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Worker buttons */}
          {isWorker && !fulfillmentStatus && (
            <button
              onClick={() => updateStatus('on_the_way')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
            >
              <Car className="w-4 h-4" /> I&apos;m on the way
            </button>
          )}
          {isWorker && fulfillmentStatus === 'on_the_way' && (
            <button
              onClick={() => updateStatus('arrived')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
            >
              <MapPin className="w-4 h-4" /> I&apos;ve arrived
            </button>
          )}
          {isWorker &&
            (fulfillmentStatus === 'arrived' ||
              fulfillmentStatus === 'in_progress') && (
              <button
                onClick={handleMarkComplete}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
              >
                <CheckCircle className="w-4 h-4" /> Task complete
              </button>
            )}

          {/* Poster buttons */}
          {isOwner && fulfillmentStatus === 'arrived' && (
            <button
              onClick={() => updateStatus('in_progress')}
              className="w-full flex items-center justify-center gap-2 py-3.5 border border-emerald-600 text-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition"
            >
              <Check className="w-4 h-4" /> Confirm arrival
            </button>
          )}
          {isOwner &&
            fulfillmentStatus === 'in_progress' &&
            gig.status !== 'completed' && (
              <button
                onClick={handleConfirmComplete}
                className="w-full flex items-center justify-center gap-2 py-3.5 border border-green-600 text-green-600 rounded-lg font-semibold hover:bg-green-50 transition"
              >
                <CheckCircle className="w-4 h-4" /> Mark complete
              </button>
            )}
        </div>
      )}

      {/* Safety section */}
      <div className="bg-app-surface border border-app-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-app-text-strong">Safety</p>
        <div className="flex gap-2">
          <a
            href="tel:911"
            className="flex-1 py-2.5 bg-red-50 rounded-lg text-center text-sm font-semibold text-red-600 hover:bg-red-100 transition"
          >
            <ShieldAlert className="w-4 h-4 inline-block mr-1" />
            Emergency: 911
          </a>
          <button
            onClick={() =>
              confirmStore.open({
                title: 'Report Issue',
                description:
                  'Report a safety concern with this task?',
                confirmLabel: 'Report',
                variant: 'destructive',
              })
            }
            className="flex-1 py-2.5 bg-red-50 rounded-lg text-center text-sm font-semibold text-red-600 hover:bg-red-100 transition"
          >
            <ShieldAlert className="w-4 h-4 inline-block mr-1" />
            Report issue
          </button>
        </div>
      </div>
    </div>
  );
}
