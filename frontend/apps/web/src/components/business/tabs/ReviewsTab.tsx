import { useCallback, useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import UserIdentityLink from '@/components/user/UserIdentityLink';

interface ReviewsTabProps {
  businessId: string;
  businessName: string;
}

export default function ReviewsTab({ businessId, businessName }: ReviewsTabProps) {
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | ''>('');
  const [reviews, setReviews] = useState<Record<string, any>[]>([]);
  const [summary, setSummary] = useState<{ total: number; average_rating: number }>({ total: 0, average_rating: 0 });

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.businesses.getBusinessReviews(businessId, ratingFilter ? { rating: ratingFilter } : undefined);
      setReviews(res.reviews || []);
      setSummary({
        total: res.total || 0,
        average_rating: res.average_rating || 0,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load reviews';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [businessId, ratingFilter]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const submitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return;
    try {
      await api.businesses.respondToReview(businessId, reviewId, { response: responseText.trim() });
      setResponding(null);
      setResponseText('');
      await loadReviews();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save response';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-app bg-surface p-6 text-center text-app-secondary">
        Loading reviews...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-app bg-surface p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-app">Reviews</div>
          <div className="text-xs text-app-secondary mt-0.5">
            {summary.total} total · {summary.average_rating ? summary.average_rating.toFixed(2) : '0.00'} avg
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-app-strong px-2 py-1.5 text-sm"
          >
            <option value="">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
          <button onClick={() => void loadReviews()} className="px-3 py-1.5 rounded-lg border border-app-strong text-sm text-app-strong hover:bg-surface-raised">
            Refresh
          </button>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-app bg-surface p-6 text-center text-app-secondary">
          No reviews yet.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-app bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <UserIdentityLink
                    userId={review.reviewer_id}
                    username={review.reviewer_username}
                    displayName={review.reviewer_name || 'Reviewer'}
                    avatarUrl={review.reviewer_avatar}
                    textClassName="text-sm font-semibold text-app hover:underline"
                  />
                  <div className="text-xs text-app-secondary">
                    {review.gig_title ? `${review.gig_title} · ` : ''}
                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
                <div className="text-yellow-500 text-sm">
                  {'★'.repeat(review.rating || 0)}
                  <span className="text-app-muted">{'★'.repeat(5 - (review.rating || 0))}</span>
                </div>
              </div>

              {review.comment && (
                <p className="text-sm text-app-strong mt-2 whitespace-pre-wrap">{review.comment}</p>
              )}

              {review.owner_response ? (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <div className="text-[11px] font-semibold text-violet-700 mb-1">Response from {businessName}</div>
                  <div className="text-sm text-app-strong whitespace-pre-wrap">{review.owner_response}</div>
                </div>
              ) : (
                <div className="mt-3">
                  {responding === review.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm resize-none"
                        placeholder="Write a response..."
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void submitResponse(review.id)}
                          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
                        >
                          Send response
                        </button>
                        <button
                          onClick={() => { setResponding(null); setResponseText(''); }}
                          className="px-3 py-1.5 rounded-lg border border-app-strong text-sm text-app-strong hover:bg-surface-raised"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setResponding(review.id); setResponseText(''); }}
                      className="text-sm text-violet-600 hover:underline"
                    >
                      Respond
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
