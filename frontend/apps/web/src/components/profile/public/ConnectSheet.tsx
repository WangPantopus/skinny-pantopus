'use client';

import { useEffect, useId, useState } from 'react';
import { UserPlus } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import ProfileAvatar from './atoms/ProfileAvatar';
import { primaryButton, secondaryButton } from './profileButtons';

// POST /api/relationships/requests takes a note of up to 500 characters; it travels only in the request's
// notification (backend/routes/relationships.js), so nothing here promises it is kept on the request.
const NOTE_LIMIT = 500;

interface ConnectSheetProps {
  open: boolean;
  onClose: () => void;
  /** The name this viewer sees. */
  name: string;
  firstName: string;
  photoUrl?: string | null;
  colorSeed: string;
  /** You already follow their public posts: "Just follow" isn't offered again. */
  following: boolean;
  /** Following isn't available (their block list couldn't be read, or a block). */
  canFollow: boolean;
  /** Sends the request with the note; resolves true once it is sent. */
  onSend: (note: string) => Promise<boolean>;
  /** Follows their public posts; resolves true once following. */
  onFollow: () => Promise<boolean>;
}

/**
 * "Connect with Rowan?": what connecting means, an optional note, Send request, and, for someone who only wants
 * the person's public posts, "Just follow".
 */
export default function ConnectSheet({
  open,
  onClose,
  name,
  firstName,
  photoUrl = null,
  colorSeed,
  following,
  canFollow,
  onSend,
  onFollow,
}: ConnectSheetProps) {
  const titleId = useId();
  const noteId = useId();
  const countId = useId();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);

  // Each opening starts with an empty note.
  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const busy = sending || followingBusy;

  const send = async () => {
    if (busy) return;
    setSending(true);
    try {
      if (await onSend(note.trim())) onClose();
    } finally {
      setSending(false);
    }
  };

  const follow = async () => {
    if (busy) return;
    setFollowingBusy(true);
    try {
      if (await onFollow()) onClose();
    } finally {
      setFollowingBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={() => { if (!busy) onClose(); }} labelledBy={titleId}>
      <div className="px-1 pb-1">
        <div className="flex items-center gap-3">
          <ProfileAvatar name={name} seed={colorSeed} photoUrl={photoUrl} size={44} />
          <h2 id={titleId} className="text-[1.375rem] leading-7 font-bold text-app [overflow-wrap:anywhere]">
            Connect with {firstName}?
          </h2>
        </div>
        <p className="mt-3 text-base leading-[1.375rem] text-app-strong">
          You&apos;ll see each other&apos;s connections-only posts and can invite each other to plans. {firstName} approves
          your request first.
        </p>

        <label htmlFor={noteId} className="block mt-[1.125rem] mb-1.5 text-[0.8125rem] leading-[1.125rem] font-semibold text-app-strong">
          Add a note (optional)
        </label>
        <textarea
          id={noteId}
          rows={3}
          value={note}
          maxLength={NOTE_LIMIT}
          onChange={(event) => setNote(event.target.value.slice(0, NOTE_LIMIT))}
          aria-describedby={countId}
          placeholder={`Hi ${firstName}, I live nearby and…`}
          className="block w-full min-h-[6rem] rounded-xl border border-app-strong bg-surface px-3.5 py-3 text-base leading-[1.375rem] text-app placeholder-app-muted resize-y focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p id={countId} className="mt-1 text-right text-xs leading-4 text-app-muted">
          {note.length} / {NOTE_LIMIT}
          <span className="sr-only"> characters. {firstName} sees the note with your request.</span>
        </p>

        <button type="button" onClick={send} disabled={busy} className={`mt-3 w-full ${primaryButton}`}>
          <UserPlus aria-hidden="true" className="w-[1.1875rem] h-[1.1875rem] shrink-0" strokeWidth={2.25} />
          {sending ? 'Sending…' : 'Send request'}
        </button>

        {canFollow && (
          following ? (
            <p className="mt-3.5 text-center text-[0.875rem] leading-5 text-app-muted">
              You already follow {firstName}&apos;s public posts.
            </p>
          ) : (
            <>
              <div aria-hidden="true" className="my-3.5 flex items-center gap-2.5 text-[0.8125rem] leading-[1.125rem] text-app-muted">
                <span className="h-px flex-1 bg-app-border" />
                <span>or</span>
                <span className="h-px flex-1 bg-app-border" />
              </div>
              <button type="button" onClick={follow} disabled={busy} className={`w-full ${secondaryButton}`}>
                {followingBusy ? 'Following…' : `Just follow ${firstName}'s public posts`}
              </button>
              <p className="mt-2 text-center text-[0.8125rem] leading-[1.125rem] text-app-muted">
                Their public posts show up in your Pulse. No request needed.
              </p>
            </>
          )
        )}
      </div>
    </BottomSheet>
  );
}
