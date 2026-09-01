'use client';

interface MarketplaceSectionHeaderProps {
  id?: string;
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

export default function MarketplaceSectionHeader({
  id,
  title,
  subtitle,
  onSeeAll,
}: MarketplaceSectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between mb-3 mt-8 first:mt-0">
      <div>
        <h2 id={id} className="text-lg font-bold text-app-text">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-app-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          aria-label={`See all ${title}`}
          className="text-xs font-medium text-primary-600 transition hover:text-primary-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          See all →
        </button>
      )}
    </div>
  );
}
