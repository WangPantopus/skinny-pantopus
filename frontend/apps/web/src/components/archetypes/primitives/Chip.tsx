// ============================================================
// Chip — pill (9999 radius) for intent / status / identity.
// Variants + optional lucide-react leading icon.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChipVariant =
  | 'neutral'
  | 'primary'
  | 'personal'
  | 'home'
  | 'business'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const VARIANT: Record<ChipVariant, string> = {
  neutral: 'bg-app-surface-sunken text-app-text-strong',
  primary: 'bg-primary-100 text-primary-700',
  personal: 'bg-app-personal-bg text-app-personal',
  home: 'bg-app-home-bg text-app-home',
  business: 'bg-app-business-bg text-app-business',
  success: 'bg-app-success-light text-app-success',
  warning: 'bg-app-warning-light text-app-warning',
  error: 'bg-app-error-light text-app-error',
  info: 'bg-app-info-light text-app-info',
};

export interface ChipProps {
  label: ReactNode;
  variant?: ChipVariant;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export default function Chip({
  label,
  variant = 'neutral',
  icon: Icon,
  size = 'sm',
  className = '',
  style,
}: ChipProps) {
  const sizeCls =
    size === 'md'
      ? 'text-[12px] px-2.5 py-1 gap-1.5'
      : 'text-[11px] px-2 py-0.5 gap-1';
  const iconSize = size === 'md' ? 13 : 11;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${VARIANT[variant]} ${sizeCls} ${className}`}
      style={style}
    >
      {Icon ? <Icon size={iconSize} className="shrink-0" /> : null}
      {label}
    </span>
  );
}
