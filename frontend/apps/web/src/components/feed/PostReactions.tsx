'use client';

// A post's emoji reactions (every kind but an event, whose reaction is Going): the card's pill, the post page's
// counts and the bar of emoji both open. One reaction per person; the same on iOS and Android
// (docs: backend/utils/postReaction.js).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';
import {
  POST_REACTION_EMOJIS,
  postReactionId,
  postReactionName,
  postReactionsSpoken,
  shownPostReactions,
  summaryReactionEmojis,
  viewerPostReaction,
  withViewerReaction,
  type PostReactionCount,
} from '@pantopus/ui-utils';
import type { Post } from '@pantopus/types';

type ReactedPost = Pick<Post, 'id' | 'like_count' | 'reactions' | 'userReaction' | 'userHasLiked'>;
type ReactionFields = Pick<Post, 'like_count' | 'reactions' | 'userReaction' | 'userHasLiked'>;

/** The fields a tap changes, to show it at once: the viewer's emoji, each emoji's count and the total. */
export function reactedPostPatch(post: ReactionFields, next: string | null): ReactionFields {
  const mine = viewerPostReaction(post);
  return {
    reactions: withViewerReaction(shownPostReactions(post), mine, next),
    userReaction: next,
    userHasLiked: next != null,
    like_count: Math.max(0, (post.like_count ?? 0) + (next ? 1 : 0) - (mine ? 1 : 0)),
  };
}

/** The same fields as the post had them, to put back when the server refuses a tap. */
export function reactionFieldsOf(post: ReactionFields): ReactionFields {
  return { reactions: post.reactions, userReaction: post.userReaction, userHasLiked: post.userHasLiked, like_count: post.like_count };
}

/** The server's answer as those fields; without counts (it couldn't read them) the ones on screen stay. */
export function serverReactionPatch(
  res: { liked: boolean; likeCount: number; reaction: string | null; reactions?: PostReactionCount[] },
  shown: PostReactionCount[] | undefined,
): ReactionFields {
  return { userReaction: res.reaction, userHasLiked: res.liked, like_count: res.likeCount, reactions: res.reactions ?? shown };
}

const selectedClass = 'text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300';

/**
 * The seven emoji in a bar beside the control that opened it. Picking one sets it; picking the viewer's own takes it
 * away. It's drawn over the page, so it follows its control as the page scrolls or resizes, and closes once the control
 * leaves the screen; Escape or a click elsewhere closes it too.
 */
