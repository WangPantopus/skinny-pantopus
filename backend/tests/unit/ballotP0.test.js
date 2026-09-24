/**
 * Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md).
 *
 *   1. The shipped reference data validates, and the validator rejects the
 *      mistakes it exists to catch.
 *   2. The summary is true on every day of the cycle: in season, ballot
 *      week, Election Day before and after 8 p.m., the week after, and
 *      nothing once the window closes. Unknown never reads as "none".
 *   3. States outside the pilot get the election date and an official
 *      link, never a count or a deadline.
 *   4. Governments come from the exact point with typed identities; a
 *      saved home is cached per home AND point, and a stale answer is
 *      never served past its limit.
 *   5. The Place section keeps its pre-Ballot behavior with the flag off.
 */

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const referenceData = require('../../services/ballot/referenceData');
const governments = require('../../services/ballot/governments');
const summary = require('../../services/ballot/summary');
const { readThrough } = require('../../services/placeSectionCache');
const featureFlagService = require('../../services/featureFlagService');
const placeSectionAdapters = require('../../services/placeSectionAdapters');
const { encodeGeohash } = require('../../utils/geohash');

const STATES = require('../../data/ballot/states.json');
const ELECTIONS = require('../../data/ballot/elections.json');

const at = (iso) => new Date(iso);
// Noon Pacific on the given day.
const pacificNoon = (day) => at(`${day}T19:00:00.000Z`);

const CAMAS_GOVERNMENTS = {
  items: [
    { level: 'federal', geoid: 'us', name: 'United States' },
    { level: 'state', geoid: '53', name: 'The state' },
    { level: 'county', geoid: '53011', name: 'Clark County' },
    { level: 'school', geoid: '5301410', name: 'Camas School District' },
    { level: 'city', geoid: '5310180', name: 'City of Camas' },
  ],
  county_geoid: '53011',
  state_geoid: '53',
};

const CAMAS_GEOGRAPHIES = {
  States: [{ GEOID: '53', NAME: 'Washington', STATE: '53' }],
  Counties: [{ GEOID: '53011', NAME: 'Clark County', STATE: '53', COUNTY: '011' }],
  'Incorporated Places': [{ GEOID: '5310180', NAME: 'Camas city', STATE: '53', PLACE: '10180' }],
  'Unified School Districts': [{ GEOID: '5301410', NAME: 'Camas School District', STATE: '53', UNSDLEA: '01410' }],
  '119th Congressional Districts': [{ GEOID: '5303', NAME: 'Congressional District 3', BASENAME: '3' }],
  'Census Tracts': [{ GEOID: '53011040910', STATE: '53', COUNTY: '011', TRACT: '040910' }],
};

function wa(day, extra = {}) {
  return summary.composeSummary({
    stateValue: 'WA',
    countyGeoid: '53011',
    governmentsResult: CAMAS_GOVERNMENTS,
    now: pacificNoon(day),
    ...extra,
  });
}

function mockResp(data, ok = true) {
  return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) };
}

beforeEach(() => {
  resetTables();
  featureFlagService.invalidateFlagCache();
  delete process.env.GOOGLE_CIVIC_API_KEY;
});

afterEach(() => {
  delete global.fetch;
});

