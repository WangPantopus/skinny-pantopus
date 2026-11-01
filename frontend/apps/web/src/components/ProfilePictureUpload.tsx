'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import * as api from '@pantopus/api';
import { refreshMe } from '@/lib/me';

interface ProfilePictureUploadProps {
  currentUrl?: string | null;
  fallbackInitial: string;
  onUploaded: (url: string) => void;
}

export default function ProfilePictureUpload({
  currentUrl,
  fallbackInitial,
  onUploaded,
}: ProfilePictureUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, GIF, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setError('');

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload
    setUploading(true);
    try {
      const result = await api.upload.uploadProfilePicture(file);
      void refreshMe();
      onUploaded(result.url);
    } catch (err: unknown) {
      console.error('Profile picture upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }

    // Reset input
    e.target.value = '';
  };

  const displayUrl = previewUrl || currentUrl;

  // Your account's photo (Edit profile → Only you see this): neighbors see the photo above it.
  return (
    <div className="py-4 flex items-start gap-3.5">
      {displayUrl ? (
        <Image
          src={displayUrl}
          alt=""
          className="w-12 h-12 shrink-0 rounded-full object-cover border border-app-border"
          width={48}
          height={48}
          sizes="48px"
          quality={75}
        />
      ) : (
        <div aria-hidden="true" className="w-12 h-12 shrink-0 rounded-full bg-app-surface-sunken text-app-text-secondary flex items-center justify-center text-lg font-semibold">
          {fallbackInitial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] leading-5 font-semibold text-app-text">Account photo</p>
        <p className="mt-0.5 text-[0.8125rem] leading-[1.125rem] text-app-text-secondary">
          For your account. Neighbors see the profile photo above. JPG, PNG, GIF or WebP, up to 5 MB.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-2.5 min-h-[2.75rem] px-3.5 rounded-full border border-app-border-strong bg-app-surface text-[0.875rem] font-semibold text-app-text hover:bg-app-hover disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : displayUrl ? 'Change account photo' : 'Add account photo'}
        </button>
        {error && <p className="text-sm text-red-600 mt-1" role="alert">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choose your account photo"
      />
    </div>
  );
}
