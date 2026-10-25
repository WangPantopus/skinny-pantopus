'use client';

import { useCallback, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, Undo2 } from 'lucide-react';
import * as api from '@pantopus/api';
import type { PostType } from '@pantopus/api';
import type { AIPostSuggestion, AIPostSuggestionRequest } from '@pantopus/types';
import type { PostFormState } from './usePostForm';

/**
 * The composer's AI assist (`POST /api/ai/draft/post-suggestion`): the whole post suggested from the person's photos,
 * the place they picked and what they've written so far, put into the composer's own fields. The person changes
 * anything they like; Post asks them to check it first ("Post this?"), and Undo puts the form back. Mirrors the iOS
 * and Android composers' "Write it with AI" card.
 */

export type PostAssistState =
  | { kind: 'idle' }
  | { kind: 'writing' }
  | { kind: 'suggested'; note: string | null }
  | { kind: 'failed'; message: string };

/** Where the post goes and how its form looks, for the suggestion. */
export interface PostAssistTarget {
  postType: PostType;
  audience: 'nearby' | 'connections';
  /** The area the post goes to ("Camas"); never a street address. */
  place?: string;
  /** The form shows a title field for this kind of post. */
  showsTitle: boolean;
}

// The fields a suggestion fills, for Undo.
const ASSIST_FIELDS = [
  'content', 'title', 'eventVenue', 'eventDate', 'eventEndDate', 'dealBusinessName', 'dealExpires', 'lostFoundType',
  'safetyKind', 'tags',
] as const;
type AssistField = (typeof ASSIST_FIELDS)[number];
type AssistValues = Pick<PostFormState, AssistField>;

// What the post-media upload and the suggestion take for a photo.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 9;
const MAX_ASSIST_PHOTOS = 4;
const MAX_EDGE = 1600;
const ALERT_KINDS = ['road_hazard', 'power_outage', 'weather_damage', 'missing_pet', 'hazard', 'other'];
const FALLBACK = 'Couldn’t write a suggestion. Try again, or write the post yourself.';
const UNREADABLE = 'Couldn’t read that photo here. Try a JPEG or PNG, or write a few words.';

const hasWords = (fields: AIPostSuggestionRequest) =>
  [fields.title, fields.body, fields.businessName, fields.eventVenue].some((value) => value?.trim());

const isImage = (file: File) => file.type.startsWith('image/');

function valuesOf(f: PostFormState): AssistValues {
  return Object.fromEntries(ASSIST_FIELDS.map((key) => [key, f[key]])) as AssistValues;
}

/**
 * A photo as the suggestion reads it: a JPEG of at most 1600px, drawn on a canvas, which leaves its EXIF (where and
 * when it was taken) behind. Null when this browser can't decode it (HEIC outside Safari).
 */
async function suggestionPhoto(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  } catch {
    return null;
  }
}

/**
 * The suggestion's values for the form. The title and the text are replaced; a venue or business the person already
 * filled in stays; the choices (lost or found, the kind of heads-up, when a deal ends) follow the suggestion, and the
 * tags fill in when there are none.
 */
function suggestedValues(current: AssistValues, suggestion: AIPostSuggestion, target: PostAssistTarget): AssistValues {
  const next = { ...current };
  const text = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() : '');
  const fillEmpty = (key: 'eventVenue' | 'eventDate' | 'eventEndDate' | 'dealBusinessName', value: string | null) => {
    if (text(value) && !current[key].trim()) next[key] = text(value);
  };
  if (target.showsTitle && text(suggestion.title)) next.title = text(suggestion.title);
  if (text(suggestion.body)) next.content = text(suggestion.body);
  if (target.postType === 'event') {
    fillEmpty('eventVenue', suggestion.eventVenue);
    fillEmpty('eventDate', suggestion.eventDate);
    fillEmpty('eventEndDate', suggestion.eventEndDate);
  }
  if (target.postType === 'deal') {
    fillEmpty('dealBusinessName', suggestion.businessName);
    if (suggestion.dealExpiresAt) next.dealExpires = suggestion.dealExpiresAt;
  }
  if (target.postType === 'lost_found' && suggestion.lostFoundType) next.lostFoundType = suggestion.lostFoundType;
  if (target.postType === 'alert' && suggestion.safetyAlertKind && ALERT_KINDS.includes(suggestion.safetyAlertKind)) {
    next.safetyKind = suggestion.safetyAlertKind;
  }
  if (!current.tags.trim() && suggestion.tags?.length) next.tags = suggestion.tags.slice(0, 3).join(', ');
  return next;
}

