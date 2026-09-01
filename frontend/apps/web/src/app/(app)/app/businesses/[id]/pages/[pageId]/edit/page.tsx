'use client';

import { usePageEditor } from './_components/usePageEditor';
import { ToastContainer } from './_components/ToastContainer';
import EditorToolbar from './_components/EditorToolbar';
import BlockPalette from './_components/BlockPalette';
import BlockCanvas from './_components/BlockCanvas';
import RevisionDrawer from './_components/RevisionDrawer';

export default function PageBuilderPage() {
  const editor = usePageEditor();

  // ─── Loading state ────────────────────────────
  if (editor.loading) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-app-surface-sunken flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto" />
          <div className="mt-3 text-sm text-app-text-secondary">Loading page builder…</div>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────
  if (editor.error) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-app-surface-sunken flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-2">{editor.error}</div>
          <button onClick={() => editor.router.back()} className="text-sm text-violet-600 hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  // ─── Main editor layout ───────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-app-surface-sunken overflow-hidden">
      {/* Top bar */}
      <EditorToolbar
        page={editor.page}
        hasUnsavedChanges={editor.hasUnsavedChanges}
        saving={editor.saving}
        publishing={editor.publishing}
        showPreview={editor.showPreview}
        draftRevision={editor.draftRevision}
        publishedRevision={editor.publishedRevision}
        undoStackLength={editor.undoStack.length}
        redoStackLength={editor.redoStack.length}
        onBack={editor.navigateBack}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onTogglePreview={() => editor.setShowPreview(!editor.showPreview)}
        onToggleRevisions={() => editor.setShowRevisions(!editor.showRevisions)}
        onSaveDraft={editor.saveDraft}
        onPublish={editor.publish}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Block palette (edit mode only) */}
        {!editor.showPreview && (
          <BlockPalette onAddBlock={editor.addBlock} />
        )}

        {/* Center + Right: Canvas with block list and editor panel */}
        <BlockCanvas
          blocks={editor.blocks}
          selectedBlockIndex={editor.selectedBlockIndex}
          showPreview={editor.showPreview}
          dragIndex={editor.dragIndex}
          dropTargetIndex={editor.dropTargetIndex}
          dropPosition={editor.dropPosition}
          onSelectBlock={editor.setSelectedBlockIndex}
          onUpdateBlock={editor.updateBlock}
          onDeleteBlock={editor.deleteBlock}
          onDuplicateBlock={editor.duplicateBlock}
          onMoveBlock={editor.moveBlock}
          onDragStart={editor.handleDragStart}
          onDragEnd={editor.handleDragEnd}
          onDragOver={editor.handleDragOver}
          onDragLeave={editor.handleDragLeave}
          onExitPreview={() => editor.setShowPreview(false)}
        />

        {/* Revision history drawer */}
        {editor.showRevisions && (
          <RevisionDrawer
            revisions={editor.revisions}
            publishedRevision={editor.publishedRevision}
            onClose={() => editor.setShowRevisions(false)}
          />
        )}
      </div>

      {/* Toasts */}
      <ToastContainer toasts={editor.toasts} onDismiss={editor.dismissToast} />
    </div>
  );
}
