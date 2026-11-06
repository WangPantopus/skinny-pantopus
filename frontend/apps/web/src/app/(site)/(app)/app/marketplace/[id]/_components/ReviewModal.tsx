'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import StarRating from '@/components/ui/StarRating';

type ReviewModalProps = {
  open: boolean;
  onClose: () => void;
  reviewedId: string;
  reviewedName: string;
  offerId?: string;
  listingId?: string;
  context: 'listing_sale' | 'listing_trade';
  onReviewSubmitted: () => void;
};

export default function ReviewModal({
  open,
  onClose,
  reviewedId,
  reviewedName,
  offerId,
  listingId,
  context,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleSubmit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await api.listings.createTransactionReview({
        reviewed_id: reviewedId,
        context,
        offer_id: offerId,
        listing_id: listingId,
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success('Review submitted!');
      onReviewSubmitted();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setRating(0);
    setComment('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-app-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold text-app-text">Rate your experience</h2>
          <button onClick={handleClose} className="p-1 text-app-text-muted hover:text-app-text transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Reviewed user */}
          <p className="text-sm text-app-text-secondary">
            How was your experience with {reviewedName}?
          </p>

          {/* Star rating */}
          <div className="flex justify-center">
            <StarRating rating={rating} onChange={setRating} size={36} />
          </div>

          {/* Comment */}
          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was your experience? (optional)"
              maxLength={2000}
              rows={4}
              className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
            <p className="text-xs text-app-text-muted mt-1 text-right">{comment.length}/2000</p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={rating < 1 || submitting}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
