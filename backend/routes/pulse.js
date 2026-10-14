// Pulse's own routes (docs/product/pulse-build/02-contract.md §2). The existing post routes stay in
// routes/posts.js; the composer checks, notes and moderation notices are routes/pulseSafety.js (PS).
const express = require('express');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');

const router = express.Router();

/** Whole years from a date of birth to today; NaN for a date that can't be read. A date of birth
 * ('2008-10-14') reads as UTC midnight, so both sides are compared as UTC calendar dates. */
function ageFrom(dateOfBirth) {
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return NaN;
  const today = new Date();
  const hadBirthday = today.getUTCMonth() > born.getUTCMonth()
    || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() >= born.getUTCDate());
  return today.getUTCFullYear() - born.getUTCFullYear() - (hadBirthday ? 0 : 1);
}

/**
 * POST /api/pulse/adult-attestation — the person confirms they're 18 or older, once (contract §2.10):
 * → { attested_at }. Confirming again returns the first time. A date of birth on file that says
 * they're younger wins (403 AGE_NOT_ELIGIBLE).
 */
router.post('/adult-attestation', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('adult_attested_at, date_of_birth')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Account not found' });

    if (user.date_of_birth && ageFrom(user.date_of_birth) < 18) {
      return res.status(403).json({ error: 'Posting in Pulse is for people 18 and older.', code: 'AGE_NOT_ELIGIBLE' });
    }
    if (user.adult_attested_at) return res.json({ attested_at: user.adult_attested_at });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('User')
      .update({ adult_attested_at: new Date().toISOString() })
      .eq('id', userId)
      .is('adult_attested_at', null)
      .select('adult_attested_at')
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return res.json({ attested_at: updated.adult_attested_at });

    // Another tap set it a moment ago; answer with the time that one kept.
    const { data: again, error: againError } = await supabaseAdmin
      .from('User').select('adult_attested_at').eq('id', userId).maybeSingle();
    if (againError || !again?.adult_attested_at) throw againError || new Error('attestation not saved');
    res.json({ attested_at: again.adult_attested_at });
  } catch (err) {
    logger.error('pulse.adult_attestation.error', { error: err.message, userId });
    res.status(500).json({ error: "Couldn't save that. Please try again." });
  }
});

module.exports = router;
