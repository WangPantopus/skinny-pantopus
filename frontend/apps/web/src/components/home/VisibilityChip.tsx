'use client';

import { type ReactNode } from 'react';
import { Globe, Users, ShieldCheck, Lock } from 'lucide-react';

interface VisibilityChipProps {
  visibility: 'public' | 'members' | 'managers' | 'sensitive';
}

const CONFIG: Record<string, { bg: string; text: string; label: string; icon: ReactNode }> = {
  public: { bg: 'bg-green-100', text: 'text-green-700', label: 'Public', icon: <Globe className="w-3 h-3" /> },
  members: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Members', icon: <Users className="w-3 h-3" /> },
  managers: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Admins', icon: <ShieldCheck className="w-3 h-3" /> },
  sensitive: { bg: 'bg-red-100', text: 'text-red-700', label: 'Sensitive', icon: <Lock className="w-3 h-3" /> },
};

export default function VisibilityChip({ visibility }: VisibilityChipProps) {
  const config = CONFIG[visibility] || CONFIG.members;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
