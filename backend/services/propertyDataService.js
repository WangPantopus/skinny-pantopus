/**
 * Property Data Service
 *
 * Integrates ATTOM and CoreLogic APIs for automated owner-name matching.
 * Used by the property_data_match claim method to verify ownership
 * against public property records.
 *
 * Environment variables:
 *   ATTOM_API_KEY          – ATTOM Data API key
 *   CORELOGIC_API_KEY      – CoreLogic API key
 *   CORELOGIC_CLIENT_ID    – CoreLogic OAuth client ID
 *   PROPERTY_DATA_PROVIDER – 'attom' | 'corelogic' | 'none' (default: 'none')
 */

const logger = require('../utils/logger');

const PROVIDER = (process.env.PROPERTY_DATA_PROVIDER || 'none').toLowerCase();

// ── ATTOM Integration ──────────────────────────────────────

async function lookupAttom(address, city, state, zip) {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) throw new Error('ATTOM_API_KEY not configured');

  const params = new URLSearchParams({
    address1: address,
    address2: `${city}, ${state} ${zip}`,
  });

  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?${params}`;

  const res = await fetch(url, {
    headers: { apikey: apiKey, Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.warn('ATTOM API error', { status: res.status, body: text });
    return null;
  }

  const data = await res.json();
  const property = data?.property?.[0];
  if (!property) return null;

  const owner = property.assessment?.owner || property.owner || {};
  const ownerNames = [];

  if (owner.owner1?.last) {
    ownerNames.push({
      first: (owner.owner1.first || '').trim().toLowerCase(),
      last: (owner.owner1.last || '').trim().toLowerCase(),
      full: `${owner.owner1.first || ''} ${owner.owner1.last || ''}`.trim().toLowerCase(),
    });
  }
  if (owner.owner2?.last) {
    ownerNames.push({
      first: (owner.owner2.first || '').trim().toLowerCase(),
      last: (owner.owner2.last || '').trim().toLowerCase(),
      full: `${owner.owner2.first || ''} ${owner.owner2.last || ''}`.trim().toLowerCase(),
    });
  }

  return {
    provider: 'attom',
    ownerNames,
    address: property.address?.oneLine || null,
    apn: property.identifier?.apn || null,
    fips: property.identifier?.fips || null,
    raw: { attomId: property.identifier?.attomId },
  };
}

// ── CoreLogic Integration ──────────────────────────────────

async function lookupCoreLogic(address, city, state, zip) {
  const apiKey = process.env.CORELOGIC_API_KEY;
  const clientId = process.env.CORELOGIC_CLIENT_ID;
  if (!apiKey || !clientId) throw new Error('CoreLogic credentials not configured');

  const params = new URLSearchParams({
    streetAddress: address,
    city,
    state,
    zip,
  });

  const url = `https://api.corelogic.com/property/v2/search?${params}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Client-Id': clientId,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.warn('CoreLogic API error', { status: res.status, body: text });
    return null;
  }

  const data = await res.json();
  const property = data?.properties?.[0] || data?.results?.[0];
  if (!property) return null;

  const ownerNames = [];
  const ownerInfo = property.owner || property.ownerInfo || {};

  if (ownerInfo.ownerName) {
    ownerNames.push({ full: ownerInfo.ownerName.trim().toLowerCase() });
  }
  if (ownerInfo.ownerName2) {
    ownerNames.push({ full: ownerInfo.ownerName2.trim().toLowerCase() });
  }

  return {
    provider: 'corelogic',
    ownerNames,
    address: property.address?.fullAddress || null,
    apn: property.apn || null,
    fips: property.fips || null,
    raw: { corelogicId: property.propertyId },
  };
}

// ── Name Matching Logic ────────────────────────────────────

/**
 * Compare a user's name against property record owner names.
 * Returns a confidence score (0-100) and match details.
 */
function matchOwnerName(userName, propertyOwnerNames) {
  if (!userName || !propertyOwnerNames || propertyOwnerNames.length === 0) {
    return { matched: false, confidence: 0, details: 'No data to compare' };
  }

  const userParts = userName.trim().toLowerCase().split(/\s+/);
  const userFirst = userParts[0] || '';
  const userLast = userParts[userParts.length - 1] || '';
  const userFull = userName.trim().toLowerCase();

  let bestScore = 0;
  let bestMatch = null;

  for (const owner of propertyOwnerNames) {
    // Exact full name match
    if (owner.full && owner.full === userFull) {
      return { matched: true, confidence: 95, details: 'Exact full name match' };
    }

    // First + last name match
    if (owner.first && owner.last) {
      if (owner.first === userFirst && owner.last === userLast) {
        return { matched: true, confidence: 90, details: 'First and last name match' };
      }
      // Last name match only
      if (owner.last === userLast) {
        const score = 60;
        if (score > bestScore) { bestScore = score; bestMatch = 'Last name match'; }
      }
    }

    // Full name contains user's last name
    if (owner.full && owner.full.includes(userLast) && userLast.length >= 3) {
      const score = owner.full.includes(userFirst) ? 80 : 55;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = score >= 80 ? 'Name components found in owner record' : 'Last name found in owner record';
      }
    }
  }

  const MATCH_THRESHOLD = 70;
  return {
    matched: bestScore >= MATCH_THRESHOLD,
    confidence: bestScore,
    details: bestMatch || 'No match found',
  };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Look up property ownership data and compare against a user's name.
 *
 * @param {object} params
 * @param {string} params.address
 * @param {string} params.city
 * @param {string} params.state
 * @param {string} params.zip
 * @param {string} params.userName - the claimant's full name
 * @returns {object} { available, matched, confidence, provider, ownerNames, raw }
 */
async function verifyPropertyOwnership({ address, city, state, zip, userName }) {
  if (PROVIDER === 'none') {
    return {
      available: false,
      matched: false,
      confidence: 0,
      provider: 'none',
      reason: 'Property data provider not configured',
    };
  }

  try {
    let result;
    if (PROVIDER === 'attom') {
      result = await lookupAttom(address, city, state, zip);
    } else if (PROVIDER === 'corelogic') {
      result = await lookupCoreLogic(address, city, state, zip);
    } else {
      return { available: false, matched: false, confidence: 0, provider: PROVIDER, reason: 'Unknown provider' };
    }

    if (!result) {
      return { available: true, matched: false, confidence: 0, provider: PROVIDER, reason: 'Property not found in records' };
    }

    const match = matchOwnerName(userName, result.ownerNames);

    return {
      available: true,
      matched: match.matched,
      confidence: match.confidence,
      provider: result.provider,
      ownerNames: result.ownerNames,
      details: match.details,
      apn: result.apn,
      raw: result.raw,
    };
  } catch (err) {
    logger.error('Property data lookup failed', { error: err.message, provider: PROVIDER });
    return {
      available: false,
      matched: false,
      confidence: 0,
      provider: PROVIDER,
      reason: `Lookup failed: ${err.message}`,
    };
  }
}

/**
 * Check if property data matching is available (provider configured).
 */
function isAvailable() {
  return PROVIDER !== 'none' && (
    (PROVIDER === 'attom' && !!process.env.ATTOM_API_KEY) ||
    (PROVIDER === 'corelogic' && !!process.env.CORELOGIC_API_KEY)
  );
}

module.exports = {
  verifyPropertyOwnership,
  matchOwnerName,
  isAvailable,
  PROVIDER,
};
