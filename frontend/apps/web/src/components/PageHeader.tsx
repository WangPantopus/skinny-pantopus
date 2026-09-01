'use client';

/**
 * PageHeader — unified header for every authenticated page.
 *
 * Pattern:
 *   Row 1:  Title (left) + primary CTA button (right)
 *           Optional subtitle beneath the title
 *   Row 2:  Optional filter / search bar beneath (passed as children)
 */
export default function PageHeader({
  title,
  subtitle,
  ctaLabel,
  ctaOnClick,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  ctaLabel?: string;
  ctaOnClick?: () => void;
  /** Filters / search bar rendered beneath the header row */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {/* Row 1: Title + CTA */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-app truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-app-muted mt-0.5">{subtitle}</p>
          )}
        </div>
        {ctaLabel && ctaOnClick && (
          <button
            onClick={ctaOnClick}
            className="flex-shrink-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold text-sm transition shadow-sm"
          >
            {ctaLabel}
          </button>
        )}
      </div>

      {/* Row 2: Filters / search (optional) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
