interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  link?: boolean;
}

export default function InfoRow({ icon, label, value, link }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xs text-app-secondary">{label}</p>
        {link ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
            {value}
          </a>
        ) : (
          <p className="text-app">{value}</p>
        )}
      </div>
    </div>
  );
}
