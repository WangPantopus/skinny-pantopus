'use client';

interface SafetyAlertFieldsProps {
  safetyKind: string;
  onSafetyKindChange: (v: string) => void;
  behaviorDesc: string;
  onBehaviorDescChange: (v: string) => void;
  /**
   * When editing: the alert type stays as posted. Several of these choices are stored as one kind,
   * so the original choice can't be shown again faithfully.
   */
  kindLocked?: boolean;
}

export default function SafetyAlertFields({
  safetyKind, onSafetyKindChange,
  behaviorDesc, onBehaviorDescChange,
  kindLocked = false,
}: SafetyAlertFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-red-50 rounded-xl space-y-2 border border-red-100">
      {kindLocked ? (
        <p className="text-xs text-red-700">The alert type stays as posted.</p>
      ) : (
        <>
          <p className="text-xs font-semibold text-red-700">Alert Type</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['road_hazard', 'Road hazard'],
              ['power_outage', 'Power outage'],
              ['weather_damage', 'Weather damage'],
              ['missing_pet', 'Missing pet'],
              ['hazard', 'Other hazard'],
              ['other', 'Other'],
            ].map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={safetyKind === kind}
                onClick={() => onSafetyKindChange(kind)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition ${safetyKind === kind ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-700 hover:bg-red-100'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-red-700">Heads-ups can’t be about crime or suspicious people. In an emergency, call 911.</p>
        </>
      )}
      <textarea
        rows={2}
        className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg resize-none text-app"
        placeholder="Describe what happened..."
        value={behaviorDesc}
        onChange={(e) => onBehaviorDescChange(e.target.value)}
        spellCheck
        autoCorrect="on"
        autoCapitalize="sentences"
      />
    </div>
  );
}
