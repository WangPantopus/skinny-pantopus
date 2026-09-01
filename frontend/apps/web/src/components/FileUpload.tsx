'use client';

import Image from 'next/image';
import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Image as ImageIcon, Film, FileText, Paperclip, Camera } from 'lucide-react';

const ACCEPTED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
};

const FILE_ICONS: Record<string, ReactNode> = {
  image: <ImageIcon className="w-5 h-5 text-app-text-secondary" />,
  video: <Film className="w-5 h-5 text-app-text-secondary" />,
  document: <FileText className="w-5 h-5 text-app-text-secondary" />,
  unknown: <Paperclip className="w-5 h-5 text-app-text-secondary" />,
};

function getCategory(mimeType: string): string {
  for (const [cat, types] of Object.entries(ACCEPTED_TYPES)) {
    if (types.includes(mimeType)) return cat;
  }
  return 'unknown';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadProps {
  /** Which file types to accept. Default: all */
  accept?: ('image' | 'video' | 'document')[];
  /** Max number of files. 1 = single file mode */
  maxFiles?: number;
  /** Max file size in bytes */
  maxSize?: number;
  /** Called when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Currently selected files for preview */
  files?: File[];
  /** Existing media URLs for preview (already uploaded) */
  existingMedia?: Array<{ id: string; url: string; name: string; type: string; thumbnailUrl?: string | null }>;
  /** Called to remove an existing media item */
  onRemoveExisting?: (id: string) => void;
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Compact mode for smaller areas */
  compact?: boolean;
  /** Disable the upload area */
  disabled?: boolean;
}

export default function FileUpload({
  accept = ['image', 'video', 'document'],
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024,
  onFilesSelected,
  files = [],
  existingMedia = [],
  onRemoveExisting,
  label,
  helperText,
  compact = false,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const acceptedMimes = accept.flatMap((cat) => ACCEPTED_TYPES[cat] || []);
  const acceptString = acceptedMimes.join(',');

  const validateAndAdd = useCallback(
    (newFiles: FileList | File[]) => {
      setError('');
      const arr = Array.from(newFiles);
      const totalCount = files.length + existingMedia.length + arr.length;

      if (totalCount > maxFiles) {
        setError(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`);
        return;
      }

      const valid: File[] = [];
      for (const f of arr) {
        if (!acceptedMimes.includes(f.type)) {
          setError(`File type not allowed: ${f.name}`);
          continue;
        }
        if (f.size > maxSize) {
          setError(`${f.name} is too large (max ${formatSize(maxSize)})`);
          continue;
        }
        valid.push(f);
      }

      if (valid.length > 0) {
        // In single-file mode, replace; in multi-file mode, append
        if (maxFiles === 1) {
          onFilesSelected(valid.slice(0, 1));
        } else {
          onFilesSelected([...files, ...valid]);
        }
      }
    },
    [files, existingMedia, maxFiles, maxSize, acceptedMimes, onFilesSelected]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) validateAndAdd(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) validateAndAdd(e.target.files);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesSelected(updated);
  };

  const isSingle = maxFiles === 1;
  const singlePreview = isSingle && files.length > 0 ? URL.createObjectURL(files[0]) : null;
  const existingSingleUrl = isSingle && existingMedia.length > 0 ? existingMedia[0].url : null;

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-app-text-strong">{label}</label>}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-app-border hover:border-gray-400 bg-app-surface-raised'}
          ${compact ? 'p-3' : 'p-6'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Single file preview (profile picture mode) */}
        {isSingle && (singlePreview || existingSingleUrl) ? (
          <div className="flex items-center gap-4">
            <Image
              src={singlePreview || existingSingleUrl!}
              alt="Preview"
              className="w-20 h-20 rounded-full object-cover border-2 border-app-border"
              width={80}
              height={80}
              sizes="80px"
              quality={75}
            />
            <div>
              <p className="text-sm text-app-text-strong font-medium">
                {files.length > 0 ? files[0].name : 'Current picture'}
              </p>
              <p className="text-xs text-blue-600 mt-1">Click to change</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`text-app-text-muted mb-1 flex justify-center`}>
              {accept.includes('image') ? <Camera className={compact ? 'w-5 h-5' : 'w-8 h-8'} /> : <Paperclip className={compact ? 'w-5 h-5' : 'w-8 h-8'} />}
            </div>
            <p className={`text-app-text-secondary ${compact ? 'text-xs' : 'text-sm'} font-medium`}>
              {compact ? 'Add files' : 'Drop files here or click to browse'}
            </p>
            {!compact && (
              <p className="text-xs text-app-text-muted mt-1">
                {accept.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')} •{' '}
                Max {formatSize(maxSize)} each • Up to {maxFiles} file{maxFiles > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={maxFiles > 1}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Helper */}
      {helperText && !error && (
        <p className="text-xs text-app-text-secondary">{helperText}</p>
      )}

      {/* File list (multi-file mode) */}
      {!isSingle && (files.length > 0 || existingMedia.length > 0) && (
        <div className="space-y-2">
          {/* Existing media */}
          {existingMedia.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-lg px-3 py-2">
              {m.thumbnailUrl || m.type === 'image' ? (
                <Image src={m.thumbnailUrl || m.url} alt={m.name} className="w-10 h-10 rounded object-cover" width={40} height={40} sizes="40px" quality={75} />
              ) : (
                <span className="flex-shrink-0">{FILE_ICONS[m.type] || FILE_ICONS.unknown}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-app-text-strong truncate">{m.name}</p>
                <p className="text-xs text-green-600">Uploaded</p>
              </div>
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveExisting(m.id); }}
                  className="text-app-text-muted hover:text-red-500 transition text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* New files pending upload */}
          {files.map((f, i) => {
            const cat = getCategory(f.type);
            const isImage = cat === 'image';
            return (
              <div key={i} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-lg px-3 py-2">
                {isImage ? (
                  /* unoptimized: local blob URL */
                  <Image src={URL.createObjectURL(f)} alt={f.name} className="w-10 h-10 rounded object-cover" width={40} height={40} unoptimized />
                ) : (
                  <span className="flex-shrink-0">{FILE_ICONS[cat]}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-app-text-strong truncate">{f.name}</p>
                  <p className="text-xs text-app-text-muted">{formatSize(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="text-app-text-muted hover:text-red-500 transition text-sm"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
