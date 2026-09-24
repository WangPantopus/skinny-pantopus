// Pantopus design-system bundle entry (tools/design-system).
//
// Everything below is re-exported from frontend/apps/web/src unchanged, except
// `Button`, which is hand-written from the class recipe the web repeats inline
// (ArchetypePageHeader's ActionButton, StickyFooter, ArchetypeEmptyState),
// because the web has no standalone button component.
//
// To add a component: export it here, give it an entry in
// content/previews.mjs and a guideline in content/components/<Name>.md.
// Imports may only reach react, lucide-react, next/navigation (shimmed),
// @/… paths and @pantopus/* workspace packages; lib/bundle.mjs refuses others.

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Download,
  FileText,
  Filter,
  Flame,
  Hammer,
  Home,
  Inbox,
  Landmark,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Thermometer,
  Users,
  Wallet,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';

// ── Brand ────────────────────────────────────────────────────
export { PantopusMark, PantopusLockup } from '@/components/brand/PantopusMark';

// ── Archetype primitives ─────────────────────────────────────
export { default as Overline } from '@/components/archetypes/primitives/Overline';
export { default as SectionHeader } from '@/components/archetypes/primitives/SectionHeader';
export { default as SectionCard } from '@/components/archetypes/primitives/SectionCard';
export { default as Chip } from '@/components/archetypes/primitives/Chip';
export { default as TabStrip } from '@/components/archetypes/primitives/TabStrip';
export { default as KeyFactsPanel } from '@/components/archetypes/primitives/KeyFactsPanel';
export { default as StickyFooter } from '@/components/archetypes/primitives/StickyFooter';
export { default as ProgressSegments } from '@/components/archetypes/primitives/ProgressSegments';
export { default as ValidatedField } from '@/components/archetypes/primitives/ValidatedField';
export { default as FieldGroup } from '@/components/archetypes/primitives/FieldGroup';
export { default as StatusChipRow } from '@/components/archetypes/primitives/StatusChipRow';
export { default as FileChevronRow } from '@/components/archetypes/primitives/FileChevronRow';
export { default as AvatarKebabRow } from '@/components/archetypes/primitives/AvatarKebabRow';
export { default as ArchetypeEmptyState } from '@/components/archetypes/primitives/ArchetypeEmptyState';
export { default as ArchetypePageHeader } from '@/components/archetypes/primitives/ArchetypePageHeader';

// ── Place archetype (renamed where the name collides) ────────
export { default as PlaceSectionCard } from '@/components/archetypes/place/SectionCard';
export { default as PlaceGroup } from '@/components/archetypes/place/Group';
export { default as LockedCard } from '@/components/archetypes/place/LockedCard';
export { default as DensityCard } from '@/components/archetypes/place/DensityCard';
export { default as PlaceHeader } from '@/components/archetypes/place/PlaceHeader';
export { default as HeroCard } from '@/components/archetypes/place/HeroCard';
export { default as AhaCard } from '@/components/archetypes/place/AhaCard';
export { default as VerifyBanner } from '@/components/archetypes/place/VerifyBanner';
export { default as PlaceSwitcher } from '@/components/archetypes/place/PlaceSwitcher';
export { DetailHeader, DetailSectionLabel, SourceNote, ComingSoonRow, InfoNote } from '@/components/archetypes/place/detail';
export { IconTile, Chevron, TextButton, StatusDot, Sparkline, PlaceAvatar, PlaceCard } from '@/components/archetypes/place/primitives';

// ── Shared UI ────────────────────────────────────────────────
export { default as BottomSheet } from '@/components/ui/BottomSheet';
export { default as ModalShell } from '@/components/ui/ModalShell';
export { default as Pill } from '@/components/ui/Pill';
export { default as IconButton } from '@/components/ui/IconButton';
export { default as EmptyState } from '@/components/ui/EmptyState';
export { default as ErrorState } from '@/components/ui/ErrorState';
export { default as StarRating } from '@/components/ui/StarRating';
export { default as Toast } from '@/components/ui/Toast';
export { ShimmerLine, ShimmerBlock } from '@/components/ui/Shimmer';
export { default as SearchInput } from '@/components/SearchInput';

// ── Icon registries (the web's single icon source) ───────────
export {
  NavIcons,
  HomeIcons,
  BusinessIcons,
  QuickCreateIcons,
  AccessIcons,
  MailboxIcons,
  IdentityIcons,
  HubIcons,
} from '@/lib/icons';

/** Extra Lucide glyphs the previews use. Import icons, never emoji. */
export const Icons = {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Download,
  FileText,
  Filter,
  Flame,
  Hammer,
  Home,
  Inbox,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Package,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Thermometer,
  Users,
  Wallet,
  Waves,
  Wrench,
  Zap,
};

// ── Button (intentional addition) ────────────────────────────
export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'warning';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** md = 40px (page headers, empty states); lg = 44px (sticky footers, forms). */
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  children: ReactNode;
}

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
  ghost: 'border border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover',
  danger: 'bg-app-error-solid text-white hover:brightness-110',
  success: 'bg-app-success-solid text-white hover:brightness-110',
  warning: 'bg-app-warning-solid text-white hover:brightness-110',
};

const BUTTON_SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'h-10 px-4 gap-1.5',
  lg: 'h-11 px-6 gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg text-sm font-semibold whitespace-nowrap transition disabled:opacity-50 ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
