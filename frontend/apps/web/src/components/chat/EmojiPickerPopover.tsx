'use client';

import { useEffect, useRef, useState } from 'react';

// The picker and its emoji table (about half a megabyte) are not part of every
// page that shows a composer or message. A chat composer preloads them while
// the page is idle; opening a picker earlier loads both at once. They are held
// here rather than behind a Suspense boundary, whose reveal React throttles by
// about 300 ms even when the module is already loaded.
type PickerComponent = (typeof import('@emoji-mart/react'))['default'];
let picker: PickerComponent | null = null;
let pickerLoad: Promise<PickerComponent> | null = null;
let emojiTable: unknown = null;
let emojiTableLoad: Promise<unknown> | null = null;
const loadPicker = () => (pickerLoad ??= import('@emoji-mart/react').then((module) => (picker = module.default))
  .catch((error: unknown) => { pickerLoad = null; throw error; }));
const loadEmojiData = () => (emojiTableLoad ??= import('@emoji-mart/data').then((module) => (emojiTable = module.default))
  .catch((error: unknown) => { emojiTableLoad = null; throw error; }));

/** Start loading the picker and its emoji table without showing anything. */
export function preloadEmojiPicker(): void {
  void loadPicker().catch(() => {});
  void loadEmojiData().catch(() => {});
}

interface EmojiPickerPopoverProps {
  isOpen?: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function EmojiPickerPopover({ isOpen = true, onClose, onSelect, anchorRef }: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<{ Picker: PickerComponent; data: unknown } | null>(null);
  const ready = loaded ?? (isOpen && picker && emojiTable ? { Picker: picker, data: emojiTable } : null);
  const isReady = ready !== null;
  useEffect(() => {
    if (!isOpen || isReady) return;
    let live = true;
    void Promise.all([loadPicker(), loadEmojiData()])
      .then(([Picker, data]) => { if (live) setLoaded({ Picker, data }); }).catch(() => {});
    return () => { live = false; };
  }, [isOpen, isReady]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ready) return null;
  const { Picker, data } = ready;

  return (
    <div ref={popoverRef} className="absolute bottom-full mb-2 z-50 shadow-xl rounded-xl overflow-hidden">
      <Picker
        data={data}
        theme="light"
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
        onEmojiSelect={(emoji: { native: string }) => onSelect(emoji.native)}
      />
    </div>
  );
}
