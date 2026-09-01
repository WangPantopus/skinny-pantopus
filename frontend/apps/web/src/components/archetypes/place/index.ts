// ============================================================
// Place archetype — web mirror of docs/design/place (place-components.jsx).
// The reusable card system for the address-led Place dashboard:
// the section-card atom + its states, the two special cards (locked /
// density), the group wrapper, the header, and the shared atoms.
//
// Note: imported via '@/components/archetypes/place' (not re-exported
// from archetypes/index.ts) so the Place SectionCard / Group don't
// collide with the generic archetype primitives of the same name.
// ============================================================

export { default as SectionCard } from './SectionCard';
export type {
  SectionCardProps,
  PlaceSectionState,
  PlaceSectionCardChip,
  PlaceSectionCardAction,
} from './SectionCard';

export { default as LockedCard } from './LockedCard';
export type { LockedCardProps } from './LockedCard';

export { default as DensityCard } from './DensityCard';
export type { DensityCardProps } from './DensityCard';

export { default as Group } from './Group';
export type { GroupProps } from './Group';

export { default as PlaceHeader } from './PlaceHeader';
export type { PlaceHeaderProps } from './PlaceHeader';

export { default as HeroCard } from './HeroCard';
export type { HeroCardProps, HeroVariant, HeroNudge } from './HeroCard';

export { default as AhaCard } from './AhaCard';
export type { AhaCardProps, AhaTone } from './AhaCard';

export { DetailHeader, DetailSectionLabel, SourceNote, ComingSoonRow, InfoNote } from './detail';
export type { DetailHeaderProps, InfoNoteTone } from './detail';

export { default as PlaceSwitcher } from './PlaceSwitcher';
export type { PlaceSwitcherProps, PlaceSwitcherHome, PlaceSwitcherStatus } from './PlaceSwitcher';

export { default as VerifyBanner } from './VerifyBanner';
export type { VerifyBannerProps } from './VerifyBanner';

export {
  IconTile,
  Chevron,
  TextButton,
  StatusDot,
  Sparkline,
  PlaceAvatar,
  PlaceCard,
} from './primitives';
export type {
  IconTileProps,
  TextButtonProps,
  PlaceTone,
  StatusDotTone,
  PlaceAvatarProps,
  PlaceAvatarStatus,
  PlaceCardProps,
} from './primitives';
