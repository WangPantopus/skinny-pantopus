interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-2 border-b-2 font-medium transition ${
        active
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-app-secondary hover:text-app hover:border-app-strong'
      }`}
    >
      {label}
    </button>
  );
}
