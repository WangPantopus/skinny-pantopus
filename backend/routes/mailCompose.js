// ============================================================
// MAIL COMPOSE ENDPOINTS
// Backend routes for the four-moment compose flow.
// Mounted at /api/mailbox/compose in app.js.
// ============================================================

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { escapeIlike } = require('../utils/escapeIlike');
// Who lives in a Home, for compose, is the household mail rule's: an active occupancy in a trusted
// verification state. A pending claim (anyone can file one on any Home) is not a household member.
const { getAccessibleHomeIds, MAIL_TRUSTED_VERIFICATION_STATUSES } = require('../utils/homeMailAccess');
const { UNPROVEN_SOURCES } = require('../utils/homeAccessPolicy');
const { unpublishedBusinessIds, isSearchable, isScopedBlocked, isConnected } = require('../utils/visibilityPolicy');
const { localProfileVisibilityFor, localDisplayNames } = require('../utils/identityProfiles');
const { hasBlocked } = require('../services/blockService');
// Other people are named the way neighbors see them: by their Local Profile (a business by the business).
const { loadChatPeople } = require('../services/chatPeople');

// ─── Helpers ───────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOME_ADDRESS_VERIFICATION_REQUIRED_CODE = 'HOME_ADDRESS_VERIFICATION_REQUIRED';
const HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE =
  'Verify your home address before sending mail. Open Homes and finish address verification, then try sending again.';

async function hasVerifiedSenderHome(userId) {
  const [occupancyRes, ownerRes] = await Promise.allSettled([
    supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id,is_active,verification_status,verification_source')
      .eq('user_id', userId),
    supabaseAdmin
      .from('HomeOwner')
      .select('home_id')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified'),
  ]);

  // A consented co-owner can have household-only provenance too. Check that
  // same Home before using the legacy owner fallback; another address-proven
  // Home still qualifies. Failed provenance reads must not become "no row".
  if (occupancyRes.status !== 'fulfilled' || occupancyRes.value?.error
    || !Array.isArray(occupancyRes.value?.data)
    || occupancyRes.value.data.some(row => !row || typeof row.home_id !== 'string')) return false;
  const occupancies = occupancyRes.value.data;
  const householdHomes = new Set(occupancies
    .filter(row => UNPROVEN_SOURCES.has(row.verification_source)).map(row => row.home_id));
  const verifiedOwnerRows = ownerRes.status === 'fulfilled' && !ownerRes.value?.error
    && Array.isArray(ownerRes.value?.data) ? ownerRes.value.data : [];
  if (occupancies.some(row => row.is_active === true && row.verification_status === 'verified'
    && !UNPROVEN_SOURCES.has(row.verification_source))) return true;
  for (const row of verifiedOwnerRows) {
    if (!row || typeof row.home_id !== 'string' || householdHomes.has(row.home_id)) continue;
    // The collection can be truncated by PostgREST's max_rows. Only an exact
    // Home/user lookup can distinguish no occupancy from an omitted row.
    try {
      const result = await supabaseAdmin.from('HomeOccupancy').select('home_id,verification_source')
        .eq('user_id', userId).eq('home_id', row.home_id).maybeSingle();
      if (!result || result.error || (result.data !== null
        && (!result.data || Array.isArray(result.data) || result.data.home_id !== row.home_id))) return false;
      if (result.data === null || !UNPROVEN_SOURCES.has(result.data.verification_source)) return true;
    } catch (_) { return false; }
  }
  return false;
}

/**
 * Get the primary home media URL for a home.
 * Tries Home.primary_photo_url first, then falls back to HomeMedia exterior.
 */
async function getHomeMediaUrl(homeId, primaryPhotoUrl) {
  if (primaryPhotoUrl) return primaryPhotoUrl;

  const { data } = await supabaseAdmin
    .from('HomeMedia')
    .select('file_id, File!inner(file_url)')
    .eq('home_id', homeId)
    .eq('media_category', 'exterior')
    .order('is_primary', { ascending: false })
    .order('display_order', { ascending: true })
    .limit(1);

  if (data && data.length > 0 && data[0].File) {
    return data[0].File.file_url || null;
  }
  return null;
}

