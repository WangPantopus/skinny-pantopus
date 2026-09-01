'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, formatTimeAgo } from '@pantopus/ui-utils';
import type { MapTaskListItem } from './mapTaskTypes';

function getImageUrl(task: MapTaskListItem): string | null {
  if (task.first_image) return task.first_image;
  if (task.attachments?.[0]) return task.attachments[0];
  return null;
}

function getLocationLabel(task: MapTaskListItem): string {
  if (task.is_remote) return 'Remote';
  const cityState = [task.exact_city, task.exact_state].filter(Boolean).join(', ');
  if (cityState) return cityState;
  return 'Current map area';
}

interface MapTaskDrawerProps {
  open: boolean;
  loading: boolean;
  tasks: MapTaskListItem[];
  selectedGigId?: string | null;
  onClose: () => void;
  onOpenGig: (gigId: string) => void;
  onHoverGig?: (gigId: string | null) => void;
}

export default function MapTaskDrawer({
  open,
  loading,
  tasks,
  selectedGigId,
  onClose,
  onOpenGig,
  onHoverGig,
}: MapTaskDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 120);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !selectedGigId) return;
    // Small delay so the drawer slide-in transition renders the task cards first
    const t = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-map-task-id="${selectedGigId}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, selectedGigId, tasks]);

  return (
    <>
      <div
        className={`absolute inset-0 z-[1001] bg-black/20 backdrop-blur-[1px] transition-opacity duration-200 sm:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="complementary"
        aria-label="Tasks in current map area"
        className={`absolute inset-y-0 right-0 z-[1002] w-full max-w-full sm:max-w-[400px] lg:max-w-[460px] border-l border-app-border bg-app-surface/98 shadow-2xl backdrop-blur-md transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-app-border bg-app-surface/95 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-app-text">Tasks in this area</h2>
                <p className="mt-1 text-xs text-app-text-secondary">
                  Updates automatically as you pan and zoom the map.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="rounded-lg p-2 text-app-text-secondary transition hover:bg-app-hover hover:text-app-text"
                aria-label="Close task list"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 inline-flex items-center rounded-full bg-app-surface-sunken px-3 py-1 text-xs font-semibold text-app-text-secondary">
              {loading ? 'Updating tasks…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'} visible`}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading && tasks.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-app-border bg-app-surface-sunken px-4 py-4"
                  >
                    <div className="h-4 w-2/3 rounded bg-app-border-subtle" />
                    <div className="mt-3 h-3 w-1/3 rounded bg-app-border-subtle" />
                    <div className="mt-4 h-3 w-full rounded bg-app-border-subtle" />
                    <div className="mt-2 h-3 w-5/6 rounded bg-app-border-subtle" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-app-border bg-app-surface-sunken px-6 text-center">
                <div className="text-3xl" aria-hidden="true">🗺️</div>
                <h3 className="mt-3 text-sm font-semibold text-app-text">No tasks in view</h3>
                <p className="mt-2 max-w-xs text-sm text-app-text-secondary">
                  Move the map or zoom out to see more tasks in nearby neighborhoods.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <MapTaskCard
                    key={task.id}
                    task={task}
                    selected={selectedGigId === task.id}
                    onOpen={() => onOpenGig(task.id)}
                    onHover={onHoverGig}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function MapTaskCard({
  task,
  selected,
  onOpen,
  onHover,
}: {
  task: MapTaskListItem;
  selected: boolean;
  onOpen: () => void;
  onHover?: (gigId: string | null) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(task);
  const timeAgo = task.created_at ? formatTimeAgo(task.created_at, 'full') : '';
  const locationLabel = getLocationLabel(task);
  const posterName = task.poster_display_name || task.poster_username || 'Pantopus';
  const posterProfileHref = task.poster_username ? `/${task.poster_username}` : null;

  return (
    <div
      role="button"
      tabIndex={0}
      data-map-task-id={task.id}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => onHover?.(task.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(task.id)}
      onBlur={() => onHover?.(null)}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? 'border-primary-400 bg-primary-50 shadow-sm'
          : 'border-app-border bg-app-surface hover:border-primary-200 hover:bg-app-hover'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-app-text">{task.title}</h3>
            <span className="shrink-0 text-sm font-bold text-green-600">
              {formatPrice(Number(task.price) || 0)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-app-text-secondary">
            {task.category && (
              <span className="rounded-full bg-app-surface-sunken px-2 py-1 font-medium text-app-text-secondary">
                {task.category}
              </span>
            )}
            <span>{locationLabel}</span>
            {timeAgo && <span>{timeAgo}</span>}
            {task.is_urgent && (
              <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                ASAP
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-app-text-secondary">
              {task.description}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between">
            {posterProfileHref ? (
              <Link
                href={posterProfileHref}
                onClick={(event) => event.stopPropagation()}
                className="text-xs text-app-text-muted"
              >
                {posterName}
              </Link>
            ) : (
              <span className="text-xs text-app-text-muted">{posterName}</span>
            )}
            <span className="text-xs font-semibold text-primary-600">Open task</span>
          </div>
        </div>

        {imageUrl && !imageError && (
          <Image
            src={imageUrl}
            alt=""
            width={72}
            height={72}
            sizes="72px"
            quality={75}
            onError={() => setImageError(true)}
            className="h-[72px] w-[72px] rounded-xl object-cover"
          />
        )}
      </div>
    </div>
  );
}
