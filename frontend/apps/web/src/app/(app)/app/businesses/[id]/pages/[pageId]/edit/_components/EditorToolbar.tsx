'use client';

import { Pencil, Eye } from 'lucide-react';
import { confirmStore } from '@/components/ui/confirm-store';
import type { BusinessPage } from './types';

interface EditorToolbarProps {
  page: BusinessPage | null;
  hasUnsavedChanges: boolean;
  saving: boolean;
  publishing: boolean;
  showPreview: boolean;
  draftRevision: number;
  publishedRevision: number;
  undoStackLength: number;
  redoStackLength: number;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePreview: () => void;
  onToggleRevisions: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export default function EditorToolbar({
  page,
  hasUnsavedChanges,
  saving,
  publishing,
  showPreview,
  draftRevision,
  publishedRevision,
  undoStackLength,
  redoStackLength,
  onBack,
  onUndo,
  onRedo,
  onTogglePreview,
  onToggleRevisions,
  onSaveDraft,
  onPublish,
}: EditorToolbarProps) {
  const hasDraftChanges = draftRevision > publishedRevision;

  const handleBack = async () => {
    if (hasUnsavedChanges) {
      const yes = await confirmStore.open({
        title: 'You have unsaved changes. Leave anyway?',
        confirmLabel: 'Leave',
        variant: 'destructive',
      });
      if (!yes) return;
    }
    onBack();
  };

  return (
    <header className="h-12 bg-app-surface border-b border-app-border flex items-center justify-between px-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="text-app-text-muted hover:text-app-text-secondary p-1"
          title="Back to pages"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="text-sm font-semibold text-app-text">{page?.title || 'Page'}</div>
          <div className="text-[10px] text-app-text-muted flex items-center gap-1">
            /{page?.slug}
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Unsaved
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center border border-app-border rounded-lg overflow-hidden mr-1">
          <button
            onClick={onUndo}
            disabled={undoStackLength === 0}
            className="px-2 py-1.5 text-app-text-secondary hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
            </svg>
          </button>
          <div className="w-px h-5 bg-app-surface-sunken" />
          <button
            onClick={onRedo}
            disabled={redoStackLength === 0}
            className="px-2 py-1.5 text-app-text-secondary hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
            </svg>
          </button>
        </div>

        {/* Status badges */}
        <button
          onClick={onToggleRevisions}
          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 cursor-pointer transition ${
            publishedRevision > 0
              ? 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100'
              : 'text-app-text-secondary bg-app-surface-raised border border-app-border hover:bg-app-hover'
          }`}
          title="View revision history"
        >
          {publishedRevision > 0 ? `Published v${publishedRevision}` : 'Unpublished'}
        </button>
        <span className="text-[10px] text-app-text-muted">Draft v{draftRevision}</span>

        {/* Preview toggle */}
        <button
          onClick={onTogglePreview}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            showPreview
              ? 'bg-violet-50 border-violet-200 text-violet-700'
              : 'border-app-border text-app-text-secondary hover:bg-app-hover'
          }`}
          title="Toggle preview (Esc to exit)"
        >
          {showPreview ? <><Pencil className="w-4 h-4 inline-block" /> Edit</> : <><Eye className="w-4 h-4 inline-block" /> Preview</>}
        </button>

        {/* Save */}
        <button
          onClick={onSaveDraft}
          disabled={saving || !hasUnsavedChanges}
          className="px-3 py-1.5 rounded-lg border border-app-border text-xs font-semibold text-app-text-strong hover:bg-app-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
          title="Save draft (Ctrl+S)"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>

        {/* Publish */}
        <button
          onClick={onPublish}
          disabled={publishing || (!hasUnsavedChanges && !hasDraftChanges)}
          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </header>
  );
}
