/**
 * Trust State Computation Module
 *
 * Determines a user's trust level relative to a geographic location.
 * Used to enforce posting permissions, comment restrictions, and
 * trust badge display in the feed.
 *
 * Trust States:
 *   - verified_resident:  User has an active home within radius
 *   - verified_business:  User is posting as a verified business in area
 *   - visitor:            User is physically present (GPS) but not a resident
 *   - incoming_resident:  User has a pending home claim in the area
 *   - remote_viewer:      User is not present and not verified
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');
const { getActiveOccupancy, mapLegacyRole } = require('./homePermissions');
const { isPersonaEnabled } = require('./featureFlags');

// Radius in meters for "nearby" determination
const NEARBY_RADIUS_METERS = 16000; // ~10 miles
const GPS_PROXIMITY_METERS = 5000; // ~3.1 miles

function parsePostGISPoint(point) {
  if (!point) return null;
  if (typeof point === 'object' && point.type === 'Point' && Array.isArray(point.coordinates)) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }
  if (typeof point === 'string') {
    const match = point.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (match) return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
  }
  // WKB hex (Supabase returns geography columns in this format)
  const str = String(point);
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xFF;
      if (geomType !== 1) return null;
      const coordOffset = hasSRID ? 9 : 5;
      const lng = le ? buf.readDoubleLE(coordOffset) : buf.readDoubleBE(coordOffset);
      const lat = le ? buf.readDoubleLE(coordOffset + 8) : buf.readDoubleBE(coordOffset + 8);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { longitude: lng, latitude: lat };
      }
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Compute the trust state of a user relative to a geographic point.
 *
 * @param {string} userId
 * @param {number} latitude   - Target location latitude
 * @param {number} longitude  - Target location longitude
 * @returns {Promise<{
 *   level: 'verified_resident'|'verified_business'|'visitor'|'incoming_resident'|'remote_viewer',
 *   homeId: string|null,
 *   roleBase: string|null,
 *   distance: number|null
 * }>}
 */
