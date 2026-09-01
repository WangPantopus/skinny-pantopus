import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { useBlockOperations } from './useBlockOperations';
import type { BusinessPage, PageRevision, Toast } from './types';

let toastId = 0;

export function usePageEditor() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.id as string;
  const pageId = params.pageId as string;

  // Page metadata
  const [page, setPage] = useState<BusinessPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Revision state
  const [draftRevision, setDraftRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState(0);

  // UI state
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<PageRevision[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Block operations (mutations, undo/redo, drag)
  const blockOps = useBlockOperations({ showToast });
  const {
    resetBlocks,
    blocks,
    setBlocks,
    setHasUnsavedChanges,
    hasUnsavedChanges,
    selectedBlockIndex,
    setSelectedBlockIndex,
    undo,
    redo,
    deleteBlock,
    duplicateBlock,
  } = blockOps;

  // ─── Unsaved changes warning ──────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ─── Load ───────────────────────────────────

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) { router.push('/login'); return; }

      const [pagesRes, blocksRes] = await Promise.all([
        api.businesses.getPages(businessId),
        api.businesses.getPageBlocks(businessId, pageId, { revision: 'draft' }),
      ]);

      const pageData = (pagesRes.pages || []).find((p) => p.id === pageId);
      if (!pageData) { setError('Page not found'); return; }

      setPage(pageData);
      const loadedBlocks = (blocksRes.blocks || []).map((b, i) => ({
        id: b.id,
        block_type: b.block_type,
        schema_version: b.schema_version || 1,
        sort_order: b.sort_order ?? i,
        data: b.data || {},
        settings: b.settings || {},
        location_id: b.location_id,
        show_from: b.show_from,
        show_until: b.show_until,
        is_visible: b.is_visible !== false,
      }));
      resetBlocks(loadedBlocks);
      setDraftRevision(blocksRes.draft_revision || 1);
      setPublishedRevision(blocksRes.published_revision || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }, [businessId, pageId, router, resetBlocks]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // ─── Save / Publish ────────────────────────

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const blocksPayload = blocks.map((b, i) => ({
        id: b.id,
        block_type: b.block_type,
        schema_version: b.schema_version || 1,
        sort_order: i,
        data: b.data,
        settings: b.settings || {},
        location_id: b.location_id || undefined,
        show_from: b.show_from || undefined,
        show_until: b.show_until || undefined,
        is_visible: b.is_visible !== false,
      }));

      const res = await api.businesses.saveDraftBlocks(businessId, pageId, { blocks: blocksPayload });
      setDraftRevision(res.draft_revision);

      if (res.blocks) {
        setBlocks(
          res.blocks.map((b, i) => ({
            id: b.id,
            block_type: b.block_type,
            schema_version: b.schema_version || 1,
            sort_order: b.sort_order ?? i,
            data: b.data || {},
            settings: b.settings || {},
            location_id: b.location_id,
            show_from: b.show_from,
            show_until: b.show_until,
            is_visible: b.is_visible !== false,
          }))
        );
      }

      setHasUnsavedChanges(false);
      showToast('Draft saved', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  }, [blocks, businessId, pageId, showToast, setBlocks, setHasUnsavedChanges]);

  const publish = async () => {
    setPublishing(true);
    try {
      if (hasUnsavedChanges) await saveDraft();
      const res = await api.businesses.publishPage(businessId, pageId);
      setPublishedRevision(res.published_revision);
      setHasUnsavedChanges(false);
      showToast(`Published as v${res.published_revision}`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // ─── Keyboard shortcuts ───────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);

      // Ctrl/Cmd + S -> save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && !saving) saveDraft();
        return;
      }

      // Ctrl/Cmd + Z -> undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (!isInputFocused) { e.preventDefault(); undo(); }
        return;
      }

      // Ctrl/Cmd + Shift + Z -> redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        if (!isInputFocused) { e.preventDefault(); redo(); }
        return;
      }

      // Ctrl/Cmd + Y -> redo (alt)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        if (!isInputFocused) { e.preventDefault(); redo(); }
        return;
      }

      if (isInputFocused) return;

      // Escape -> deselect block / exit preview
      if (e.key === 'Escape') {
        if (showPreview) { setShowPreview(false); }
        else if (selectedBlockIndex !== null) { setSelectedBlockIndex(null); }
        return;
      }

      // Delete/Backspace -> delete selected block
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIndex !== null && !showPreview) {
        e.preventDefault();
        deleteBlock(selectedBlockIndex);
        return;
      }

      // Ctrl/Cmd + D -> duplicate selected block
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedBlockIndex !== null && !showPreview) {
        e.preventDefault();
        duplicateBlock(selectedBlockIndex);
        return;
      }

      // Arrow Up -> select previous block
      if (e.key === 'ArrowUp' && selectedBlockIndex !== null && selectedBlockIndex > 0 && !showPreview) {
        e.preventDefault();
        setSelectedBlockIndex(selectedBlockIndex - 1);
        return;
      }

      // Arrow Down -> select next block
      if (e.key === 'ArrowDown' && selectedBlockIndex !== null && selectedBlockIndex < blocks.length - 1 && !showPreview) {
        e.preventDefault();
        setSelectedBlockIndex(selectedBlockIndex + 1);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasUnsavedChanges, saving, selectedBlockIndex, blocks.length, showPreview, undo, redo, deleteBlock, duplicateBlock, saveDraft, setSelectedBlockIndex]);

  // ─── Revision history ─────────────────────

  const loadRevisions = useCallback(async () => {
    try {
      const res = await api.businesses.getPageRevisions(businessId, pageId);
      setRevisions(res.revisions || []);
    } catch {
      setRevisions([]);
    }
  }, [businessId, pageId]);

  useEffect(() => {
    if (showRevisions) loadRevisions();
  }, [showRevisions, loadRevisions]);

  // ─── Navigation ─────────────────────────────

  const navigateBack = useCallback(() => {
    router.push(`/app/businesses/${businessId}/dashboard?tab=pages`);
  }, [router, businessId]);

  return {
    // Identifiers
    businessId,
    pageId,

    // Page data
    page,
    loading,
    error,

    // Blocks (forwarded from blockOps)
    blocks: blockOps.blocks,
    draftRevision,
    publishedRevision,
    hasUnsavedChanges: blockOps.hasUnsavedChanges,

    // UI state
    selectedBlockIndex: blockOps.selectedBlockIndex,
    setSelectedBlockIndex: blockOps.setSelectedBlockIndex,
    saving,
    publishing,
    showPreview,
    setShowPreview,
    showRevisions,
    setShowRevisions,
    revisions,

    // Drag state
    dragIndex: blockOps.dragIndex,
    dropTargetIndex: blockOps.dropTargetIndex,
    dropPosition: blockOps.dropPosition,

    // Undo/Redo
    undoStack: blockOps.undoStack,
    redoStack: blockOps.redoStack,
    undo: blockOps.undo,
    redo: blockOps.redo,

    // Toast
    toasts,
    dismissToast,

    // Block operations
    updateBlock: blockOps.updateBlock,
    deleteBlock: blockOps.deleteBlock,
    duplicateBlock: blockOps.duplicateBlock,
    addBlock: blockOps.addBlock,
    moveBlock: blockOps.moveBlock,

    // Drag handlers
    handleDragStart: blockOps.handleDragStart,
    handleDragEnd: blockOps.handleDragEnd,
    handleDragOver: blockOps.handleDragOver,
    handleDragLeave: blockOps.handleDragLeave,

    // Persistence
    saveDraft,
    publish,

    // Navigation
    navigateBack,
    router,
  };
}
