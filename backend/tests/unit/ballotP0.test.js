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
 *   5. The Place section keeps its pre-Ballot behavior unless the request
 *      opted in to Ballot (the route decides once; composers never read the
 *      flag).
 *   6. The pre-launch repairs: the validator refuses data that would
 *      silently change a card, the last days stop giving advice that cannot
 *      be followed, a certification "by" date is never reported as an
 *      event, a boundary answer for another state is dropped, Mountain-time
 *      enclaves read their own clock, and a home with no coordinates is never
 *      looked up at 0,0.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');

const { resetTables, seedTable, getTable } = supabaseAdmin;
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

  it('refuses data that would silently change what a card says', () => {
    const wa = (e) => e.elections[0].states.WA;
    const returnBy = (e) => wa(e).deadlines.find((d) => d.key === 'return_by');
    const cases = [
      ['a return deadline with no time', (s, e) => { delete returnBy(e).time_local; }, /return_by: time_local is required/],
      ['a return deadline with a null time', (s, e) => { returnBy(e).time_local = null; }, /return_by: time_local is required/],
      ['an Election Day notice with no detail', (s, e) => { delete wa(e).election_day_notice.detail; }, /election_day_notice\.detail is required/],
      ['a state with no timezone', (s) => { delete s.states.WA.timezone; }, /WA: timezone undefined is not valid/],
      ['a block with no ballot week', (s, e) => { delete wa(e).ballot_week; }, /ballot_week\.body is required/],
      ['a ballot week with no Election Day title', (s, e) => { delete wa(e).ballot_week.election_day_title; }, /ballot_week\.election_day_title is required/],
      ['a supported state with no block for the election', (s, e) => { delete e.elections[0].states.OR; }, /supported state OR has no block/],
      ['an all-mail state with no mailing date', (s, e) => { wa(e).deadlines = wa(e).deadlines.filter((d) => d.key !== 'ballots_mailed'); }, /ballots_mailed is required/],
      ['a by-mail-only registration state with no far note', (s, e) => { delete e.elections[0].states.NV.far_note; }, /NV: far_note is required/],
      ['a not-online registration state with no mover text', (s, e) => { delete e.elections[0].states.HI.mover_text; }, /HI: mover_text is required/],
      ['late copy with no cut-over day', (s, e) => { delete wa(e).late_days; }, /late copy needs late_days/],
      ['a cut-over day out of range', (s, e) => { wa(e).late_days = 30; }, /late_days must be a whole number/],
      ['late teaser copy with nothing to replace', (s, e) => { delete returnBy(e).teaser_detail; }, /teaser_detail_late needs teaser_detail/],
      ['a state with no FIPS code', (s) => { delete s.states.WA.fips; }, /WA: fips must be/],
      ['a state that does not say whether schools are separate', (s) => { delete s.states.WA.dependent_schools; }, /WA: dependent_schools must be/],
      ['a time zone override naming a county and a place', (s) => { s.states.OR.timezone_overrides[0].place_geoid = '4112345'; }, /exactly one of county_geoid or place_geoid/],
      ['a time zone override with an unknown zone', (s) => { s.states.OR.timezone_overrides[0].timezone = 'Mars/Olympus'; }, /timezone is not valid/],
      ['a time zone override for another state’s county', (s) => { s.states.OR.timezone_overrides[0].county_geoid = '53045'; }, /county_geoid must be a 5-digit county GEOID in this state/],
      ['a consolidated county in another state', (s) => { s.states.CA.consolidated_counties = { '08031': 'City of Denver' }; }, /consolidated_counties\.08031: key must be/],
    ];
    for (const [name, mutate, pattern] of cases) {
      const states = JSON.parse(JSON.stringify(STATES));
      const elections = JSON.parse(JSON.stringify(ELECTIONS));
      mutate(states, elections);
      expect({ name, errors: referenceData.validateReferenceData(states, elections).join('\n') })
        .toEqual({ name, errors: expect.stringMatching(pattern) });
    }
  });

  it('says Vermont mails every ballot by Oct 1, not "starting Sep 25"', () => {
    const vt = ELECTIONS.elections[0].states.VT;
    expect(vt.deadlines.find((d) => d.key === 'ballots_mailed')).toMatchObject({ date: '2026-10-01', cutoff: 'mailed_by' });
    expect(vt.how_it_works).toMatch(/^Every active voter is mailed a ballot by Oct 1\./);
    expect(JSON.stringify(vt)).not.toMatch(/Sep 25|starting/);
  });

  it('reads a county or place that keeps another clock on that clock', () => {
    const or = referenceData.stateEntry('OR');
    const nv = referenceData.stateEntry('NV');
    expect(referenceData.timezoneFor(or)).toBe('America/Los_Angeles');
    expect(referenceData.timezoneFor(or, { countyGeoid: '41051' })).toBe('America/Los_Angeles');
    expect(referenceData.timezoneFor(or, { countyGeoid: '41045' })).toBe('America/Boise');
    expect(referenceData.timezoneFor(nv, { countyGeoid: '32007' })).toBe('America/Los_Angeles');
    expect(referenceData.timezoneFor(nv, { countyGeoid: '32007', placeGeoid: '3283730' })).toBe('America/Denver');
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

  it('the last days stop advising "mail it a week early"', () => {
    const returnByDetail = (s) => s.deadlines.find((d) => d.key === 'return_by').teaser_detail;
    const early = wa('2026-10-27'); // seven days left: a week early is still possible
    expect(early.how_it_works).toMatch(/mail it a week early/);
    expect(early.ballot_week.body).toMatch(/mail it a week early/);
    expect(returnByDetail(early)).toBe('Use a drop box, or mail it a week early.');

    const late = wa('2026-10-28'); // six days left
    expect(late.how_it_works).toBe('Everyone here votes by mail. Your ballot is mailed by Oct 16. Return it in a drop box by 8 p.m. Nov 3.');
    expect(late.ballot_week).toMatchObject({ show: true, body: 'Return yours in a drop box by 8 p.m. Nov 3.' });
    expect(returnByDetail(late)).toBe('Use a drop box.');
    expect(JSON.stringify(late)).not.toMatch(/week early/);
  });

  it('Vermont: ballots are mailed by Oct 1, and Election Day drops the town-clerk route', () => {
    const vt = (iso) => summary.composeSummary({ stateValue: 'VT', now: at(iso) });
    const clerkAdvice = (iso) => vt(iso).deadlines.find((d) => d.key === 'return_by').teaser_detail;
    // Noon Eastern: 16:00Z while daylight time lasts, 17:00Z after Nov 1.
    expect(vt('2026-09-29T16:00:00.000Z').ballot_week).toEqual({ show: false });
    expect(vt('2026-09-30T16:00:00.000Z').ballot_week).toMatchObject({ show: true, title: 'Ballots go out by Oct 1' });
    expect(vt('2026-10-02T16:00:00.000Z').ballot_week).toMatchObject({ show: true, title: 'Ballots were mailed by Oct 1' });
    expect(clerkAdvice('2026-11-02T17:00:00.000Z')).toBe('Town clerk by Nov 2, or your polling place.');
    expect(clerkAdvice('2026-11-03T17:00:00.000Z')).toBe('Bring it to your polling place.');
  });

  it('a certification "by" date is a deadline: past it, the card never claims the count was certified', () => {
    const or = (day) => summary.composeSummary({ stateValue: 'OR', now: pacificNoon(day) });
    expect(or('2026-11-30')).toMatchObject({
      after_stage: 'counting',
      note: 'Ballots are still being counted. Results can change until your county certifies them by Nov 30.',
    });
    expect(or('2026-12-01')).toMatchObject({ after_stage: 'certified', note: 'Your county had until Nov 30 to certify the results.' });
    // A date the state fixes ("on") still reads as the event it is.
    expect(wa('2026-11-25').note).toBe('Clark County Elections certified the results on Nov 24.');
  });

  it('ignores a boundary answer for another state, with its county', () => {
    const s = wa('2026-09-24', { governmentsResult: { ...CAMAS_GOVERNMENTS, state_geoid: '41' } });
    expect(s).toMatchObject({ line: null, governments: null, primary_action: null });
    expect(s.official_links.map((l) => l.key)).toEqual(['registration', 'ballot_tracking', 'election_information']);
    expect(s.deadlines.length).toBeGreaterThan(0);
  });

  it('reads Mountain-time enclaves on their own clock', () => {
    const answer = (state, county, place) => ({
      items: [
        { level: 'federal', geoid: 'us', name: 'United States' },
        { level: 'state', geoid: state, name: 'The state' },
        { level: 'county', geoid: county, name: 'Some County' },
        ...(place ? [{ level: 'city', geoid: place, name: 'City of Somewhere' }] : []),
      ],
      county_geoid: county,
      state_geoid: state,
    });
    const phase = (stateValue, result, iso) => summary.composeSummary({
      stateValue, countyGeoid: result.county_geoid, governmentsResult: result, now: at(iso),
    }).phase;
    // Oregon closes at 8 p.m.: 7:30 p.m. Pacific (03:30Z) is 8:30 p.m. Mountain.
    expect(phase('OR', answer('41', '41051'), '2026-11-04T03:30:00.000Z')).toBe('election_day'); // Multnomah: Pacific
    expect(phase('OR', answer('41', '41045'), '2026-11-04T03:30:00.000Z')).toBe('after'); // Malheur: Mountain time
    // Nevada closes at 7 p.m.: 6:30 p.m. Pacific (02:30Z) is 7:30 p.m. Mountain.
    expect(phase('NV', answer('32', '32031', '3260600'), '2026-11-04T02:30:00.000Z')).toBe('election_day'); // Reno: Pacific
    expect(phase('NV', answer('32', '32007', '3283730'), '2026-11-04T02:30:00.000Z')).toBe('after'); // West Wendover: Mountain time
    // With no boundary answer the state's own clock stands.
    expect(summary.composeSummary({ stateValue: 'OR', now: at('2026-11-04T03:30:00.000Z') }).phase).toBe('election_day');
  });

  it('counts a consolidated city-county once and a state-run school system never', () => {
    const denver = {
      items: [
        { level: 'federal', geoid: 'us', name: 'United States' },
        { level: 'state', geoid: '08', name: 'The state' },
        { level: 'county', geoid: '08031', name: 'Denver County' },
        { level: 'school', geoid: '0803360', name: 'Denver County 1' },
        { level: 'city', geoid: '0820000', name: 'City of Denver' },
      ],
      county_geoid: '08031',
      state_geoid: '08',
    };
    const co = summary.composeSummary({ stateValue: 'CO', countyGeoid: '08031', governmentsResult: denver, now: pacificNoon('2026-09-24') });
    expect(co.governments.items.map((g) => [g.level, g.name])).toEqual([
      ['federal', 'United States'], ['state', 'The state'], ['city', 'City of Denver'], ['school', 'Denver County 1'],
    ]);
    expect(co.line).toBe('This address sits inside at least 4 governments.');

    const honolulu = {
      items: [
        { level: 'federal', geoid: 'us', name: 'United States' },
        { level: 'state', geoid: '15', name: 'The state' },
        { level: 'county', geoid: '15003', name: 'Honolulu County' },
        { level: 'school', geoid: '1500030', name: 'Hawaii Unified School District' },
      ],
      county_geoid: '15003',
      state_geoid: '15',
    };
    const hi = summary.composeSummary({ stateValue: 'HI', countyGeoid: '15003', governmentsResult: honolulu, now: pacificNoon('2026-09-24') });
    expect(hi.governments.items.map((g) => g.name)).toEqual(['United States', 'The state', 'City and County of Honolulu']);
  });
});

