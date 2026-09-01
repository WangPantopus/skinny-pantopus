'use client';

import { useState } from 'react';
import Image from 'next/image';
import ReviewForm from '@/components/ReviewForm';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import MediaLightbox, { type LightboxImage } from '@/components/gig-detail/MediaLightbox';

interface ReviewItem {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  received_as?: string;
  reviewer_name?: string;
  reviewer_username?: string;
  reviewer_avatar?: string;
  media_urls?: string[];
  reviewer?: {
    id?: string;
    username?: string;
    profile_picture_url?: string;
  };
  [key: string]: unknown;
}

interface PendingReview {
  gig_id: string;
  reviewee_id: string;
  reviewee_name?: string;
}

interface ReviewsTabProps {
  reviews: ReviewItem[];
  loading: boolean;
  stats: { average: number; total: number };
  pendingReview: PendingReview | null;
  isOwnProfile: boolean;
  onReviewSubmitted: () => void;
}

export default function ReviewsTab({
  reviews,
  loading,
  stats,
  pendingReview,
  isOwnProfile,
  onReviewSubmitted,
}: ReviewsTabProps) {
  const [roleFilter, setRoleFilter] = useState<'all' | 'worker' | 'poster'>('all');
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-app-secondary">Loading reviews...</p>
      </div>
    );
  }

  const filteredReviews = reviews.filter((r) => {
    if (roleFilter === 'all') return true;
    return r.received_as === roleFilter;
  });
  const workerCount = reviews.filter((r) => r.received_as === 'worker').length;
  const posterCount = reviews.filter((r) => r.received_as === 'poster').length;

  const filterButtonClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm border ${
      active
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-surface text-app-strong border-app-strong hover:bg-surface-raised'
    }`;

  return (
    <div className="space-y-6">
      {/* Review Summary */}
      {stats.total > 0 && (
        <div className="bg-surface rounded-xl border border-app p-6 flex items-center gap-8">
          <div className="text-center">
            <p className="text-4xl font-bold text-app">{stats.average.toFixed(1)}</p>
            <div className="flex justify-center mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={s <= Math.round(stats.average) ? 'text-yellow-400' : 'text-app-muted'}>★</span>
              ))}
            </div>
            <p className="text-sm text-app-secondary mt-1">{stats.total} review{stats.total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-app-secondary w-8">{star} ★</span>
                  <div className="flex-1 bg-surface-muted rounded-full h-2">
                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-app-secondary w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending review prompt */}
      {pendingReview && !isOwnProfile && (
        <ReviewForm
          gigId={pendingReview.gig_id}
          revieweeId={pendingReview.reviewee_id}
          revieweeName={pendingReview.reviewee_name || 'this user'}
          onSuccess={onReviewSubmitted}
        />
      )}

      {/* Role filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setRoleFilter('all')} className={filterButtonClass(roleFilter === 'all')}>
          All ({reviews.length})
        </button>
        <button onClick={() => setRoleFilter('worker')} className={filterButtonClass(roleFilter === 'worker')}>
          As Worker ({workerCount})
        </button>
        <button onClick={() => setRoleFilter('poster')} className={filterButtonClass(roleFilter === 'poster')}>
          As Task Poster ({posterCount})
        </button>
      </div>

      {/* Review list */}
      {filteredReviews.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-xl border border-app">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-lg font-semibold text-app mb-2">
            {reviews.length === 0 ? 'No reviews yet' : 'No reviews in this category'}
          </h3>
          <p className="text-app-secondary">
            {reviews.length === 0
              ? "This user hasn\u0027t received any reviews yet."
              : 'Try another filter to see more reviews.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <div key={review.id} className="bg-surface rounded-xl border border-app p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {review.reviewer_avatar || review.reviewer?.profile_picture_url ? (
                    <Image
                      src={review.reviewer_avatar || review.reviewer?.profile_picture_url || ''}
                      alt={review.reviewer_name || ''}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {review.reviewer_name?.[0] || '?'}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <UserIdentityLink
                      userId={review.reviewer?.id}
                      username={review.reviewer_username || review.reviewer?.username}
                      displayName={review.reviewer_name || 'Anonymous'}
                      avatarUrl={review.reviewer_avatar || review.reviewer?.profile_picture_url}
                      textClassName="font-semibold text-app hover:text-primary-600"
                    />
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`text-sm ${s <= review.rating ? 'text-yellow-400' : 'text-app-muted'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-app-strong text-sm leading-relaxed">{review.comment}</p>
                  )}
                  {review.media_urls && review.media_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {review.media_urls.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setLightboxImages(review.media_urls!);
                            setLightboxIndex(idx);
                          }}
                          className="relative w-20 h-20 rounded-lg overflow-hidden border border-app hover:opacity-80 transition-opacity"
                        >
                          <Image
                            src={url}
                            alt={`Review photo ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-app-secondary mt-2">
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {review.received_as === 'worker' && ' • Review as worker'}
                    {review.received_as === 'poster' && ' • Review as gig poster'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <MediaLightbox
          images={lightboxImages.map((url): LightboxImage => ({
            url,
            name: url.split('/').pop() || 'Review photo',
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
