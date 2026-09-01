import { useState, useCallback, useRef } from 'react';
import { BLOCK_TYPE_REGISTRY } from '@/components/business/BlockPreview';
import { MAX_UNDO } from './types';
import type { BlockData, HistoryEntry } from './types';

interface UseBlockOperationsOptions {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function useBlockOperations({ showToast }: UseBlockOperationsOptions) {
  // Blocks state
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const skipHistoryRef = useRef(false);

  // ─── History helpers ──────────────────────────

  const pushHistory = useCallback(
    (currentBlocks: BlockData[], currentSelected: number | null) => {
      if (skipHistoryRef.current) return;
      setUndoStack((prev) => {
        const next = [...prev, { blocks: currentBlocks.map((b) => ({ ...b, data: { ...b.data } })), selectedBlockIndex: currentSelected }];
        if (next.length > MAX_UNDO) next.shift();
        return next;
      });
      setRedoStack([]);
    },
    []
  );

  const undo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const newUndo = [...prevUndo];
      const entry = newUndo.pop()!;

      // Push current state to redo
      setRedoStack((prevRedo) => [
        ...prevRedo,
        { blocks: blocks.map((b) => ({ ...b, data: { ...b.data } })), selectedBlockIndex },
      ]);

      skipHistoryRef.current = true;
      setBlocks(entry.blocks);
      setSelectedBlockIndex(entry.selectedBlockIndex);
      setHasUnsavedChanges(true);
      setTimeout(() => { skipHistoryRef.current = false; }, 0);

      return newUndo;
    });
  }, [blocks, selectedBlockIndex]);

  const redo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const newRedo = [...prevRedo];
      const entry = newRedo.pop()!;

      // Push current state to undo
      setUndoStack((prevUndo) => [
        ...prevUndo,
        { blocks: blocks.map((b) => ({ ...b, data: { ...b.data } })), selectedBlockIndex },
      ]);

      skipHistoryRef.current = true;
      setBlocks(entry.blocks);
      setSelectedBlockIndex(entry.selectedBlockIndex);
      setHasUnsavedChanges(true);
      setTimeout(() => { skipHistoryRef.current = false; }, 0);

      return newRedo;
    });
  }, [blocks, selectedBlockIndex]);

  // ─── Block mutations ───────────────────────

  const updateBlock = (index: number, updated: BlockData) => {
    pushHistory(blocks, selectedBlockIndex);
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const deleteBlock = useCallback((index: number) => {
    pushHistory(blocks, selectedBlockIndex);
    setBlocks((prev) => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, sort_order: i })));
    if (selectedBlockIndex === index) setSelectedBlockIndex(null);
    else if (selectedBlockIndex !== null && selectedBlockIndex > index) setSelectedBlockIndex(selectedBlockIndex - 1);
    setHasUnsavedChanges(true);
    showToast('Block deleted', 'info');
  }, [blocks, selectedBlockIndex, pushHistory, showToast]);

  const duplicateBlock = useCallback((index: number) => {
    pushHistory(blocks, selectedBlockIndex);
    const source = blocks[index];
    const clone: BlockData = {
      ...source,
      id: undefined,
      data: { ...source.data },
      settings: { ...source.settings },
      sort_order: index + 1,
    };
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    setSelectedBlockIndex(index + 1);
    setHasUnsavedChanges(true);
    showToast('Block duplicated', 'success');
  }, [blocks, selectedBlockIndex, pushHistory, showToast]);

  const addBlock = (blockType: string) => {
    const registry = BLOCK_TYPE_REGISTRY.find((r) => r.type === blockType);
    if (!registry) return;

    pushHistory(blocks, selectedBlockIndex);

    const newBlock: BlockData = {
      block_type: blockType,
      schema_version: 1,
      sort_order: blocks.length,
      data: { ...registry.defaultData },
      settings: {},
      is_visible: true,
    };

    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockIndex(blocks.length);
    setHasUnsavedChanges(true);
    showToast(`${registry.label} block added`, 'success');
  };

  const moveBlock = (from: number, to: number) => {
    if (from === to) return;
    pushHistory(blocks, selectedBlockIndex);
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
    if (selectedBlockIndex === from) {
      setSelectedBlockIndex(to);
    } else if (selectedBlockIndex !== null) {
      if (from < selectedBlockIndex && to >= selectedBlockIndex) {
        setSelectedBlockIndex(selectedBlockIndex - 1);
      } else if (from > selectedBlockIndex && to <= selectedBlockIndex) {
        setSelectedBlockIndex(selectedBlockIndex + 1);
      }
    }
    setHasUnsavedChanges(true);
  };

  // ─── Drag handlers ─────────────────────────

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Slight delay so the dragged element gets a ghost
    requestAnimationFrame(() => {
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = '0.4';
      }
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    if (dragIndex !== null && dropTargetIndex !== null) {
      let target = dropTargetIndex;
      if (dropPosition === 'after') target += 1;
      // Adjust target if moving down
      if (dragIndex < target) target -= 1;
      if (dragIndex !== target) moveBlock(dragIndex, target);
    }
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Determine if cursor is in top half or bottom half of the element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'before' : 'after';

    setDropTargetIndex(index);
    setDropPosition(pos);
  };

  const handleDragLeave = () => {
    // Only clear if we're actually leaving the block area
  };

  // ─── Reset (used after loading from API) ────

  const resetBlocks = useCallback((loadedBlocks: BlockData[]) => {
    setBlocks(loadedBlocks);
    setHasUnsavedChanges(false);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedBlockIndex(null);
  }, []);

  return {
    // Blocks
    blocks,
    setBlocks,
    selectedBlockIndex,
    setSelectedBlockIndex,
    hasUnsavedChanges,
    setHasUnsavedChanges,

    // Drag state
    dragIndex,
    dropTargetIndex,
    dropPosition,

    // Undo/Redo
    undoStack,
    redoStack,
    undo,
    redo,

    // Block operations
    updateBlock,
    deleteBlock,
    duplicateBlock,
    addBlock,
    moveBlock,

    // Drag handlers
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,

    // Reset
    resetBlocks,
  };
}