describe('the /start teaser composed from a point', () => {
  const KEYS = { lat: 45.5871, lng: -122.3995, state: 'WA' };

  it('takes its lookup and its time budget from the caller, and shows when the answer was made', async () => {
    const lookup = jest.fn(() => Promise.resolve({ result: CAMAS_GOVERNMENTS, lookedUpAt: '2026-09-24T18:00:00.000Z' }));
    const teaser = await summary.teaserForPoint(KEYS, { now: pacificNoon('2026-09-24'), timeoutMs: 1234, lookup });
    expect(lookup).toHaveBeenCalledWith(KEYS.lat, KEYS.lng, { timeoutMs: 1234 });
    expect(teaser).toMatchObject({
      looked_up_at: '2026-09-24T18:00:00.000Z',
      headline: 'Your address sits inside at least 5 governments.',
      governments: { count: 5, count_is_minimum: true },
    });
  });

  it('stops advising "mail it a week early" in the last days', async () => {
    const lookup = () => Promise.resolve({ result: CAMAS_GOVERNMENTS, lookedUpAt: null });
    const detail = async (day) => {
      const teaser = await summary.teaserForPoint(KEYS, { now: pacificNoon(day), lookup });
      return teaser.next_deadline;
    };
    // Registration is the next deadline until it passes; then the return.
    expect(await detail('2026-10-27')).toMatchObject({ key: 'return_by', detail: 'Use a drop box, or mail it a week early.' });
    expect(await detail('2026-10-28')).toMatchObject({ key: 'return_by', detail: 'Use a drop box.' });
    expect(await detail('2026-11-03')).toMatchObject({ key: 'return_by', detail: 'Use a drop box.' });
  });

  it('shows no count and no timestamp for an answer from another state', async () => {
    const lookup = () => Promise.resolve({ result: { ...CAMAS_GOVERNMENTS, state_geoid: '41' }, lookedUpAt: '2026-09-24T18:00:00.000Z' });
    const teaser = await summary.teaserForPoint(KEYS, { now: pacificNoon('2026-09-24'), lookup });
    expect(teaser).toMatchObject({
      headline: 'The general election is November 3.', governments: null, primary_action: null, looked_up_at: null,
    });
  });

  it('ends the geocoder call when the budget does, so it never outlives the response', async () => {
    let signal = null;
    global.fetch = jest.fn((url, init) => {
      signal = init.signal;
      return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const started = Date.now();
    const teaser = await summary.teaserForPoint(KEYS, { now: pacificNoon('2026-09-24'), timeoutMs: 40 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(signal.aborted).toBe(true);
    expect(teaser).toMatchObject({ governments: null, looked_up_at: null });
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

  it('caches a saved home per exact point, never per cell and never under a home id', async () => {
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    const home = { id: 'home-1', map_center_lat: 45.5871, map_center_lng: -122.3995 };
    const result = await governments.governmentsForHome(home);
    expect(result).toMatchObject({ county_geoid: '53011', stale: false });
    const rows = getTable('PlaceSectionCache');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cache_key: `geo9:${encodeGeohash(45.5871, -122.3995, 9)}`,
      section_id: '_ballot_governments',
    });
    expect(rows[0].cache_key).not.toContain('home');
    // Another household at the same point reads the same row: a fact about the land.
    await governments.governmentsForHome({ ...home, id: 'home-2' });
    expect(getTable('PlaceSectionCache')).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Moving the pin is a new key: the old answer is never reused.
    await governments.governmentsForHome({ ...home, map_center_lat: 45.6001 });
    expect(getTable('PlaceSectionCache')).toHaveLength(2);
  });

  it('never looks up a home that has no coordinates (not 0,0, not off the map)', async () => {
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    const none = [
      { map_center_lat: null, map_center_lng: null },
      { map_center_lat: undefined, map_center_lng: undefined },
      { map_center_lat: '', map_center_lng: ' ' },
      { map_center_lat: 0, map_center_lng: 0 },
      { map_center_lat: 91, map_center_lng: -122 },
      { map_center_lat: 45.5, map_center_lng: -200 },
      { map_center_lat: 'north', map_center_lng: -122 },
      { map_center_lat: 45.5871 },
    ];
    for (const coordinates of none) {
      expect(await governments.governmentsForHome({ id: 'home-1', ...coordinates })).toBeNull();
    }
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getTable('PlaceSectionCache')).toHaveLength(0);
    // A coordinate stored as text still works.
    expect(await governments.governmentsForHome({ id: 'home-1', map_center_lat: '45.5871', map_center_lng: '-122.3995' }))
      .toMatchObject({ county_geoid: '53011' });
  });

  it('shares one geocoder call between the sections that ask for the same point', async () => {
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    const [a, b] = await Promise.all([
      governments.sharedGeographies(45.5871, -122.3995),
      governments.sharedGeographies(45.5871, -122.3995),
    ]);
    expect(a).toBe(b);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Once it has finished the next ask is a new call.
    await governments.sharedGeographies(45.5871, -122.3995);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('serves an eligible stale row when the geocoder answers without a state and county', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const home = { id: 'home-1', map_center_lat: 45.5871, map_center_lng: -122.3995 };
    seedTable('PlaceSectionCache', [{
      cache_key: governments.pointCacheKey(home.map_center_lat, home.map_center_lng),
      section_id: '_ballot_governments',
      payload: CAMAS_GOVERNMENTS,
      fetched_at: new Date(Date.now() - 31 * DAY).toISOString(),
      expires_at: new Date(Date.now() - DAY).toISOString(),
    }]);
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: { 'Census Tracts': [] } } })));
    expect(await governments.governmentsForHome(home)).toMatchObject({ county_geoid: '53011', stale: true });
  });

  it('over budget, serves a cached answer only while it is eligible', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const release = [];
    global.fetch = jest.fn(() => new Promise((resolve) => { release.push(() => resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } }))); }));
    const seed = (home, ageDays) => seedTable('PlaceSectionCache', [{
      cache_key: governments.pointCacheKey(home.map_center_lat, home.map_center_lng),
      section_id: '_ballot_governments',
      payload: CAMAS_GOVERNMENTS,
      fetched_at: new Date(Date.now() - ageDays * DAY).toISOString(),
      expires_at: new Date(Date.now() - (ageDays - 30) * DAY).toISOString(),
    }]);
    const young = { id: 'h1', map_center_lat: 45.5871, map_center_lng: -122.3995 };
    seed(young, 36); // seven days before the limit: still served
    expect(await governments.governmentsForHome(young, { budgetMs: 30 })).toMatchObject({ county_geoid: '53011', stale: true });
    release.splice(0).forEach((fn) => fn());
    await new Promise((resolve) => setImmediate(resolve));

    resetTables();
    const old = { id: 'h2', map_center_lat: 45.6101, map_center_lng: -122.4001 };
    seed(old, 38); // past the limit: nothing
    expect(await governments.governmentsForHome(old, { budgetMs: 30 })).toBeNull();
    release.splice(0).forEach((fn) => fn());
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('reads the cached row twice at most per Place load, however many sections ask', async () => {
    const home = { id: 'home-1', map_center_lat: 45.5871, map_center_lng: -122.3995 };
    global.fetch = jest.fn(() => Promise.resolve(mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })));
    seedTable('PlaceSectionCache', [{
      cache_key: governments.pointCacheKey(home.map_center_lat, home.map_center_lng),
      section_id: '_ballot_governments',
      payload: CAMAS_GOVERNMENTS,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }]);
    const from = jest.spyOn(supabaseAdmin, 'from');
    try {
      await Promise.all([1, 2, 3].map(() => governments.governmentsForHome(home)));
      // The shared read-through (1) and the shared over-budget read (1), not one of each per section.
      expect(from.mock.calls.filter(([table]) => table === 'PlaceSectionCache').length).toBeLessThanOrEqual(2);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      from.mockRestore();
    }
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

