'use client';

import { useState, useRef, useEffect } from 'react';
import { QuickCreateIcons } from '@/lib/icons';
import { Plus, type LucideIcon } from 'lucide-react';

interface QuickCreateFABProps {
  onAddTask: () => void;
  onAddIssue: () => void;
  onAddBill: () => void;
  onAddPackage: () => void;
  onInviteMember: () => void;
  onPostGig: () => void;
}

const ACTIONS: { key: string; icon: LucideIcon; label: string; handler: keyof QuickCreateFABProps }[] = [
  { key: 'task', icon: QuickCreateIcons.task, label: 'Add Task', handler: 'onAddTask' },
  { key: 'issue', icon: QuickCreateIcons.issue, label: 'Report Issue', handler: 'onAddIssue' },
  { key: 'bill', icon: QuickCreateIcons.bill, label: 'Track Bill', handler: 'onAddBill' },
  { key: 'package', icon: QuickCreateIcons.package, label: 'Track Package', handler: 'onAddPackage' },
  { key: 'member', icon: QuickCreateIcons.member, label: 'Invite Member', handler: 'onInviteMember' },
  { key: 'gig', icon: QuickCreateIcons.gig, label: 'Post Home Task', handler: 'onPostGig' },
];

export default function QuickCreateFAB(props: QuickCreateFABProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
      {/* Action menu */}
      {open && (
        <div className="absolute bottom-16 right-0 bg-app-surface rounded-xl border border-app-border shadow-lg py-2 min-w-[180px] animate-fade-in-up">
          {ACTIONS.map((action) => (
            <button
              key={action.key}
              onClick={() => {
                props[action.handler]();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-app-text-strong hover:bg-app-hover transition text-left"
            >
              <action.icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl transition-all ${
          open
            ? 'bg-gray-700 rotate-45'
            : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-xl'
        }`}
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
