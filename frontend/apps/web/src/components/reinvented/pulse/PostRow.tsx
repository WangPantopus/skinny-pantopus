'use client';

// A post that stays, in the one Pulse list (phase 1): today's Pulse card, unchanged, under one status line that says
// what it is and how it stands; the list's band lines already say how far it is ("Question · 3 answers", "Solved", "Spot · 8 want to go", "Plan · 4 going").

import type { ComponentProps } from 'react';
import { Camera, MapPin } from 'lucide-react';
import type { Post } from '@pantopus/api';
import PostCard from '@/components/feed/PostCard';
import { studioPostPicture } from './StudioPostPicture';
import type { Point } from './listApi';
import { PassItOn, travelLine } from '../passon/PassOn';

type CardProps = Omit<ComponentProps<typeof PostCard>, 'post'>;

/** The status line's words, from fields today's posts already carry; null for a kind that has none. */
export function statusLine(post: Post): { words: string; tone: string } | null {
  const p = post as Post & { resolved_at?: string | null; state?: string | null; signals?: { signal: string; count: number }[] };
  const answers = Number(p.comment_count) || 0;
  switch (String(p.post_type)) {
    case 'ask_local':
      if (p.resolved_at || p.state === 'solved') return { words: 'Solved', tone: 'done' };
      return { words: answers ? `Question · ${answers} ${answers === 1 ? 'answer' : 'answers'}` : 'Question · stays until answered', tone: 'ask' };
    case 'share':
    case 'recommendation': {
      const want = p.signals?.find((s) => s.signal === 'want_to_go')?.count || 0;
      return { words: want ? `Spot · ${want} want to go` : 'Spot', tone: 'spot' };
    }
    case 'event': {
      const going = Number(p.like_count) || 0;
      return { words: going ? `Plan · ${going} going` : 'Plan', tone: 'plan' };
    }
    case 'alert':
      return { words: 'Heads-up', tone: 'alert' };
    case 'lost_found':
      return { words: p.resolved_at || p.state === 'solved' ? 'Lost and found · claimed' : 'Lost and found · until claimed', tone: 'lost' };
    case 'offer':
      return { words: 'Offer', tone: 'offer' };
    default:
      return null;
  }
}

export default function PostRow({
  post,
  point,
  onPlace,
  card,
  onAnswer,
}: {
  post: Post;
  point: Point | null;
  onPlace(point: Point): void;
  card: CardProps;
  /** An open Eyes-on Ask: answer it with a Live photo from the place (CONTRACT 8f). */
  onAnswer?(ask: { id: string; question: string }): void;
}) {
  const status = statusLine(post);
  // Who carried it, who it came from, or an Eyes-on Ask's window (CONTRACT 8f).
  const travel = travelLine(post);
  return (
    <div className="rp-post">
      {(status || point || travel) && (
        <div className="rp-post-status">
          {status && (
            <span className="rp-status" data-tone={status.tone}>
              {status.words}
            </span>
          )}
          {travel && <span className="po-travel">{travel}</span>}
          {point && (
            <button type="button" className="rp-place-button" onClick={() => onPlace(point)} aria-label="Show this post’s place on the map">
              <MapPin size={15} aria-hidden />
              On the map
            </button>
          )}
        </div>
      )}
      {/* Today's card, one size step smaller in the new Pulse only (PHASE-6 C), drawn from this wrapper so its own file is
          untouched (pulse.css, .rp-post-card). */}
      <div className="rp-post-card">
        <PostCard post={post} {...card} overMedia={studioPostPicture} />
      </div>
      <PassItOn post={post} />
      {onAnswer && (post as Post & { eyes_on?: { open: boolean } | null }).eyes_on?.open && (
        <button
          type="button"
          className="rp-place-button"
          onClick={() => onAnswer({ id: post.id, question: (post.title || post.content || '').slice(0, 80) })}
        >
          <Camera size={15} aria-hidden />
          Answer with a Live photo
        </button>
      )}
    </div>
  );
}
