'use client';

// ============================================================
// LivingSky — the homepage's scene (skyScene.ts) on its canvas.
// ============================================================

import SkyCanvas from '@/components/sky/SkyCanvas';
import { DEFAULT_SKY_OPTIONS, drawSky, type SkyOptions } from './skyScene';

type LivingSkyProps = Partial<SkyOptions> & {
  /** The hour to draw, 0–24. Omit it to follow the device clock. */
  hour?: number;
  /** The sun or moon rises into place when the sky first appears. */
  rise?: boolean;
  label: string;
  className?: string;
};

export default function LivingSky({ hour, rise, label, className, ...rest }: LivingSkyProps) {
  return <SkyCanvas draw={drawSky} options={{ ...DEFAULT_SKY_OPTIONS, ...rest }} hour={hour} rise={rise} label={label} className={className} />;
}
