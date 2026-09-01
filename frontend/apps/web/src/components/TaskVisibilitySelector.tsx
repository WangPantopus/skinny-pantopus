'use client';

import { useState, type ReactNode } from 'react';
import { Users, KeyRound, Lock, Globe } from 'lucide-react';

interface TaskVisibilitySelectorProps {
  value: string;
  onChange: (visibility: string) => void;
  viewerUserIds?: string[];
  onViewerUserIdsChange?: (ids: string[]) => void;
  /** Optional: household members for the "specific people" picker */
  householdMembers?: { id: string; name: string; username: string }[];
}

const VISIBILITY_OPTIONS: { value: string; label: string; description: string; icon: ReactNode }[] = [
  {
    value: 'members',
    label: 'All Members',
    description: 'Visible to everyone in the household',
    icon: <Users className="w-5 h-5" />,
  },
  {
    value: 'managers',
    label: 'Managers & Admins',
    description: 'Only managers, admins, and owners can see',
    icon: <KeyRound className="w-5 h-5" />,
  },
  {
    value: 'sensitive',
    label: 'Owners & Admins Only',
    description: 'Restricted to owners and admins',
    icon: <Lock className="w-5 h-5" />,
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can see this task (e.g. gig-eligible)',
    icon: <Globe className="w-5 h-5" />,
  },
];

export default function TaskVisibilitySelector({
  value,
  onChange,
  viewerUserIds = [],
  onViewerUserIdsChange,
  householdMembers = [],
}: TaskVisibilitySelectorProps) {
  const [showSpecificPeople, setShowSpecificPeople] = useState(viewerUserIds.length > 0);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-app-text-strong">Who can see this task?</label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {VISIBILITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-app-border hover:border-app-border bg-app-surface'
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">{opt.icon}</span>
            <div>
              <div className="text-sm font-medium text-app-text">{opt.label}</div>
              <div className="text-xs text-app-text-secondary">{opt.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Additional specific-people toggle */}
      {onViewerUserIdsChange && householdMembers.length > 0 && (
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-app-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showSpecificPeople}
              onChange={(e) => {
                setShowSpecificPeople(e.target.checked);
                if (!e.target.checked) onViewerUserIdsChange([]);
              }}
              className="rounded border-app-border text-blue-600 focus:ring-blue-500"
            />
            Also grant access to specific people
          </label>

          {showSpecificPeople && (
            <div className="mt-2 ml-6 space-y-1 max-h-40 overflow-y-auto">
              {householdMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 text-sm text-app-text-strong cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={viewerUserIds.includes(member.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onViewerUserIdsChange([...viewerUserIds, member.id]);
                      } else {
                        onViewerUserIdsChange(viewerUserIds.filter((id) => id !== member.id));
                      }
                    }}
                    className="rounded border-app-border text-blue-600 focus:ring-blue-500"
                  />
                  {member.name || member.username}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