/**
 * Get accepted connection user IDs for a sender.
 */
async function getConnectionUserIds(userId) {
  const { data } = await supabaseAdmin
    .from('Relationship')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (!data) return new Set();

  const ids = new Set();
  for (const row of data) {
    if (row.requester_id === userId) {
      ids.add(row.addressee_id);
    } else {
      ids.add(row.requester_id);
    }
  }
  return ids;
}

/**
 * Whether a stranger's search finds this account, by the rules /api/users/search applies
 * (canDiscoverLocalProfileForUserSearch in routes/users.js): no personal or scoped block, the
 * account's and Local Profile's search visibility, and a profile that isn't private (or, when
 * it is for connections, a connection).
 */
async function isFindableBy(senderId, user, localProfile) {
  if (await hasBlocked(user.id, senderId)) return false;
  if (!(await isSearchable(senderId, user.id))) return false;
  if (await isScopedBlocked(senderId, user.id, 'search_only')) return false;
  const searchVisibility = localProfile?.search_visibility || 'everyone';
  const profileVisibility = await localProfileVisibilityFor(localProfile || { user_id: user.id }, senderId, user);
  if (searchVisibility === 'nobody' || profileVisibility === 'private') return false;
  if (searchVisibility === 'mutuals' || ['connections', 'followers'].includes(profileVisibility)) {
    return isConnected(senderId, user.id);
  }
  return true;
}

/**
 * The accounts a search finds by name outside the sender's household, by the rule GET /api/users/search follows: a
 * person by the name and handle on their Local Profile (what neighbors see), and by their account's name or username
 * only when they let people find them by name (UserPrivacySettings.findable_by_name). A business, or someone with no
 * Local Profile, goes by its account everywhere, so the account's name and username find it. `within` limits the
 * search to those accounts and `exclude` leaves accounts out. Throws on a read error.
 *
 * @returns {Promise<string[]>} account ids, at most `limit` of each kind of match
 */
async function idsFoundByName(searchPattern, { within = null, exclude = [], limit }) {
  const scope = (query, column) => {
    const scoped = within ? query.in(column, within) : query;
    return (exclude.length ? scoped.not(column, 'in', `(${exclude.join(',')})`) : scoped).limit(limit);
  };
  const [profiles, accounts] = await Promise.all([
    scope(supabaseAdmin.from('LocalProfile').select('user_id')
      .or(`display_name.ilike.${searchPattern},handle.ilike.${searchPattern}`), 'user_id'),
    scope(supabaseAdmin.from('User').select('id, account_type')
      .or(`name.ilike.${searchPattern},username.ilike.${searchPattern}`), 'id'),
  ]);
  if (profiles.error) throw profiles.error;
  if (accounts.error) throw accounts.error;
  const found = new Set((profiles.data || []).map((row) => String(row.user_id)));
  const byAccount = (accounts.data || []).filter((user) => !found.has(String(user.id)));
  const people = byAccount.filter((user) => user.account_type !== 'business').map((user) => user.id);
  let withProfile = new Set();
  let findableByName = new Set();
  if (people.length) {
    const [profileRows, privacyRows] = await Promise.all([
      supabaseAdmin.from('LocalProfile').select('user_id').in('user_id', people),
      supabaseAdmin.from('UserPrivacySettings').select('user_id').in('user_id', people).eq('findable_by_name', true),
    ]);
    if (profileRows.error) throw profileRows.error;
    if (privacyRows.error) throw privacyRows.error;
    withProfile = new Set((profileRows.data || []).map((row) => String(row.user_id)));
    findableByName = new Set((privacyRows.data || []).map((row) => String(row.user_id)));
  }
  for (const user of byAccount) {
    const id = String(user.id);
    if (user.account_type === 'business' || !withProfile.has(id) || findableByName.has(id)) found.add(id);
  }
  return [...found];
}

/**
 * Build a recipient result object from a user row and home data.
 */
function buildRecipientResult(user, homeId, homeAddress, homeMediaUrl, rank) {
  return {
    userId: user.id,
    name: user.name || user.username,
    username: user.username,
    homeId: homeId || null,
    homeAddress: homeAddress || null,
    isVerified: user.verified || false,
    homeMediaUrl: homeMediaUrl || null,
    isOnPantopus: true,
    _rank: rank,
  };
}