/** The assist's state and actions for one composer. */
export function usePostAssist(
  f: PostFormState,
  setField: <K extends keyof PostFormState>(field: K, value: PostFormState[K]) => void,
  target: PostAssistTarget,
) {
  const [assist, setAssist] = useState<PostAssistState>({ kind: 'idle' });
  // The form before the suggestion went in (Undo), and what the suggestion put there.
  const [before, setBefore] = useState<AssistValues | null>(null);
  const [applied, setApplied] = useState<AssistValues | null>(null);
  const latest = useRef(f);
  latest.current = f;

  // Undo stays until the person edits the suggestion.
  const canUndo = before !== null && applied !== null && ASSIST_FIELDS.every((key) => f[key] === applied[key]);
  const hasAISuggestion = applied !== null;
  const photoCount = Math.min(f.mediaFiles.filter(isImage).length, MAX_ASSIST_PHOTOS);
  const hasMaterial = photoCount > 0 || Boolean(f.content.trim() || (target.showsTitle && f.title.trim())
    || (target.postType === 'event' && f.eventVenue.trim()) || (target.postType === 'deal' && f.dealBusinessName.trim()));

  const suggest = useCallback(async (added: File[] = []) => {
    if (assist.kind === 'writing') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setAssist({ kind: 'failed', message: 'You’re offline. Try again when you’re back online.' });
      return;
    }
    // "Try again" right after a suggestion starts over from what the person wrote, not from the suggestion.
    const written = canUndo && before ? before : valuesOf(latest.current);
    const fields: AIPostSuggestionRequest = {
      postType: target.postType,
      audience: target.audience,
      title: target.showsTitle ? written.title : undefined,
      body: written.content,
      businessName: target.postType === 'deal' ? written.dealBusinessName : undefined,
      eventVenue: target.postType === 'event' ? written.eventVenue : undefined,
      place: target.place,
    };
    const images = [...latest.current.mediaFiles, ...added].filter(isImage).slice(0, MAX_ASSIST_PHOTOS);
    setAssist({ kind: 'writing' });
    try {
      const photos = (await Promise.all(images.map(suggestionPhoto))).filter((photo): photo is Blob => photo !== null);
      if (images.length > 0 && photos.length === 0 && !hasWords(fields)) {
        setAssist({ kind: 'failed', message: UNREADABLE });
        return;
      }
      const { suggestion, note } = await api.ai.suggestPost(fields, photos);
      const now = valuesOf(latest.current);
      const next = suggestedValues(now, suggestion, target);
      for (const key of ASSIST_FIELDS) {
        if (next[key] !== now[key]) setField(key, next[key]);
      }
      // A second suggestion keeps the first one's Undo: back to the person's own words.
      setBefore((kept) => (kept && canUndo ? kept : now));
      setApplied(next);
      setAssist({ kind: 'suggested', note: note?.trim() || null });
    } catch (e) {
      setAssist({ kind: 'failed', message: e instanceof Error && e.message ? e.message : FALLBACK });
    }
  }, [assist.kind, before, canUndo, setField, target]);

  const undo = useCallback(() => {
    if (!before) return;
    for (const key of ASSIST_FIELDS) setField(key, before[key]);
    setBefore(null);
    setApplied(null);
    setAssist({ kind: 'idle' });
  }, [before, setField]);

  const reset = useCallback(() => {
    setBefore(null);
    setApplied(null);
    setAssist({ kind: 'idle' });
  }, []);

  return { assist, canUndo, hasAISuggestion, hasMaterial, photoCount, suggest, undo, reset };
}

interface PostAssistProps {
  assist: PostAssistState;
  hasMaterial: boolean;
  photoCount: number;
  canUndo: boolean;
  /** How many more attachments the post takes. */
  remainingAttachments: number;
  onSuggest: (added?: File[]) => void;
  onUndo: () => void;
  /** Photos chosen from the card join the attachments; the suggestion follows them. */
  onAddPhotos: (files: File[]) => void;
}

/** The "Write it with AI" card under the composer's text box. */
export default function PostAssist({
  assist, hasMaterial, photoCount, canUndo, remainingAttachments, onSuggest, onUndo, onAddPhotos,
}: PostAssistProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  let message: string;
  if (assist.kind === 'writing') message = 'Writing your post…';
  else if (assist.kind === 'suggested') message = 'Suggested by AI. Check it and change anything before you post.';
  else if (assist.kind === 'failed') message = assist.message;
  else if (!hasMaterial) message = 'Add a photo and Pantopus suggests the whole post. You can change anything before you post.';
  else {
    const source = photoCount === 0 ? 'finish this post from what you wrote'
      : photoCount === 1 ? 'write this post from your photo' : 'write this post from your photos';
    message = `Pantopus can ${source}. You can change anything before you post.`;
  }

  const buttonClass = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
  const primaryClass = `${buttonClass} bg-primary-600 text-white hover:bg-primary-700`;
  const ghostClass = `${buttonClass} border border-app bg-surface text-app hover-bg-app`;

  return (
    <div className="rounded-xl bg-primary-50 px-3 py-2.5 dark:bg-primary-500/10" data-testid="composer-ai-assist">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-300" aria-hidden />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-app">Write it with AI</p>
          <p
            role={assist.kind === 'failed' ? 'alert' : 'status'}
            className={`text-xs ${assist.kind === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-app-secondary'}`}
          >
            {message}
          </p>
          {assist.kind === 'suggested' && assist.note && <p className="text-xs text-app">{assist.note}</p>}
          {pickError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{pickError}</p>}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {assist.kind === 'writing' ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-label="Writing your post" />
        ) : assist.kind === 'suggested' ? (
          <>
            {canUndo && (
              <button type="button" onClick={onUndo} className={ghostClass}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
              </button>
            )}
            <button type="button" onClick={() => onSuggest()} className={ghostClass}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Try again
            </button>
          </>
        ) : hasMaterial ? (
          <>
            {/* A retry that failed leaves the first suggestion in the form, and its Undo. */}
            {assist.kind === 'failed' && canUndo && (
              <button type="button" onClick={onUndo} className={ghostClass}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
              </button>
            )}
            <button type="button" onClick={() => onSuggest()} className={primaryClass}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {assist.kind === 'failed' ? 'Try again' : 'Suggest post'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={remainingAttachments === 0}
            className={primaryClass}
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Add photos
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          const usable = files
            .filter((file) => IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES)
            .slice(0, Math.max(0, Math.min(remainingAttachments, MAX_ATTACHMENTS)));
          setPickError(usable.length < files.length
            ? 'Some photos weren’t added. Choose JPEG, PNG, GIF, WebP, AVIF or HEIC photos of up to 10 MB.'
            : null);
          if (usable.length === 0) return;
          onAddPhotos(usable);
          onSuggest(usable);
        }}
      />
    </div>
  );
}
