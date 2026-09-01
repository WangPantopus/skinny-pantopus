'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';

type VirtualizedListProps<T> = {
  items: T[];
  estimateSize?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
};

/**
 * Virtualizes a list when it has more than 50 items.
 * Below that threshold, renders normally for simplicity.
 */
export default function VirtualizedList<T>({
  items,
  estimateSize = 72,
  renderItem,
  className,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
  });

  // For short lists, render without virtualization
  if (items.length <= 20) {
    return (
      <div className={className} role="list">
        {items.map((item, i) => (
          <div key={i} role="listitem">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className={`overflow-y-auto ${className ?? ''}`} role="list">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            role="listitem"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
