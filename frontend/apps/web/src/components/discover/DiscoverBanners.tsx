'use client';

import { useRouter } from 'next/navigation';
import { Search, MapPin } from 'lucide-react';
import { toast } from '@/components/ui/toast-store';
import type { SearchScope } from './discoverTypes';

// ── Empty State ──────────────────────────────────────────────
export function EmptyState({ category, scope }: { category?: string; scope: SearchScope }) {
  const router = useRouter();
  const href = category ? `/app/gigs/new?category=${category}` : '/app/gigs-v2/new';
  const isBusinessScope = scope === 'businesses';
  return (
    <div className="text-center py-16 px-6">
      <div className="mb-4 flex justify-center"><Search className="w-10 h-10 text-app-muted" /></div>
      <h3 className="text-lg font-semibold text-app-strong mb-1">No results found</h3>
      <p className="text-sm text-app-muted max-w-sm mx-auto mb-6">
        {isBusinessScope ? 'Post a task to get quotes from local providers.' : 'Try a different search term or category.'}
      </p>
      {isBusinessScope && (
        <button
          onClick={() => router.push(href)}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 transition"
        >
          Post a Task
        </button>
      )}
    </div>
  );
}

// ── No Home Banner ───────────────────────────────────────────
export function NoHomeBanner() {
  const router = useRouter();
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-amber-800 font-medium">Add your home address to see neighbor trust data</p>
      </div>
      <button
        onClick={() => router.push('/app/homes')}
        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
      >
        Set up
      </button>
    </div>
  );
}

// ── Worked Nearby Banner ─────────────────────────────────────
export function WorkedNearbyBanner() {
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 mb-4">
      <p className="text-sm text-teal-800 font-medium">
        ✓ Showing businesses with verified local work history
      </p>
    </div>
  );
}

// ── No Location Banner ───────────────────────────────────────
export function NoLocationBanner() {
  const router = useRouter();
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-4">
      <div className="flex items-start gap-3">
        <MapPin className="w-6 h-6 text-blue-600 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900 mb-1">Location needed to discover businesses</p>
          <p className="text-xs text-blue-700 mb-3">
            Add your home address so we can show you trusted local providers, or allow location access in your browser.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/app/homes')}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition"
            >
              Add Home Address
            </button>
            <button
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  () => window.location.reload(),
                  () => toast.warning('Location access was denied. Please enable it in your browser settings, or add a home address instead.'),
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
              className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition"
            >
              Use My Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
