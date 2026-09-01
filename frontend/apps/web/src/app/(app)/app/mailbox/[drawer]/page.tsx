'use client';

/**
 * Drawer welcome/empty state — shown in the detail panel when no item is selected.
 * Desktop only (on mobile the list is full-screen).
 */
export default function DrawerWelcomePage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <svg className="w-16 h-16 text-gray-200 dark:text-app-text-strong mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <h2 className="text-lg font-semibold text-app-text-muted dark:text-app-text-secondary mb-1">
        Select a mail item
      </h2>
      <p className="text-sm text-app-text-muted dark:text-app-text-secondary max-w-xs">
        Choose an item from the list to view its contents, take actions, or file it to your vault.
      </p>
    </div>
  );
}
