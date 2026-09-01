interface MetricTileProps {
  label: string;
  value: string | number;
}

export default function MetricTile({ label, value }: MetricTileProps) {
  return (
    <div className="bg-surface rounded-xl border border-app p-4">
      <div className="text-xs text-app-secondary">{label}</div>
      <div className="text-2xl font-bold text-app mt-1">{value}</div>
    </div>
  );
}
