import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

type PantopusBadgeProps = {
  href?: string;
  tagline?: string;
  align?: 'center' | 'left';
  showTagline?: boolean;
  className?: string;
};

export default function PantopusBadge({
  href = '/',
  tagline = 'Your real-world network',
  align = 'center',
  showTagline = true,
  className = '',
}: PantopusBadgeProps) {
  const alignClasses = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <Link
      href={href}
      className={`inline-flex flex-col ${alignClasses} gap-1 select-none ${className}`}
      aria-label="Go to Pantopus home"
    >
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6 text-primary-600 dark:text-primary-400" />

        <span className="text-3xl font-bold tracking-tight text-primary-700 dark:text-primary-400">
          Pantopus
        </span>

        {/* tiny brand accent */}
        <span className="ml-1 hidden sm:inline-block h-2 w-2 rounded-full bg-primary-300/70 dark:bg-primary-500/40" />
      </div>

      {showTagline && (
        <span className="text-xs font-medium text-app-text-secondary dark:text-app-text-muted">
          {tagline}
        </span>
      )}
    </Link>
  );
}
