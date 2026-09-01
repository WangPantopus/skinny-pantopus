'use client';

import { Shield, Clock, MoreVertical, Mail } from 'lucide-react';
import type { SeatListItem } from '@pantopus/types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  staff: 'Staff',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-violet-100 text-violet-700 border-violet-200',
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  editor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  staff: 'bg-amber-50 text-amber-700 border-amber-200',
  viewer: 'bg-gray-50 text-gray-600 border-gray-200',
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: 'Invite pending', className: 'text-amber-600' },
  expired: { label: 'Invite expired', className: 'text-red-500' },
  declined: { label: 'Declined', className: 'text-red-500' },
  accepted: { label: 'Active', className: 'text-green-600' },
};

interface SeatCardProps {
  seat: SeatListItem;
  canManage: boolean;
  onEdit: (seat: SeatListItem) => void;
  onRemove: (seat: SeatListItem) => void;
}

export default function SeatCard({ seat, canManage, onEdit, onRemove }: SeatCardProps) {
  const isBound = seat.invite_status === 'accepted';
  const statusInfo = STATUS_MAP[seat.invite_status] || STATUS_MAP.pending;
  const roleColor = ROLE_COLORS[seat.role_base] || ROLE_COLORS.viewer;

  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar / seat icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
          isBound
            ? 'bg-violet-100 text-violet-700'
            : 'bg-surface-muted text-app-secondary'
        }`}>
          {isBound
            ? (seat.display_name?.[0]?.toUpperCase() || 'S')
            : <Mail className="w-4 h-4" />
          }
        </div>

        {/* Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-app truncate">
              {seat.display_name || 'Unnamed seat'}
            </span>
            {seat.is_you && (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600 border border-violet-200">
                You
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {seat.title && (
              <span className="text-xs text-app-secondary truncate">{seat.title}</span>
            )}
            {!isBound && (
              <span className={`flex items-center gap-1 text-xs ${statusInfo.className}`}>
                <Clock className="w-3 h-3" />
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: role + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleColor}`}>
          {seat.role_base === 'owner' && <Shield className="w-3 h-3 mr-1" />}
          {ROLE_LABELS[seat.role_base] || seat.role_base}
        </span>

        {canManage && seat.role_base !== 'owner' && !seat.is_you && (
          <div className="relative group">
            <button className="p-1 rounded-md hover:bg-surface-raised transition text-app-secondary hover:text-app">
              <MoreVertical className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-app bg-surface shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => onEdit(seat)}
                className="w-full px-3 py-2 text-left text-sm text-app hover:bg-surface-raised rounded-t-lg transition"
              >
                Edit
              </button>
              <button
                onClick={() => onRemove(seat)}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-b-lg transition"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
