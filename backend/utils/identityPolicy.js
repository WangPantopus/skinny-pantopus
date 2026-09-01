const PERSONA_LOCAL_AUDIENCES = new Set(['nearby', 'neighborhood', 'saved_place', 'target_area', 'household', 'connections']);

function canPostWithIdentityToAudience({ identityType, audience }) {
  const normalizedIdentity = identityType === 'creator' ? 'persona' : identityType;

  if (normalizedIdentity === 'persona') {
    if (PERSONA_LOCAL_AUDIENCES.has(audience)) {
      return {
        allowed: false,
        code: 'PERSONA_LOCAL_AUDIENCE_BLOCKED',
        reason: 'Beacon posts cannot be shared to local, household, nearby, or connection audiences.',
      };
    }
    if (audience === 'followers' || audience === 'public') {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'PERSONA_AUDIENCE_UNSUPPORTED',
      reason: 'Beacon posts can only be shared to followers or public in this version.',
    };
  }

  if ((normalizedIdentity === 'local' || normalizedIdentity === 'personal') && audience === 'persona_followers') {
    return {
      allowed: false,
      code: 'LOCAL_TO_PERSONA_AUDIENCE_BLOCKED',
      reason: 'Local Profile posts cannot be shared to Beacon followers.',
    };
  }

  if (normalizedIdentity === 'home') {
    if (audience === 'household' || audience === 'neighborhood') return { allowed: true };
    return {
      allowed: false,
      code: 'HOME_AUDIENCE_BLOCKED',
      reason: 'Home posts can only be shared to household or the home Place feed.',
    };
  }

	  if (normalizedIdentity === 'business') {
	    if (audience === 'target_area' || audience === 'public') return { allowed: true };
	    return {
	      allowed: false,
	      code: 'BUSINESS_AUDIENCE_BLOCKED',
	      reason: 'Business posts can only be shared to public or a target area.',
	    };
	  }

  return { allowed: true };
}

module.exports = {
  canPostWithIdentityToAudience,
};
