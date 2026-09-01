'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useCallback } from 'react';
import { Camera, Save, FolderOpen, Handshake } from 'lucide-react';
import { formatTimestamp } from '@pantopus/ui-utils';
import type { VaultFolder } from '@/types/mailbox';

type PackageUnboxingProps = {
  itemId: string;
  deliveryPhoto?: string;
  deliveryNote?: string;
  deliveredAt?: string;
  /** Document block file IDs from the mail item (warranty, manual, etc.) */
  documentIds?: { type: string; fileId: string; label: string }[];
  vaultFolders?: VaultFolder[];
  onUploadConditionPhoto: (file: File) => Promise<void>;
  onSaveToVault: (fileId: string, folderId: string) => void;
  onCreateGig: () => void;
  onSkipUnboxing: () => void;
};

export default function PackageUnboxing({
  deliveryPhoto,
  deliveryNote,
  deliveredAt,
  documentIds,
  vaultFolders,
  onUploadConditionPhoto,
  onSaveToVault,
  onCreateGig,
  onSkipUnboxing,
}: PackageUnboxingProps) {
  const [uploading, setUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [vaultPickerOpen, setVaultPickerOpen] = useState<string | null>(null);
  const [savedDocs, setSavedDocs] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadConditionPhoto(file);
      setPhotoUploaded(true);
    } finally {
      setUploading(false);
    }
  }, [onUploadConditionPhoto]);

  const handleSaveToVault = useCallback((docType: string, fileId: string, folderId: string) => {
    onSaveToVault(fileId, folderId);
    setSavedDocs(prev => new Set(prev).add(docType));
    setVaultPickerOpen(null);
  }, [onSaveToVault]);

  if (skipped) return null;

  return (
    <div className="mx-6 my-4 border border-green-200 dark:border-green-800 rounded-xl overflow-hidden">
      {/* ── Delivery header ─────────────────────────────────── */}
      <div className="bg-green-50 dark:bg-green-950/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-green-800 dark:text-green-300">
            DELIVERED TODAY
          </span>
        </div>
      </div>

      {/* ── Delivery photo ──────────────────────────────────── */}
      {deliveryPhoto && (
        <div className="px-4 py-3 border-b border-green-100 dark:border-green-900/30">
          <img
            src={deliveryPhoto}
            alt="Delivery photo"
            className="w-full max-h-48 object-cover rounded-lg"
          />
          <p className="text-xs text-app-text-secondary mt-2">
            {deliveryNote || 'Left at front door'}
            {deliveredAt && ` · ${formatTimestamp(deliveredAt)}`}
          </p>
        </div>
      )}

      {!deliveryPhoto && deliveryNote && (
        <div className="px-4 py-3 border-b border-green-100 dark:border-green-900/30">
          <p className="text-xs text-app-text-secondary">
            {deliveryNote}
            {deliveredAt && ` · ${formatTimestamp(deliveredAt)}`}
          </p>
        </div>
      )}

      {/* ── Unboxing section ────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-app-border-subtle">
        <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2.5">
          Unboxing
        </p>

        <div className="space-y-2">
          {/* Take condition photo */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || photoUploaded}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
              photoUploaded
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                : uploading
                  ? 'border-app-border bg-app-surface-raised text-app-text-muted cursor-not-allowed'
                  : 'border-app-border hover:bg-app-hover dark:hover:bg-gray-800 text-app-text-strong'
            }`}
          >
            {photoUploaded ? (
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : uploading ? (
              <div className="w-5 h-5 border-2 border-app-border border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
            ) : (
              <Camera className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">
              {photoUploaded ? 'Condition photo saved' : uploading ? 'Uploading...' : 'Take condition photo'}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Skip */}
          <button
            type="button"
            onClick={() => {
              onSkipUnboxing();
              setSkipped(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="text-sm text-app-text-secondary font-medium">Skip</span>
          </button>
        </div>
      </div>

      {/* ── Quick save section ──────────────────────────────── */}
      {documentIds && documentIds.length > 0 && (
        <div className="px-4 py-3 border-b border-app-border-subtle">
          <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2.5">
            Quick Save
          </p>
          <div className="space-y-2">
            {documentIds.map((doc) => (
              <div key={doc.type} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (savedDocs.has(doc.type)) return;
                    setVaultPickerOpen(vaultPickerOpen === doc.type ? null : doc.type);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                    savedDocs.has(doc.type)
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                      : 'border-app-border hover:bg-app-hover dark:hover:bg-gray-800 text-app-text-strong'
                  }`}
                >
                  {savedDocs.has(doc.type) ? (
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <Save className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium">
                    {savedDocs.has(doc.type)
                      ? `${doc.label} saved to Vault`
                      : `Save ${doc.label.toLowerCase()} to Vault`}
                  </span>
                </button>

                {/* Vault folder picker dropdown */}
                {vaultPickerOpen === doc.type && vaultFolders && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-app-surface border border-app-border rounded-lg shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                    {vaultFolders.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-app-text-muted">No folders</p>
                    ) : (
                      vaultFolders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => handleSaveToVault(doc.type, doc.fileId, folder.id)}
                          className="w-full text-left px-3 py-2 text-sm text-app-text-strong hover:bg-app-hover dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                          <span className="text-base">{folder.icon || <FolderOpen className="w-4 h-4" />}</span>
                          <span className="truncate">{folder.label}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Need help section ───────────────────────────────── */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2.5">
          Need Help?
        </p>
        <button
          type="button"
          onClick={onCreateGig}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
        >
          <Handshake className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            Ask a neighbor to help assemble
          </span>
          <svg className="w-4 h-4 text-primary-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
