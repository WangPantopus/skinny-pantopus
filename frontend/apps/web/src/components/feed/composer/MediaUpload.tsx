'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { Camera } from 'lucide-react';

interface MediaUploadProps {
  mediaFiles: File[];
  onAddMedia: (files: File[]) => void;
  onRemoveMedia: (index: number) => void;
}

export default function MediaUpload({ mediaFiles, onAddMedia, onRemoveMedia }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Thumbnails */}
      {mediaFiles.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {mediaFiles.map((file, idx) => (
            <div key={idx} className="relative flex-shrink-0">
              {/* unoptimized: local blob URL */}
              <Image src={URL.createObjectURL(file)} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-muted" width={64} height={64} unoptimized />
              <button
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
        <Camera className="w-4 h-4" /> Photo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAddMedia(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </>
  );
}
