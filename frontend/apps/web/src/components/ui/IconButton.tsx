'use client';

import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // accessibility
  badge?: number;
}

export default function IconButton({ icon, label, badge, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`relative p-2 rounded-lg text-app-muted hover:text-app hover-bg-app transition ${className}`}
      {...rest}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
