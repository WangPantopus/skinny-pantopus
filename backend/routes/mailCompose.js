// ============================================================
// MAIL COMPOSE ENDPOINTS
// Backend routes for the four-moment compose flow.
// Mounted at /api/mailbox/compose in app.js.
// ============================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

// ─── Helpers ───────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOME_ADDRESS_VERIFICATION_REQUIRED_CODE = 'HOME_ADDRESS_VERIFICATION_REQUIRED';
const HOME_ADDRESS_VERIFICATION_REQUIRED_MESSAGE =
  'Verify your home address before sending mail. Open Homes and finish address verification, then try sending again.';

/**
 * Escape special characters for PostgREST ILIKE patterns.
 * Prevents filter injection via commas, dots, parens in user input.
 */
function escapeIlike(str) {
  // Escape PostgREST special chars: backslash, percent, underscore
  // Also escape commas and dots which are PostgREST filter syntax
  return str
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '\\,')
    .replace(/\./g, '\\.');
}

/**
 * Get the sender's active home IDs (via HomeOccupancy + Home ownership).
 */
async function getSenderHomeIds(userId) {
  const homeIdSet = new Set();

  const [occupancyRes, ownerRes] = await Promise.allSettled([
    supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabaseAdmin
      .from('Home')
      .select('id')
      .eq('owner_id', userId),
  ]);

  if (occupancyRes.status === 'fulfilled') {
    for (const row of occupancyRes.value?.data || []) {
      if (row?.home_id) homeIdSet.add(row.home_id);
    }
  }
  if (ownerRes.status === 'fulfilled') {
    for (const row of ownerRes.value?.data || []) {
      if (row?.id) homeIdSet.add(row.id);
    }
  }

  return Array.from(homeIdSet);
}