function ReactionPicker({
  anchor,
  current,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  current: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Above the control (below it when there's no room above), kept inside the window; gone with the control.
  const place = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    if (!anchor.isConnected || rect.bottom < 0 || rect.top > window.innerHeight) {
      onClose();
      return;
    }
    const width = barRef.current?.offsetWidth ?? 0;
    const height = barRef.current?.offsetHeight ?? 0;
    const above = rect.top - height - 8;
    setPosition({
      top: above >= 8 ? above : rect.bottom + 8,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
    });
  }, [anchor, onClose]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  useEffect(() => {
    const buttons = barRef.current?.querySelectorAll<HTMLButtonElement>('button');
    const index = POST_REACTION_EMOJIS.findIndex((option) => option.emoji === current);
    buttons?.[Math.max(0, index)]?.focus({ preventScroll: true });
  }, [current]);

  useEffect(() => {
    // Escape closes the bar and nothing under it (the post panel also closes on Escape), so it's caught first.
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
      anchor.focus();
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!barRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [anchor, onClose]);

  // Left and right move between the emoji, as in a toolbar.
  const onArrow = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = [...(barRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[(at + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
    next?.focus();
    event.preventDefault();
  };

  return createPortal(
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Reactions"
      onKeyDown={onArrow}
      style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 9999 }}
      className="flex items-center gap-0.5 p-1 bg-surface rounded-full shadow-lg border border-app"
    >
      {POST_REACTION_EMOJIS.map((option) => {
        const selected = option.emoji === current;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onPick(option.emoji)}
            aria-label={option.name}
            aria-pressed={selected}
            title={option.name}
            data-testid={`pulseReactionOption_${option.id}`}
            className={`w-10 h-10 flex items-center justify-center rounded-full text-xl leading-none transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
              selected ? 'bg-sky-100 ring-1 ring-sky-300 dark:bg-sky-900/40 dark:ring-sky-700' : 'hover:bg-surface-muted'
            }`}
          >
            <span aria-hidden="true">{option.emoji}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** A control that opens the picker: its open state and the element the bar sits beside. */
function usePicker() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const toggle = useCallback((element: HTMLElement) => setAnchor((open) => (open ? null : element)), []);
  return { anchor, close, toggle };
}

/**
 * The card's reaction: "React" before anyone reacted, then up to three emoji (the most used, the viewer's own always
 * among them) and how many people reacted ("👍❤️😂 6"). Tinted once the viewer reacted. It opens the picker.
 */
export function PostReactionPill({
  post,
  pending,
  onReact,
}: {
  post: ReactedPost;
  pending?: boolean;
  onReact: (reaction: string | null) => void;
}) {
  const picker = usePicker();
  const reactions = shownPostReactions(post);
  const total = reactions.reduce((sum, entry) => sum + entry.count, 0);
  const mine = viewerPostReaction(post);
  const label = total === 0 ? 'React' : `Reactions, ${total}: ${postReactionsSpoken(reactions)}`;
  return (
    <>
      <button
        type="button"
        onClick={(event) => picker.toggle(event.currentTarget)}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-haspopup="true"
        aria-expanded={Boolean(picker.anchor)}
        aria-label={mine ? `${label}. Your reaction: ${postReactionName(mine)}` : label}
        data-testid={`pulseReaction_${post.id}`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${pending ? 'opacity-60 ' : ''}${
          mine ? selectedClass : 'text-app-muted hover-bg-app'
        }`}
      >
        {total === 0 ? (
          <>
            <Smile className="w-4 h-4" aria-hidden="true" />
            <span>React</span>
          </>
        ) : (
          <>
            <span className="text-sm leading-none" aria-hidden="true">{summaryReactionEmojis(reactions, mine).join('')}</span>
            <span>{total}</span>
          </>
        )}
      </button>
      {picker.anchor && (
        <ReactionPicker
          anchor={picker.anchor}
          current={mine}
          onClose={picker.close}
          onPick={(emoji) => {
            picker.close();
            onReact(emoji === mine ? null : emoji);
          }}
        />
      )}
    </>
  );
}

/**
 * The post page's reactions: each emoji someone picked with its count ("👍 3"), the viewer's own tinted, then a button
 * that opens the picker ("React" while nobody has). A count's chip sets that emoji, or takes the viewer's own away.
 */
export function PostReactionBar({
  post,
  pending,
  onReact,
  className = '',
}: {
  post: ReactedPost;
  pending?: boolean;
  onReact: (reaction: string | null) => void;
  className?: string;
}) {
  const picker = usePicker();
  const reactions = shownPostReactions(post);
  const mine = viewerPostReaction(post);
  const chipClass = (selected: boolean) => `flex items-center gap-1 h-8 px-2.5 rounded-full border text-xs font-medium transition-colors ${
    pending ? 'opacity-60 ' : ''
  }${selected ? `${selectedClass} border-sky-300 dark:border-sky-700` : 'border-app text-app-muted hover-bg-app'}`;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {reactions.map((entry) => {
        const selected = entry.reaction === mine;
        return (
          <button
            key={entry.reaction}
            type="button"
            onClick={() => onReact(selected ? null : entry.reaction)}
            disabled={pending}
            aria-pressed={selected}
            aria-label={`${postReactionName(entry.reaction)}, ${entry.count}`}
            data-testid={`pulsePostDetail-reaction-${postReactionId(entry.reaction)}`}
            className={chipClass(selected)}
          >
            <span className="text-base leading-none" aria-hidden="true">{entry.reaction}</span>
            <span>{entry.count}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={(event) => picker.toggle(event.currentTarget)}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-haspopup="true"
        aria-expanded={Boolean(picker.anchor)}
        aria-label="Add a reaction"
        data-testid="pulsePostDetail-reactionAdd"
        className={chipClass(false)}
      >
        <Smile className="w-4 h-4" aria-hidden="true" />
        {reactions.length === 0 && <span>React</span>}
      </button>
      {picker.anchor && (
        <ReactionPicker
          anchor={picker.anchor}
          current={mine}
          onClose={picker.close}
          onPick={(emoji) => {
            picker.close();
            onReact(emoji === mine ? null : emoji);
          }}
        />
      )}
    </div>
  );
}
