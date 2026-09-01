'use client';

import { BLOCK_TYPE_REGISTRY } from '@/components/business/BlockPreview';

interface BlockPaletteProps {
  onAddBlock: (blockType: string) => void;
}

export default function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  return (
    <aside className="w-56 bg-app-surface border-r border-app-border flex flex-col flex-shrink-0 overflow-hidden">
      <div className="px-3 py-2 border-b border-app-border-subtle">
        <div className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider">Add Blocks</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {BLOCK_TYPE_REGISTRY.map((reg) => (
          <button
            key={reg.type}
            onClick={() => onAddBlock(reg.type)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-violet-50 active:bg-violet-100 transition group"
          >
            <span className="text-base flex-shrink-0 w-7 text-center">{reg.icon}</span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-app-text group-hover:text-violet-700">{reg.label}</div>
              <div className="text-[10px] text-app-text-muted truncate leading-tight">{reg.description}</div>
            </div>
          </button>
        ))}
      </div>
      {/* Keyboard shortcuts hint */}
      <div className="px-3 py-2 border-t border-app-border-subtle text-[10px] text-app-text-muted space-y-0.5">
        <div><kbd className="px-1 py-0.5 bg-app-surface-sunken rounded text-[9px]">⌘S</kbd> Save</div>
        <div><kbd className="px-1 py-0.5 bg-app-surface-sunken rounded text-[9px]">⌘Z</kbd> Undo <kbd className="px-1 py-0.5 bg-app-surface-sunken rounded text-[9px]">⌘⇧Z</kbd> Redo</div>
        <div><kbd className="px-1 py-0.5 bg-app-surface-sunken rounded text-[9px]">⌘D</kbd> Duplicate <kbd className="px-1 py-0.5 bg-app-surface-sunken rounded text-[9px]">Del</kbd> Delete</div>
      </div>
    </aside>
  );
}
