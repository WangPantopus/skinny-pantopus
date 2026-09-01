'use client';

import { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import * as api from '@pantopus/api';

interface DeliveryProofSheetProps {
  open: boolean;
  gigId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function DeliveryProofSheet({
  open,
  gigId,
  onClose,
  onSubmitted,
}: DeliveryProofSheetProps) {
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous URL
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto({ file, url: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const proof: { note?: string; photos?: string[] } = {};
      if (note.trim()) proof.note = note.trim();

      if (photo) {
        try {
          const uploadRes = await api.upload.uploadGigMedia(gigId, [photo.file]);
          const urls = ((uploadRes as any)?.media || [])
            .map((m: any) => m.file_url || m.url)
            .filter(Boolean) as string[];
          if (urls.length > 0) proof.photos = urls;
        } catch {
          // Continue without photo — mark completed anyway
        }
      }

      await api.gigs.markGigCompleted(gigId, proof);
      onSubmitted();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    handleRemovePhoto();
    setNote('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-app-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <button type="button" onClick={handleClose} className="p-1 text-app-text hover:bg-app-hover rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold text-app-text">Delivery Proof</h3>
          <div className="w-7" />
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-app-text-strong leading-relaxed">
            Take a photo at the dropoff location to confirm delivery.
          </p>

          {/* Photo area */}
          {photo ? (
            <div className="space-y-2 text-center">
              <img
                src={photo.url}
                alt="Delivery proof"
                className="w-full h-60 rounded-xl object-cover border border-app-border"
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-4 py-2 border border-app-border rounded-full text-sm font-medium text-app-text-secondary hover:bg-app-hover transition"
              >
                Retake
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition"
            >
              <Camera className="w-8 h-8 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-600">Take or Select Photo</span>
            </button>
          )}

          {/* Note */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 disabled:opacity-60 transition"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Submitting&hellip;
              </span>
            ) : (
              'Submit Proof'
            )}
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
