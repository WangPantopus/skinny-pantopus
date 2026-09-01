'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogFocusTrap<T extends HTMLElement>(onClose: () => void, returnFocusTo?: HTMLElement | null) {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(returnFocusTo || null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = returnFocusRef.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const container = containerRef.current;
    const getFocusable = () => (
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || [])
    );

    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (!container?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return containerRef;
}
