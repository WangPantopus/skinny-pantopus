// Types and constants specific to the Discover page

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
