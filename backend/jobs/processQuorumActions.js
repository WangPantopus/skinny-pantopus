// ============================================================
// PROCESS QUORUM ACTIONS (owner votes)
//
// Owner votes settle on time even when nobody opens them. The votes
// and security pages settle a home's votes when someone reads them
// (processQuorumExpirations, routes/homeOwnership.js); this runs the
// same step hourly for every home with a vote due:
//   - an open vote past expires_at expires;
//   - a tier 1-2 change whose waiting period passed without a
//     rejection is approved and applied ("approves in 7 days unless
//     rejected");
//   - an approved change that isn't applied yet is tried again.
// Every state change there is a compare-and-set, so a page read,
// another run or a second process can't settle a vote twice. There is
// no actor: the audit rows it writes have none.
//
// Household removal votes (REMOVE_MEMBER, the residents' vote) are
// settled first, by their own SQL (homeRemovalVoteService.settleDue):
// a vote that passed waits 72 hours from opening so the person can
// contest, then removes them or goes to Pantopus review.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const PAGE_SIZE = 200;

/** Every home with a vote that `filter` selects, read in id order a page at a time. */
async function homesWithVotes(filter) {
  const homes = new Set();
  let cursor = null;
  for (;;) {
    let query = filter(supabaseAdmin.from('HomeQuorumAction').select('id, home_id'))
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw new Error(`Owner votes could not be read: ${error.message}`);
    for (const row of data || []) homes.add(row.home_id);
    if (!data || data.length < PAGE_SIZE) return homes;
    cursor = data[data.length - 1].id;
  }
}

async function processQuorumActions() {
  // A failure here never holds up the owner votes below; the next run tries again.
  const household = await require('../services/homeRemovalVoteService').settleDue().catch((err) => {
    logger.warn('[processQuorumActions] Household votes could not be settled', { error: err.message });
    return { due: 0, settled: 0 };
  });
  if (household.settled) logger.info('[processQuorumActions] Settled household votes', household);

  const now = new Date().toISOString();
  const homes = new Set([
    // Open votes past their deadline or their waiting period.
    ...await homesWithVotes(query => query.neq('action_type', 'REMOVE_MEMBER').in('state', ['proposed', 'collecting_votes'])
      .or(`expires_at.lte."${now}",passive_approval_at.lte."${now}"`)),
    // Approved changes not applied yet. An applied change keeps state 'approved'.
    ...await homesWithVotes(query => query.neq('action_type', 'REMOVE_MEMBER').eq('state', 'approved')
      .in('metadata->execution->>status', ['pending', 'applying'])),
  ]);
  if (!homes.size) return { homes: 0, household };

  const { processQuorumExpirations } = require('../routes/homeOwnership');
  // It logs and leaves a vote as it is when a step fails; the next run tries again.
  for (const homeId of homes) await processQuorumExpirations(homeId, null);
  logger.info('[processQuorumActions] Settled due owner votes', { homes: homes.size });
  return { homes: homes.size, household };
}

module.exports = processQuorumActions;
