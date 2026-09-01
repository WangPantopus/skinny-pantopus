'use client';

import { useEffect, useRef, useState } from 'react';

type AttachAction = 'photos' | 'documents' | 'gig' | 'listing';

interface ChatAttachmentMenuProps {
  onAction: (action: AttachAction) => void;
  disabled?: boolean;
}

export default function ChatAttachmentMenu({ onAction, disabled = false }: ChatAttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  const handleAction = (action: AttachAction) => {
    setOpen(false);
    onAction(action);
  };

  const items: { action: AttachAction; icon: string; label: string; color: string }[] = [
    { action: 'photos', icon: '📷', label: 'Photos & Videos', color: 'bg-green-50 text-green-700' },
    { action: 'documents', icon: '📄', label: 'Documents', color: 'bg-blue-50 text-blue-700' },
    { action: 'gig', icon: '💼', label: 'Share a Task', color: 'bg-purple-50 text-purple-700' },
    { action: 'listing', icon: '🏷️', label: 'Share a Listing', color: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Attach"
      >
        <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface rounded-xl shadow-xl border border-app overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {items.map(item => (
            <button
              key={item.action}
              onClick={() => handleAction(item.action)}
              className="w-full flex items-center gap-3 px-4 py-3 hover-bg-app transition-colors text-left"
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${item.color}`}>
                {item.icon}
              </span>
              <span className="text-sm font-medium text-app-text-strong">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
