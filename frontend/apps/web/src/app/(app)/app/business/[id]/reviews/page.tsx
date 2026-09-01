'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import UserIdentityLink from '@/components/user/UserIdentityLink';

export default function BusinessReviewsPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<api.businesses.BusinessReview[]>([]);
  const [summary, setSummary] = useState<{ total: number; average_rating: number }>({ total: 0, average_rating: 0 });
  const [filterRating, setFilterRating] = useState<number | ''>('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getBusinessReviews(businessId, filterRating ? { rating: filterRating } : undefined);
      setReviews(res.reviews || []);
      setSummary({
        total: res.total || 0,
        average_rating: res.average_rating || 0,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [businessId, filterRating]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (reviewId: string) => {
    if (!replyText.trim()) return;
    try {
      await api.businesses.respondToReview(businessId, reviewId, { response: replyText.trim() });
      setReplyText('');
      setReplyingId(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to post response');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Business Reviews</h1>
          <p className="text-sm text-app-text-secondary mt-1">
            {summary.total} total · avg {summary.average_rating ? Number(summary.average_rating).toFixed(2) : '0.00'}
          </p>
        </div>
        <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value ? Number(e.target.value) : '')}
          className="rounded-lg border border-app-border px-2 py-1.5 text-sm"
        >
          <option value="">All ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
        <button onClick={() => void load()} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Refresh
        </button>
      </div>

      {loading && <div className="text-app-text-secondary">Loading...</div>}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {!loading && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="bg-app-surface border border-app-border rounded-xl p-6 text-center text-app-text-secondary">No reviews found.</div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-app-surface border border-app-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <UserIdentityLink
                      userId={review.reviewer?.id || review.reviewer_id}
                      username={review.reviewer?.username}
                      displayName={review.reviewer_name || 'Reviewer'}
                      avatarUrl={review.reviewer_avatar || review.reviewer?.profile_picture_url}
                      textClassName="text-sm font-semibold text-app-text hover:text-primary-600"
                    />
                    <div className="text-xs text-app-text-secondary">
                      {review.gig_title ? `${review.gig_title} · ` : ''}
                      {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div className="text-yellow-500 text-sm">
                    {'★'.repeat(review.rating || 0)}
                    <span className="text-gray-300">{'★'.repeat(5 - (review.rating || 0))}</span>
                  </div>
                </div>
                {review.comment && <p className="text-sm text-app-text-strong mt-2 whitespace-pre-wrap">{review.comment}</p>}

                {review.owner_response ? (
                  <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <div className="text-[11px] font-semibold text-violet-700 mb-1">Owner response</div>
                    <div className="text-sm text-app-text-strong whitespace-pre-wrap">{review.owner_response}</div>
                  </div>
                ) : (
                  <div className="mt-3">
                    {replyingId === review.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none"
                          placeholder="Write a response..."
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={() => void respond(review.id)} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
                            Send response
                          </button>
                          <button
                            onClick={() => {
                              setReplyingId(null);
                              setReplyText('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingId(review.id);
                          setReplyText('');
                        }}
                        className="text-sm text-violet-600 hover:underline"
                      >
                        Respond
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
