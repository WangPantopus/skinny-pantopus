const DISABLED_VALUES = ['0', 'false', 'off', 'disabled'];
const PRODUCTION_ENVS = ['production', 'prod'];

function isProductionRuntime(): boolean {
  const runtimeEnv = (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    ''
  ).toLowerCase();
  return PRODUCTION_ENVS.includes(runtimeEnv);
}

function defaultIdentityFeatureEnabled(): boolean {
  return !isProductionRuntime();
}

function enabled(value: string | undefined, defaultValue = defaultIdentityFeatureEnabled()): boolean {
  if (value == null || value === '') return defaultValue;
  return !DISABLED_VALUES.includes(value.toLowerCase());
}

const defaultEnabled = defaultIdentityFeatureEnabled();
const identityFirewall = enabled(process.env.NEXT_PUBLIC_IDENTITY_FIREWALL_ENABLED, defaultEnabled);
const persona = identityFirewall && enabled(process.env.NEXT_PUBLIC_PERSONA_ENABLED, defaultEnabled);
const personaBroadcast = persona && enabled(process.env.NEXT_PUBLIC_PERSONA_BROADCAST_ENABLED, defaultEnabled);
const personaPaidMemberships = persona && enabled(process.env.NEXT_PUBLIC_PERSONA_PAID_MEMBERSHIPS_ENABLED, false);

// Calendarly scheduling. `scheduling` is the master gate; `schedulingPaid`
// gates priced surfaces (Stripe TEST mode; payout settlement deferred).
// Default ON in non-prod / OFF in prod, like the identity flags.
const scheduling = enabled(process.env.NEXT_PUBLIC_SCHEDULING_ENABLED, defaultEnabled);
const schedulingPaid =
  scheduling && enabled(process.env.NEXT_PUBLIC_SCHEDULING_PAID_ENABLED, defaultEnabled);

export const webFeatureFlags = {
  identityFirewall,
  persona,
  personaBroadcast,
  personaPaidMemberships,
  scheduling,
  schedulingPaid,
};

// First-launch scope (founder direction, 2026-09-27). These eight features are
// hidden for the first launch; their code stays. A feature is OFF in every
// environment unless its key is listed in NEXT_PUBLIC_LAUNCH_FEATURES
// (comma-separated, or "all"), e.g. NEXT_PUBLIC_LAUNCH_FEATURES=marketplace.
// The same keys drive the backend (LAUNCH_FEATURES) and the native apps.
export const LAUNCH_FEATURE_KEYS = [
  'beacon', // 1. Beacon and creator tools
  'personas', // 2. Personas and identity switching
  'marketplace', // 3. Marketplace
  'open_gigs', // 4. Open Gigs marketplace
  'public_scheduling', // 5. Public scheduling for general businesses
  'business_directory', // 6. General business directory
  'household_extras', // 7. Polls, packages, pet section, family calendar, bill management
  'mail_extras', // 8. Letters, e-signing, community mail, event invitations by mail
] as const;

export type LaunchFeatureKey = (typeof LAUNCH_FEATURE_KEYS)[number];

export function parseLaunchFeatures(raw: string | undefined): Set<LaunchFeatureKey> {
  const listed = (raw || '')
    .split(',')
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
  if (listed.includes('all')) return new Set(LAUNCH_FEATURE_KEYS);
  return new Set(LAUNCH_FEATURE_KEYS.filter((key) => listed.includes(key)));
}

const enabledLaunchFeatures = parseLaunchFeatures(process.env.NEXT_PUBLIC_LAUNCH_FEATURES);

export const launchFeatures = {
  beacon: enabledLaunchFeatures.has('beacon'),
  personas: enabledLaunchFeatures.has('personas'),
  marketplace: enabledLaunchFeatures.has('marketplace'),
  openGigs: enabledLaunchFeatures.has('open_gigs'),
  publicScheduling: enabledLaunchFeatures.has('public_scheduling'),
  businessDirectory: enabledLaunchFeatures.has('business_directory'),
  householdExtras: enabledLaunchFeatures.has('household_extras'),
  mailExtras: enabledLaunchFeatures.has('mail_extras'),
};