async function computeTrustState(userId, latitude, longitude) {
  const result = {
    level: 'remote_viewer',
    homeId: null,
    roleBase: null,
    distance: null,
  };

  if (!userId || latitude == null || longitude == null) return result;

  try {
    // 1) Check if user has any active homes near this location
    let nearbyHomes = null;
    try {
      const rpcResult = await supabaseAdmin.rpc('get_user_homes_near_point', {
        p_user_id: userId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_radius_meters: NEARBY_RADIUS_METERS,
      });
      nearbyHomes = rpcResult?.data || null;
    } catch (_) {
      nearbyHomes = null;
    }

    // If RPC doesn't exist, fall back to manual query
    if (nearbyHomes && nearbyHomes.length > 0) {
      const closest = nearbyHomes[0];
      result.level = 'verified_resident';
      result.homeId = closest.home_id;
      result.roleBase = closest.role_base;
      result.distance = closest.distance_meters;
      return result;
    }

    // Fallback: query homes manually with haversine approximation
    const { data: userHomes } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id, role, role_base')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (userHomes && userHomes.length > 0) {
      const homeIds = userHomes.map(h => h.home_id);
      const { data: homes } = await supabaseAdmin
        .from('Home')
        .select('id, latitude, longitude')
        .in('id', homeIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (homes && homes.length > 0) {
        let closestHome = null;
        let closestDistance = Infinity;

        for (const home of homes) {
          const dist = haversineMeters(
            latitude, longitude,
            home.latitude, home.longitude
          );
          if (dist < closestDistance) {
            closestDistance = dist;
            closestHome = home;
          }
        }

        if (closestHome && closestDistance <= NEARBY_RADIUS_METERS) {
          const occ = userHomes.find(h => h.home_id === closestHome.id);
          result.level = 'verified_resident';
          result.homeId = closestHome.id;
          result.roleBase = occ?.role_base || mapLegacyRole(occ?.role);
          result.distance = Math.round(closestDistance);
          return result;
        }
      }
    }

    // 2) Check if user is an in-area verified business owner/team member
    const businessIds = new Set();
    const { data: ownedBusiness } = await supabaseAdmin
      .from('BusinessProfile')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (ownedBusiness?.user_id) businessIds.add(ownedBusiness.user_id);

    // Seat-based: get all business seats for this user via SeatBinding
    const { data: seatBindings } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat:seat_id ( business_user_id, is_active )')
      .eq('user_id', userId);
    for (const sb of seatBindings || []) {
      if (sb.seat?.business_user_id && sb.seat?.is_active !== false) {
        businessIds.add(sb.seat.business_user_id);
      }
    }

    // Fallback: also check legacy BusinessTeam
    const { data: teamMemberships } = await supabaseAdmin
      .from('BusinessTeam')
      .select('business_user_id, is_active')
      .eq('user_id', userId);
    for (const tm of teamMemberships || []) {
      if (tm?.business_user_id && tm?.is_active !== false) businessIds.add(tm.business_user_id);
    }

    if (businessIds.size > 0) {
      const ids = Array.from(businessIds);
      const { data: bizLocations } = await supabaseAdmin
        .from('BusinessLocation')
        .select('business_user_id, latitude, longitude, location, is_active')
        .in('business_user_id', ids)
        .eq('is_active', true);

      let closestBiz = null;
      let closestDistance = Infinity;
      for (const loc of bizLocations || []) {
        let lat = Number(loc.latitude);
        let lon = Number(loc.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          const parsed = parsePostGISPoint(loc.location);
          if (parsed) {
            lat = parsed.latitude;
            lon = parsed.longitude;
          }
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const dist = haversineMeters(latitude, longitude, lat, lon);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestBiz = loc;
        }
      }

      if (closestBiz && closestDistance <= NEARBY_RADIUS_METERS) {
        result.level = 'verified_business';
        result.homeId = closestBiz.business_user_id;
        result.roleBase = 'business';
        result.distance = Math.round(closestDistance);
        return result;
      }
    }

    // 3) Check for pending ownership claims (incoming resident)
    const { data: pendingClaims } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('home_id, state')
      .eq('claimant_user_id', userId)
      .in('state', ['submitted', 'pending_review', 'pending_challenge_window']);

    if (pendingClaims && pendingClaims.length > 0) {
      const claimHomeIds = pendingClaims.map(c => c.home_id);
      const { data: claimHomes } = await supabaseAdmin
        .from('Home')
        .select('id, latitude, longitude')
        .in('id', claimHomeIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (claimHomes) {
        for (const home of claimHomes) {
          const dist = haversineMeters(latitude, longitude, home.latitude, home.longitude);
          if (dist <= NEARBY_RADIUS_METERS) {
            result.level = 'incoming_resident';
            result.homeId = home.id;
            result.distance = Math.round(dist);
            return result;
          }
        }
      }
    }

    // 4) If none of the above, user is remote_viewer
    // Note: "visitor" status requires GPS confirmation from the client.
    // The client can override to "visitor" if GPS confirms physical presence.
    return result;
  } catch (err) {
    logger.error('Error computing trust state', { error: err.message, userId });
    return result;
  }
}

/**
 * Get all posting identities available to a user.
 * Used to populate the "Post As" picker in the composer.
 *
 * @param {string} userId
 * @returns {Promise<Array<{type: string, id: string, name: string, role?: string, imageUrl?: string}>>}
 */
async function getPostingIdentities(userId) {
  const identities = [];

  try {
    // 1) Personal identity (always available)
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('id, username, name, first_name, profile_picture_url')
      .eq('id', userId)
      .single();

    if (user) {
      identities.push({
        type: 'personal',
        id: userId,
        name: user.name || user.first_name || user.username || 'Local Profile',
        imageUrl: user.profile_picture_url || null,
      });
    }

    // 1b) Beacon / Public Persona identity
    if (isPersonaEnabled()) {
      const { data: persona } = await supabaseAdmin
        .from('PublicPersona')
        .select('id, handle, display_name, avatar_url, status, audience_label')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (persona) {
        identities.push({
          type: 'persona',
          id: persona.id,
          name: persona.display_name || persona.handle || 'Beacon',
          role: persona.audience_label || 'followers',
          imageUrl: persona.avatar_url || null,
        });
      }
    }

    // 2) Business identities
    const { data: businesses } = await supabaseAdmin
      .from('BusinessProfile')
      .select('user_id, name, logo_url')
      .eq('user_id', userId);

    // Also check business team membership — seat-based with fallback
    const { getAllSeatsForUser } = require('./seatPermissions');
    const userSeats = await getAllSeatsForUser(userId);

    // Legacy fallback
    const { data: teamMemberships } = await supabaseAdmin
      .from('BusinessTeam')
      .select('business_user_id, role_base')
      .eq('user_id', userId);

    if (businesses) {
      for (const biz of businesses) {
        identities.push({
          type: 'business',
          id: biz.user_id,
          name: biz.name,
          role: 'owner',
          imageUrl: biz.logo_url || null,
        });
      }
    }

    // Prefer seat data when available
    if (userSeats.length > 0) {
      for (const seat of userSeats) {
        if (identities.some(i => i.type === 'business' && i.id === seat.business_user_id)) continue;
        identities.push({
          type: 'business',
          id: seat.business_user_id,
          name: seat.business_name,
          role: seat.role_base,
          imageUrl: null,
        });
      }
    } else if (teamMemberships) {
      for (const tm of teamMemberships) {
        // Avoid duplicates if user is the business owner
        if (identities.some(i => i.type === 'business' && i.id === tm.business_user_id)) continue;
        const { data: biz } = await supabaseAdmin
          .from('BusinessProfile')
          .select('name, logo_url')
          .eq('user_id', tm.business_user_id)
          .single();
        if (biz) {
          identities.push({
            type: 'business',
            id: tm.business_user_id,
            name: biz.name,
            role: tm.role_base,
            imageUrl: biz.logo_url || null,
          });
        }
      }
    }

    // 3) Home identities (only homes where user has active occupancy)
    const { data: occupancies } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id, role, role_base')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (occupancies) {
      const homeIds = occupancies.map(o => o.home_id);
      const { data: homes } = await supabaseAdmin
        .from('Home')
        .select('id, name, address, city, primary_photo_url')
        .in('id', homeIds);

      if (homes) {
        for (const home of homes) {
          const occ = occupancies.find(o => o.home_id === home.id);
          const roleBase = occ?.role_base || mapLegacyRole(occ?.role);
          identities.push({
            type: 'home',
            id: home.id,
            name: home.name || home.address || 'Home',
            role: roleBase,
            imageUrl: home.primary_photo_url || null,
          });
        }
      }
    }
  } catch (err) {
    logger.error('Error getting posting identities', { error: err.message, userId });
  }

  return identities;
}

