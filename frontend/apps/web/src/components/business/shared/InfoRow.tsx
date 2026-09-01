interface InfoRowProps {
  label: string;
  value?: string | null;
}

export default function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div>
      <div className="text-xs font-medium text-app-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm text-app mt-0.5">{value || <span className="text-app-muted">—</span>}</div>
    </div>
  );
}
