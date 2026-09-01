// ============================================================
// ValidatedField — 44px input with green-check on valid,
// 1.5px red border + inline error message, required marker.
// Supports text / email / number / textarea / password.
// ============================================================

'use client';

import { forwardRef, useId } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

type BaseProps = {
  label: string;
  required?: boolean;
  helper?: ReactNode;
  error?: string | null;
  valid?: boolean;
  trailing?: ReactNode;
  containerClassName?: string;
};

type InputOnlyProps = React.InputHTMLAttributes<HTMLInputElement> & BaseProps & {
  multiline?: false;
};
type TextareaOnlyProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> &
  BaseProps & {
    multiline: true;
    rows?: number;
  };

export type ValidatedFieldProps = InputOnlyProps | TextareaOnlyProps;

function fieldClasses(error?: string | null, valid?: boolean) {
  return [
    'w-full rounded-md bg-app-surface px-3 text-sm text-app-text',
    'placeholder:text-app-text-muted outline-none transition',
    'focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
    error
      ? 'border-[1.5px] border-app-error'
      : valid
      ? 'border border-app-success'
      : 'border border-app-border',
  ].join(' ');
}

const ValidatedField = forwardRef<HTMLInputElement | HTMLTextAreaElement, ValidatedFieldProps>(
  function ValidatedField(props, ref) {
    const {
      label,
      required,
      helper,
      error,
      valid,
      trailing,
      containerClassName = '',
    } = props;
    const autoId = useId();
    const fieldId = (props as { id?: string }).id ?? autoId;

    const cls = fieldClasses(error, valid);

    const trailingNode = trailing ?? (valid && !error ? (
      <CheckCircle2 size={18} className="text-app-success" />
    ) : null);

    return (
      <div className={`mb-3 ${containerClassName}`}>
        <label htmlFor={fieldId} className="block text-[13px] font-semibold text-app-text-strong mb-1.5">
          {label}
          {required ? <span className="text-app-error ml-0.5">*</span> : null}
        </label>
        <div className="relative">
          {props.multiline ? (
            <textarea
              {...(props as TextareaOnlyProps)}
              id={fieldId}
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={(props as TextareaOnlyProps).rows ?? 4}
              className={`${cls} py-2.5 ${trailingNode ? 'pr-9' : ''} resize-y min-h-[88px]`}
            />
          ) : (
            <input
              {...(props as InputOnlyProps)}
              id={fieldId}
              ref={ref as React.Ref<HTMLInputElement>}
              className={`${cls} h-11 ${trailingNode ? 'pr-9' : ''}`}
            />
          )}
          {trailingNode ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {trailingNode}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="mt-1.5 text-xs font-medium text-app-error">{error}</p>
        ) : helper ? (
          <p className="mt-1.5 text-xs text-app-text-secondary">{helper}</p>
        ) : null}
      </div>
    );
  },
);

export default ValidatedField;
