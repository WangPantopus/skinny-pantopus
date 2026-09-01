// ============================================================
// Place detail — small private-input form atoms (money field, the
// "private to you" note, the sky CTA button). Shared by the Band-C
// resident inputs on Your Home (mortgage) and Money Signals (rent).
// ============================================================

'use client';

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';

export interface MoneyFieldProps {
  label: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function MoneyField({ label, prefix, suffix, value, onChange, placeholder }: MoneyFieldProps) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-app-text-strong mb-1.5">{label}</label>
      <div className="flex items-center gap-1.5 h-[46px] px-3 bg-app-surface border border-app-border-strong rounded-[10px] transition focus-within:border-primary-600 focus-within:ring-4 focus-within:ring-primary-600/10">
        {prefix ? <span className="text-base font-medium text-app-text-secondary">{prefix}</span> : null}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-base font-semibold text-app-text placeholder:font-normal placeholder:text-app-text-muted"
        />
        {suffix ? <span className="text-[15px] font-medium text-app-text-secondary">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 mt-3 text-[12px] leading-[17px] text-app-text-muted">
      <Lock size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SkyButton({ children, onClick, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; className?: string }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`w-full h-12 rounded-xl bg-primary-600 text-white text-[15px] font-semibold shadow-[0_6px_16px_rgba(2,132,199,0.18)] hover:bg-primary-700 transition ${className}`}
    >
      {children}
    </button>
  );
}

/** Parse a money-ish string into a number (strips $ , spaces). */
export function parseMoney(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Re-group digits with thousands separators as the user types. */
export function groupDigits(v: string): string {
  const digits = v.replace(/[^0-9]/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
}
