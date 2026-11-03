import type { KeyboardEvent } from 'react';

interface TabButtonProps {
  label: string;
  /** A number beside the label (Posts 8); left out when unknown. */
  count?: number | null;
  active: boolean;
  onClick: () => void;
  /** The tab's id and its panel's, so the panel is named by the tab. */
  id?: string;
  controls?: string;
  /** Arrow keys move between the tabs. */
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export default function TabButton({ label, count = null, active, onClick, id, controls, onKeyDown }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`min-h-[2.75rem] -mb-px flex items-center gap-1.5 border-b-2 px-0.5 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-link)] ${
        active ? 'border-[color:var(--color-link)] text-app' : 'border-transparent text-app-muted hover:text-app'
      }`}
    >
      {label}
      {count != null ? <span className="font-medium text-app-muted">{count}</span> : null}
    </button>
  );
}
