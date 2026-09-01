export default function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-app-border-subtle last:border-0">
      <span className="text-sm text-app-text-secondary">{label}</span>
      <span className="text-sm font-medium text-app-text capitalize">{value}</span>
    </div>
  );
}
