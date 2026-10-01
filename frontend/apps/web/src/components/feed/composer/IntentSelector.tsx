'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  MessageCircle, Star, Calendar, Search, Siren, Tag,
  Wrench, Megaphone, PenLine, Newspaper, Trophy, Compass,
} from 'lucide-react';
import type { FeedSurface, PostType } from '@pantopus/api';

export interface IntentDef {
  key: PostType;
  label: string;
  icon: ReactNode;
  placeholder: string;
  color: string;
  /** Label text in `color`'s hue that meets WCAG AA (4.5:1) on `bgLight`. */
  textColor: string;
  /** Text on dark surfaces: the shared palette's `darkTextColor` (Lost & Found keeps its amber hue). */
  darkTextColor: string;
  bgLight: string;
  cta: string;
}

export const INTENTS: IntentDef[] = [
  { key: 'ask_local', label: 'Ask', icon: <MessageCircle className="w-4 h-4" />, placeholder: 'What do you want to ask your neighbors?', color: '#0369A1', textColor: '#0369A1', darkTextColor: '#38BDF8', bgLight: '#EFF6FF', cta: 'Post Question' },
  { key: 'recommendation', label: 'Recommend', icon: <Star className="w-4 h-4" />, placeholder: 'What place, service, or thing are you recommending?', color: '#B45309', textColor: '#B45309', darkTextColor: '#FBBF24', bgLight: '#FFFBEB', cta: 'Share Recommendation' },
  { key: 'event', label: 'Event', icon: <Calendar className="w-4 h-4" />, placeholder: 'Tell neighbors about the event — what, when, where…', color: '#7C3AED', textColor: '#7C3AED', darkTextColor: '#A78BFA', bgLight: '#F5F3FF', cta: 'Post Event' },
  { key: 'lost_found', label: 'Lost & Found', icon: <Search className="w-4 h-4" />, placeholder: 'Describe what was lost or found and where…', color: '#A16207', textColor: '#A16207', darkTextColor: '#FBBF24', bgLight: '#FEFCE8', cta: 'Post Alert' },
  { key: 'alert', label: 'Safety Alert', icon: <Siren className="w-4 h-4" />, placeholder: 'What should neighbors know?', color: '#DC2626', textColor: '#B91C1C', darkTextColor: '#F87171', bgLight: '#FEF2F2', cta: 'Post Alert' },
  { key: 'deal', label: 'Deal/Promo', icon: <Tag className="w-4 h-4" />, placeholder: 'Describe the deal and where to find it...', color: '#15803D', textColor: '#15803D', darkTextColor: '#4ADE80', bgLight: '#F0FDF4', cta: 'Post Deal' },
  { key: 'local_update', label: 'Local Update', icon: <Newspaper className="w-4 h-4" />, placeholder: 'Share a local update with your neighbors…', color: '#374151', textColor: '#374151', darkTextColor: '#9CA3AF', bgLight: '#F9FAFB', cta: 'Post Update' },
  { key: 'neighborhood_win', label: 'Neighborhood Win', icon: <Trophy className="w-4 h-4" />, placeholder: 'Celebrate something great in your neighborhood…', color: '#047857', textColor: '#047857', darkTextColor: '#34D399', bgLight: '#F0FDF4', cta: 'Share Win' },
  { key: 'visitor_guide', label: 'Visitor Guide', icon: <Compass className="w-4 h-4" />, placeholder: 'Share tips for visitors to the area…', color: '#7C3AED', textColor: '#7C3AED', darkTextColor: '#A78BFA', bgLight: '#FAF5FF', cta: 'Post Guide' },
  { key: 'service_offer', label: 'Service', icon: <Wrench className="w-4 h-4" />, placeholder: 'What service are you offering?', color: '#7C3AED', textColor: '#7C3AED', darkTextColor: '#A78BFA', bgLight: '#FAF5FF', cta: 'Post Service' },
  { key: 'announcement', label: 'Announce', icon: <Megaphone className="w-4 h-4" />, placeholder: 'Share important news with the neighborhood…', color: '#0F766E', textColor: '#0F766E', darkTextColor: '#2DD4BF', bgLight: '#F0FDFA', cta: 'Post Announcement' },
  { key: 'general', label: 'Share', icon: <PenLine className="w-4 h-4" />, placeholder: 'Share something with your neighborhood…', color: '#6B7280', textColor: '#6B7280', darkTextColor: '#9CA3AF', bgLight: '#F9FAFB', cta: 'Post' },
];

interface IntentSelectorProps {
  onSelect: (key: PostType) => void;
  user?: { name?: string; first_name?: string; username?: string; profile_picture_url?: string } | null;
  activeSurface?: FeedSurface;
  /** When set, only these post types are offered (the Place feed refuses the others). */
  allowedTypes?: readonly string[];
}

export default function IntentSelector({ onSelect, user, activeSurface, allowedTypes }: IntentSelectorProps) {
  const isNetworkSurface = activeSurface === 'connections';
  const sharePrompt = activeSurface === 'connections'
    ? 'Share something with your connections…'
    : 'Share something with your neighborhood…';
  const userInitial =
    user?.first_name?.[0]?.toUpperCase() ||
    user?.name?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    '?';

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app p-4">
      <div className="flex items-center gap-3 mb-4">
        {user?.profile_picture_url ? (
          <Image src={user.profile_picture_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100" width={36} height={36} sizes="36px" quality={75} />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold ring-2 ring-primary-100">
            {userInitial}
          </div>
        )}
        <button
          onClick={() => onSelect('general')}
          className="flex-1 text-left text-app-muted text-sm bg-surface-muted rounded-xl px-4 py-2.5 hover-bg-app transition"
        >
          {sharePrompt}
        </button>
      </div>
      {!isNetworkSurface && (
        <div className="flex flex-wrap gap-2">
          {INTENTS.filter((i) => i.key !== 'general' && (!allowedTypes || allowedTypes.includes(i.key))).map((intent) => (
            <button
              key={intent.key}
              onClick={() => onSelect(intent.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-[1.04] active:scale-95"
              style={{
                background: intent.bgLight,
                color: intent.textColor,
                border: `1px solid ${intent.color}20`,
              }}
            >
              <span className="flex-shrink-0">{intent.icon}</span>
              {intent.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
