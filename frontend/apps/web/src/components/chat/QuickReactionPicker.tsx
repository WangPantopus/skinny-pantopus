'use client';

const QUICK_REACTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

interface QuickReactionPickerProps {
  onSelect: (emoji: string) => void;
  onOpenFullPicker: () => void;
}

export default function QuickReactionPicker({ onSelect, onOpenFullPicker }: QuickReactionPickerProps) {
  return (
    <div className="flex gap-1 p-2 bg-surface rounded-xl shadow-lg border border-app">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-muted transition-colors text-xl"
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenFullPicker}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-muted transition-colors text-sm text-app-text-secondary"
      >
        +
      </button>
    </div>
  );
}
