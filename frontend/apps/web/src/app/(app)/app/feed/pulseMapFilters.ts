import {
  MessageCircle, Star, CalendarDays, Search, AlertTriangle, Tag, Newspaper, Trophy,
  Home as HomeIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getPostTypeConfig } from '@pantopus/ui-utils';

/** The Pulse map's intent chips (Place surface). */
export const MAP_FILTERS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'All', icon: HomeIcon },
  { key: 'ask_local', label: 'Ask', icon: MessageCircle },
  { key: 'recommendation', label: 'Recs', icon: Star },
  { key: 'event', label: 'Events', icon: CalendarDays },
  { key: 'lost_found', label: 'Lost', icon: Search },
  { key: 'alert', label: 'Alerts', icon: AlertTriangle },
  { key: 'deal', label: 'Deals', icon: Tag },
  { key: 'local_update', label: 'Updates', icon: Newspaper },
  { key: 'neighborhood_win', label: 'Wins', icon: Trophy },
];

/** The active chip's label, for the reveal capsule ("Pulse · Events"). */
export function mapFilterLabel(filter: string): string {
  return MAP_FILTERS.find((f) => f.key === filter)?.label ?? getPostTypeConfig(filter).label;
}
