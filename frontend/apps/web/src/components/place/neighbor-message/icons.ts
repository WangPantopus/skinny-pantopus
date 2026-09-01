// ============================================================
// Neighbor-message template icons (W2.6).
//
// The template catalog is served by the backend with `icon` as a string
// (the single source of truth lives server-side). This maps those names to
// the lucide-react glyphs the compose screen renders. Unknown names fall
// back to a neutral note glyph so the UI never breaks on a new template.
// ============================================================

import type { LucideIcon } from 'lucide-react';
import { Volume2, Package, Car, Dog, DoorOpen, MessageSquare } from 'lucide-react';

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  'volume-2': Volume2,
  package: Package,
  car: Car,
  dog: Dog,
  'door-open': DoorOpen,
};

export function templateIcon(name: string): LucideIcon {
  return TEMPLATE_ICONS[name] ?? MessageSquare;
}
