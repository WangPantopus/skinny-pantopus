'use client';

/**
 * MailboxLayout — three-pane responsive shell.
 *
 * Desktop  (≥1024px): nav 220px  │ list 360px │ detail flex
 * Tablet   (768–1023): nav 52px  │ list 360px │ detail flex
 * Mobile   (<768px):   nav hidden│ list OR detail (single column)
 */

type MailboxLayoutProps = {
  leftNav?: React.ReactNode;
  listPanel: React.ReactNode;
  detailPanel?: React.ReactNode;
  showDetailOnMobile?: boolean;
};

export default function MailboxLayout({
  leftNav,
  listPanel,
  detailPanel,
  showDetailOnMobile = false,
}: MailboxLayoutProps) {
  const hasDetail = detailPanel != null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-app-surface">
      {/* ── Left Nav ─────────────────────────────────────────── */}
      {/* Desktop: 220px. Tablet: 52px icons-only. Mobile: hidden */}
      {leftNav && (
        <aside className="hidden md:flex flex-col flex-shrink-0 w-[52px] lg:w-[220px] border-r border-app-border bg-app-surface-raised overflow-y-auto">
          {leftNav}
        </aside>
      )}

      {/* ── List Panel ───────────────────────────────────────── */}
      {/* Desktop/tablet: 360px fixed. Mobile: full width (hidden when detail shown) */}
      <div
        className={`flex-shrink-0 overflow-y-auto border-r border-app-border bg-app-surface ${
          hasDetail
            ? `w-full md:w-[360px] ${showDetailOnMobile ? 'hidden md:block' : ''}`
            : 'w-full md:flex-1'
        }`}
      >
        {listPanel}
      </div>

      {/* ── Detail Panel ─────────────────────────────────────── */}
      {/* Desktop/tablet: flex remaining. Mobile: full width (shown only when selected) */}
      {hasDetail && (
        <main
          className={`flex-1 min-w-0 overflow-y-auto bg-app-surface ${
            showDetailOnMobile ? '' : 'hidden md:block'
          }`}
        >
          {detailPanel}
        </main>
      )}
    </div>
  );
}
