'use client';

import { useEffect, useRef } from 'react';
import { Reply, Copy, Trash2, Flag, Smile } from 'lucide-react';

const QUICK_REACTIONS = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25'];

export interface MessageAction {
  key: string;
  label: string;
  icon: typeof Reply;
  destructive?: boolean;
}

const DEFAULT_ACTIONS: MessageAction[] = [
  { key: 'reply', label: 'Reply', icon: Reply },
  { key: 'copy', label: 'Copy text', icon: Copy },
  { key: 'delete', label: 'Delete', icon: Trash2, destructive: true },
  { key: 'report', label: 'Report', icon: Flag, destructive: true },
];

interface MessageActionMenuProps {
  open: boolean;
  onClose: () => void;
  onAction: (key: string) => void;
  onReact: (emoji: string) => void;
  actions?: MessageAction[];
  /** Position the menu near the message */
  anchorPosition?: { top: number; left: number };
}

export default function MessageActionMenu({
  open,
  onClose,
  onAction,
  onReact,
  actions = DEFAULT_ACTIONS,
  anchorPosition,
}: MessageActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    // Delay to avoid the triggering click
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [open, onClose]);

  if (!open) return null;

  const style = anchorPosition
    ? { position: 'fixed' as const, top: anchorPosition.top, left: anchorPosition.left, zIndex: 9999 }
    : { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 };

  return (
    <>
      {/* Backdrop for mobile */}
      <div className="fixed inset-0 z-[9998] bg-black/20 sm:bg-transparent" onClick={onClose} />

      <div ref={menuRef} style={style} className="bg-app-surface rounded-xl shadow-2xl border border-app-border overflow-hidden min-w-[200px]">
        {/* Quick reactions */}
        <div className="flex items-center justify-center gap-1 px-3 py-2.5">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => { onReact(emoji); onClose(); }}
              className="w-9 h-9 rounded-full bg-app-surface-sunken hover:bg-app-hover flex items-center justify-center text-lg transition">
              {emoji}
            </button>
          ))}
          <button type="button" onClick={() => { onAction('emoji_picker'); onClose(); }}
            className="w-9 h-9 rounded-full bg-app-surface-sunken hover:bg-app-hover flex items-center justify-center transition">
            <Smile className="w-4 h-4 text-app-text-secondary" />
          </button>
        </div>

        <div className="h-px bg-app-border" />

        {/* Action list */}
        <div className="py-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.key} type="button"
                onClick={() => { onAction(action.key); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-app-hover transition ${
                  action.destructive ? 'text-red-600' : 'text-app-text-strong'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