describe('the Place sections take Ballot only when the request opted in', () => {
  const USER = '11111111-1111-4111-8111-111111111111';
  const HOME = { id: 'home-1', state: 'WA', map_center_lat: 45.5871, map_center_lng: -122.3995, move_in_date: null };
  const censusCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).includes('geocoding.geo.census.gov'));

  beforeEach(() => {
    // The section reads the real clock; pin it inside the Washington season.
    jest.useFakeTimers({ now: pacificNoon('2026-09-24'), advanceTimers: true });
    global.fetch = jest.fn((url) => Promise.resolve(String(url).includes('geocoding.geo.census.gov')
      ? mockResp({ result: { geographies: CAMAS_GEOGRAPHIES } })
      : mockResp(null, false)));
    seedTable('User', [{ id: USER, role: 'user' }]);
    // The flag is on for everyone: only the request's own opt-in may matter.
    seedTable('FeatureFlag', [{ flag_name: 'ballot_p0', enabled_globally: true, enabled_for_internal_team: false, beta_user_ids: [] }]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps the pre-Ballot behavior unless the request opted in', async () => {
    const [plain] = await placeSectionAdapters.composeCivicElection(HOME);
    expect(plain).toMatchObject({ id: 'civic_election', status: 'unavailable', unavailable_reason: 'Election data is not configured yet.' });
    const [no] = await placeSectionAdapters.composeCivicElection(HOME, { ballot: false });
    expect(no.status).toBe('unavailable');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never reads a feature flag (or a user) itself: the route decides once', async () => {
    const isEnabled = jest.spyOn(featureFlagService, 'isFeatureEnabled');
    await placeSectionAdapters.composeCivicElection(HOME, { ballot: true });
    await placeSectionAdapters.composeCivicDistricts(HOME, { ballot: true });
    await placeSectionAdapters.composeCivicElection(HOME);
    await placeSectionAdapters.composeCivicDistricts(HOME);
    expect(isEnabled).not.toHaveBeenCalled();
  });

  it('adds the card fields for a request that opted in', async () => {
    const [env] = await placeSectionAdapters.composeCivicElection(HOME, { ballot: true });
    expect(env).toMatchObject({ id: 'civic_election', status: 'ready', coverage: 'full', source: 'Washington Secretary of State' });
    expect(env.data).toMatchObject({ coverage: 'supported', election_id: '2026-11-03-general', polling_place: null, ballot: [] });
  });

  it('civic districts: without Ballot, the long-standing ~1 km cell and no governments', async () => {
    const [env] = await placeSectionAdapters.composeCivicDistricts(HOME);
    expect(env.data).not.toHaveProperty('governments');
    expect(getTable('PlaceSectionCache').map((r) => [r.section_id, r.cache_key])).toEqual([
      ['civic_districts', `geo:${encodeGeohash(HOME.map_center_lat, HOME.map_center_lng, 6)}`],
    ]);
  });

  it('civic districts: outside the pilot states Ballot changes nothing about the districts', async () => {
    const [env] = await placeSectionAdapters.composeCivicDistricts({ ...HOME, state: 'TX' }, { ballot: true });
    expect(env.data).not.toHaveProperty('governments');
    expect(getTable('PlaceSectionCache').map((r) => [r.section_id, r.cache_key])).toEqual([
      ['civic_districts', `geo:${encodeGeohash(HOME.map_center_lat, HOME.map_center_lng, 6)}`],
    ]);
  });

  it('civic districts: with Ballot, the districts and the governments come from one exact point, in one geocoder call', async () => {
    const [env] = await placeSectionAdapters.composeCivicDistricts(HOME, { ballot: true });
    expect(env.status).toBe('ready');
    expect(env.data.governments).toMatchObject({ count: 5, count_is_minimum: true });
    expect(env.data.districts.map((d) => d.name)).toEqual(expect.arrayContaining(['Camas School District', 'Clark County']));
    const key = `geo9:${encodeGeohash(HOME.map_center_lat, HOME.map_center_lng, 9)}`;
    expect(getTable('PlaceSectionCache').map((r) => [r.section_id, r.cache_key]).sort()).toEqual([
      ['_ballot_governments', key],
      ['civic_districts', key],
    ]);
    expect(censusCalls()).toHaveLength(1);
  });

  it('civic districts: two homes in one ~1 km cell each get their own school district and city', async () => {
    const WASHOUGAL = {
      ...CAMAS_GEOGRAPHIES,
      'Incorporated Places': [{ GEOID: '5374135', NAME: 'Washougal city', STATE: '53', PLACE: '74135' }],
      'Unified School Districts': [{ GEOID: '5307770', NAME: 'Washougal School District', STATE: '53', UNSDLEA: '07770' }],
    };
    const other = { ...HOME, id: 'home-2', map_center_lat: 45.5875 }; // same geohash-6 cell, a few dozen meters north
    expect(encodeGeohash(other.map_center_lat, other.map_center_lng, 6)).toBe(encodeGeohash(HOME.map_center_lat, HOME.map_center_lng, 6));
    global.fetch = jest.fn((url) => Promise.resolve(String(url).includes('geocoding.geo.census.gov')
      ? mockResp({ result: { geographies: String(url).includes('y=45.5875') ? WASHOUGAL : CAMAS_GEOGRAPHIES } })
      : mockResp(null, false)));
    const [first] = await placeSectionAdapters.composeCivicDistricts(HOME, { ballot: true });
    const [second] = await placeSectionAdapters.composeCivicDistricts(other, { ballot: true });
    const names = (env) => [env.data.districts.map((d) => d.name), env.data.governments.items.map((g) => g.name)].flat();
    expect(names(first)).toEqual(expect.arrayContaining(['Camas', 'Camas School District', 'City of Camas']));
    expect(names(first)).not.toContain('Washougal School District');
    expect(names(second)).toEqual(expect.arrayContaining(['Washougal', 'Washougal School District', 'City of Washougal']));
    expect(names(second)).not.toContain('Camas School District');
  });

  it('civic districts: the governments row does not wait for, or depend on, the districts', async () => {
    // The districts call fails for good; the governments (their own cached row) are still there for the card.
    seedTable('PlaceSectionCache', [{
      cache_key: governments.pointCacheKey(HOME.map_center_lat, HOME.map_center_lng),
      section_id: '_ballot_governments',
      payload: CAMAS_GOVERNMENTS,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }]);
    global.fetch = jest.fn(() => Promise.resolve(mockResp(null, false)));
    const [card] = await placeSectionAdapters.composeCivicElection(HOME, { ballot: true });
    expect(card).toMatchObject({ status: 'ready' });
    expect(card.data.governments).toMatchObject({ count: 5 });
  });
});
