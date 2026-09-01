'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import * as api from '@pantopus/api';

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

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-6">
      <h2 className="text-lg font-semibold text-app-text mb-4">Profile Picture</h2>
      <div className="flex items-center gap-6">
        {/* Avatar preview */}
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-2 border-app-border"
            width={96}
            height={96}
            sizes="96px"
            quality={75}
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold">
            {fallbackInitial}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Uploading...
              </span>
            ) : displayUrl ? (
              'Change Photo'
            ) : (
              'Upload Photo'
            )}
          </button>
          <p className="text-sm text-app-text-secondary mt-2">JPG, PNG, GIF, or WebP. Max 5MB.</p>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
