interface TrustChipProps {
  title: string;
  value: string | number;
  detail: string;
}

export default function TrustChip({ title, value, detail }: TrustChipProps) {
  return (
    <div className="rounded-xl border border-app bg-surface-muted p-3">
      <p className="text-xs uppercase tracking-wide text-app-secondary font-medium">{title}</p>
      <p className="text-base md:text-lg font-semibold text-app mt-0.5">{value}</p>
      <p className="text-xs text-app-secondary mt-0.5">{detail}</p>
    </div>
  );
}
