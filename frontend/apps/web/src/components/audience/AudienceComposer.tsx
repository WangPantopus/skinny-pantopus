'use client';

/**
 * AudienceComposer — the audience-zone post composer.
 *
 * Per unified-IA §4.2 + §4.3, this is the ONLY surface where persona
 * content is created from inside the app. It cannot post to a Personal-
 * zone destination because the component literally has no fields for
 * one — the "Posting as" signature is fixed to the persona handle and
 * the "Visible to" picker only offers persona-valid audiences (Public /
 * Followers / Members / Insiders). The two-composer split from §4.3 is
 * the safety guarantee.
 *
 * Submission goes through the existing broadcast pipeline:
 *   POST /api/broadcast/channels/:channelId/messages
 * which is already gated server-side by audience_profile + persona
 * ownership. There is no fallback path through /api/posts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Megaphone, Send, Video, X } from 'lucide-react';
import * as api from '@pantopus/api';
import type { BroadcastMessage } from '@pantopus/types';
import type { MembershipStats } from '@pantopus/api';

type ComposerVisibility = 'public' | 'followers' | 'members' | 'insiders';

interface VisibilityOption {
  value: ComposerVisibility;
  label: string;
  visibility: 'public' | 'followers' | 'tier_or_above';
  targetTierRank: number | null;
}

const VISIBILITY_OPTIONS: ReadonlyArray<VisibilityOption> = [
  { value: 'public',    label: 'Public',    visibility: 'public',        targetTierRank: null },
  { value: 'followers', label: 'Followers', visibility: 'followers',     targetTierRank: null },
  { value: 'members',   label: 'Members',   visibility: 'tier_or_above', targetTierRank: 2 },
  { value: 'insiders',  label: 'Insiders',  visibility: 'tier_or_above', targetTierRank: 3 },
];

export interface AudienceComposerProps {
  personaId: string;
  personaHandle: string;
  channelId: string;
  /** Called after a successful publish so the parent can refresh the timeline. */
  onPosted?: (message: BroadcastMessage) => void;
}

export function AudienceComposer({
  personaId,
  personaHandle,
  channelId,
  onPosted,
}: AudienceComposerProps) {
  const [body, setBody] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<ComposerVisibility>('followers');
  const [stats, setStats] = useState<MembershipStats | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.personas.getMembershipStats(personaId)
      .then((res) => { if (!cancelled) setStats(res.counts); })
      .catch(() => { if (!cancelled) setStats(null); });
    return () => { cancelled = true; };
  }, [personaId]);

  const reachLabel = useCallback((option: VisibilityOption): string => {
    if (!stats) return '';
    if (option.value === 'public')    return 'anyone';
    if (option.value === 'followers') return `${stats.followers.toLocaleString()} reach`;
    if (option.value === 'members')   return `${stats.members.toLocaleString()} reach`;
    if (option.value === 'insiders')  return `${stats.insiders.toLocaleString()} reach`;
    return '';
  }, [stats]);

  const selectedOption =
    VISIBILITY_OPTIONS.find((o) => o.value === visibility) ?? VISIBILITY_OPTIONS[1];

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const media = Array.from(files)
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    setMediaFiles((prev) => [...prev, ...media].slice(0, 9));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handlePost = useCallback(async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: {
        body: string;
        visibility: typeof selectedOption.visibility;
        target_tier_rank?: number;
      } = {
        body: body.trim(),
        visibility: selectedOption.visibility,
      };
      if (selectedOption.targetTierRank !== null) {
        payload.target_tier_rank = selectedOption.targetTierRank;
      }
      const res = await api.broadcast.publishBroadcastMessage(channelId, payload);
      let postedMessage = res.message;
      if (mediaFiles.length > 0) {
        try {
          const upload = await api.upload.uploadPostMedia(postedMessage.id, mediaFiles);
          postedMessage = {
            ...postedMessage,
            media: upload.media_urls.map((url: string, index: number) => ({
              url,
              type: upload.media_types[index] || 'image',
            })),
          };
        } catch {
          setError('Update posted, but some media failed to upload.');
        }
      }
      setBody('');
      setMediaFiles([]);
      onPosted?.(postedMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post update.');
    } finally {
      setSubmitting(false);
    }
  }, [body, submitting, mediaFiles, channelId, selectedOption, onPosted]);

  return (
    <section
      aria-label="Compose audience update"
      data-testid="audience-composer"
      data-zone="audience"
      className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm dark:border-teal-900/40 dark:bg-neutral-900"
    >
      {/*
        Posting-as label is FIXED — never a picker. Per unified-IA §4.1
        the audience composer is locked to the persona signature, by
        design. The teal pill matches the AudienceZoneHeader so the
        visual zone cue extends into the composer.
      */}
      <div
        className="mb-3 flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300"
        data-testid="audience-composer-posting-as"
      >
        <Megaphone className="h-4 w-4" aria-hidden />
        <span>Posting as</span>
        <span className="font-medium">@{personaHandle}</span>
      </div>

      <textarea
        aria-label="Update body"
        data-testid="audience-composer-body"
        value={body}
        onChange={(e) => { setBody(e.target.value); if (error) setError(null); }}
        rows={5}
        maxLength={5000}
        className="w-full resize-none rounded-lg border border-app-strong bg-surface px-3 py-2 text-sm text-app outline-none focus:ring-2 focus:ring-teal-400"
        placeholder="What's the update for fans..."
      />

      {mediaFiles.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {mediaFiles.map((file, index) => {
            const isVideo = file.type.startsWith('video/');
            return (
              <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-app bg-surface-muted px-3 py-2">
                {isVideo ? <Video className="h-4 w-4 shrink-0 text-teal-700" /> : <ImageIcon className="h-4 w-4 shrink-0 text-teal-700" />}
                <span className="min-w-0 flex-1 truncate text-xs text-app-secondary">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setMediaFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-full p-1 text-app-muted hover:bg-surface hover:text-app"
                  aria-label="Remove media"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="mt-2 text-sm font-medium text-app-secondary">
        Visible to: {selectedOption.label}
        {reachLabel(selectedOption) ? ` · ${reachLabel(selectedOption)}` : ''}
      </p>
      {visibility === 'public' ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Anyone with the link can see this update.
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          aria-label="Update visibility"
          data-testid="audience-composer-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ComposerVisibility)}
          className="rounded-lg border border-app-strong bg-surface px-3 py-2 text-sm text-app outline-none focus:ring-2 focus:ring-teal-400"
        >
          {VISIBILITY_OPTIONS.map((option) => {
            const reach = reachLabel(option);
            return (
              <option key={option.value} value={option.value}>
                {option.label}
                {reach ? ` · ${reach}` : ''}
              </option>
            );
          })}
        </select>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => handleFilesSelected(event.currentTarget.files)}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={mediaFiles.length >= 9 || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-app bg-surface px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageIcon className="h-4 w-4" aria-hidden />
          Media
          {mediaFiles.length > 0 ? <span className="text-xs text-app-muted">{mediaFiles.length}/9</span> : null}
        </button>

        <button
          type="button"
          onClick={handlePost}
          disabled={submitting || body.trim().length === 0}
          data-testid="audience-composer-submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
        >
          <Send className="h-4 w-4" aria-hidden />
          {submitting ? 'Posting…' : 'Post update'}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}

export default AudienceComposer;