describe('reference data', () => {
  it('ships valid files', () => {
    expect(referenceData.validateReferenceData()).toEqual([]);
    expect(referenceData.isAvailable()).toBe(true);
  });

  it('covers every state and DC, and supports only the checked states', () => {
    expect(Object.keys(STATES.states)).toHaveLength(51);
    const supported = Object.entries(STATES.states).filter(([, s]) => s.coverage === 'supported').map(([k]) => k);
    expect(supported).toEqual(['CA', 'CO', 'HI', 'NV', 'OR', 'UT', 'VT', 'WA']);
  });

  it('rejects an http link, a bad date, a missing registration deadline and a deadline after the election', () => {
    const states = JSON.parse(JSON.stringify(STATES));
    states.states.WA.official_links[0].url = 'http://insecure.example';
    const elections = JSON.parse(JSON.stringify(ELECTIONS));
    const block = elections.elections[0].states.WA;
    block.deadlines = block.deadlines.filter((d) => d.key !== 'register_online_mail');
    block.deadlines[0].date = '2026-02-30';
    block.deadlines[1].date = '2026-12-01';
    const errors = referenceData.validateReferenceData(states, elections).join('\n');
    expect(errors).toMatch(/url must be https/);
    expect(errors).toMatch(/date must be YYYY-MM-DD/);
    expect(errors).toMatch(/register_online_mail is required/);
    expect(errors).toMatch(/falls after the election/);
  });

  it('keeps deadlines only on supported states', () => {
    const elections = JSON.parse(JSON.stringify(ELECTIONS));
    elections.elections[0].states.TX = elections.elections[0].states.WA;
    expect(referenceData.validateReferenceData(STATES, elections).join('\n')).toMatch(/only supported states carry deadlines/);
  });

  it('has the Washington 2026 general dates the plan cites', () => {
    const byKey = Object.fromEntries(ELECTIONS.elections[0].states.WA.deadlines.map((d) => [d.key, d]));
    expect(byKey.ballots_mailed.date).toBe('2026-10-16');
    expect(byKey.register_online_mail.date).toBe('2026-10-26');
    expect(byKey.register_in_person).toMatchObject({ date: '2026-11-03', time_local: '20:00' });
    expect(byKey.return_by).toMatchObject({ date: '2026-11-03', time_local: '20:00' });
  });

  it('computes phases on the calendar boundaries', () => {
    expect(referenceData.phaseFor(121)).toBeNull();
    expect(referenceData.phaseFor(120)).toBe('far');
    expect(referenceData.phaseFor(61)).toBe('far');
    expect(referenceData.phaseFor(60)).toBe('in_season');
    expect(referenceData.phaseFor(1)).toBe('in_season');
    expect(referenceData.phaseFor(0)).toBe('election_day');
    expect(referenceData.phaseFor(-7)).toBe('after');
    expect(referenceData.phaseFor(-8)).toBeNull();
  });

  it('accepts a full state name as well as the code', () => {
    expect(referenceData.stateCode('Washington')).toBe('WA');
    expect(referenceData.stateCode('wa')).toBe('WA');
    expect(referenceData.stateCode('PR')).toBeNull();
  });
});

describe('the Place card summary (supported: Washington)', () => {
  it('in season: count as a minimum, real dates, official links, no invented decisions', () => {
    const s = wa('2026-09-24');
    expect(s).toMatchObject({
      name: 'November 3 general election',
      date: '2026-11-03',
      days_until: 40,
      polling_place: null,
      ballot: [],
      coverage: 'supported',
      phase: 'in_season',
      title: 'Your ballot',
      subtitle: 'November 3 general election',
      chip: '40 days',
      line: 'This address sits inside at least 5 governments.',
      voting_method: 'all_mail',
      primary_action: { kind: 'governments', label: 'See your governments' },
      source_line: 'Washington Secretary of State',
    });
    expect(s.deadlines.filter((d) => d.timeline).map((d) => [d.key, d.month_day, d.days_until])).toEqual([
      ['ballots_mailed', 'Oct 16', 22],
      ['register_online_mail', 'Oct 26', 32],
      ['return_by', 'Nov 3', 40],
    ]);
    expect(s.official_links.map((l) => l.key)).toEqual(['registration', 'ballot_tracking', 'drop_boxes']);
    expect(s.governments).toMatchObject({ count: 5, count_is_minimum: true });
    // Only the nation is known to be on this ballot; nothing is "none".
    expect(s.governments.items.map((g) => g.on_ballot)).toEqual([true, null, null, null, null]);
    expect(JSON.stringify(s)).not.toMatch(/nothing (this year|to decide)|decisions from|should arrive|Mail Day/i);
  });

  it('uses state links only when the county has none of its own', () => {
    const s = wa('2026-09-24', { countyGeoid: '53033' });
    expect(s.official_links.map((l) => l.key)).toEqual(['registration', 'ballot_tracking', 'election_information']);
  });

  it('drops a deadline once it has passed', () => {
    const s = wa('2026-10-27');
    expect(s.deadlines.map((d) => d.key)).toEqual(['return_by', 'register_in_person']);
  });

  it('ballot week: the county’s mailing date, never a delivery promise', () => {
    expect(wa('2026-10-14').ballot_week).toEqual({ show: false });
    expect(wa('2026-10-15').ballot_week).toMatchObject({ show: true, overline: 'Ballot week', title: 'Ballots go out by Oct 16' });
    expect(wa('2026-10-17').ballot_week).toMatchObject({ show: true, title: 'Ballots were mailed by Oct 16' });
  });

  it('Election Day: the return notice until 8 p.m., then the results state', () => {
    const morning = wa('2026-11-03');
    expect(morning).toMatchObject({ phase: 'election_day', title: 'Election Day', chip: 'Today' });
    expect(morning.election_day_notice).toEqual({ lead: 'Return by 8 p.m. today.', detail: 'Use a drop box. If you mail it, get it postmarked at a post office counter today.' });
    expect(morning.official_links.map((l) => l.key)).toEqual(['drop_boxes', 'ballot_tracking']);

    // 8:30 p.m. Pacific on Election Day = 03:30 UTC the next day.
    const evening = summary.composeSummary({
      stateValue: 'WA', countyGeoid: '53011', governmentsResult: CAMAS_GOVERNMENTS, now: at('2026-11-04T04:30:00.000Z'),
    });
    expect(evening).toMatchObject({ phase: 'after', after_stage: 'counting', chip: 'Counting' });
    expect(evening.note).toBe('Ballots are still being counted. Results can change until Clark County Elections certifies them on Nov 24.');
  });

  it('after: counting through county certification, certified until the state certifies, then nothing', () => {
    const counting = wa('2026-11-06');
    expect(counting).toMatchObject({ phase: 'after', after_stage: 'counting', chip: 'Counting', deadlines: [], primary_action: null });
    expect(counting.official_links.map((l) => [l.key, l.owner])).toEqual([['results', 'Clark County Elections'], ['ballot_tracking', 'VoteWA']]);
    expect(wa('2026-11-24').after_stage).toBe('counting');

    const certified = wa('2026-11-25');
    expect(certified).toMatchObject({ after_stage: 'certified', chip: null, note: 'Clark County Elections certified the results on Nov 24.' });
    expect(certified.official_links.map((l) => l.key)).toEqual(['results']);
    expect(wa('2026-12-03').after_stage).toBe('certified');
    expect(wa('2026-12-04')).toBeNull();

    // The card returns 120 days before Washington's next general election.
    expect(wa('2027-07-04')).toBeNull();
    expect(wa('2027-07-05')).toMatchObject({ phase: 'far', subtitle: 'November 2 general election' });
  });

  it('far: the registration deadline only', () => {
    const far = wa('2026-07-10');
    expect(far).toMatchObject({ phase: 'far', chip: '116 days', line: null, how_it_works: null, note: 'Registration deadline: Oct 26, online or by mail.' });
  });

  it('shows no count when the exact-point lookup failed', () => {
    const s = wa('2026-09-24', { governmentsResult: null });
    expect(s.line).toBeNull();
    expect(s.governments).toBeNull();
    expect(s.primary_action).toBeNull();
    expect(s.deadlines.length).toBeGreaterThan(0);
  });

  it('asks "Moved this year?" only from the household’s own move-in date, within a year', () => {
    expect(wa('2026-09-24', { moveInDate: '2026-06-01' }).mover_prompt).toEqual({
      text: 'Moved this year? Update your registration online by Oct 26.',
      days_left: 32,
      url: STATES.states.WA.official_links[0].url,
    });
    expect(wa('2026-09-24', { moveInDate: '2025-06-01' }).mover_prompt).toBeNull();
    expect(wa('2026-09-24', { moveInDate: null }).mover_prompt).toBeNull();
    expect(wa('2026-10-27', { moveInDate: '2026-06-01' }).mover_prompt).toBeNull();
  });
});