async function hasVerifiedSenderHome(userId) {
  const [occupancyRes, ownerRes] = await Promise.allSettled([
    supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('verification_status', 'verified')
      .limit(1),
    supabaseAdmin
      .from('HomeOwner')
      .select('home_id')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .limit(1),
  ]);

  const verifiedOccupancies =
    occupancyRes.status === 'fulfilled' ? occupancyRes.value?.data || [] : [];
  const verifiedOwnerRows =
    ownerRes.status === 'fulfilled' ? ownerRes.value?.data || [] : [];

  return verifiedOccupancies.length > 0 || verifiedOwnerRows.length > 0;
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

    // --- Priority 1: Household members (if homeId provided) ---
    if (homeId) {
      // Fetch home data once, outside the member loop
      const [householdRes, homeRes] = await Promise.all([
        supabaseAdmin
          .from('HomeOccupancy')
          .select('user_id, role, User!inner(id, name, username, verified, profile_picture_url)')
          .eq('home_id', homeId)
          .eq('is_active', true),
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
        for (const row of householdRows) {
          const user = row.User;
          if (!user || user.id === senderId) continue;
          const nameMatch = (user.name || '').toLowerCase().includes(query.toLowerCase());
          const usernameMatch = (user.username || '').toLowerCase().includes(query.toLowerCase());
          if (!nameMatch && !usernameMatch) continue;

          seenUserIds.add(user.id);
          results.push(buildRecipientResult(user, homeId, homeAddress, homeMediaUrl, 0));
        }
      }
    }

    // --- Priority 2: Connected users (accepted Relationships) ---
    const connectionIds = await getConnectionUserIds(senderId);

    if (connectionIds.size > 0) {
      const { data: connectedUsers } = await supabaseAdmin
        .from('User')
        .select('id, name, username, verified, profile_picture_url')
        .in('id', Array.from(connectionIds))
        .or(`name.ilike.${searchPattern},username.ilike.${searchPattern}`)
        .limit(10);

      if (connectedUsers) {
        // Batch-fetch home occupancies for all connected users at once
        const connUserIds = connectedUsers
          .filter((u) => !seenUserIds.has(u.id))
          .map((u) => u.id);

        let homesByUserId = {};
        if (connUserIds.length > 0) {
          const { data: occupancies } = await supabaseAdmin
            .from('HomeOccupancy')
            .select('user_id, home_id, Home!inner(id, address, city, state, primary_photo_url)')
            .in('user_id', connUserIds)
            .eq('is_active', true);

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
          const homeMediaUrl = userHome
            ? await getHomeMediaUrl(userHome.id, userHome.primary_photo_url)
            : null;
          const homeAddress = userHome
            ? `${userHome.address}, ${userHome.city}, ${userHome.state}`
            : null;

          results.push(buildRecipientResult(user, userHome?.id, homeAddress, homeMediaUrl, 1));
        }
      }
    }

    // --- Priority 3: General user search ---
    if (results.length < 10) {
      const remaining = 10 - results.length;
      const excludeIds = [senderId, ...seenUserIds];

      const { data: generalUsers } = await supabaseAdmin
        .from('User')
        .select('id, name, username, verified, profile_picture_url')
        .or(`name.ilike.${searchPattern},username.ilike.${searchPattern}`)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(remaining);

      if (generalUsers) {
        // Batch-fetch home occupancies
        const genUserIds = generalUsers
          .filter((u) => !seenUserIds.has(u.id))
          .map((u) => u.id);

        let homesByUserId = {};
        if (genUserIds.length > 0) {
          const { data: occupancies } = await supabaseAdmin
            .from('HomeOccupancy')
            .select('user_id, home_id, Home!inner(id, address, city, state, primary_photo_url)')
            .in('user_id', genUserIds)
            .eq('is_active', true);

          if (occupancies) {
            for (const occ of occupancies) {
              if (!homesByUserId[occ.user_id]) {
                homesByUserId[occ.user_id] = occ.Home;
              }
            }
          }
        }

        for (const user of generalUsers) {
          if (seenUserIds.has(user.id)) continue;
          seenUserIds.add(user.id);

          const userHome = homesByUserId[user.id] || null;
          const homeMediaUrl = userHome
            ? await getHomeMediaUrl(userHome.id, userHome.primary_photo_url)
            : null;
          const homeAddress = userHome
            ? `${userHome.address}, ${userHome.city}, ${userHome.state}`
            : null;

          results.push(buildRecipientResult(user, userHome?.id, homeAddress, homeMediaUrl, 2));
        }
      }
    }

    // Sort by rank, limit to 10
    results.sort((a, b) => a._rank - b._rank);
    const recipients = results.slice(0, 10).map(({ _rank, ...rest }) => rest);

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

    // Verify sender has access: occupant, owner, or connected to a resident
    const senderHomeIds = await getSenderHomeIds(senderId);
    const isOccupantOrOwner = senderHomeIds.includes(homeId);

    let hasAccess = isOccupantOrOwner;

    if (!hasAccess) {
      // Check if sender is connected to any resident of this home
      const connectionIds = await getConnectionUserIds(senderId);

      const { data: residents } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .eq('home_id', homeId)
        .eq('is_active', true);

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

    // Get active occupants with user details
    const { data: occupants } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id, role, User!inner(id, name, username)')
      .eq('home_id', homeId)
      .eq('is_active', true);

    const members = (occupants || []).map((o) => ({
      userId: o.User.id,
      name: o.User.name || o.User.username,
      role: o.role || 'member',
    }));

    const memberCount = members.length;

    // Get home media
    const homeMediaUrl = await getHomeMediaUrl(homeId, home.primary_photo_url);

    // Format address display
    const addressParts = [home.address, home.city, home.state].filter(Boolean);
    const addressDisplay = addressParts.join(', ');

    res.json({
      homeId: home.id,
      addressDisplay,
      memberCount,
      homeMediaUrl,
      privateDeliveryAvailable: memberCount > 1,
      members,
    });
  } catch (err) {
    logger.error('Home context error', { error: err.message, homeId: req.params.homeId, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch home context' });
  }
});

// ─── Escrow Validation Schemas ──────────────────────────────

const claimMailSchema = Joi.object({
  token: Joi.string().required(),
});

const withdrawMailSchema = Joi.object({});

// ─── Escrow Helpers ─────────────────────────────────────────

function timingSafeTokenMatch(stored, provided) {
  if (!stored || !provided) return false;
  const storedBuf = Buffer.from(stored, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (storedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, providedBuf);
}

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

// ─── Route 3: Escrow Claim Preview (PUBLIC) ─────────────────

/**
 * GET /api/mailbox/compose/claim/:mailId?token=...
 *
 * Public endpoint — returns a safe preview of escrowed mail
 * so a non-user recipient can view it before claiming.
 */
router.get('/claim/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;
    const token = req.query.token;

    if (!mailId || !UUID_RE.test(mailId)) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }
    if (!token) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, subject, content, type, mail_type, mail_extracted, attachments, created_at, escrow_status, escrow_claim_token, object_id')
      .eq('id', mailId)
      .single();

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    if (!timingSafeTokenMatch(mail.escrow_claim_token, token)) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    const statusErr = escrowStatusError(mail.escrow_status);
    if (statusErr) {
      return res.status(statusErr.code).json({ error: statusErr.error });
    }

    if (mail.escrow_status !== 'pending') {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    // Fetch sender info
    const { data: sender } = await supabaseAdmin
      .from('User')
      .select('name, username, verified')
      .eq('id', mail.sender_user_id)
      .single();

    // Get body content — if object_id exists, fetch from MailObject
    let body = mail.content || '';
    let stationeryTheme = null;
    let inkSelection = null;
    let voicePostscriptUri = null;
    let photoAttachments = [];
    let outcomeDescription = 'Just read';
    let mailType = mail.mail_type || mail.type || null;

    if (mail.object_id) {
      const { data: obj } = await supabaseAdmin
        .from('MailObject')
        .select('payload')
        .eq('id', mail.object_id)
        .single();

      if (obj?.payload) {
        body = obj.payload.body || obj.payload.content || body;
        stationeryTheme = obj.payload.stationeryTheme || null;
        inkSelection = obj.payload.inkSelection || null;
        voicePostscriptUri = obj.payload.voicePostscriptUri || null;
        photoAttachments = obj.payload.photoAttachments || [];
        if (obj.payload.outcomeDescription) outcomeDescription = obj.payload.outcomeDescription;
        if (obj.payload.mailType) mailType = obj.payload.mailType;
      }
    }

    // Extract from mail_extracted if available
    if (mail.mail_extracted) {
      const ext = mail.mail_extracted;
      if (ext.stationeryTheme) stationeryTheme = stationeryTheme || ext.stationeryTheme;
      if (ext.inkSelection) inkSelection = inkSelection || ext.inkSelection;
    }

    // Photo attachments fallback from mail.attachments
    if (photoAttachments.length === 0 && Array.isArray(mail.attachments)) {
      photoAttachments = mail.attachments.filter(
        (a) => typeof a === 'string' || (a && a.url)
      ).map((a) => (typeof a === 'string' ? a : a.url));
    }

    res.json({
      mail: {
        id: mail.id,
        senderName: sender?.name || sender?.username || 'Someone',
        senderVerified: sender?.verified || false,
        subject: mail.subject || null,
        body,
        stationeryTheme,
        inkSelection,
        voicePostscriptUri,
        photoAttachments,
        createdAt: mail.created_at,
        outcomeDescription,
        mailType,
      },
    });
  } catch (err) {
    logger.error('Escrow claim preview error', { error: err.message, mailId: req.params.mailId });
    res.status(500).json({ error: 'Failed to fetch mail' });
  }
});

// ─── Route 4: Escrow Claim (AUTH REQUIRED) ──────────────────

/**
 * POST /api/mailbox/compose/claim/:mailId
 *
 * Authenticated user claims escrowed mail, moving it into their mailbox.
 * Notifies the original sender.
 */
router.post('/claim/:mailId', verifyToken, validate(claimMailSchema), async (req, res) => {
  try {
    const { mailId } = req.params;
    const { token } = req.body;
    const claimantId = req.user.id;

    if (!mailId || !UUID_RE.test(mailId)) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    const { data: mail, error } = await supabaseAdmin
      .from('Mail')
      .select('id, sender_user_id, escrow_status, escrow_claim_token')
      .eq('id', mailId)
      .single();

    if (error || !mail) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    if (!timingSafeTokenMatch(mail.escrow_claim_token, token)) {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    const statusErr = escrowStatusError(mail.escrow_status);
    if (statusErr) {
      return res.status(statusErr.code).json({ error: statusErr.error });
    }

    if (mail.escrow_status !== 'pending') {
      return res.status(404).json({ error: 'Mail not found or invalid token' });
    }

    // Claim the mail
    const { error: updateError } = await supabaseAdmin
      .from('Mail')
      .update({
        escrow_status: 'claimed',
        recipient_user_id: claimantId,
        escrow_recipient_contact: null,
        escrow_claim_token: null,
        escrow_expires_at: null,
      })
      .eq('id', mailId)
      .eq('escrow_status', 'pending');

    if (updateError) {
      logger.error('Escrow claim update failed', { error: updateError.message, mailId, claimantId });
      return res.status(500).json({ error: 'Failed to claim mail' });
    }

    // Notify the original sender (non-blocking)
    (async () => {
      try {
        const { data: claimant } = await supabaseAdmin
          .from('User')
          .select('name, username')
          .eq('id', claimantId)
          .single();

        const recipientName = claimant?.name || claimant?.username || 'Someone';

        await notificationService.createNotification({
          userId: mail.sender_user_id,
          type: 'mail_claimed',
          title: `${recipientName} picked up your letter!`,
          body: 'Your escrowed mail has been claimed.',
          icon: '📬',
          link: `/app/mailbox/${mailId}`,
          metadata: { mail_id: mailId, claimant_id: claimantId },
        });
      } catch (notifErr) {
        logger.warn('Escrow claim notification failed (non-blocking)', { error: notifErr.message, mailId });
      }
    })();

    logger.info('Escrowed mail claimed', { mailId, claimantId, senderId: mail.sender_user_id });

    res.json({ success: true, message: 'Mail claimed successfully' });
  } catch (err) {
    logger.error('Escrow claim error', { error: err.message, mailId: req.params.mailId });
    res.status(500).json({ error: 'Failed to claim mail' });
  }
});

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
