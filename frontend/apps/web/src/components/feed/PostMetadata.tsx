'use client';

import { Calendar, MapPin, Store, Clock, Search, CheckCircle, Wrench } from 'lucide-react';
import type { Post } from '@pantopus/types';
import { lostFoundContactLabel } from './composer/LostFoundFields';

/**
 * An Event's start or end, "Nov 8, 7:00 PM". Every composer stores the wall-clock time the poster picked, labelled UTC,
 * so it's shown in UTC. A plan's post (made by Plans, `post_metadata.plan`) stores the real moment, so it's shown in
 * the reader's own time zone.
 */
function eventTime(value: string, plan: boolean): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(plan ? {} : { timeZone: 'UTC' }),
  });
}

/** Keep the same saved details visible in cards, reply panels and full post pages. */
export default function PostMetadata({ post, onClick, spacing = 'mx-4 mb-2' }: {
  post: Post;
  onClick?: () => void;
  spacing?: string;
}) {
  const plan = post.post_metadata?.plan === true;
  return <>
      {(post.post_type === 'event') && (post.event_date || post.event_venue) && (
        <div className={`${spacing} p-3 bg-blue-50 rounded-xl border-l-4 border-blue-400 space-y-1${onClick ? ' cursor-pointer' : ''}`} onClick={onClick}>
          {post.event_date && (
            <div className="flex items-center gap-2 text-xs text-blue-800">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {eventTime(post.event_date, plan)}
                {post.event_end_date ? ` – ${eventTime(post.event_end_date, plan)}` : ''}
              </span>
            </div>
          )}
          {post.event_venue && (
            <div className="flex items-center gap-2 text-xs text-blue-800">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="min-w-0 break-words">{post.event_venue}</span>
            </div>
          )}
        </div>
      )}

      {post.post_type === 'deal' && (post.deal_business_name || post.deal_expires_at) && (
        <div className={`${spacing} p-3 bg-green-50 rounded-xl border-l-4 border-green-400 space-y-1${onClick ? ' cursor-pointer' : ''}`} onClick={onClick}>
          {post.deal_business_name && (
            <div className="flex items-center gap-2 text-xs text-green-800">
              <Store className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="min-w-0 break-words">{post.deal_business_name}</span>
            </div>
          )}
          {post.deal_expires_at && (
            <div className="flex items-center gap-2 text-xs text-green-800">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Expires {new Date(post.deal_expires_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>
            </div>
          )}
        </div>
      )}

      {post.post_type === 'lost_found' && post.lost_found_type && (
        <div className={`${spacing} p-3 bg-yellow-50 rounded-xl border-l-4 border-yellow-400${onClick ? ' cursor-pointer' : ''}`} onClick={onClick}>
          <div className="flex items-center gap-2 text-xs text-yellow-800 font-bold">
            {post.lost_found_type === 'lost' ? <Search className="w-3.5 h-3.5 flex-shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="uppercase">{post.lost_found_type}</span>
            {post.lost_found_contact_pref && <span className="font-normal">· Contact: {lostFoundContactLabel(post.lost_found_contact_pref)}</span>}
          </div>
        </div>
      )}

      {['service_offer', 'ask_local', 'recommendation'].includes(post.post_type) && post.service_category && (
        <div className={`${spacing} p-3 bg-violet-50 rounded-xl border-l-4 border-violet-400${onClick ? ' cursor-pointer' : ''}`} onClick={onClick}>
          <div className="flex items-center gap-2 text-xs text-violet-800">
            <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="min-w-0 break-words">{post.service_category}</span>
          </div>
        </div>
      )}

  </>;
}