// ─── Route 1: Recipient Search ─────────────────────────────

/**
 * GET /api/mailbox/compose/recipients?q=...&homeId=...
 *
 * Search for mail recipients. Returns household members (if homeId given),
 * connections, and nearby users — sorted by relevance.
 *
 * A Home's members and address are the household's: only someone the household
 * mail rule admits to that Home gets its member block, and a match found by the
 * general search carries no Home (home-context refuses it anyway).
 */
router.get('/recipients', verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const query = (req.query.q || '').trim();
    const homeId = req.query.homeId || null;

    if (query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
    }

    if (homeId && !UUID_RE.test(homeId)) {
      return res.status(400).json({ error: 'Invalid homeId format.' });
    }

    const escapedQuery = escapeIlike(query);
    const searchPattern = `%${escapedQuery}%`;

    const results = [];
    const seenUserIds = new Set();

    // --- Priority 1: Household members (if homeId provided and the sender belongs to it) ---
    const senderHouseholds = homeId ? await getAccessibleHomeIds(senderId) : [];
    if (homeId && senderHouseholds.includes(homeId.toLowerCase())) {
      // Fetch home data once, outside the member loop
      const [householdRes, homeRes] = await Promise.all([
        supabaseAdmin
          .from('HomeOccupancy')
          // Name the user_id FK: HomeOccupancy also references User through
          // added_by_user_id, and an unqualified embed fails as ambiguous.
          .select('user_id, role, User!HomeOccupancy_user_id_fkey!inner(id, name, username, verified, profile_picture_url)')
          .eq('home_id', homeId)
          .eq('is_active', true)
          .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES),
        supabaseAdmin
          .from('Home')
          .select('id, address, city, state, primary_photo_url')
          .eq('id', homeId)
          .single(),
      ]);

      const householdRows = householdRes.data;
      const home = homeRes.data;
      let homeMediaUrl = null;

      if (home) {
        homeMediaUrl = await getHomeMediaUrl(homeId, home.primary_photo_url);
      }

      const homeAddress = home ? `${home.address}, ${home.city}, ${home.state}` : null;

      if (householdRows) {
        // A housemate is found by the name and handle they show (their Local Profile) and, since the household's
        // mail comes addressed to them by name, by their account's name and username too.
        const housemates = await loadChatPeople(householdRows.map((row) => row.User?.id));
        const wanted = query.toLowerCase();
        for (const row of householdRows) {
          const user = row.User;
          if (!user || user.id === senderId) continue;
          const person = housemates.get(String(user.id));
          const names = [user.name, user.username, person?.displayName, person?.handle];
          if (!names.some((name) => (name || '').toLowerCase().includes(wanted))) continue;

          seenUserIds.add(user.id);
          results.push(buildRecipientResult(user, homeId, homeAddress, homeMediaUrl, 0));
        }
      }
    }

    // --- Priority 2: Connected users (accepted Relationships) ---
    const connectionIds = await getConnectionUserIds(senderId);

    if (connectionIds.size > 0) {
      const connectionMatches = await idsFoundByName(searchPattern, { within: Array.from(connectionIds), limit: 10 });
      const { data: connectedUsers } = connectionMatches.length
        ? await supabaseAdmin
          .from('User')
          .select('id, name, username, verified, profile_picture_url')
          .in('id', connectionMatches)
        : { data: [] };

      if (connectedUsers) {
        // Batch-fetch home occupancies for all connected users at once
        const connUserIds = connectedUsers
          .filter((u) => !seenUserIds.has(u.id))
          .map((u) => u.id);

        let homesByUserId = {};
        if (connUserIds.length > 0) {
          // A connection is outside the household: City/State only, no street or photo
          // (docs/location-privacy-matrix.md, Homes). The homeId addresses the mail.
          const { data: occupancies } = await supabaseAdmin
            .from('HomeOccupancy')
            .select('user_id, home_id, Home!inner(id, city, state)')
            .in('user_id', connUserIds)
            .eq('is_active', true)
            .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES);

          if (occupancies) {
            for (const occ of occupancies) {
              // Take the first home per user
              if (!homesByUserId[occ.user_id]) {
                homesByUserId[occ.user_id] = occ.Home;
              }
            }
          }
        }

        for (const user of connectedUsers) {
          if (seenUserIds.has(user.id)) continue;
          seenUserIds.add(user.id);

          const userHome = homesByUserId[user.id] || null;
          const homeAddress = userHome ? [userHome.city, userHome.state].filter(Boolean).join(', ') || null : null;

          results.push(buildRecipientResult(user, userHome?.id, homeAddress, null, 1));
        }
      }
    }

    // --- Priority 3: General user search ---
    if (results.length < 10) {
      const remaining = 10 - results.length;
      const excludeIds = [senderId, ...seenUserIds];

      const generalMatches = await idsFoundByName(searchPattern, { exclude: excludeIds, limit: remaining });
      const { data: generalUsers } = generalMatches.length
        ? await supabaseAdmin
          .from('User')
          .select('id, name, username, verified, profile_picture_url, profile_visibility')
          .in('id', generalMatches)
        : { data: [] };

      if (generalUsers) {
        const generalUserIds = generalUsers.map((user) => user.id);
        const unpublishedBusinesses = await unpublishedBusinessIds(generalUserIds);
        const { data: localProfiles, error: localProfileError } = generalUserIds.length
          ? await supabaseAdmin.from('LocalProfile').select('user_id, search_visibility, profile_visibility').in('user_id', generalUserIds)
          : { data: [], error: null };
        if (localProfileError) throw localProfileError;
        const localProfileByUserId = new Map((localProfiles || []).map((profile) => [profile.user_id, profile]));
        // Someone who is neither a housemate nor a connection is matched by name
        // only: their Home, address and photo stay private.
        for (const user of generalUsers) {
          if (results.length >= 10) break;
          if (seenUserIds.has(user.id)) continue;
          if (unpublishedBusinesses.has(String(user.id))) continue;
          if (!(await isFindableBy(senderId, user, localProfileByUserId.get(user.id)))) continue;
          seenUserIds.add(user.id);
          results.push(buildRecipientResult(user, null, null, null, 2));
        }
      }
    }

    // Sort by rank, limit to 10
    results.sort((a, b) => a._rank - b._rank);
    // Each person by their Local Profile's name and handle, as neighbors see them (a business, or anyone without one,
    // by the account); someone who can't be read keeps the account row's name.
    const shown = results.slice(0, 10);
    const people = await loadChatPeople(shown.map((result) => result.userId));
    const recipients = shown.map(({ _rank, ...rest }) => {
      const person = people.get(String(rest.userId));
      if (!person) return rest;
      const { displayName, handle } = person;
      return { ...rest, name: displayName, username: handle || null };
    });

    res.json({ recipients });
  } catch (err) {
    logger.error('Recipient search error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to search recipients' });
  }
});

