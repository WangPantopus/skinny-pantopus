'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, ArrowLeftRight } from 'lucide-react';
import * as api from '@pantopus/api';
import type { MagicTaskDraft, ScheduleType, MagicPostResponse } from '@pantopus/types';
import { inferEngagementMode } from '@/lib/engagementHelpers';

interface DraftPreviewProps {
  draft: MagicTaskDraft;
  originalText: string;
  confidence: number;
  location?: {
    mode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    homeId?: string | null;
    place_id?: string | null;
  } | null;
  onPost: (result: MagicPostResponse) => void;
  onBack: () => void;
}

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  asap: '\u26A1 Now',
  today: '\uD83D\uDCC5 Today',
  scheduled: '\uD83D\uDDD3\uFE0F Scheduled',
  flexible: '\uD83E\uDD37 Flexible',
};

const ENGAGEMENT_LABELS: Record<string, { icon: string; label: string }> = {
  instant_accept: { icon: '\u26A1', label: 'Instant Accept' },
  curated_offers: { icon: '\uD83D\uDCCB', label: 'Offers' },
  quotes: { icon: '\uD83D\uDCBC', label: 'Quotes' },
};

export default function DraftPreview({
  draft,
  originalText,
  confidence,
  location,
  onPost,
  onBack,
}: DraftPreviewProps) {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(draft.category);
  const [engagementMode, setEngagementMode] = useState(
    inferEngagementMode(draft.category, draft.schedule_type),
  );

  const payLabel =
    draft.pay_type === 'offers'
      ? draft.budget_range
        ? `$${draft.budget_range.min}\u2013$${draft.budget_range.max} (suggested)`
        : 'Open to offers'
      : draft.pay_type === 'hourly'
        ? `$${draft.hourly_rate}/hr`
        : draft.budget_fixed
          ? `$${draft.budget_fixed}`
          : draft.budget_range
            ? `$${draft.budget_range.min}\u2013$${draft.budget_range.max}`
            : 'Open to offers';

  const engInfo = ENGAGEMENT_LABELS[engagementMode] || ENGAGEMENT_LABELS.curated_offers;

  const handlePost = async () => {
    setPosting(true);
    setError('');
    try {
	      const lat = Number(location?.latitude);
	      const lng = Number(location?.longitude);
	      const addr = typeof location?.address === 'string' ? location.address.trim() : '';
	      const locationMode = (['home', 'address', 'current', 'custom'] as const).includes(location?.mode as any)
	        ? location?.mode as 'home' | 'address' | 'current' | 'custom'
	        : 'address';
	      const requestLocation =
	        Number.isFinite(lat) && Number.isFinite(lng) && addr
	          ? {
	              mode: locationMode,
              latitude: lat,
              longitude: lng,
              address: addr,
              city: location?.city ?? null,
              state: location?.state ?? null,
              zip: location?.zip ?? null,
              homeId: location?.homeId ?? null,
              place_id: location?.place_id ?? null,
            }
          : undefined;

      const result = await api.magicTask.magicPost({
        text: originalText,
        draft: { ...draft, category },
        location: requestLocation,
        source_flow: 'magic',
        engagement_mode: engagementMode as any,
        ai_confidence: confidence,
      });
      onPost(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to post task. Please try again.');
      setPosting(false);
    }
  };

  const handleEditDetails = () => {
    const prefill = JSON.stringify({
      title: draft.title,
      description: draft.description,
      price: draft.budget_fixed || draft.hourly_rate || '',
      category,
      tags: draft.tags?.join(',') || '',
      schedule_type: draft.schedule_type,
      pay_type: draft.pay_type,
    });
    router.push(`/app/gigs/new?prefill=${encodeURIComponent(prefill)}`);
  };

  const cycleEngagement = () => {
    const modes = ['instant_accept', 'curated_offers', 'quotes'] as const;
    const idx = modes.indexOf(engagementMode as any);
    setEngagementMode(modes[(idx + 1) % modes.length]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="p-1 text-app-text hover:bg-app-hover rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-app-text">Preview</h2>
        <div className="w-7" />
      </div>

      {/* Draft card */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
        <h3 className="text-xl font-bold text-app-text">{draft.title}</h3>
        <p className="text-sm text-app-text-strong leading-relaxed line-clamp-4">
          {draft.description}
        </p>

        {/* Chips */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-full border border-emerald-500 text-sm font-medium text-emerald-600">
            {category || 'Category'}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-app-surface-sunken text-sm font-medium text-app-text-strong">
            {SCHEDULE_LABELS[draft.schedule_type]}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-app-surface-sunken text-sm font-medium text-app-text-strong">
            {payLabel}
          </span>
        </div>

        {/* Engagement mode chip */}
        <button
          type="button"
          onClick={cycleEngagement}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition"
        >
          {engInfo.icon} {engInfo.label}
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>

        {/* Privacy note */}
        <div className="pt-3 border-t border-app-border-subtle flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-app-text-secondary" />
          <p className="text-xs text-app-text-secondary">
            Exact address shared after someone is accepted
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* CTAs */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handlePost}
          disabled={posting}
          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold text-lg hover:bg-emerald-700 disabled:opacity-60 transition"
        >
          {posting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              Posting&hellip;
            </span>
          ) : (
            'Post'
          )}
        </button>
        <button
          type="button"
          onClick={handleEditDetails}
          className="w-full py-3.5 border border-emerald-600 text-emerald-600 rounded-xl font-semibold text-base hover:bg-emerald-50 transition"
        >
          Edit details
        </button>
      </div>
    </div>
  );
}
