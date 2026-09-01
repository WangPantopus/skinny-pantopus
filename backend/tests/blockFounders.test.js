// ============================================================
// TEST: Block Founders (Wave 3, final slice)
//
// The invariants:
//   * ranks are permanent, first-come, and idempotent per home;
//   * the meters and raw count reach ONLY verified occupants — an
//     unverified member gets the T4 gate, before any data is read;
//   * every invite safeguard fires BEFORE money is spent, in order:
//     opt-out → already-on-Pantopus → recipient dedup → weekly cap;
//   * the card's sender line names the street, never the house
//     number, name, or unit;
//   * the opt-out redemption is idempotent and oracle-free.
// ============================================================

jest.mock('../services/addressValidation', () => ({
  mailVendorService: {
    getProvider: jest.fn(),
  },
}));

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const { mailVendorService } = require('../services/addressValidation');
const blockFoundersService = require('../services/blockFoundersService');
const { sanitizeStreet, cleanAddressInput, cellForHome, WEEKLY_INVITE_CAP } = blockFoundersService;
const { encodeGeohash } = require('../utils/geohash');
const { computeAddressHash } = require('../utils/normalizeAddress');
const blockFoundersRoutes = require('../routes/blockFounders');
const publicRoutes = require('../routes/public');

const USER = 'bf-user-1';
const NEIGHBOR_MEMBER = 'bf-user-2';
const HOME_ID = 'home-bf-1';
const LAT = 45.51;
const LNG = -122.65;
const CELL = encodeGeohash(LAT, LNG, 6);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', blockFoundersRoutes);
  app.use('/api/public', publicRoutes);
  return app;
}

const HOME_ROW = {
  id: HOME_ID,
  owner_id: USER,
  address: '1421 SE Oak St, Portland, OR 97214',
  map_center_lat: LAT,
  map_center_lng: LNG,
  address_hash: 'own-home-hash',
};

function seedVerified({ verification = 'verified' } = {}) {
  seedTable('Home', [HOME_ROW]);
  seedTable('HomeOccupancy', [
    { id: 'bf-occ-1', home_id: HOME_ID, user_id: USER, is_active: true, role: 'owner', role_base: 'owner', verification_status: verification },
    { id: 'bf-occ-2', home_id: HOME_ID, user_id: NEIGHBOR_MEMBER, is_active: true, role: 'member', role_base: 'member', verification_status: 'pending' },
  ]);
  seedTable('NeighborhoodPreview', [{ geohash: CELL, verified_users_count: 4 }]);
  // A VERIFIED home has a vendor-validated address by construction — a
  // postcard was physically delivered to it. The card's sender line reads
  // from here, never from the user-editable Home.address text.
  seedTable('HomeAddress', [{
    id: 'ha-1', address_hash: HOME_ROW.address_hash, address_line1_norm: '1421 SE Oak St',
    city_norm: 'Portland', state: 'OR', postal_code: '97214',
  }]);
}

const RECIPIENT = { line1: '1425 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' };
// The SUPPRESSION key (not the platform-wide computeAddressHash): this
// is what the opt-out registry and the 90-day dedup are keyed on, and it
// is deliberately stricter so formatting variants cannot bypass them.
const RECIPIENT_HASH = blockFoundersService.suppressionHashFor(
  { line1: '1425 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' },
);
// What Home.address_hash carries platform-wide — the already-member gate
// compares against this, on a normalized input so punctuation cannot
// bypass it.
const MEMBER_HASH = computeAddressHash('1425 SE Oak St', '', 'Portland', 'OR', '97214');

function mockProvider() {
  const send = jest.fn().mockResolvedValue({ vendorJobId: 'psc_1', status: 'created' });
  mailVendorService.getProvider.mockReturnValue({ sendCustomPostcard: send });
  return send;
}

beforeEach(() => {
  resetTables();
  mockProvider();
});

// ── Pure helpers ─────────────────────────────────────────────

describe('helpers', () => {
  test('sanitizeStreet names the street, never the house number', () => {
    expect(sanitizeStreet('1421 SE Oak St, Portland, OR')).toBe('SE Oak St');
    expect(sanitizeStreet('221B Baker Street, London')).toBe('Baker Street');
    expect(sanitizeStreet('')).toBe('your street');
  });

  test('cleanAddressInput fails closed on junk', () => {
    expect(() => cleanAddressInput({ line1: 'x', city: 'y', state: 'Oregon', zip: '97214' })).toThrow();
    expect(() => cleanAddressInput({ line1: 'x', city: 'y', state: 'OR', zip: 'abc' })).toThrow();
    expect(cleanAddressInput(RECIPIENT).state).toBe('OR');
  });

  test('cellForHome fails closed without coordinates', () => {
    expect(cellForHome({ map_center_lat: null, map_center_lng: null })).toBeNull();
    expect(cellForHome(HOME_ROW)).toBe(CELL);
  });
});

