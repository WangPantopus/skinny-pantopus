'use client';

import React, { useRef } from 'react';
import { FileText } from 'lucide-react';
import { BlockPreview } from '@/components/business/BlockPreview';
import { PublicBlock } from '@/components/business/PublicBlockRenderer';
import BlockEditor from '@/components/business/BlockEditor';
import type { BlockData } from './types';

interface BlockCanvasProps {
  blocks: BlockData[];
  selectedBlockIndex: number | null;
  showPreview: boolean;
  dragIndex: number | null;
  dropTargetIndex: number | null;
  dropPosition: 'before' | 'after';
  onSelectBlock: (index: number | null) => void;
  onUpdateBlock: (index: number, updated: BlockData) => void;
  onDeleteBlock: (index: number) => void;
  onDuplicateBlock: (index: number) => void;
  onMoveBlock: (from: number, to: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onExitPreview: () => void;
}

// Preview mode context (dummy — blocks render as-is with no live business data)
const previewCtx = { locations: [], hours: [], catalog: [], business: {}, profile: {} };

export default function BlockCanvas({
  blocks,
  selectedBlockIndex,
  showPreview,
  dragIndex,
  dropTargetIndex,
  dropPosition,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onExitPreview,
}: BlockCanvasProps) {
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const selectedBlock = selectedBlockIndex !== null ? blocks[selectedBlockIndex] : null;

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <main
        className="flex-1 overflow-y-auto"
        onClick={(e) => {
          // Click on empty canvas area -> deselect
          if (e.target === e.currentTarget && !showPreview) onSelectBlock(null);
        }}
      >
        <div className={`mx-auto py-6 px-4 ${showPreview ? 'max-w-3xl' : 'max-w-xl'}`}>
          {/* Preview mode header */}
          {showPreview && (
            <div className="mb-4 px-4 py-2 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700 flex items-center justify-between">
              <span>Preview mode — this is how visitors will see your page</span>
              <button onClick={onExitPreview} className="font-semibold hover:underline">Exit preview</button>
            </div>
          )}

          {blocks.length === 0 ? (
            <div className="text-center py-20">
              <div className="mb-3 flex justify-center"><FileText className="w-8 h-8 text-app-text-muted" /></div>
              <div className="text-sm font-medium text-app-text-secondary">No blocks yet</div>
              <div className="text-xs text-app-text-muted mt-1 max-w-xs mx-auto">
                {showPreview
                  ? 'This page has no content yet.'
                  : 'Click a block type from the left panel to add your first block.'}
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {blocks.map((block, index) => {
                const isSelected = selectedBlockIndex === index;
                const isDragging = dragIndex === index;
                const showDropBefore = dropTargetIndex === index && dropPosition === 'before' && dragIndex !== null && dragIndex !== index;
                const showDropAfter = dropTargetIndex === index && dropPosition === 'after' && dragIndex !== null && dragIndex !== index;

                return (
                  <div key={block.id || `new-${index}`} className="relative">
                    {/* Drop indicator — before */}
                    <div className={`h-1 mx-4 rounded-full transition-all duration-150 ${
                      showDropBefore ? 'bg-violet-500 my-1' : 'bg-transparent my-0'
                    }`} />

                    <div
                      ref={(el) => { blockRefs.current[index] = el; }}
                      draggable={!showPreview}
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDragLeave={onDragLeave}
                      onClick={() => { if (!showPreview) onSelectBlock(index); }}
                      className={`group relative rounded-xl transition-all duration-150 ${
                        showPreview
                          ? 'bg-app-surface shadow-sm'
                          : `cursor-pointer ${
                              isDragging
                                ? 'opacity-40 scale-[0.98]'
                                : isSelected
                                ? 'ring-2 ring-violet-500 ring-offset-2 shadow-md bg-app-surface'
                                : 'bg-app-surface hover:ring-2 hover:ring-gray-200 hover:ring-offset-1 shadow-sm'
                            }`
                      } ${block.is_visible === false ? 'opacity-40' : ''}`}
                    >
                      {/* Block toolbar (edit mode, on hover or selected) */}
                      {!showPreview && (
                        <div
                          className={`absolute -top-3 right-2 z-10 flex items-center gap-1 transition-opacity ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {/* Block type label */}
                          <span className="px-1.5 py-0.5 bg-gray-800 rounded text-[9px] font-medium text-white capitalize">
                            {block.block_type.replace('_', ' ')}
                          </span>

                          {/* Move up */}
                          <button
                            onClick={(e) => { e.stopPropagation(); if (index > 0) onMoveBlock(index, index - 1); }}
                            disabled={index === 0}
                            className="w-5 h-5 rounded bg-app-surface border border-app-border shadow-sm flex items-center justify-center text-app-text-muted hover:text-app-text-strong disabled:opacity-30 text-[10px]"
                            title="Move up"
                          >
                            ↑
                          </button>

                          {/* Move down */}
                          <button
                            onClick={(e) => { e.stopPropagation(); if (index < blocks.length - 1) onMoveBlock(index, index + 1); }}
                            disabled={index === blocks.length - 1}
                            className="w-5 h-5 rounded bg-app-surface border border-app-border shadow-sm flex items-center justify-center text-app-text-muted hover:text-app-text-strong disabled:opacity-30 text-[10px]"
                            title="Move down"
                          >
                            ↓
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={(e) => { e.stopPropagation(); onDuplicateBlock(index); }}
                            className="w-5 h-5 rounded bg-app-surface border border-app-border shadow-sm flex items-center justify-center text-app-text-muted hover:text-app-text-strong text-[10px]"
                            title="Duplicate (Ctrl+D)"
                          >
                            ⧉
                          </button>

                          {/* Delete */}
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteBlock(index); }}
                            className="w-5 h-5 rounded bg-app-surface border border-red-200 shadow-sm flex items-center justify-center text-red-400 hover:text-red-600 text-[10px]"
                            title="Delete (Del)"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Drag handle (left edge) */}
                      {!showPreview && (
                        <div className={`absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-l-xl transition-opacity ${
                          isSelected ? 'opacity-100 bg-violet-50' : 'opacity-0 group-hover:opacity-100 hover:bg-app-hover'
                        }`}>
                          <svg className="w-3.5 h-3.5 text-app-text-muted" viewBox="0 0 10 16" fill="currentColor">
                            <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
                            <circle cx="3" cy="6" r="1.2" /><circle cx="7" cy="6" r="1.2" />
                            <circle cx="3" cy="10" r="1.2" /><circle cx="7" cy="10" r="1.2" />
                            <circle cx="3" cy="14" r="1.2" /><circle cx="7" cy="14" r="1.2" />
                          </svg>
                        </div>
                      )}

                      {/* Hidden / scheduled indicators */}
                      {!showPreview && block.is_visible === false && (
                        <div className="absolute top-1 left-8 text-[9px] text-app-text-muted font-medium flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                          </svg>
                          Hidden
                        </div>
                      )}
                      {!showPreview && (block.show_from || block.show_until) && (
                        <div className="absolute top-1 left-8 text-[9px] text-amber-500 font-medium flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scheduled
                        </div>
                      )}

                      {/* Block content */}
                      <div className={showPreview ? '' : 'pl-6'}>
                        {showPreview ? (
                          <PublicBlock block={block} ctx={previewCtx} />
                        ) : (
                          <BlockPreview block={block} />
                        )}
                      </div>
                    </div>

                    {/* Drop indicator — after (only show on last block) */}
                    {index === blocks.length - 1 && (
                      <div className={`h-1 mx-4 rounded-full transition-all duration-150 ${
                        showDropAfter ? 'bg-violet-500 my-1' : 'bg-transparent my-0'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add block area at bottom (edit mode) */}
          {!showPreview && (
            <div className="mt-4">
              <button
                onClick={() => {
                  // Scroll palette into view or show inline hint
                  const sidebar = document.querySelector('aside');
                  if (sidebar) sidebar.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3 rounded-xl border-2 border-dashed border-app-border text-sm font-medium text-app-text-muted hover:border-violet-300 hover:text-violet-500 transition"
              >
                + Add block from left panel
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Right: Block editor panel */}
      {!showPreview && selectedBlock && selectedBlockIndex !== null && (
        <aside className="w-72 bg-app-surface border-l border-app-border flex-shrink-0 overflow-hidden">
          <BlockEditor
            key={`${selectedBlockIndex}-${selectedBlock.block_type}`}
            block={selectedBlock}
            onUpdate={(updated) => onUpdateBlock(selectedBlockIndex, updated)}
            onDelete={() => onDeleteBlock(selectedBlockIndex)}
            onClose={() => onSelectBlock(null)}
          />
        </aside>
      )}
    </div>
  );
}
