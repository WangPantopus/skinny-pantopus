'use client';

import { useRef } from 'react';
import { Star, Send, ImagePlus, FileUp, X } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import StarRating from '@/components/ui/StarRating';
import type { ReviewMediaFile } from '@/hooks/useReviewMedia';

const REVIEW_RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

const MAX_REVIEW_COMMENT_LENGTH = 2000;
const MAX_REVIEW_MEDIA = 5;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

interface LeaveReviewModalProps {
  open: boolean;
  isOwner: boolean;
  reviewRating: number;
  onSelectRating: (n: number) => void;
  reviewComment: string;
  onChangeComment: (text: string) => void;
  reviewMediaFiles: ReviewMediaFile[];
  onAddMedia: (files: ReviewMediaFile[]) => void;
  onRemoveMedia: (idx: number) => void;
  submittingReview: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export default function LeaveReviewModal({
  open,
  isOwner,
  reviewRating,
  onSelectRating,
  reviewComment,
  onChangeComment,
  reviewMediaFiles,
  onAddMedia,
  onRemoveMedia,
  submittingReview,
  onSubmit,
  onClose,
}: LeaveReviewModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_REVIEW_MEDIA - reviewMediaFiles.length;
    const selected = Array.from(files).slice(0, remaining);

    const mediaFiles: ReviewMediaFile[] = selected
      .filter((f) => f.size <= MAX_FILE_SIZE_BYTES)
      .map((f) => ({
        url: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
        type: f.type,
        file: f,
      }));

    if (mediaFiles.length > 0) {
      onAddMedia(mediaFiles);
    }

    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={Star}
      iconColor="#f59e0b"
      iconBgColor="#fffbeb"
      title="Leave a Review"
      subtitle={`How was your experience with the ${isOwner ? 'worker' : 'task poster'}?`}
      cancelLabel="Cancel"
      onCancel={onClose}
      cancelDisabled={submittingReview}
      submitLabel="Submit Review"
      onSubmit={onSubmit}
      submitDisabled={submittingReview || reviewRating === 0}
      submitting={submittingReview}
      submitIcon={Send}
    >
      {/* Star Rating */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-app-text-strong mb-2">Rating *</label>
        <StarRating
          rating={reviewRating}
          onChange={onSelectRating}
          size={28}
          valueLabel={reviewRating > 0 ? REVIEW_RATING_LABELS[reviewRating] : undefined}
        />
      </div>

      {/* Review Comment */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-app-text-strong mb-1.5">
          Comment <span className="text-app-text-muted">(optional)</span>
        </label>
        <textarea
          value={reviewComment}
          onChange={(e) => onChangeComment(e.target.value)}
          placeholder="Share your experience..."
          maxLength={MAX_REVIEW_COMMENT_LENGTH}
          disabled={submittingReview}
          rows={4}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:opacity-50 resize-none"
        />
        <p className="text-xs text-app-text-muted mt-1 text-right">
          {reviewComment.length}/{MAX_REVIEW_COMMENT_LENGTH}
        </p>
      </div>

      {/* Media Attachments */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-2">Attachments</label>

        {/* Thumbnails */}
        {reviewMediaFiles.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {reviewMediaFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="relative flex-shrink-0">
                {file.type.startsWith('image/') ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-16 h-16 rounded-lg object-cover border border-app-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-app-border bg-app-surface-sunken flex flex-col items-center justify-center p-1">
                    <FileUp className="w-5 h-5 text-app-text-muted" />
                    <span className="text-[10px] text-app-text-muted truncate w-full text-center mt-0.5">
                      {file.name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveMedia(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={submittingReview || reviewMediaFiles.length >= MAX_REVIEW_MEDIA}
            className="flex items-center gap-1.5 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text hover:bg-app-hover transition disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4 text-emerald-600" />
            Photos
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submittingReview || reviewMediaFiles.length >= MAX_REVIEW_MEDIA}
            className="flex items-center gap-1.5 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text hover:bg-app-hover transition disabled:opacity-50"
          >
            <FileUp className="w-4 h-4 text-sky-600" />
            Files
          </button>
        </div>

        <p className="text-xs text-app-text-muted mt-2">
          Up to {MAX_REVIEW_MEDIA} photos or files (25 MB max each)
        </p>

        {/* Hidden file inputs */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </ModalShell>
  );
}