describe('outside the pilot: official links only', () => {
  it('shows the election date and Vote.gov, never a count or a deadline', () => {
    const s = summary.composeSummary({ stateValue: 'TX', governmentsResult: CAMAS_GOVERNMENTS, now: pacificNoon('2026-09-24') });
    expect(s).toMatchObject({
      coverage: 'links_only',
      phase: 'in_season',
      chip: '40 days',
      line: null,
      note: 'Pantopus doesn’t have this state’s deadlines yet. Its election office does.',
      deadlines: [],
      governments: null,
      primary_action: null,
      source_line: 'Election date: federal law',
    });
    expect(s.official_links).toEqual([{ key: 'registration', label: 'Registration and deadlines', owner: 'Vote.gov', url: 'https://vote.gov/' }]);
  });

  it('hides after the election and for territories', () => {
    expect(summary.composeSummary({ stateValue: 'TX', now: pacificNoon('2026-11-05') })).toBeNull();
    expect(summary.composeSummary({ stateValue: 'PR', now: pacificNoon('2026-09-24') })).toBeNull();
  });
});

describe('governments from the exact point', () => {
  it('keeps typed identities, wide to narrow, with readable names', () => {
    expect(governments.governmentsFromGeographies(CAMAS_GEOGRAPHIES)).toEqual(CAMAS_GOVERNMENTS);
  });

  it('uses elementary plus secondary districts when there is no unified one, and dedupes by type', () => {
    const geo = { ...CAMAS_GEOGRAPHIES };
    delete geo['Unified School Districts'];
    geo['Elementary School Districts'] = [{ GEOID: '0612345', NAME: 'Oak Elementary School District' }];
    geo['Secondary School Districts'] = [{ GEOID: '0698765', NAME: 'Valley Union High School District' }];
    const levels = governments.governmentsFromGeographies(geo).items.map((g) => `${g.level}:${g.geoid}`);
    expect(levels).toEqual(['federal:us', 'state:53', 'county:53011', 'school:0612345', 'school:0698765', 'city:5310180']);
  });

  it('refuses to count without a state and a county', () => {
    const geo = { ...CAMAS_GEOGRAPHIES };
    delete geo.Counties;
    expect(governments.governmentsFromGeographies(geo)).toBeNull();
  });

  it('names incorporated places the way the canvas does', () => {
    expect(governments.placeName('Camas city')).toBe('City of Camas');
    expect(governments.placeName('Yacolt town')).toBe('Town of Yacolt');
    expect(governments.placeName('Honolulu')).toBe('Honolulu');
  });

  it('caches a saved home per home and exact point, never per cell', async () => {
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    const home = { id: 'home-1', map_center_lat: 45.5871, map_center_lng: -122.3995 };
    const result = await governments.governmentsForHome(home);
    expect(result).toMatchObject({ county_geoid: '53011', stale: false });
    const rows = getTable('PlaceSectionCache');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cache_key: `home:home-1:${encodeGeohash(45.5871, -122.3995, 9)}`,
      section_id: '_ballot_governments',
    });
    // Moving the pin is a new key: the old answer is never reused.
    await governments.governmentsForHome({ ...home, map_center_lat: 45.6001 });
    expect(getTable('PlaceSectionCache')).toHaveLength(2);
  });

  it('never writes anything for an anonymous point', async () => {
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    const result = await governments.governmentsForPoint(45.5871, -122.3995);
    expect(result.items).toHaveLength(5);
    expect(getTable('PlaceSectionCache')).toHaveLength(0);
  });
});