// ─── Route 2: Home Context ─────────────────────────────────

/**
 * GET /api/mailbox/compose/home-context/:homeId
 *
 * Returns home context for the compose destination step.
 * Verifies the sender has access via HomeOccupancy or Relationship.
 */
router.get('/home-context/:homeId', verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { homeId } = req.params;

    if (!UUID_RE.test(homeId)) {
      return res.status(400).json({ error: 'Invalid homeId format.' });
    }

    // Fetch the home
    const { data: home, error: homeError } = await supabaseAdmin
      .from('Home')
      .select('id, address, city, state, zipcode, owner_id, primary_photo_url')
      .eq('id', homeId)
      .single();

    if (homeError || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const senderHasVerifiedHome = await hasVerifiedSenderHome(senderId);
    if (!senderHasVerifiedHome) {
      return res.status(403).json({
        error: HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE,
        message: HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE,
        code: HOME_ADDRESS_VERIFICATION_REQUIRED_CODE,
      });
    }

    // Verify sender has access: a member the household mail rule admits (a pending
    // claim is not membership), or connected to a resident
    const isOccupantOrOwner = (await getAccessibleHomeIds(senderId)).includes(homeId.toLowerCase());

    let hasAccess = isOccupantOrOwner;

    if (!hasAccess) {
      // Check if sender is connected to any resident of this home
      const connectionIds = await getConnectionUserIds(senderId);

      const { data: residents } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .eq('home_id', homeId)
        .eq('is_active', true)
        .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES);

      if (residents) {
        for (const r of residents) {
          if (connectionIds.has(r.user_id)) {
            hasAccess = true;
            break;
          }
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'You do not have access to this home.',
        code: 'MAILBOX_HOME_CONTEXT_FORBIDDEN',
      });
    }

    // Get active occupants with user details. The embed names the user_id FK
    // (HomeOccupancy also references User through added_by_user_id).
    const { data: occupants } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id, role, User!HomeOccupancy_user_id_fkey!inner(id, name, username)')
      .eq('home_id', homeId)
      .eq('is_active', true)
      .in('verification_status', MAIL_TRUSTED_VERIFICATION_STATUSES);

    // Members by the name they show their household (their Local Profile's); no name, or a failed read, reads
    // "Household member", as on the Home page (services/homeDetailService.js).
    const names = await localDisplayNames((occupants || []).map((o) => o.User.id)).catch(() => new Map());
    const members = (occupants || []).map((o) => ({
      userId: o.User.id,
      name: names.get(String(o.User.id)) || 'Household member',
      role: o.role || 'member',
    }));

    const memberCount = members.length;

    // A connection is outside the household: City/State only, and no photo or member list
    // (docs/location-privacy-matrix.md, Homes). Household members see the full context.
    const homeMediaUrl = isOccupantOrOwner ? await getHomeMediaUrl(homeId, home.primary_photo_url) : null;
    const addressParts = isOccupantOrOwner ? [home.address, home.city, home.state] : [home.city, home.state];
    const addressDisplay = addressParts.filter(Boolean).join(', ');

    res.json({
      homeId: home.id,
      addressDisplay,
      memberCount,
      homeMediaUrl,
      privateDeliveryAvailable: memberCount > 1,
      members: isOccupantOrOwner ? members : [],
    });
  } catch (err) {
    logger.error('Home context error', { error: err.message, homeId: req.params.homeId, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch home context' });
  }
});

