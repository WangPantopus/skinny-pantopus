'use client';

import type { Toast } from './types';

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all animate-in slide-in-from-right ${
            t.type === 'success'
              ? 'bg-green-600 text-white'
              : t.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-white'
          }`}
        >
          {t.type === 'success' && '✓'}
          {t.type === 'error' && '✕'}
          {t.type === 'info' && 'ℹ'}
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-1 opacity-70 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  );
}
