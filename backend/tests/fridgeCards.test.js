// ============================================================
// TEST: Fridge Card (Wave 1, #2)
//
// The invariants that matter:
//   * the address block is SERVER-derived — client content can never
//     write it, and the card always leads with the verified address;
//   * section content is shape-validated and length-capped, and a card
//     outside the vocabulary is rejected, not coerced;
//   * issuing requires home-manage AND verified occupancy; listing is
//     household-wide (unlike personal letters/claims);
//   * a REVOKED card's public page returns NO content — revocation
//     actually pulls health-adjacent data;
//   * unknown codes are a uniform { valid: false }.
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const fridgeCardService = require('../services/fridgeCardService');
const { normalizeSections, addressBlockFromHome, FridgeCardError } = fridgeCardService;
const fridgeCardRoutes = require('../routes/fridgeCards');
const publicRoutes = require('../routes/public');

const OWNER = 'fc-owner-1';
const MEMBER = 'fc-member-1';
const HOME_ID = 'home-fc-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', fridgeCardRoutes);
  app.use('/api/public', publicRoutes);
  return app;
}

function seedHousehold({ ownerVerification = 'verified' } = {}) {
  seedTable('Home', [{
    id: HOME_ID,
    owner_id: OWNER,
    address: '1421 SE Oak St, Portland, OR 97214',
    address2: 'Unit B',
    city: 'Portland',
    state: 'OR',
    zipcode: '97214',
  }]);
  seedTable('User', [
    { id: OWNER, first_name: 'Dana', last_name: 'Whitfield' },
    { id: MEMBER, first_name: 'Sam', last_name: 'Whitfield' },
  ]);
  seedTable('HomeOccupancy', [
    {
      id: 'fc-occ-1',
      home_id: HOME_ID,
      user_id: OWNER,
      is_active: true,
      role: 'owner',
      role_base: 'owner',
      verification_status: ownerVerification,
    },
    {
      id: 'fc-occ-2',
      home_id: HOME_ID,
      user_id: MEMBER,
      is_active: true,
      role: 'member',
      role_base: 'member',
      verification_status: 'verified',
    },
  ]);
}

const SECTIONS = [
  { key: 'household', items: [{ label: 'Mia (6)', note: 'Peanut allergy — EpiPen in the pantry, left shelf' }] },
  { key: 'pets', items: [{ label: 'Biscuit', note: 'Golden retriever, friendly' }] },
  { key: 'utilities', items: [{ label: 'Gas shutoff', note: 'Left side of the house, behind the hydrangea' }] },
];

function issue(app, body, userId = OWNER) {
  return request(app)
    .post(`/api/homes/${HOME_ID}/fridge-cards`)
    .set('x-test-user-id', userId)
    .send(body);
}

beforeEach(() => resetTables());

// ── Content normalization (pure) ─────────────────────────────

