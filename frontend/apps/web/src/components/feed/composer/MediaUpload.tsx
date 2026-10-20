'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

interface MediaUploadProps {
  mediaFiles: File[];
  onAddMedia: (files: File[]) => void;
  onRemoveMedia: (index: number) => void;
}

// The types, sizes and count the post-media upload accepts. A file it would
// refuse is never added, so a retry can't fail on the same attachment again.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const PDF_TYPE = 'application/pdf';
const MAX_ATTACHMENTS = 9;

function sizeLimitMb(type: string) {
  if (IMAGE_TYPES.includes(type)) return 10;
  if (VIDEO_TYPES.includes(type)) return 100;
  return type === PDF_TYPE ? 25 : 0;
}

export default function MediaUpload({ mediaFiles, onAddMedia, onRemoveMedia }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {/* Thumbnails */}
      {mediaFiles.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {mediaFiles.map((file, idx) => (
            <div key={idx} className="relative flex-shrink-0">
              {/* unoptimized: local blob URL */}
              <AttachmentPreview file={file} />
              <button
                aria-label={`Remove attachment ${idx + 1}: ${file.name}`}
                onClick={() => { setError(null); onRemoveMedia(idx); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Photo picker button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-app-muted hover-bg-app rounded-lg transition"
      >
        <Camera className="w-4 h-4" /> Photo, video, or PDF
      </button>
      {error && <p role="alert" className="px-4 text-sm text-red-600">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={[...IMAGE_TYPES, ...VIDEO_TYPES, PDF_TYPE].join(',')}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length === 0) return;
          // Existing attachments are always kept; only files the upload accepts are added.
          const unsupported = files.some(file => sizeLimitMb(file.type) === 0);
          const valid = files.filter(file => file.size > 0 && file.size <= sizeLimitMb(file.type) * 1024 * 1024);
          const remaining = Math.max(0, MAX_ATTACHMENTS - mediaFiles.length);
          setError(unsupported
            ? 'Some files weren’t added. Choose photos (JPEG, PNG, GIF, WebP, AVIF or HEIC), videos (MP4, MOV, AVI or WebM) or PDFs.'
            : valid.length !== files.length
              ? 'Some files weren’t added. Files can’t be empty; photos can be up to 10 MB, videos 100 MB and PDFs 25 MB.'
              : valid.length > remaining
                ? `Up to ${MAX_ATTACHMENTS} attachments per post. ${remaining > 0 ? `Only the first ${remaining} were added.` : 'Your existing attachments are kept.'}`
                : null);
          if (remaining > 0 && valid.length > 0) onAddMedia(valid.slice(0, remaining));
        }}
      />
    </>
  );
}

function AttachmentPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  if (file.type === 'application/pdf') return <div className="w-16 h-16 rounded-lg bg-surface-muted flex items-center justify-center">PDF</div>;
  if (file.type.startsWith('video/')) return <video src={url} muted preload="metadata" className="w-16 h-16 rounded-lg object-cover bg-surface-muted" aria-label="Video attachment" />;
  return url ? <Image src={url} alt="Photo attachment" className="w-16 h-16 rounded-lg object-cover bg-surface-muted" width={64} height={64} unoptimized /> : null;
}