describe('readThrough maxStaleMs', () => {
  const DAY = 24 * 60 * 60 * 1000;
  function seedExpired(ageDays) {
    const fetchedAt = new Date(Date.now() - ageDays * DAY).toISOString();
    seedTable('PlaceSectionCache', [{
      id: 'row-1', cache_key: 'home:h', section_id: '_ballot_governments',
      payload: { items: [] }, fetched_at: fetchedAt, expires_at: new Date(Date.now() - DAY).toISOString(),
    }]);
  }
  const failing = () => Promise.reject(new Error('provider down'));

  it('serves a stale row younger than the limit', async () => {
    seedExpired(3);
    const out = await readThrough({ cacheKey: 'home:h', sectionId: '_ballot_governments', ttlMs: DAY, maxStaleMs: 7 * DAY, fetch: failing });
    expect(out.stale).toBe(true);
  });

  it('refuses a stale row older than the limit', async () => {
    seedExpired(9);
    await expect(readThrough({ cacheKey: 'home:h', sectionId: '_ballot_governments', ttlMs: DAY, maxStaleMs: 7 * DAY, fetch: failing }))
      .rejects.toThrow('provider down');
  });

  it('keeps the old unlimited behavior when no limit is given', async () => {
    seedExpired(90);
    const out = await readThrough({ cacheKey: 'home:h', sectionId: '_ballot_governments', ttlMs: DAY, fetch: failing });
    expect(out.stale).toBe(true);
  });
});

describe('civic_election section behind ballot_p0', () => {
  const USER = '11111111-1111-4111-8111-111111111111';
  const HOME = { id: 'home-1', state: 'WA', map_center_lat: 45.5871, map_center_lng: -122.3995, move_in_date: null };

  beforeEach(() => {
    // The section reads the real clock; pin it inside the Washington season.
    jest.useFakeTimers({ now: pacificNoon('2026-09-24'), advanceTimers: true });
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    seedTable('User', [{ id: USER, role: 'user' }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the pre-Ballot behavior with the flag off', async () => {
    const [env] = await placeSectionAdapters.composeCivicElection(HOME, { userId: USER });
    expect(env).toMatchObject({ id: 'civic_election', status: 'unavailable', unavailable_reason: 'Election data is not configured yet.' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the pre-Ballot behavior for the anonymous preview (no user)', async () => {
    seedTable('FeatureFlag', [{ flag_name: 'ballot_p0', enabled_globally: true, enabled_for_internal_team: false, beta_user_ids: [] }]);
    const [env] = await placeSectionAdapters.composeCivicElection(HOME);
    expect(env.status).toBe('unavailable');
  });

  it('adds the card fields for a user the flag allows', async () => {
    seedTable('FeatureFlag', [{ flag_name: 'ballot_p0', enabled_globally: false, enabled_for_internal_team: false, beta_user_ids: [USER] }]);
    const [env] = await placeSectionAdapters.composeCivicElection(HOME, { userId: USER });
    expect(env).toMatchObject({ id: 'civic_election', status: 'ready', coverage: 'full', source: 'Washington Secretary of State' });
    expect(env.data).toMatchObject({ coverage: 'supported', election_id: '2026-11-03-general', polling_place: null, ballot: [] });
  });
});
