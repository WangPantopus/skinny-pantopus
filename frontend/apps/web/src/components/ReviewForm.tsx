'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';

interface ReviewFormProps {
  gigId: string;
  revieweeId: string;
  revieweeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReviewForm({
  gigId,
  revieweeId,
  revieweeName,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.reviews.createReview({
        gig_id: gigId,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || undefined,
      });

      setSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h3 className="text-lg font-semibold text-green-900 mb-1">Review submitted!</h3>
        <p className="text-sm text-green-700">Thank you for your feedback about {revieweeName}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-app-surface border border-app-border rounded-xl p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-app-text mb-1">Leave a Review</h3>
        <p className="text-sm text-app-text-secondary">How was your experience with {revieweeName}?</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Star Rating */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-2">Rating *</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="text-3xl transition-transform hover:scale-110 focus:outline-none"
            >
              <span
                className={
                  star <= (hoveredRating || rating)
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }
              >
                ★
              </span>
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-app-text-secondary self-center">
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Great'}
              {rating === 5 && 'Excellent'}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">
          Comment <span className="text-app-text-muted">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
        />
        <p className="text-xs text-app-text-muted mt-1">{comment.length}/2000</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
}
