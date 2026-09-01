export const identityCopy = {
  profilesPrivacyTitle: 'Profiles & Privacy',
  profilesPrivacyPromise: 'Choose what people see about you in each part of Pantopus.',
  beacon: 'Beacon',
  updates: 'Updates',
  profileLinks: 'Profile links',
  privacyPreview: 'Privacy Preview',
};

export function audienceLabelSingular(label?: string | null): string {
  const normalized = label?.trim();
  if (!normalized) return 'Follower';
  const lower = normalized.toLowerCase();
  if (lower.endsWith('s')) return capitalize(lower.slice(0, -1));
  return capitalize(lower);
}

export function audienceLabelPlural(label?: string | null): string {
  const normalized = label?.trim();
  if (!normalized) return 'Followers';
  return capitalize(normalized);
}

export function viewerLabel(viewer: string, audienceLabel?: string | null): string {
  switch (viewer) {
    case 'persona_audience_member':
      return audienceLabelSingular(audienceLabel);
    case 'household_member':
      return 'Household';
    case 'gig_participant':
      return 'Gig participant';
    default:
      return capitalize(viewer.replace(/_/g, ' '));
  }
}

export function normalizeIdentityProductLanguage(value: string): string {
  const audienceProfileLegacy = ['Audience', 'Profile'].join(' ');
  const publicProfileLegacy = ['Public', 'Profile'].join(' ');
  const profilesPrivacyLegacy = ['Identity', 'Center'].join(' ');
  const updatesLegacy = ['Broadcast', 'channel'].join(' ');
  const updatesLegacyTitle = ['Broadcast', 'Channel'].join(' ');

  return value
    .replace(phrasePattern(`${audienceProfileLegacy}s`), `${identityCopy.beacon}s`)
    .replace(phrasePattern(audienceProfileLegacy), identityCopy.beacon)
    .replace(phrasePattern(`${publicProfileLegacy}s`), `${identityCopy.beacon}s`)
    .replace(phrasePattern(publicProfileLegacy), identityCopy.beacon)
    .replace(phrasePattern(profilesPrivacyLegacy), identityCopy.profilesPrivacyTitle)
    .replace(phrasePattern(updatesLegacy), identityCopy.updates)
    .replace(phrasePattern(updatesLegacyTitle), identityCopy.updates);
}

// History: identityUiText was a runtime regex helper that rewrote legacy
// UI terms (Audience Profile -> Public Profile, Identity Center -> Profiles
// & Privacy, Broadcast channel -> Updates, ...) on every call. All
// callsites were migrated to source literals and the helper was deleted.
// A subsequent rename retired "Public Profile" in favor of "Beacon"; the
// CI guard at backend/scripts/ci/check-legacy-ui-terms.js enforces both.
// normalizeIdentityProductLanguage above kept as a defense-in-depth
// translator for any backend message that still ships legacy phrasing.

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function phrasePattern(phrase: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