describe('normalizeSections', () => {
  test('keeps known sections, drops empty items, caps lengths', () => {
    const out = normalizeSections([
      { key: 'household', items: [{ label: '  Mia   (6) ', note: 'x'.repeat(500) }, { label: '', note: '' }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(1);
    expect(out[0].items[0].label).toBe('Mia (6)');
    expect(out[0].items[0].note).toHaveLength(160);
  });

  test('rejects unknown keys, duplicates, and empty cards', () => {
    expect(() => normalizeSections([{ key: 'passwords', items: [{ label: 'x' }] }])).toThrow(FridgeCardError);
    expect(() => normalizeSections([
      { key: 'pets', items: [{ label: 'a' }] },
      { key: 'pets', items: [{ label: 'b' }] },
    ])).toThrow(FridgeCardError);
    expect(() => normalizeSections([])).toThrow(FridgeCardError);
    expect(() => normalizeSections([{ key: 'pets', items: [] }])).toThrow(FridgeCardError);
  });
});

describe('addressBlockFromHome', () => {
  test('street + unit and city/state/zip, derived from the home row', () => {
    expect(addressBlockFromHome({
      address: '1421 SE Oak St, Portland, OR 97214',
      address2: 'Unit B',
      city: 'Portland',
      state: 'OR',
      zipcode: '97214',
    })).toEqual({ line1: '1421 SE Oak St Unit B', city_state_zip: 'Portland, OR 97214' });
  });
});

// ── Issue gates ──────────────────────────────────────────────

describe('issuing', () => {
  test('an unverified manager cannot issue', async () => {
    seedHousehold({ ownerVerification: 'pending' });
    const res = await issue(buildApp(), { sections: SECTIONS });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VERIFICATION_REQUIRED');
  });

  test('a verified non-manager member cannot issue', async () => {
    seedHousehold();
    const res = await issue(buildApp(), { sections: SECTIONS }, MEMBER);
    expect(res.status).toBe(403);
  });

  test('a verified manager issues a card whose address is server-derived', async () => {
    seedHousehold();
    const res = await issue(buildApp(), {
      label: 'Sitter card',
      sections: SECTIONS,
      // A hostile client trying to write the address block:
      content: { address: { line1: 'attacker street' } },
    });
    expect(res.status).toBe(201);
    const { card } = res.body;
    expect(card.content.address).toEqual({ line1: '1421 SE Oak St Unit B', city_state_zip: 'Portland, OR 97214' });
    expect(card.content.sections).toHaveLength(3);
    expect(card.label).toBe('Sitter card');
    expect(card.card_url).toContain(`/fridge-card/${card.card_code}`);
  });

  test('out-of-vocabulary content is a 400, not coerced', async () => {
    seedHousehold();
    const res = await issue(buildApp(), { sections: [{ key: 'wifi_password', items: [{ label: 'hunter2' }] }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_CONTENT');
    expect(getTable('FridgeCard')).toHaveLength(0);
  });
});

// ── Household visibility + public page ───────────────────────

describe('the card in use', () => {
  async function issuedCard(app) {
    const res = await issue(app, { label: 'Sitter card', sections: SECTIONS });
    expect(res.status).toBe(201);
    return res.body.card;
  }

  test('any household member sees the home cards list', async () => {
    seedHousehold();
    const app = buildApp();
    await issuedCard(app);

    const list = await request(app)
      .get(`/api/homes/${HOME_ID}/fridge-cards`)
      .set('x-test-user-id', MEMBER);
    expect(list.status).toBe(200);
    expect(list.body.cards).toHaveLength(1);
    expect(list.body.cards[0].content.sections).toHaveLength(3);
  });

  test('the public page serves the frozen card while active and counts views', async () => {
    seedHousehold();
    const app = buildApp();
    const card = await issuedCard(app);

    const res = await request(app).get(`/api/public/fridge-cards/${card.card_code}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.status).toBe('active');
    expect(res.body.content.address.line1).toBe('1421 SE Oak St Unit B');
    expect(res.body.content.sections.find((s) => s.key === 'household').items[0].note).toContain('EpiPen');

    await new Promise((resolve) => setImmediate(resolve));
    expect(getTable('FridgeCard')[0].view_count).toBe(1);
  });

  test('a revoked card serves status and NO content', async () => {
    seedHousehold();
    const app = buildApp();
    const card = await issuedCard(app);

    const revoke = await request(app)
      .post(`/api/homes/${HOME_ID}/fridge-cards/${card.id}/revoke`)
      .set('x-test-user-id', OWNER);
    expect(revoke.status).toBe(200);
    expect(revoke.body.card.status).toBe('revoked');

    const res = await request(app).get(`/api/public/fridge-cards/${card.card_code}`);
    expect(res.body).toMatchObject({ valid: true, status: 'revoked' });
    expect(res.body.content).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('EpiPen');
    expect(JSON.stringify(res.body)).not.toContain('Oak St');
  });

  test('a non-manager member cannot revoke; unknown codes are uniform', async () => {
    seedHousehold();
    const app = buildApp();
    const card = await issuedCard(app);

    const revoke = await request(app)
      .post(`/api/homes/${HOME_ID}/fridge-cards/${card.id}/revoke`)
      .set('x-test-user-id', MEMBER);
    expect(revoke.status).toBe(403);

    const res = await request(app).get('/api/public/fridge-cards/AAAA-BBBB-CCCC-DDDD');
    expect(res.body).toEqual({ valid: false });
  });
});