/**
 * Validate whether a user can post to a given audience based on trust state.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.postAs       - 'personal' | 'business' | 'home'
 * @param {string} params.audience     - 'nearby' | 'followers' | 'connections' | 'network' | 'household' | 'neighborhood' | 'saved_place' | 'target_area'
 * @param {string} params.postType     - The post category
 * @param {string} params.trustLevel   - Computed trust state level
 * @param {string} [params.homeId]     - Home ID when postAs === 'home'
 * @param {string} [params.roleBase]   - Home role when postAs === 'home'
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canPostToAudience({ postAs, audience, postType, trustLevel, homeId, roleBase }) {
  if (postAs === 'persona') {
    if (audience === 'followers' || audience === 'public') return { allowed: true };
    return {
      allowed: false,
      reason: 'Beacon posts cannot be shared to local, household, nearby, or connection audiences.',
    };
  }

  // Rule A: General is banned from all local-public audiences
  const localPublicAudiences = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
  if (localPublicAudiences.includes(audience) && postType === 'general') {
    return {
      allowed: false,
      reason: 'General posts cannot be shared to local/public audiences. Please choose a specific category.',
    };
  }

  // Nearby physical-presence checks are enforced by canPostToPlace()
  // using fresh GPS proximity and trust level. Do not block here.

  // Home → Neighborhood requires Owner or Admin role
  if (postAs === 'home' && audience === 'neighborhood') {
    const allowedRoles = ['owner', 'admin'];
    if (!allowedRoles.includes(roleBase)) {
      return {
        allowed: false,
        reason: 'Only Home Owners and Admins can publish neighborhood posts as this Home.',
      };
    }
  }

  // Incoming residents can only post Questions and Recommendations to Nearby
  if (trustLevel === 'incoming_resident' && audience === 'nearby') {
    const allowedTypes = ['ask_local', 'recommendation'];
    if (!allowedTypes.includes(postType)) {
      return {
        allowed: false,
        reason: 'As an Incoming Resident, you can only post Questions and Recommendations to Nearby.',
      };
    }
  }

  // Business target area posts must be structured (no general)
  if (postAs === 'business' && audience === 'target_area') {
    const allowedBusinessTypes = ['event', 'deal', 'recommendation', 'announcement', 'service_offer'];
    if (!allowedBusinessTypes.includes(postType)) {
      return {
        allowed: false,
        reason: 'Business posts to Target Area must use a structured category (Events, Deals, Recommendations, etc.).',
      };
    }
  }

  return { allowed: true };
}

/**
 * v1.1: Check if a user is eligible to post to the Place feed surface.
 *
 * Eligible if:
 *   - Fresh GPS (gpsTimestamp ≤ 5 min ago) → visitor/resident
 *   - verified_resident trust level
 *   - verified_business trust level
 *
 * @param {object} params
 * @param {string} params.trustLevel   - Computed trust state level
 * @param {string} [params.gpsTimestamp] - ISO timestamp of last GPS fix
 * @returns {{ eligible: boolean, readOnly: boolean, reason?: string }}
 */