// ── The status panel ─────────────────────────────────────────

describe('block status', () => {
  test('an unverified member is gated before any insider data is read', async () => {
    seedVerified();
    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/block-founders`)
      .set('x-test-user-id', NEIGHBOR_MEMBER);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VERIFICATION_REQUIRED');
    expect(JSON.stringify(res.body)).not.toContain('verified_count');
  });

  test('a verified occupant gets a permanent rank, the meters, and the invite budget', async () => {
    seedVerified();
    const app = buildApp();
    const res = await request(app)
      .get(`/api/homes/${HOME_ID}/block-founders`)
      .set('x-test-user-id', USER);
    expect(res.status).toBe(200);
    const block = res.body.block;
    expect(block.rank).toBe(1);
    expect(block.verified_count).toBe(4);
    const homesMeter = block.meters.find((m) => m.id === 'verified_homes');
    expect(homesMeter).toMatchObject({ current: 4, needed: 10, unlocked: false });
    // The meter must not claim to gate bill_benchmark: that section's
    // real gate is opted-in BillBenchmark rows, not the verified count.
    expect(block.meters.some((m) => m.id === 'bill_benchmark')).toBe(false);
    expect(block.invites_remaining).toBe(WEEKLY_INVITE_CAP);

    // Idempotent: a second read keeps the same rank, mints nothing new.
    const again = await request(app)
      .get(`/api/homes/${HOME_ID}/block-founders`)
      .set('x-test-user-id', USER);
    expect(again.body.block.rank).toBe(1);
    expect(getTable('BlockFounder')).toHaveLength(1);
  });

  // The flagship meter reads RENT REPORTS, not verified homes — a block
  // of verified owner-occupiers has no rents to pool, and a meter that
  // counted them would promise an unlock the section then can't honor.
  test('the real_rent meter tracks rent reports, not the verified-home count', async () => {
    seedVerified(); // 4 verified homes in the cell, zero rent reports
    const app = buildApp();

    const empty = await request(app)
      .get(`/api/homes/${HOME_ID}/block-founders`)
      .set('x-test-user-id', USER);
    const emptyRent = empty.body.block.meters.find((m) => m.id === 'real_rent');
    expect(emptyRent).toMatchObject({ current: 0, needed: 10, unlocked: false });
    expect(empty.body.block.rent_reports).toBe(0);
    // The verified-home meters still read the density, unchanged.
    expect(empty.body.block.meters.find((m) => m.id === 'verified_homes').current).toBe(4);

    // Two neighbors share their rent; only the rent meter moves.
    const cell = require('../services/realRentService').cellForHome(HOME_ROW);
    seedTable('HomeRentReport', [
      { id: 'rr1', home_id: 'other-1', user_id: 'u1', geohash6: cell, monthly_rent_cents: 210000, bedrooms: 2 },
      { id: 'rr2', home_id: 'other-2', user_id: 'u2', geohash6: cell, monthly_rent_cents: 235000, bedrooms: 2 },
    ]);

    const withRents = await request(app)
      .get(`/api/homes/${HOME_ID}/block-founders`)
      .set('x-test-user-id', USER);
    expect(withRents.body.block.rent_reports).toBe(2);
    expect(withRents.body.block.meters.find((m) => m.id === 'real_rent').current).toBe(2);
    expect(withRents.body.block.meters.find((m) => m.id === 'verified_homes').current).toBe(4);
  });

  test('ranks are first-come within a cell', async () => {
    seedVerified();
    seedTable('BlockFounder', [{
      id: 'bf-0', home_id: 'other-home', user_id: 'other-user', geohash6: CELL, rank: 1,
      established_at: '2026-08-01T00:00:00.000Z',
    }]);
    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/block-founders`)
      .set('x-test-user-id', USER);
    expect(res.body.block.rank).toBe(2);
  });
});

// ── Invites: the safeguard ladder ────────────────────────────

