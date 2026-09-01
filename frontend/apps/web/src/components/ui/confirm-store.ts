// ============================================================
// CONFIRM STORE — promise-based pub/sub singleton
// Allows `await confirm({ title: '...' })` from anywhere.
// ============================================================

export type ConfirmVariant = 'primary' | 'destructive';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export interface ConfirmState {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

type Listener = (state: ConfirmState | null) => void;

let current: ConfirmState | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn(current));
}

function open(options: ConfirmOptions): Promise<boolean> {
  // If a dialog is already open, reject the previous one
  if (current) {
    current.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    current = { options, resolve };
    emit();
  });
}

function close(result: boolean) {
  if (current) {
    current.resolve(result);
    current = null;
    emit();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ConfirmState | null {
  return current;
}

export const confirmStore = { open, close, subscribe, getSnapshot };