// Pages that exist only for a hidden feature, matched against the pathname.
// Each row is [feature on?, pattern]; a surface of two features needs both.
// The middleware turns direct entry away, and in-app links built from server
// data (notifications, search results) skip these pages. Pages that stay are
// deliberately absent: task detail (/app/gigs/<id>), business pages, invoices,
// packages and payouts.
const LAUNCH_CUT_ROUTES: ReadonlyArray<readonly [boolean, RegExp]> = [
  // #1 Beacon: the Beacon directory, audience management and creator inbox.
  [launchFeatures.beacon, /^\/app\/(?:beacons|audience)(?:\/|$)/],
  // #1 + #2: My Beacon, broadcasts, paid follow and public persona pages.
  [launchFeatures.beacon && launchFeatures.personas, /^\/(?:app\/)?persona(?:\/|$)|^\/(?:@|%40)/i],
  // #2 Personas: the Identity Center and view-as.
  [launchFeatures.personas, /^\/app\/identity(?:\/|$)/],
  // #2 + #4: Professional mode, a second public profile for open gig work.
  [launchFeatures.personas && launchFeatures.openGigs, /^\/app\/professional(?:\/|$)/],
  // #3 Marketplace.
  [launchFeatures.marketplace, /^\/app\/(?:marketplace|my-listings|saved-listings|listing-offers)(?:\/|$)/],
  [launchFeatures.marketplace, /^\/(?:listing|listings|marketplace)(?:\/|$)/],
  // #4 Open Gigs: browse, composers, bookmarks and bids.
  [launchFeatures.openGigs, /^\/app\/gigs(?:\/new|\/saved)?\/?$/],
  // Editing reopens the open-post composer; task detail and review stay.
  [launchFeatures.openGigs, /^\/app\/gigs\/[^/]+\/edit\/?$/],
  [launchFeatures.openGigs, /^\/app\/gigs-v2(?:\/new)?\/?$/],
  [launchFeatures.openGigs, /^\/app\/(?:my-bids|offers)(?:\/|$)/],
  [launchFeatures.openGigs, /^\/gigs(?:\/new)?\/?$/],
  // #5 Public scheduling; its invoices, packages and payouts pages stay.
  [launchFeatures.publicScheduling, /^\/app\/scheduling(?:\/(?!(?:invoices|packages|my-packages)(?:\/|$)|payments\/?$)|$)/],
  [launchFeatures.publicScheduling, /^\/book(?:\/(?![^/]+\/packages\/)|$)|^\/booking(?:\/|$)/],
  // #5 + #7: the Home scheduling hub (household agenda, find-a-time polls).
  [launchFeatures.publicScheduling && launchFeatures.householdExtras, /^\/app\/homes\/[^/]+\/scheduling(?:\/|$)|^\/poll(?:\/|$)/],
  // #3 + #4 + #6: the Discover hub (business, task and listing rails).
  [launchFeatures.businessDirectory && launchFeatures.openGigs && launchFeatures.marketplace, /^\/app\/discover-hub(?:\/|$)/],
  // #7 Household extras, incl. the mailbox's package tracking and unboxing.
  [launchFeatures.householdExtras, /^\/app\/homes\/[^/]+\/(?:bills|calendar|packages|pets|polls)(?:\/|$)/],
  [launchFeatures.householdExtras, /^\/app\/mailbox\/(?:package|unboxing)(?:\/|$)/],
  // #4 + #7: a package's "Ask a neighbor" task post.
  [launchFeatures.openGigs && launchFeatures.householdExtras, /^\/app\/mailbox\/gig(?:\/|$)/],
  // #8 Mail extras.
  [launchFeatures.mailExtras, /^\/app\/mailbox\/(?:certified|community|party|translation)(?:\/|$)/],
];

/** True when `path` opens a page of a feature hidden for the first launch. */
export function isLaunchCutPath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return LAUNCH_CUT_ROUTES.some(([open, pattern]) => !open && pattern.test(pathname));
}

/**
 * True when a notification belongs to a hidden feature: the Audience stream
 * (#1) or a row whose resolved link opens a hidden page.
 */
export function isLaunchCutNotification(
  notification: { context?: string | null },
  path: string | null,
): boolean {
  if (!launchFeatures.beacon && notification.context === 'audience') return true;
  return !!path && isLaunchCutPath(path);
}