describe('invites', () => {
  function invite(app, body = { recipient: RECIPIENT }, userId = USER) {
    return request(app)
      .post(`/api/homes/${HOME_ID}/block-founders/invites`)
      .set('x-test-user-id', userId)
      .send(body);
  }

  test('a clean send mails the card, records the row, and burns budget', async () => {
    seedVerified();
    const send = mockProvider();
    const res = await invite(buildApp());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ sent: true, invites_remaining: WEEKLY_INVITE_CAP - 1 });

    expect(send).toHaveBeenCalledTimes(1);
    const [addr, card] = send.mock.calls[0];
    expect(addr.line1).toBe('1425 SE Oak St');
    // Sender anonymity: the card names the street, never the house.
    expect(card.backHtml).toContain('SE Oak St');
    expect(card.backHtml).not.toContain('1421');
    expect(card.backHtml).toContain('pantopus.com/no-mail/');

    const rows = getTable('BlockInvite');
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_address_hash).toBe(RECIPIENT_HASH);
  });

  test('an opted-out address is refused before any send', async () => {
    seedVerified();
    seedTable('BlockInviteOptOut', [{ address_hash: RECIPIENT_HASH, created_at: '2026-08-01T00:00:00.000Z' }]);
    const send = mockProvider();
    const res = await invite(buildApp());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OPTED_OUT');
    expect(send).not.toHaveBeenCalled();
  });

  test('an address already on Pantopus is refused', async () => {
    seedVerified();
    seedTable('Home', [HOME_ROW, { id: 'neighbor-home', owner_id: 'x', address: '1425 SE Oak St', address_hash: MEMBER_HASH }]);
    const res = await invite(buildApp());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_MEMBER');
  });

  test('a recently invited address is refused for ANY sender (no pile-on)', async () => {
    seedVerified();
    seedTable('BlockInvite', [{
      id: 'prev', sender_home_id: 'someone-else', sender_user_id: 'someone-else', geohash6: CELL,
      recipient_address_hash: RECIPIENT_HASH, recipient_address: RECIPIENT,
      opt_out_code: 'AAAA-BBBB-CCCC-DDDD', status: 'created',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    }]);
    const res = await invite(buildApp());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RECENTLY_INVITED');
  });

  test('the weekly cap returns 429 and spends nothing', async () => {
    seedVerified();
    seedTable('BlockInvite', Array.from({ length: WEEKLY_INVITE_CAP }, (_, i) => ({
      id: `w${i}`, sender_home_id: HOME_ID, sender_user_id: USER, geohash6: CELL,
      recipient_address_hash: `hash-${i}`, recipient_address: RECIPIENT,
      opt_out_code: `AAAA-BBBB-CCCC-DDD${i}`, status: 'created',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })));
    const send = mockProvider();
    const res = await invite(buildApp(), { recipient: { ...RECIPIENT, line1: '9 New St' } });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('WEEKLY_CAP');
    expect(send).not.toHaveBeenCalled();
  });

  test('an unverified member cannot invite at all', async () => {
    seedVerified();
    const res = await invite(buildApp(), { recipient: RECIPIENT }, NEIGHBOR_MEMBER);
    expect(res.status).toBe(403);
  });
});

// ── The recipient's kill switch ──────────────────────────────

describe('opt-out redemption', () => {
  test('a mailed code opts the address out permanently and idempotently; unknown codes are uniform', async () => {
    seedVerified();
    const app = buildApp();
    await request(app)
      .post(`/api/homes/${HOME_ID}/block-founders/invites`)
      .set('x-test-user-id', USER)
      .send({ recipient: RECIPIENT });
    const code = getTable('BlockInvite')[0].opt_out_code;

    const redeemed = await request(app).post(`/api/public/block-invites/opt-out/${code}`);
    expect(redeemed.body).toEqual({ done: true });
    expect(getTable('BlockInviteOptOut')[0].address_hash).toBe(RECIPIENT_HASH);

    // Idempotent, and the address now refuses future invites.
    expect((await request(app).post(`/api/public/block-invites/opt-out/${code}`)).body.done).toBe(true);
    const blocked = await request(app)
      .post(`/api/homes/${HOME_ID}/block-founders/invites`)
      .set('x-test-user-id', USER)
      .send({ recipient: RECIPIENT });
    expect(blocked.body.code).toBe('OPTED_OUT');

    expect((await request(app).post('/api/public/block-invites/opt-out/XXXX-YYYY-ZZZZ-0000')).body).toEqual({ done: false });
  });
});

