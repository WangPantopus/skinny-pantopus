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
                aria-label="Remove attachment"
                onClick={() => onRemoveMedia(idx)}
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
        accept="image/*,video/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          const valid = files.filter(file => {
            const limit = file.type.startsWith('image/') ? 10 : file.type.startsWith('video/') ? 100 : file.type === 'application/pdf' ? 25 : 0;
            return file.size > 0 && file.size <= limit * 1024 * 1024;
          });
          const remaining = Math.max(0, 9 - mediaFiles.length);
          setError(valid.length !== files.length ? 'Choose images under 10 MB, videos under 100 MB, or PDFs under 25 MB.' : valid.length > remaining ? 'Up to 9 attachments per post.' : null);
          onAddMedia(valid.slice(0, remaining));
          e.target.value = '';
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
