'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import * as api from '@pantopus/api';
import type { Post } from '@pantopus/api';
import PostComposer, { type PostEditPatch } from './PostComposer';

// Fields a saved edit changes, taken from the server's copy; the viewer's own counts and flags stay.
const EDITED_FIELDS = [
  'content', 'title', 'event_date', 'event_end_date', 'event_venue', 'safety_behavior_description',
  'deal_expires_at', 'deal_business_name', 'lost_found_type', 'service_category', 'tags',
  'is_edited', 'edited_at', 'updated_at',
] as const;

function editedFields(saved: Post): Partial<Post> {
  const source = saved as unknown as Record<string, unknown>;
  const changes: Record<string, unknown> = {};
  for (const key of EDITED_FIELDS) {
    if (key in source) changes[key] = source[key];
  }
  return changes as Partial<Post>;
}

function statusOf(err: unknown): number | undefined {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === 'number' ? status : undefined;
}

/**
 * No reply, or a server/gateway error: the edit may or may not have been applied. Through the web's
 * same-origin API proxy a dropped reply arrives as a 5xx. Sending the same update again is safe.
 */
function worthOneRetry(err: unknown): boolean {
  const status = statusOf(err);
  if (status === undefined) return (err as { code?: unknown } | null)?.code !== 'ERR_CANCELED';
  return status >= 500;
}

interface EditPostDialogProps {
  post: Post;
  user?: { name?: string; first_name?: string; username?: string; profile_picture_url?: string } | null;
  onClose: () => void;
  /** The edit is saved; `changes` are the edited fields from the server's copy. */
  onSaved: (postId: string, changes: Partial<Post>) => void;
  /** The post was deleted elsewhere while it was open, so there is nothing left to edit. */
  onGone: (postId: string) => void;
}

/**
 * Edits one of the viewer's own posts with the composer. A lost reply or server error is sent once
 * more; a save that still fails keeps the edit in the form; a post deleted meanwhile is reported.
 */
export default function EditPostDialog({ post, user, onClose, onSaved, onGone }: EditPostDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const saving = useRef(false);
  const titleId = useId();

  useEffect(() => {
    // The form puts the cursor in the post's text; otherwise let the dialog itself be announced.
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (!saving.current) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
    ) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const save = async (patch: PostEditPatch): Promise<string | null> => {
    saving.current = true;
    try {
      let result: Awaited<ReturnType<typeof api.posts.updatePost>>;
      try {
        result = await api.posts.updatePost(post.id, patch);
      } catch (err) {
        if (!worthOneRetry(err)) throw err;
        result = await api.posts.updatePost(post.id, patch);
      }
      onSaved(post.id, editedFields(result.post));
      return null;
    } catch (err) {
      const status = statusOf(err);
      if (status === 404) {
        onGone(post.id);
        return null;
      }
      if (status === 403) return 'Only the person who posted this can edit it.';
      const reason = err instanceof Error && err.message ? err.message : "Couldn't save your changes.";
      return `${reason} Your edit is still here.`;
    } finally {
      saving.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-app bg-surface shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-app px-5 py-3">
          <h2 id={titleId} className="text-sm font-bold text-app">Edit post</h2>
          <button
            type="button"
            onClick={() => { if (!saving.current) onClose(); }}
            aria-label="Close"
            className="rounded-lg p-1.5 text-app-muted transition hover:text-app hover-bg-app"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <PostComposer editPost={post} onSaveEdit={save} onCancelEdit={onClose} user={user} />
        </div>
      </div>
    </div>
  );
}
