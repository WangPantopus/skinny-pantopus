// The one-time "I'm 18 or older" confirmation (User.adult_attested_at), shared by Pulse
// (POST /api/pulse/adult-attestation, contract §2.10) and Moments (POST /api/moments/adult-confirm):
// one confirmation covers both. A date of birth on file that says the person is younger wins.

const supabaseAdmin = require('../config/supabaseAdmin');

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

function underAge(user) {
  return Boolean(user?.date_of_birth) && ageFrom(user.date_of_birth) < 18;
}

/**
 * Where the person stands: { found, attestedAt, ineligible }. `ineligible` when a date of birth on file says they're
 * under 18 (then attestedAt is ignored). Throws on a failed read.
 */
async function adultStatus(userId) {
  const { data: user, error } = await supabaseAdmin
    .from('User')
    .select('adult_attested_at, date_of_birth')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!user) return { found: false, attestedAt: null, ineligible: false };
  return { found: true, attestedAt: user.adult_attested_at || null, ineligible: underAge(user) };
}

/**
 * Records the confirmation once and returns { attestedAt } (the first time, when confirming again), { ineligible }
 * when the date of birth on file says under 18, or { found: false } for a missing account. Throws on a failed write.
 */
async function confirmAdult(userId) {
  const status = await adultStatus(userId);
  if (!status.found) return { found: false };
  if (status.ineligible) return { found: true, ineligible: true };
  if (status.attestedAt) return { found: true, attestedAt: status.attestedAt };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('User')
    .update({ adult_attested_at: new Date().toISOString() })
    .eq('id', userId)
    .is('adult_attested_at', null)
    .select('adult_attested_at')
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return { found: true, attestedAt: updated.adult_attested_at };

  // Another tap set it a moment ago; answer with the time that one kept.
  const { data: again, error: againError } = await supabaseAdmin
    .from('User').select('adult_attested_at').eq('id', userId).maybeSingle();
  if (againError || !again?.adult_attested_at) throw againError || new Error('attestation not saved');
  return { found: true, attestedAt: again.adult_attested_at };
}

module.exports = { ageFrom, adultStatus, confirmAdult };
