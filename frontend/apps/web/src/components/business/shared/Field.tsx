import { useId } from 'react';

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

export default function Field({ label, value, onChange, placeholder, type = 'text' }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-app-strong mb-1">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
    </div>
  );
}
