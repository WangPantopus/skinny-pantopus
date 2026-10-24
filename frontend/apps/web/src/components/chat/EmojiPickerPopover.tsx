'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// The picker and its emoji table (about half a megabyte) load the first time
// someone opens a picker, not with every page that shows a composer or message.
const Picker = dynamic(() => import('@emoji-mart/react'), { ssr: false });
let emojiData: Promise<unknown> | null = null;
const loadEmojiData = () => (emojiData ??= import('@emoji-mart/data').then((module) => module.default)
  .catch((error: unknown) => { emojiData = null; throw error; }));

interface EmojiPickerPopoverProps {
  isOpen?: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function EmojiPickerPopover({ isOpen = true, onClose, onSelect, anchorRef }: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<unknown>(null);
  useEffect(() => {
    if (!isOpen || data) return;
    let live = true;
    void loadEmojiData().then((loaded) => { if (live) setData(loaded); }).catch(() => {});
    return () => { live = false; };
  }, [isOpen, data]);

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

  if (!isOpen || !data) return null;

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
