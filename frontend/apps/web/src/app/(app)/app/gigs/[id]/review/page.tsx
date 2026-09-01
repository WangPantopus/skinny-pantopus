// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import ReviewForm from '@/components/ReviewForm';
import type { GigDetail, User, Review } from '@pantopus/types';

export default function GigReviewPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [gig, setGig] = useState<GigDetail | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [profile, gigRes, gigReviews] = await Promise.all([
          api.users.getMyProfile(),
          api.gigs.getGig(gigId),
          api.reviews.getGigReviews(gigId),
        ]);

        if (!mounted) return;
        const g = gigRes?.gig || gigRes;
        setMe(profile);
        setGig(g);

        const mine = (gigReviews?.reviews || []).find((r: Record<string, any>) => String(r.reviewer_id) === String(profile?.id));
        setExistingReview(mine || null);
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load review page');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [gigId]);

  const roleContext = useMemo(() => {
    if (!gig || !me) return { allowed: false, reason: '', revieweeId: '', revieweeLabel: 'counterparty', revieweeName: 'Counterparty' };
    const isOwner = String(gig.user_id) === String(me.id);
    const isWorker = String(gig.accepted_by || '') === String(me.id);
    if (!isOwner && !isWorker) {
      return { allowed: false, reason: 'Only the gig owner or assigned worker can leave a review.', revieweeId: '', revieweeLabel: 'counterparty', revieweeName: 'Counterparty' };
    }
    if (gig.status !== 'completed') {
      return { allowed: false, reason: `Reviews can only be left on completed gigs (current: ${gig.status || 'unknown'}).`, revieweeId: '', revieweeLabel: 'counterparty', revieweeName: 'Counterparty' };
    }

    const revieweeId = isOwner ? String(gig.accepted_by || '') : String(gig.user_id || '');
    const revieweeLabel = isOwner ? 'worker' : 'gig poster';
    const revieweeName =
      (isOwner
        ? gig?.accepted_bid?.bidder?.name || gig?.accepted_bid?.bidder?.username
        : gig?.owner?.name || gig?.owner?.username || gig?.user?.name || gig?.user?.username) ||
      revieweeLabel;

    if (!revieweeId) {
      return { allowed: false, reason: 'Could not find the other participant for this gig.', revieweeId: '', revieweeLabel, revieweeName };
    }

    return { allowed: true, reason: '', revieweeId, revieweeLabel, revieweeName };
  }, [gig, me]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center text-app-text-secondary">Loading review page...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">{error}</div>
      </div>
    );
  }

  if (!roleContext.allowed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
          {roleContext.reason}
        </div>
        <button
          onClick={() => router.push(`/app/gigs/${gigId}`)}
          className="px-4 py-2 rounded-lg border border-app-border text-app-text-strong hover:bg-app-hover"
        >
          Back to Gig
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <button
        onClick={() => router.push(`/app/gigs/${gigId}`)}
        className="text-sm text-app-text-secondary hover:text-app-text"
      >
        ← Back to Gig
      </button>

      <div className="bg-app-surface border border-app-border rounded-xl p-5">
        <h1 className="text-xl font-semibold text-app-text">Leave a Review</h1>
        <p className="text-sm text-app-text-secondary mt-1">
          Share feedback for the {roleContext.revieweeLabel} so it appears on their public profile.
        </p>
      </div>

      {existingReview ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h2 className="font-semibold text-green-900">You already reviewed this gig</h2>
          <p className="text-sm text-green-800 mt-1">
            Rating: {existingReview.rating}/5
          </p>
          {existingReview.comment && (
            <p className="text-sm text-green-800 mt-2">{existingReview.comment}</p>
          )}
        </div>
      ) : (
        <ReviewForm
          gigId={gigId}
          revieweeId={roleContext.revieweeId}
          revieweeName={roleContext.revieweeName}
          onSuccess={() => {
            router.push(`/app/gigs/${gigId}`);
          }}
        />
      )}
    </div>
  );
}
