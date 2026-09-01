// Calendarly shared component kit (W0 Foundation). Feature streams import from
// here; they must not edit anything under components/scheduling/**.

// Owner context + theming
export {
  SchedulingOwnerProvider,
  useSchedulingOwner,
} from "./SchedulingOwnerProvider";
export { detectOwnerFromPath, ownerToParams } from "./schedulingOwner";
export {
  PillarThemeProvider,
  usePillar,
  usePillarTokens,
  useOwnerAccent,
} from "./PillarThemeProvider";
export {
  pillarTokens,
  pillarForOwner,
  PRIMARY_BLUE,
  PRIMARY_BLUE_CLS,
  type Pillar,
  type PillarTokens,
} from "./pillarTokens";

// Error decoding + token persistence
export { decodeError, fieldErrors, asSlotConflict } from "./decodeError";
export {
  saveManageToken,
  getManageToken,
  clearManageToken,
} from "./manageToken";

// Slot selection + conflict recovery
export { default as SlotPicker, type SlotFetchRange } from "./SlotPicker";
export { default as SlotConflictAlternatives } from "./SlotConflictAlternatives";
export {
  default as TimezoneSelector,
  detectTimezone,
  zoneLabel,
} from "./TimezoneSelector";

// Status + policy + sharing + calendar
export {
  default as BookingStatusPill,
  type StatusPillValue,
} from "./BookingStatusPill";
export { default as CancellationPolicy } from "./CancellationPolicy";
export { default as ShareLink } from "./ShareLink";
export {
  default as AddToCalendar,
  type CalendarEventInput,
} from "./AddToCalendar";

// First-class state views
export {
  default as TerminalState,
  type TerminalStateProps,
} from "./states/TerminalState";
export { default as PausedView } from "./states/PausedView";
export { default as SecretView } from "./states/SecretView";
export { default as ExpiredView } from "./states/ExpiredView";
export { default as UnavailableView } from "./states/UnavailableView";
export { default as NoAvailabilityView } from "./states/NoAvailabilityView";
