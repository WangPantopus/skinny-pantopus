'use client';

import { useEffect, useRef } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerPopoverProps {
  isOpen?: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function EmojiPickerPopover({ isOpen = true, onClose, onSelect, anchorRef }: EmojiPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen) return null;

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
