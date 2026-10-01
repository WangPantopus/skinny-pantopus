// Types and constants specific to the Discover page

import { launchFeatures } from '@/lib/featureFlags';

export type ViewMode = 'list' | 'map';
export type SearchScope = 'all' | 'local_profiles' | 'public_profiles' | 'businesses' | 'tasks' | 'listings';

export const PAGE_SIZE = 20;

export const SCOPE_TABS: { key: SearchScope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'local_profiles', label: 'Profiles' },
  { key: 'public_profiles', label: 'Beacons' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'listings', label: 'Listings' },
];

// Launch cuts: Beacons (#1 + #2, public persona pages), Businesses (#6),
// Tasks (#4) and Listings (#3) are hidden; people search stays.
export const SHOW_BEACON_RESULTS = launchFeatures.beacon && launchFeatures.personas;

export function isSearchScopeAvailable(scope: SearchScope): boolean {
  if (scope === 'public_profiles') return SHOW_BEACON_RESULTS;
  if (scope === 'businesses') return launchFeatures.businessDirectory;
  if (scope === 'tasks') return launchFeatures.openGigs;
  if (scope === 'listings') return launchFeatures.marketplace;
  return true;
}

/** "profiles, businesses, tasks, and listings", minus hidden kinds. */
export function searchableKindsLabel(): string {
  const kinds = [
    'profiles',
    launchFeatures.businessDirectory && 'businesses',
    launchFeatures.openGigs && 'tasks',
    launchFeatures.marketplace && 'listings',
  ].filter((kind): kind is string => !!kind);
  if (kinds.length < 3) return kinds.join(' and ');
  return `${kinds.slice(0, -1).join(', ')}, and ${kinds[kinds.length - 1]}`;
}

export interface UnifiedResult {
  id: string;
  type: 'local_profile' | 'public_profile' | 'business' | 'task' | 'listing';
  title: string;
  subtitle?: string;
  meta?: string;
  imageUrl?: string | null;
  href: string;
  badges?: string[];
  linkedProfile?: {
    type: 'local_profile' | 'public_profile';
    title: string;
    href: string | null;
  } | null;
}
