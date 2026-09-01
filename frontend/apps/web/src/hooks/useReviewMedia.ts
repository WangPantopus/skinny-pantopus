'use client';

import { useState, useCallback, useRef } from 'react';
import { useToast } from './useToast';

const MAX_REVIEW_MEDIA = 5;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface ReviewMediaFile {
  url: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

export function useReviewMedia() {
  const { toast } = useToast();
  const [reviewMediaFiles, setReviewMediaFiles] = useState<ReviewMediaFile[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const appendReviewMedia = useCallback((newFiles: ReviewMediaFile[]) => {
    setReviewMediaFiles((prev) => [...prev, ...newFiles].slice(0, MAX_REVIEW_MEDIA));
  }, []);

  const removeReviewMedia = useCallback((idx: number) => {
    setReviewMediaFiles((prev) => {
      const removed = prev[idx];
      if (removed?.url) {
        URL.revokeObjectURL(removed.url);
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const resetReviewMedia = useCallback(() => {
    reviewMediaFiles.forEach((f) => {
      if (f.url) URL.revokeObjectURL(f.url);
    });
    setReviewMediaFiles([]);
  }, [reviewMediaFiles]);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const remaining = MAX_REVIEW_MEDIA - reviewMediaFiles.length;
      const selected = Array.from(files).slice(0, remaining);
      const valid: ReviewMediaFile[] = [];

      for (const f of selected) {
        if (f.size > MAX_FILE_SIZE_BYTES) {
          toast.warning(`${f.name} is too large (max 25 MB).`);
          continue;
        }
        valid.push({
          url: URL.createObjectURL(f),
          name: f.name,
          size: f.size,
          type: f.type,
          file: f,
        });
      }

      if (valid.length > 0) {
        appendReviewMedia(valid);
      }

      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [reviewMediaFiles.length, appendReviewMedia, toast],
  );

  const pickReviewPhotos = useCallback(() => {
    if (reviewMediaFiles.length >= MAX_REVIEW_MEDIA) {
      toast.warning(`Maximum ${MAX_REVIEW_MEDIA} files allowed.`);
      return;
    }
    photoInputRef.current?.click();
  }, [reviewMediaFiles.length, toast]);

  const pickReviewFiles = useCallback(() => {
    if (reviewMediaFiles.length >= MAX_REVIEW_MEDIA) {
      toast.warning(`Maximum ${MAX_REVIEW_MEDIA} files allowed.`);
      return;
    }
    fileInputRef.current?.click();
  }, [reviewMediaFiles.length, toast]);

  return {
    reviewMediaFiles,
    setReviewMediaFiles,
    removeReviewMedia,
    resetReviewMedia,
    pickReviewPhotos,
    pickReviewFiles,
    handleFileInput,
    photoInputRef,
    fileInputRef,
    maxReviewMedia: MAX_REVIEW_MEDIA,
    maxFileSize: MAX_FILE_SIZE_BYTES,
  };
}
