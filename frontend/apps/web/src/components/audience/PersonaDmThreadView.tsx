'use client';

// Shared chat-style DM thread view for the audience surface.
// Audience Profile design v2 §11.5 (fan opens DM) + §11.7 (creator
// reply panel). Used by both the creator's inbox view and the fan's
// membership inbox.

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { PersonaDmThreadDetail, PersonaDmMessage } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

interface Props {
  personaId: string;
  threadId: string;
  // Optional callback after a successful send so parent state can
  // bump unread counters / refresh inbox lists.
  onMessageSent?: (message: PersonaDmMessage) => void;
}

export function PersonaDmThreadView({ personaId, threadId, onMessageSent }: Props) {
  const [detail, setDetail] = useState<PersonaDmThreadDetail | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    api.personaDms.getThread(personaId, threadId)
      .then((res) => { if (!cancelled) setDetail(res); })
      .catch(() => { if (!cancelled) setLoadError('Could not load this thread.'); });
    return () => { cancelled = true; };
  }, [personaId, threadId]);

  // Auto-scroll to the bottom whenever new messages arrive.
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [detail?.messages?.length]);

  async function send() {
    if (sending || !body.trim()) return;
    setSending(true);
    try {
      const res = await api.personaDms.sendMessage(personaId, threadId, {
        body: body.trim(),
      });
      setDetail((prev) => prev ? {
        ...prev,
        messages: [...prev.messages, res.message],
      } : prev);
      setBody('');
      onMessageSent?.(res.message);
    } catch {
      toast.error('Could not send message.');
    } finally {
      setSending(false);
    }
  }

  async function requestRefund() {
    if (requestingRefund) return;
    setRequestingRefund(true);
    try {
      await api.personaMembership.requestRefund(personaId, {
        reason: 'sla_missed',
        thread_id: threadId,
      });
      toast.success('Refund request submitted. Your membership will remain available through the current period.');
      setDetail((prev) => prev ? { ...prev, replyPolicyStatus: null } : prev);
    } catch {
      toast.error('Could not request a refund.');
    } finally {
      setRequestingRefund(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
        {loadError}
      </p>
    );
  }

  if (!detail) {
    return <p className="text-sm text-app-secondary" aria-busy>Loading thread…</p>;
  }

  const slaMissed = detail.replyPolicyStatus?.status === 'sla_missed';

  return (
    <div className="flex h-full min-h-[500px] flex-col gap-3" data-testid="persona-dm-thread">
      <header className="border-b border-app-strong pb-2">
        {detail.viewerRole === 'creator' ? (
          <p className="text-sm text-app-secondary">
            Conversation with{' '}
            <span className="font-medium text-app">@{detail.fan.handle}</span>
          </p>
        ) : (
          <p className="text-sm text-app-secondary">
            Conversation with{' '}
            <span className="font-medium text-app">{detail.persona.displayName}</span>
            {' · '}
            <span>@{detail.persona.handle}</span>
          </p>
        )}
      </header>

      {slaMissed ? (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Reply was promised within {detail.replyPolicyStatus?.slaDays} days and
          hasn&rsquo;t arrived yet.{' '}
          <button
            type="button"
            onClick={requestRefund}
            disabled={requestingRefund}
            className="font-medium underline"
          >
            {requestingRefund ? 'Requesting...' : 'Request a refund'}
          </button>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto rounded-md border border-app-strong bg-surface p-3"
      >
        {detail.messages.length === 0 ? (
          <p className="text-sm text-app-secondary">No messages yet.</p>
        ) : (
          <ul className="space-y-2">
            {detail.messages.map((m) => {
              const fromViewer = m.senderRole === detail.viewerRole;
              return (
                <li
                  key={m.id}
                  className={`flex ${fromViewer ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      fromViewer
                        ? 'bg-teal-600 text-white'
                        : 'bg-app/30 text-app'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-xs ${fromViewer ? 'text-teal-100' : 'text-app-secondary'}`}>
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-end gap-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          rows={2}
          className="min-w-0 flex-1 resize-none rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          disabled={sending || body.trim().length === 0}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export default PersonaDmThreadView;
