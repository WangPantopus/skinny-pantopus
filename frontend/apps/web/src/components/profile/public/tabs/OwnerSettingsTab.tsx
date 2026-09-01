interface OwnerSettingsTabProps {
  onOpenSettings: () => void;
}

export default function OwnerSettingsTab({ onOpenSettings }: OwnerSettingsTabProps) {
  return (
    <div className="bg-surface rounded-xl border border-app p-5">
      <h3 className="text-lg font-semibold text-app">Privacy & Account</h3>
      <p className="text-sm text-app-secondary mt-2">Private sections are only visible to you. Public visitors see city/state only and no exact address details.</p>
      <button onClick={onOpenSettings} className="mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium">
        Open profile settings
      </button>
    </div>
  );
}
