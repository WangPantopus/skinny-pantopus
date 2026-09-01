interface InfoLineProps {
  label: string;
  value: string;
}

export default function InfoLine({ label, value }: InfoLineProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-app pb-2 last:border-0 last:pb-0">
      <span className="text-app-secondary">{label}</span>
      <span className="text-app font-medium text-right">{value}</span>
    </div>
  );
}
