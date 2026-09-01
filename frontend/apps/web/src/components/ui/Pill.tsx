'use client';

import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  color?: string;
}

export default function Pill({ label, icon, active = false, color, className = '', ...rest }: PillProps) {
  return (
    <button
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
        active
          ? 'text-white shadow-sm'
          : 'bg-surface-muted text-app-muted border border-app hover-bg-app'
      } ${className}`}
      style={active && color ? { background: color } : undefined}
      {...rest}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
}
