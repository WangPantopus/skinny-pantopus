'use client';

type DrawerBadgeProps = {
  drawer: 'personal' | 'home' | 'business' | 'earn';
  size?: 'sm' | 'md';
};

const config: Record<string, { bg: string; label: string }> = {
  personal: { bg: 'bg-sky-100 text-sky-800', label: 'Personal' },
  home: { bg: 'bg-emerald-100 text-emerald-800', label: 'Home' },
  business: { bg: 'bg-indigo-100 text-indigo-800', label: 'Business' },
  earn: { bg: 'bg-amber-100 text-amber-800', label: 'Earn' },
};

export default function DrawerBadge({ drawer, size = 'md' }: DrawerBadgeProps) {
  const c = config[drawer] ?? config.personal;

  if (size === 'sm') {
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${c.bg}`}>
        {c.label}
      </span>
    );
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${c.bg}`}>
      {c.label}
    </span>
  );
}
