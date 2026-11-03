'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

export interface ProfileMenuItem {
  key: string;
  label: string;
  /** A second, smaller line under the label. */
  detail?: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ProfileMenuProps {
  /** The trigger's accessible name when its content is only an icon. */
  ariaLabel?: string;
  /** What screen readers call the open menu. */
  menuLabel: string;
  trigger: ReactNode;
  triggerClassName: string;
  items: ProfileMenuItem[];
  align?: 'left' | 'right';
  disabled?: boolean;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

/**
 * A small menu under a button (the profile's ⋯, Connected ▾ and Preview as ▾): it opens on the first item, moves with
 * the arrow keys, and closes on Escape, Tab, a choice or a click elsewhere, giving focus back to its button.
 */
export default function ProfileMenu({
  ariaLabel,
  menuLabel,
  trigger,
  triggerClassName,
  items,
  align = 'right',
  disabled = false,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    rootRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const choices = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (choices.length === 0) return;
    const index = choices.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (event.key === 'ArrowDown') next = choices[(index + 1) % choices.length];
    else if (event.key === 'ArrowUp') next = choices[(index - 1 + choices.length) % choices.length];
    else if (event.key === 'Home') next = choices[0];
    else if (event.key === 'End') next = choices[choices.length - 1];
    else if (event.key === 'Tab') setOpen(false);
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          onKeyDown={moveFocus}
          className={`absolute z-30 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} w-max min-w-[13rem] max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-app bg-surface py-1 shadow-xl`}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                item.onSelect();
              }}
              className={`w-full min-h-[44px] px-4 py-2 flex items-center gap-3 text-left text-[0.9375rem] leading-5 hover-bg-app focus:outline-none focus-visible:bg-[rgb(var(--app-hover))] disabled:opacity-50 ${
                item.destructive ? 'text-red-700' : 'text-app'
              }`}
            >
              {item.icon ? <span aria-hidden="true" className="shrink-0 text-app-muted">{item.icon}</span> : null}
              <span className="min-w-0">
                <span className="block font-medium">{item.label}</span>
                {item.detail ? <span className="block text-[0.8125rem] leading-[1.125rem] text-app-muted">{item.detail}</span> : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