function canPostToPlace({ trustLevel, gpsTimestamp, gpsLatitude, gpsLongitude, targetLatitude, targetLongitude }) {
  // Verified residents and businesses can always post
  if (trustLevel === 'verified_resident' || trustLevel === 'verified_business') {
    return { eligible: true, readOnly: false };
  }

  // Check GPS freshness (≤ 5 minutes)
  if (gpsTimestamp && gpsLatitude != null && gpsLongitude != null && targetLatitude != null && targetLongitude != null) {
    const ageMs = Date.now() - new Date(gpsTimestamp).getTime();
    const fiveMinMs = 5 * 60 * 1000;
    const distanceMeters = haversineMeters(
      Number(gpsLatitude),
      Number(gpsLongitude),
      Number(targetLatitude),
      Number(targetLongitude)
    );
    if (ageMs <= fiveMinMs && distanceMeters <= GPS_PROXIMITY_METERS) {
      return { eligible: true, readOnly: false };
    }
  }

  // Incoming residents can view but not post
  if (trustLevel === 'incoming_resident') {
    return {
      eligible: false,
      readOnly: true,
      reason: 'As an incoming resident, you can read the Place feed but cannot post yet. Complete your home verification to unlock posting.',
    };
  }

  // Remote viewers are read-only
  return {
    eligible: false,
    readOnly: true,
    reason: 'You need to be physically present (fresh GPS) or be a verified resident/business to post to the Place feed.',
  };
}

/**
 * Check if a remote viewer can comment on a Nearby post.
 * Remote viewers are read-only on Nearby posts.
 *
 * @param {string} trustLevel
 * @param {string} postAudience
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canCommentOnPost(trustLevel, postAudience) {
  const localAudiences = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
  if (trustLevel === 'remote_viewer' && localAudiences.includes(postAudience)) {
    return {
      allowed: false,
      reason: "You're viewing this place remotely. Commenting is limited to locals and visitors.",
    };
  }
  return { allowed: true };
}

// ─── Haversine helper ────────────────────────────────────────

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  computeTrustState,
  getPostingIdentities,
  canPostToAudience,
  canPostToPlace,
  canCommentOnPost,
  haversineMeters,
  NEARBY_RADIUS_METERS,
};