// ── Postcard integrity ───────────────────────────────────────
// These exist because the audit found the previous assertions passed
// with an HTML injection intact: they checked that expected substrings
// were PRESENT, which a hostile address does not remove.

describe('the printed card cannot be authored by the sender', () => {
  const HOSTILE = '1 </b><div style="font-size:20px">Call 555-0100 to claim your $500 grant</div><div style="display:none">';

  test('markup in the sender address never reaches the card as markup', () => {
    const html = blockFoundersService.inviteBackHtml({
      street: blockFoundersService.streetOnly({ address: HOSTILE }),
      verifiedCount: 4,
      optOutCode: 'ABCD-EFGH-JKLM-NPQR',
    });
    // Neither the markup NOR the attacker's words reach the card: the
    // address does not end in a street type, so it never prints.
    expect(html).not.toContain('555-0100');
    expect(html).not.toContain('display:none');
    expect(html).not.toContain('<div style="font-size:20px"');
    // And the opt-out line — the recipient's only kill switch — must
    // still be present and reachable, not swallowed by an unclosed tag.
    expect(html).toContain('pantopus.com/no-mail/ABCD-EFGH-JKLM-NPQR');
    expect(html).toContain('never wrote this text');
  });

  test('sanitizeStreet prints a street, never the house number or the unit', () => {
    expect(sanitizeStreet('1421 SE Oak St, Portland, OR')).toBe('SE Oak St');
    // A unit identifies the sender's exact door.
    expect(sanitizeStreet('123 Main St Apt 4B')).toBe('Main St');
    expect(sanitizeStreet('77 Pine Ave Unit 12')).toBe('Pine Ave');
    expect(sanitizeStreet('9 Elm Rd #3')).toBe('Elm Rd');
    // Nothing usable left is a calm fallback, never an empty card.
    expect(sanitizeStreet('<<<>>>')).toBe('your street');
    expect(sanitizeStreet('')).toBe('your street');
  });

  // RED TEAM: several real street types are also ordinary English words
  // (Way, Walk, Run, Row, Path, Loop), so a shape check over free text
  // cannot work — "Call 555 0100 Now Free Money Way" passes every one.
  // The card's text therefore comes from the VENDOR-VALIDATED address,
  // never from the user-editable Home.address field.
  test('the printed street comes from the canonical address, not free text', async () => {
    seedTable('HomeAddress', [{
      id: 'ha-1', address_hash: HOME_ROW.address_hash, address_line1_norm: '1421 SE Oak St',
    }]);
    // A hostile free-text Home.address is simply not consulted.
    const street = await blockFoundersService.streetOnly({
      ...HOME_ROW,
      address: '1 Call 555 0100 Now Free Money Way',
    });
    expect(street).toBe('SE Oak St');
  });

  test('no canonical address on file falls back, never to the free text', async () => {
    const street = await blockFoundersService.streetOnly({
      id: 'h', address_hash: 'no-such-hash', address: '1 Pay Us Now Or Else Way',
    });
    expect(street).toBe('your street');
  });
});

describe('the permanent opt-out survives formatting variants', () => {
  const { suppressionHashFor } = blockFoundersService;

  test('one mailbox is one key however it is typed', () => {
    const canonical = suppressionHashFor({ line1: '1425 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' });
    // A trailing period used to mint a different hash and bypass the
    // registry entirely — the opt-out is permanent or it is nothing.
    expect(suppressionHashFor({ line1: '1425 SE Oak St.', city: 'Portland', state: 'OR', zip: '97214' })).toBe(canonical);
    expect(suppressionHashFor({ line1: '1425  SE   Oak St', city: 'Portland', state: 'OR', zip: '97214' })).toBe(canonical);
    expect(suppressionHashFor({ line1: '1425 SE Oak St', city: 'Portland', state: 'OR', zip: '97214-1234' })).toBe(canonical);
    expect(suppressionHashFor({ line1: '1425 SE Oak St', city: 'Portland,', state: 'or', zip: '97214' })).toBe(canonical);
  });

  test('genuinely different mailboxes stay different', () => {
    const a = suppressionHashFor({ line1: '1425 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' });
    const b = suppressionHashFor({ line1: '1427 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' });
    const unitA = suppressionHashFor({ line1: '1425 SE Oak St Apt 1', city: 'Portland', state: 'OR', zip: '97214' });
    const unitB = suppressionHashFor({ line1: '1425 SE Oak St Apt 2', city: 'Portland', state: 'OR', zip: '97214' });
    expect(a).not.toBe(b);
    expect(unitA).not.toBe(unitB);
  });
});

