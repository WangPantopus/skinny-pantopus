// ============================================================
// StatusChipRow — list row: tinted icon tile + title/subtitle +
// right-aligned amount + status chip. "Bill row" template.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Receipt } from 'lucide-react';
import Chip, { type ChipVariant } from './Chip';

export interface StatusChipRowProps {
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  amount?: ReactNode;
  statusLabel?: string;
  statusVariant?: ChipVariant;
  statusIcon?: LucideIcon;
  onClick?: () => void;
  /** Optional custom trailing node in place of amount/chip. */
  trailing?: ReactNode;
  /** Extra content rendered below the row (actions, counter-offer, etc.). */
  below?: ReactNode;
  className?: string;
}

export default function StatusChipRow({
  icon: Icon = Receipt,
  iconBg,
  iconColor,
  title,
  subtitle,
  amount,
  statusLabel,
  statusVariant = 'neutral',
  statusIcon,
  onClick,
  trailing,
  below,
  className = '',
}: StatusChipRowProps) {
  const body = (
    <div className="flex items-center gap-3 p-4">
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
        style={{
          background: iconBg,
        }}
      >
        <Icon size={20} style={iconColor ? { color: iconColor } : undefined} className={iconColor ? '' : 'text-primary-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-app-text truncate">{title}</div>
        {subtitle ? (
          <div className="text-xs text-app-text-secondary mt-0.5 truncate">{subtitle}</div>
        ) : null}
      </div>
      {trailing ?? (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {amount ? (
            <span className="text-[15px] font-bold text-app-text -tracking-[0.01em]">{amount}</span>
          ) : null}
          {statusLabel ? (
            <Chip label={statusLabel} variant={statusVariant} icon={statusIcon} />
          ) : null}
        </div>
      )}
    </div>
  );

  const defaultIconBgCls = iconBg ? '' : 'bg-primary-50';

  const wrapperCls = `bg-app-surface border border-app-border rounded-2xl shadow-sm ${onClick ? 'hover:shadow-md hover:-translate-y-px transition' : ''}`;

  return (
    <div className={`${wrapperCls} ${defaultIconBgCls ? '' : ''} ${className}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full text-left block"
        >
          <div className="flex items-center gap-3 p-4">
            <div
              className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${defaultIconBgCls}`}
              style={iconBg ? { background: iconBg } : undefined}
            >
              <Icon
                size={20}
                style={iconColor ? { color: iconColor } : undefined}
                className={iconColor ? '' : 'text-primary-600'}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-app-text truncate">{title}</div>
              {subtitle ? (
                <div className="text-xs text-app-text-secondary mt-0.5 truncate">{subtitle}</div>
              ) : null}
            </div>
            {trailing ?? (
              <div className="flex flex-col items-end gap-1 shrink-0">
                {amount ? (
                  <span className="text-[15px] font-bold text-app-text -tracking-[0.01em]">{amount}</span>
                ) : null}
                {statusLabel ? (
                  <Chip label={statusLabel} variant={statusVariant} icon={statusIcon} />
                ) : null}
              </div>
            )}
          </div>
        </button>
      ) : (
        body
      )}
      {below ? <div className="px-4 pb-4">{below}</div> : null}
    </div>
  );
}
