/**
 * The ballot guide (Mail tab, SRV-9): a household letter from Pantopus to each Home someone has proven they live at,
 * four weeks before each election in backend/data/ballot/elections.json (or on the first run after that, until the day
 * before), with that state's reviewed dates and how voting works there, or its official pages where Pantopus doesn't
 * have the dates yet. Once per Home and election. The words come from the reviewed data (services/ballot), never the
 * AI, and follow the Ballot card's global switch (ballot_p0) as well as the mailbox's.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { isLaunchFeatureEnabled } = require('../utils/featureFlags');
const featureFlagService = require('../services/featureFlagService');
const referenceData = require('../services/ballot/referenceData');
const { composeSummary } = require('../services/ballot/summary');
const pantopusLetters = require('../services/pantopusLetters');
const { MAIL_PROVEN_SOURCES } = require('../utils/homeMailAccess');

const GUIDE_DAYS = 28;
const PAGE = 500;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A household letter follows the Ballot card's global switch: it reads the same for everyone at the Home.
async function ballotOnForEveryone() {
  try {
    const flag = await featureFlagService.getFlag('ballot_p0');
    return Boolean(flag && flag.enabled_globally);
  } catch (err) {
    logger.warn('[BallotGuide] ballot flag read failed', { error: err.message });
    return false;
  }
}

// Homes someone has proven they live at (the Homes whose mail a resident can open).
async function provenHomeIds() {
  const ids = new Set();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from('HomeOccupancy').select('home_id')
      .eq('is_active', true).eq('verification_status', 'verified').in('verification_source', MAIL_PROVEN_SOURCES)
      .order('home_id').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data || []) ids.add(row.home_id);
    if (!data || data.length < PAGE) break;
  }
  return [...ids];
}

function dayText(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${referenceData.monthDay(iso)}`;
}

// The guide's words for one Home, from its state's summary (services/ballot/summary composeSummary).
function guide(home, s) {
  const address = [home.address, home.address2].filter(Boolean).join(', ');
  const when = `The ${s.name} is ${dayText(s.date)}.`;
  const links = (s.official_links || []).map((l) => `• ${l.label}: ${l.url}`);
  const registration = (s.deadlines || []).find((d) => d.key === 'register_online_mail') || null;
  const returnBy = (s.deadlines || []).find((d) => d.key === 'return_by') || null;
  const supported = s.coverage === 'supported';
  const content = [
    address ? `To everyone at ${address},` : 'Hello,',
    '',
    when,
    '',
    ...(supported && s.how_it_works ? [s.how_it_works, ''] : []),
    ...(supported && s.deadlines?.length ? ['Dates for this address:',
      ...s.deadlines.map((d) => `• ${d.teaser_lead || `${d.label}: ${d.month_day}.`}${d.detail ? ` ${d.detail}` : ''}`), ''] : []),
    ...(s.mover_prompt?.text ? [s.mover_prompt.text, ''] : []),
    ...(!supported && s.note ? [s.note, ''] : []),
    ...(links.length ? ['Official pages:', ...links, ''] : []),
    // A links-only state's pages name their own office.
    ...(supported && s.source_line ? [`These dates come from the ${s.source_line}.`, ''] : []),
    'Your Pantopus carrier',
  ].join('\n');
  const summary = [when, registration?.teaser_lead || (registration ? `Register by ${registration.month_day}.` : null),
    returnBy?.teaser_lead || null].filter(Boolean).join(' ');
  return {
    subject: `Your ballot guide: ${s.name}`,
    content,
    summary: supported ? summary : `${when} Your state's election office has the deadlines.`,
    key_facts: [
      { label: 'Election day', value: dayText(s.date) },
      ...(registration ? [{ label: 'Register by', value: registration.month_day }] : []),
      ...(returnBy ? [{ label: 'Return by', value: returnBy.teaser_lead ? returnBy.teaser_lead.replace(/^Return by\s*/, '').replace(/\.$/, '') : returnBy.month_day }] : []),
    ],
  };
}

/**
 * Write the guides due now. `homeIds` limits the run to those Homes (a check on one household); answers
 * { homes, sent }.
 */
async function ballotGuideLetters({ now = new Date(), homeIds = null } = {}) {
  if (!isLaunchFeatureEnabled('mailbox') || !referenceData.isAvailable() || !(await ballotOnForEveryone())) {
    return { homes: 0, sent: 0 };
  }
  const ids = homeIds || await provenHomeIds();
  let sent = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: homes, error } = await supabaseAdmin.from('Home')
      .select('id, state, address, address2, move_in_date').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const home of homes || []) {
      const current = referenceData.currentElection(home.state, { now });
      if (!current || current.phase !== 'in_season' || current.daysUntil > GUIDE_DAYS) continue;
      const s = composeSummary({ stateValue: home.state, moveInDate: home.move_in_date || null, now });
      if (!s || s.phase !== 'in_season') continue;
      const result = await pantopusLetters.sendSafe(`ballot:${s.election_id}:${home.id}`, {
        recipient_home_id: home.id,
        drawer: 'home',
        privacy: 'shared_household',
        delivery_visibility: 'home_members',
        ...guide(home, s),
      });
      if (result?.created) sent += 1;
    }
  }
  logger.info('[BallotGuide] Complete', { homes: ids.length, sent });
  return { homes: ids.length, sent };
}

module.exports = ballotGuideLetters;
module.exports.GUIDE_DAYS = GUIDE_DAYS;
