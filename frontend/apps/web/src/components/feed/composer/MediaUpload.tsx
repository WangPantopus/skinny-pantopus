'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

interface MediaUploadProps {
  mediaFiles: File[];
  onAddMedia: (files: File[]) => void;
  onRemoveMedia: (index: number) => void;
}

export default function MediaUpload({ mediaFiles, onAddMedia, onRemoveMedia }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = mediaFiles.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [mediaFiles]);

  return (
    <>
      {/* Thumbnails */}
      {mediaFiles.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {mediaFiles.map((file, idx) => (
            <div key={idx} className="relative flex-shrink-0">
              {/* unoptimized: local blob URL */}
              {previews[idx] && (file.type.startsWith('video/')
                ? <video src={previews[idx]} aria-label={`Preview ${file.name}`} className="w-16 h-16 rounded-lg object-cover bg-surface-muted" muted preload="metadata" />
                : <Image src={previews[idx]} alt={file.name} className="w-16 h-16 rounded-lg object-cover bg-surface-muted" width={64} height={64} unoptimized />)}
              <button
                aria-label={`Remove attachment ${idx + 1}: ${file.name}`}
                onClick={() => { setError(''); onRemoveMedia(idx); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className="px-4 pb-2 text-xs text-red-600">{error}</p>}

      {/* Photo picker button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-app-muted hover-bg-app rounded-lg transition"
      >
        <Camera className="w-4 h-4" /> Photo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif,video/mp4,video/quicktime,video/x-msvideo,video/webm"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length === 0) return;
          if (mediaFiles.length + files.length > 9) {
            setError('Choose up to 9 photos or videos per post. Your existing attachments are kept.');
            return;
          }
          const supported = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']);
          if (files.some((file) => !supported.has(file.type))) {
            setError('Choose a supported photo or video file.');
            return;
          }
          if (files.some((file) => file.size === 0 || file.size > (file.type.startsWith('video/') ? 100 : 10) * 1024 * 1024)) {
            setError('Files must not be empty. Photos can be up to 10 MB and videos up to 100 MB.');
            return;
          }
          setError('');
          onAddMedia(files);
        }}
      />
    </>
  );
}
