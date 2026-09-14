'use client';

import { useMemo } from 'react';
import { create } from 'qrcode';

/** Real QR encoding shared by invitation and resource-share views. */
export default function QRCode({ value, size = 180, label = 'Share link QR code' }: {
  value: string;
  size?: number;
  label?: string;
}) {
  const image = useMemo(() => {
    try {
      const { modules } = create(value, { errorCorrectionLevel: 'M' });
      const cells: string[] = [];
      for (let row = 0; row < modules.size; row += 1) {
        for (let column = 0; column < modules.size; column += 1) {
          if (modules.get(row, column)) cells.push(`M${column + 4} ${row + 4}h1v1h-1z`);
        }
      }
      return { width: modules.size + 8, path: cells.join('') };
    } catch {
      return null;
    }
  }, [value]);

  if (!image) return <span className="text-sm text-app-text-secondary">Use the share link below.</span>;
  return (
    <svg role="img" aria-label={label} width={size} height={size}
      viewBox={`0 0 ${image.width} ${image.width}`} shapeRendering="crispEdges">
      <rect width={image.width} height={image.width} fill="#ffffff" />
      <path d={image.path} fill="#000000" />
    </svg>
  );
}
