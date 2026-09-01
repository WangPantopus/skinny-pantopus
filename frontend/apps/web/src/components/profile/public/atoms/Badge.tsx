interface BadgeProps {
  icon: string;
  text: string;
  color: string;
}

const COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-emerald-100 text-emerald-700',
  purple: 'bg-purple-100 text-purple-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray: 'bg-surface-muted text-app',
};

export default function Badge({ icon, text, color }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${COLORS[color] || COLORS.gray}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </span>
  );
}
