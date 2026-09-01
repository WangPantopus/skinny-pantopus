'use client';

import { useState } from 'react';

interface AccountDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function AccountDeleteModal({ open, onClose, onConfirm }: AccountDeleteModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const isConfirmed = confirmText === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (deleting) return;
    setConfirmText('');
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]" onClick={handleClose} />

      <div className="fixed inset-0 z-[81] flex items-center justify-center p-4">
        <div
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-8 pb-6 text-center">
            {/* Warning icon */}
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-app mb-2">Delete your account?</h2>

            <p className="text-sm text-app-secondary mb-4">
              This will permanently delete your account, including:
            </p>

            <ul className="text-sm text-app-secondary text-left space-y-1.5 mb-5 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Your profile and all personal data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Your task history and reviews</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Your home memberships</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Your business profiles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Your messages and connections</span>
              </li>
            </ul>

            <p className="text-sm font-semibold text-red-600 mb-6">
              This action cannot be undone.
            </p>

            {/* Typed confirmation */}
            <div className="text-left mb-6">
              <label className="block text-sm font-medium text-app-strong mb-1.5">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={deleting}
                className="w-full px-4 py-2.5 border border-app rounded-lg text-sm text-app bg-surface focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 font-mono"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-app rounded-lg text-sm font-medium text-app-strong hover:bg-surface-raised transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isConfirmed || deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete My Account'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
