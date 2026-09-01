'use client';

interface SectionHeaderProps {
  id?: string;
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  onSeeAll?: () => void;
}

export default function SectionHeader({
  id,
  title,
  subtitle,
  seeAllHref,
  onSeeAll,
}: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between mb-2 mt-6 first:mt-0">
      <div>
        <h2 id={id} className="text-base font-bold text-app-text">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-app-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {(seeAllHref || onSeeAll) && (
        <button
          onClick={onSeeAll}
          aria-label={`See all ${title}`}
          className="text-xs font-medium text-primary-600 transition hover:text-primary-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
        >
          See all
        </button>
      )}
    </div>
  );
}