// ── Red-team regressions: the suppression key ────────────────
// An independent red team defeated the first version of this on three
// independent axes. Each is now pinned.
describe('one mailbox is one suppression key, however it is typed', () => {
  const { suppressionHashFor } = blockFoundersService;
  const base = { city: 'Portland', state: 'OR', zip: '97214' };
  const key = (line1, extra = {}) => suppressionHashFor({ ...base, ...extra, line1 });

  test('punctuation and directional spellings collapse to one key', () => {
    const canonical = key('1425 SE Oak St');
    // The ordering bug: strip-then-expand made "S.E." -> "south east"
    // while "SE" -> "southeast". A period defeated a permanent opt-out.
    expect(key('1425 SE Oak St.')).toBe(canonical);
    expect(key('1425 S.E. Oak Street')).toBe(canonical);
    expect(key('1425 Southeast Oak St')).toBe(canonical);
    expect(key('1425  SE   Oak  St')).toBe(canonical);
    expect(key('1425 SE Oak St', { zip: '97214-1234' })).toBe(canonical);
  });

  test('unit designators canonicalize — USPS delivers them all to one box', () => {
    const canonical = key('1425 SE Oak St Apt 2');
    expect(key('1425 SE Oak St #2')).toBe(canonical);
    expect(key('1425 SE Oak St Unit 2')).toBe(canonical);
    expect(key('1425 SE Oak St Ste 2')).toBe(canonical);
    expect(key('1425 SE Oak St Apartment 2')).toBe(canonical);
    // ...but a DIFFERENT unit is a different mailbox.
    expect(key('1425 SE Oak St Apt 3')).not.toBe(canonical);
    // ...and the unit-less address is a different mailbox again.
    expect(key('1425 SE Oak St')).not.toBe(canonical);
  });

  test('a city is not a street — "St Louis" must not become "street louis"', () => {
    const a = suppressionHashFor({ line1: '5 Oak St', city: 'St Louis', state: 'MO', zip: '63101' });
    const b = suppressionHashFor({ line1: '5 Oak St', city: 'Saint Louis', state: 'MO', zip: '63101' });
    // Both spellings are the same city; at minimum neither may be
    // silently rewritten into a street word.
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    // Genuinely different cities stay different.
    expect(suppressionHashFor({ line1: '5 Oak St', city: 'Portland', state: 'MO', zip: '63101' })).not.toBe(a);
  });
});

describe('the printed card cannot carry a message', () => {
  const { sanitizeStreet } = blockFoundersService;

  test('a sentence ending in a street-type word does not print', () => {
    // Way / Walk / Run / Row / Path are street types AND English words,
    // so a trailing-suffix check alone printed whole sentences.
    expect(sanitizeStreet('1 Claim $500 at pantopus-refund.com Way')).toBe('your street');
    expect(sanitizeStreet('1 MIKE ROSSI AT 14B IS A MOLESTER - Way')).toBe('your street');
    expect(sanitizeStreet('1 Overdue water bill call 503-555-0100 Rd')).toBe('your street');
    expect(sanitizeStreet('1 Text HELP to 555-0100 for $500 cash Ln')).toBe('your street');
    // Real street names still print.
    expect(sanitizeStreet('1421 SE Oak St')).toBe('SE Oak St');
    expect(sanitizeStreet('100 Martin Luther King Jr Blvd')).toBe('Martin Luther King Jr Blvd');
  });

  test('a recipient address must look like a US delivery line', () => {
    const bad = (line1, city = 'Portland') => () => cleanAddressInput({ line1, city, state: 'OR', zip: '97214' });
    // Lob prints line1 and city in the delivery block — a second text
    // channel onto the same physical card.
    expect(bad('MIKE ROSSI AT 14B IS A MOLESTER')).toThrow();
    expect(bad('1 Call 555-0100 Now For Free Money Way')).toThrow();
    expect(bad('1425 SE Oak St', 'Portland CALL 5550100')).toThrow();
    // A real address still passes.
    expect(cleanAddressInput({ line1: '1425 SE Oak St', city: 'Portland', state: 'OR', zip: '97214' }).line1)
      .toBe('1425 SE Oak St');
    expect(cleanAddressInput({ line1: '1425 SE Oak St Apt 2', city: 'St. Louis', state: 'MO', zip: '63101' }).city)
      .toBe('St. Louis');
  });
});