// ─── Escrow Helpers ─────────────────────────────────────────
// A letter for someone not on Pantopus is previewed and claimed at /api/mailbox/claim/:mailId (routes/mailbox.js).

function escrowStatusError(status) {
  switch (status) {
    case 'expired':
      return { code: 410, error: 'This mail has expired' };
    case 'claimed':
      return { code: 410, error: 'This mail has already been claimed' };
    case 'withdrawn':
      return { code: 410, error: 'This mail was withdrawn by the sender' };
    default:
      return null;
  }
}

// ─── Route 5: Escrow Withdraw (AUTH REQUIRED) ───────────────

/**
 * POST /api/mailbox/compose/withdraw/:mailId
 *
 * The original sender withdraws an escrowed mail before it's claimed.
 */
router.post('/withdraw/:mailId', verifyToken, async (req, res) => {
  try {
    const { mailId } = req.params;
    const senderId = req.user.id;

    if (!mailId || !UUID_RE.test(mailId)) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, escrow_status')
      .eq('id', mailId)
      .single();

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    if (mail.sender_user_id !== senderId) {
      return res.status(403).json({ error: 'You are not the sender of this mail' });
    }

    const statusErr = escrowStatusError(mail.escrow_status);
    if (statusErr) {
      return res.status(statusErr.code).json({ error: statusErr.error });
    }

    if (mail.escrow_status !== 'pending') {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('Mail')
      .update({ escrow_status: 'withdrawn' })
      .eq('id', mailId)
      .eq('sender_user_id', senderId)
      .eq('escrow_status', 'pending');

    if (updateError) {
      logger.error('Escrow withdraw update failed', { error: updateError.message, mailId, senderId });
      return res.status(500).json({ error: 'Failed to withdraw mail' });
    }

    logger.info('Escrowed mail withdrawn', { mailId, senderId });

    res.json({ success: true, message: 'Mail withdrawn' });
  } catch (err) {
    logger.error('Escrow withdraw error', { error: err.message, mailId: req.params.mailId });
    res.status(500).json({ error: 'Failed to withdraw mail' });
  }
});

module.exports = router;
