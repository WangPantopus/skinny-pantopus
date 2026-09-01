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
