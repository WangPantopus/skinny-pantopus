'use client';

import type { ReactNode } from 'react';
import {
  MessageCircle, Calendar, Search, Star, Home, MapPin,
  AlertTriangle, Tag, Newspaper, Trophy, Users, User, Megaphone, Radio,
} from 'lucide-react';
import type { PostType, FeedSurface } from '@pantopus/api';
import {
  SPORTS_STARTERS, type SportsMode, type SportsStarter, type TopicKey,
} from '@/constants/feedTopics';

type FilterType = PostType | 'all';

export type { SportsStarter } from '@/constants/feedTopics';

export default function EmptyFeed({
  filter,
  surface,
  locationLabel,
  locationLat,
  locationLng,
  radiusMiles,
  topic,
  sportsMode,
  noActiveEvent,
  onStarterPress,
}: {
  filter: FilterType;
  surface: FeedSurface;
  locationLabel?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  radiusMiles?: number | null;
  topic?: TopicKey | null;
  sportsMode?: SportsMode;
  noActiveEvent?: boolean;
  onStarterPress?: (starter: SportsStarter) => void;
}) {
  // Sports-variant empty state: the whole point of the Sports lane is the
  // conversation, so push users to start one rather than show "nothing here".
  if (surface === 'place' && topic === 'sports') {
    let title = 'No sports threads here yet.';
    let sub = 'Start one for tonight’s game, a youth league update, or a local pickup group.';
    if (sportsMode === 'event' && noActiveEvent) {
      title = 'No major event right now.';
      sub = 'Check back when the next playoffs or tournament kicks off.';
    } else if (sportsMode === 'watch') {
      sub = 'Ask where people are watching or share a good local spot.';
    } else if (sportsMode === 'local') {
      sub = 'Share a local team update, a youth league note, or a pickup game.';
    }
    return (
      <div className="text-center py-16 px-6">
        <div className="flex justify-center mb-4 text-app-muted"><Trophy className="w-5 h-5" /></div>
        <h3 className="text-lg font-semibold text-app mb-1">{title}</h3>
        <p className="text-sm text-app-muted max-w-sm mx-auto">{sub}</p>
        {!noActiveEvent && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SPORTS_STARTERS.map((s) => (
              <button
                key={s.key}
                onClick={() => onStarterPress?.(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-app bg-surface text-app-muted hover-bg-app transition"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const radiusHint = radiusMiles
    ? `Nothing found within ${radiusMiles} miles. Try expanding your area or be the first to post!`
    : 'Be the first to share something with your neighbors!';

  const placeMessages: Record<string, { icon: ReactNode; title: string; sub: string }> = {
    all: {
      icon: <Home className="w-5 h-5" />,
      title: locationLabel ? `No posts near ${locationLabel}` : 'Your Pulse is waiting',
      sub: radiusHint,
    },
    ask_local: { icon: <MessageCircle className="w-5 h-5" />, title: 'No questions yet', sub: 'Got something on your mind? Ask your neighbors!' },
    recommendation: { icon: <Star className="w-5 h-5" />, title: 'No recommendations yet', sub: 'Know a great local spot? Share it!' },
    event: { icon: <Calendar className="w-5 h-5" />, title: 'No events posted', sub: 'Know about something happening nearby? Let neighbors know!' },
    lost_found: { icon: <Search className="w-5 h-5" />, title: 'Nothing lost or found', sub: "That's good news! Help keep it that way." },
    alert: { icon: <AlertTriangle className="w-5 h-5" />, title: 'No alerts', sub: 'Everything looks safe in the neighborhood!' },
    deal: { icon: <Tag className="w-5 h-5" />, title: 'No deals yet', sub: 'Know about a local deal? Share it with neighbors!' },
    local_update: { icon: <Newspaper className="w-5 h-5" />, title: 'No updates', sub: 'Have news about the neighborhood? Post an update.' },
    neighborhood_win: { icon: <Trophy className="w-5 h-5" />, title: 'No wins yet', sub: 'Celebrate something great happening nearby!' },
    requiresLocation: { icon: <MapPin className="w-5 h-5" />, title: 'Set an area to see local posts', sub: 'Use your location or search for a neighborhood to get started.' },
  };

  const networkMessages: Record<string, { icon: ReactNode; title: string; sub: string }> = {
    all: {
      icon: surface === 'personas' ? <Radio className="w-5 h-5" /> : <Users className="w-5 h-5" />,
      title: 'Nothing here yet',
      sub: surface === 'personas'
        ? 'Beacon posts from people you follow will appear here.'
        : 'Connect with neighbors to see their posts.',
    },
    personal_update: { icon: <User className="w-5 h-5" />, title: 'No updates', sub: 'No personal updates from your network yet.' },
    ask_local: { icon: <MessageCircle className="w-5 h-5" />, title: 'No questions yet', sub: 'Your network hasn\'t asked any questions yet.' },
    recommendation: { icon: <Star className="w-5 h-5" />, title: 'No recommendations yet', sub: 'Recommendations from your network will appear here.' },
    event: { icon: <Calendar className="w-5 h-5" />, title: 'No events posted', sub: 'Events shared by your network will appear here.' },
    announcement: { icon: <Megaphone className="w-5 h-5" />, title: 'No announcements', sub: 'Announcements from your network will appear here.' },
  };

  // Show requiresLocation state when Place surface has no real coordinates
  if (surface === 'place' && (locationLat == null || locationLng == null)) {
    const msg = placeMessages.requiresLocation;
    return (
      <div className="text-center py-16 px-6">
        <div className="flex justify-center mb-4 text-app-muted">{msg.icon}</div>
        <h3 className="text-lg font-semibold text-app mb-1">{msg.title}</h3>
        <p className="text-sm text-app-muted max-w-sm mx-auto">{msg.sub}</p>
      </div>
    );
  }

  const messages = surface === 'place' ? placeMessages : networkMessages;
  const msg = messages[filter] || messages.all;

  return (
    <div className="text-center py-16 px-6">
      <div className="flex justify-center mb-4 text-app-muted">{msg.icon}</div>
      <h3 className="text-lg font-semibold text-app mb-1">{msg.title}</h3>
      <p className="text-sm text-app-muted max-w-sm mx-auto">{msg.sub}</p>
    </div>
  );
}
