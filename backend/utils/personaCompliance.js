const LOW_RISK_PERSONA_CATEGORIES = [
  'creator',
  'writer',
  'coach',
  'consultant',
  'community_leader',
  'public_figure',
  'other',
];

const SENSITIVE_PERSONA_CATEGORY_POLICIES = {
  doctor: {
    label: 'Doctor',
    requiresCredentialVerification: true,
    requiresOrganizationReview: true,
    requiresConsentControls: true,
    requiresMinorSafeguards: false,
    defaultAudienceMode: 'approval_required',
    enabledEnv: 'PERSONA_SENSITIVE_CATEGORIES_ENABLED',
  },
  therapist: {
    label: 'Therapist',
    requiresCredentialVerification: true,
    requiresOrganizationReview: true,
    requiresConsentControls: true,
    requiresMinorSafeguards: false,
    defaultAudienceMode: 'approval_required',
    enabledEnv: 'PERSONA_SENSITIVE_CATEGORIES_ENABLED',
  },
  lawyer: {
    label: 'Lawyer',
    requiresCredentialVerification: true,
    requiresOrganizationReview: false,
    requiresConsentControls: true,
    requiresMinorSafeguards: false,
    defaultAudienceMode: 'approval_required',
    enabledEnv: 'PERSONA_SENSITIVE_CATEGORIES_ENABLED',
  },
  teacher: {
    label: 'Teacher',
    requiresCredentialVerification: true,
    requiresOrganizationReview: true,
    requiresConsentControls: true,
    requiresMinorSafeguards: true,
    defaultAudienceMode: 'approval_required',
    enabledEnv: 'PERSONA_SENSITIVE_CATEGORIES_ENABLED',
  },
  tutor: {
    label: 'Tutor',
    requiresCredentialVerification: true,
    requiresOrganizationReview: false,
    requiresConsentControls: true,
    requiresMinorSafeguards: true,
    defaultAudienceMode: 'approval_required',
    enabledEnv: 'PERSONA_SENSITIVE_CATEGORIES_ENABLED',
  },
};

function isSensitivePersonaCategory(category) {
  return Object.prototype.hasOwnProperty.call(
    SENSITIVE_PERSONA_CATEGORY_POLICIES,
    String(category || '').toLowerCase(),
  );
}

function isSensitivePersonaCategoryEnabled(category, env = process.env) {
  const policy = SENSITIVE_PERSONA_CATEGORY_POLICIES[String(category || '').toLowerCase()];
  if (!policy) return true;
  return env[policy.enabledEnv] === 'true';
}

function getPersonaCategoryPolicy(category, env = process.env) {
  const normalized = String(category || 'creator').toLowerCase();
  if (LOW_RISK_PERSONA_CATEGORIES.includes(normalized)) {
    return {
      category: normalized,
      label: normalized.replace(/_/g, ' '),
      sensitive: false,
      enabled: true,
      requirements: [],
    };
  }

  const policy = SENSITIVE_PERSONA_CATEGORY_POLICIES[normalized];
  if (!policy) {
    return {
      category: normalized,
      label: normalized,
      sensitive: false,
      enabled: false,
      requirements: ['unsupported_category'],
    };
  }

  return {
    category: normalized,
    label: policy.label,
    sensitive: true,
    enabled: isSensitivePersonaCategoryEnabled(normalized, env),
    defaultAudienceMode: policy.defaultAudienceMode,
    requirements: [
      policy.requiresCredentialVerification ? 'credential_verification' : null,
      policy.requiresOrganizationReview ? 'organization_review' : null,
      policy.requiresConsentControls ? 'consent_controls' : null,
      policy.requiresMinorSafeguards ? 'minor_safeguards' : null,
    ].filter(Boolean),
  };
}

function getPersonaCategoryPolicies(env = process.env) {
  return [
    ...LOW_RISK_PERSONA_CATEGORIES.map((category) => getPersonaCategoryPolicy(category, env)),
    ...Object.keys(SENSITIVE_PERSONA_CATEGORY_POLICIES).map((category) => getPersonaCategoryPolicy(category, env)),
  ];
}

function assertPersonaCategoryEnabled(category, env = process.env) {
  const policy = getPersonaCategoryPolicy(category, env);
  if (!policy.enabled) {
    return {
      allowed: false,
      code: policy.sensitive ? 'SENSITIVE_PERSONA_CATEGORY_GATED' : 'PERSONA_CATEGORY_UNSUPPORTED',
      error: policy.sensitive
        ? 'This audience category is modeled but not enabled yet. Sensitive professional audiences require additional verification and compliance controls.'
        : 'This audience category is not supported.',
      policy,
    };
  }
  return { allowed: true, policy };
}

module.exports = {
  LOW_RISK_PERSONA_CATEGORIES,
  SENSITIVE_PERSONA_CATEGORY_POLICIES,
  assertPersonaCategoryEnabled,
  getPersonaCategoryPolicies,
  getPersonaCategoryPolicy,
  isSensitivePersonaCategory,
  isSensitivePersonaCategoryEnabled,
};
