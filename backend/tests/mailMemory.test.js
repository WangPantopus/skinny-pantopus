// Actual before: 20261002-stream4-memory-nonempty-before-r1. No existing test
// exercises this read's otd IDs through validation and the stored DATE contract.
// Reuse the project's Supertest/Supabase harness; no new persistence fixture kit.
const express = require('express');
const request = require('supertest');
const db = require('./__mocks__/supabaseAdmin');
const routes = require('../routes/mailboxV2Phase3');

const OWNER = 'ed310001-0000-4000-8000-000000000001';
const OTHER = 'ed310001-0000-4000-8000-000000000002';
const MAIL = 'ed310001-0000-4000-8000-000000000100';
const STORED = 'ed310001-0000-4000-8000-000000000200';
const MEMORY = 'otd-2025-10-2';
function app() {
  const result = express();
  result.use(express.json());
  result.use('/api/mailbox/v2/p3', routes);
  return result;
}
function seedMail(overrides = {}) {
  db.seedTable('Mail', [{ id: MAIL, recipient_user_id: OWNER,
    subject: 'Synthetic retained notice', category: 'personal',
    created_at: '2025-10-02T12:00:00.000Z', deleted_at: null, ...overrides }]);
}
function dismiss(memoryId = MEMORY, user = OWNER) {
  return request(app()).post('/api/mailbox/v2/p3/memory/dismiss')
    .set('x-test-user-id', user).send({ memoryId });
}
function read() {
  return request(app()).get('/api/mailbox/v2/p3/memory/on-this-day')
    .set('x-test-user-id', OWNER);
}
beforeEach(() => {
  db.resetTables();
  jest.useFakeTimers({ now: new Date('2026-10-02T12:00:00Z'),
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'performance', 'hrtime'] });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('anniversary read preserves native items and supplies the web related IDs', async () => {
  seedMail();
  const res = await read();
  expect(res.status).toBe(200);
  expect(res.body.memories).toHaveLength(1);
  expect(res.body.memories[0]).toMatchObject({ id: MEMORY,
    mail_ids: [MAIL], mail_items: [{ id: MAIL }], dismissed: false });
});

test('returned card ID survives validation, stores real columns, and rereads dismissed', async () => {
  seedMail();
  expect((await dismiss()).status).toBe(200);
  const rows = db.getTable('MailMemory');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ user_id: OWNER, memory_type: 'on_this_day',
    reference_date: '2025-10-02', headline: '1 year ago today',
    mail_item_ids: [MAIL], dismissed: true });
  expect(rows[0].reference_id).toBeUndefined();
  expect((await read()).body.memories[0].dismissed).toBe(true);
});

test('concurrent and repeated first dismissals share one existing primary key', async () => {
  seedMail();
  const responses = await Promise.all([dismiss(), dismiss()]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  const id = db.getTable('MailMemory')[0].id;
  expect((await dismiss()).status).toBe(200);
  expect(db.getTable('MailMemory')).toHaveLength(1);
  expect(db.getTable('MailMemory')[0].id).toBe(id);
});

test('existing DATE row is reused instead of creating a competing record', async () => {
  seedMail();
  db.seedTable('MailMemory', [{ id: STORED, user_id: OWNER,
    memory_type: 'on_this_day', reference_date: '2025-10-02',
    headline: 'Earlier record', dismissed: false }]);
  expect((await dismiss()).status).toBe(200);
  expect(db.getTable('MailMemory')).toHaveLength(1);
  expect(db.getTable('MailMemory')[0]).toMatchObject({ id: STORED, dismissed: true });
});

test.each([{ recipient_user_id: OTHER }, { deleted_at: '2026-01-01T00:00:00Z' }])(
  'foreign or deleted mail cannot establish an owned memory', async overrides => {
    seedMail(overrides);
    expect((await dismiss()).status).toBe(404);
    expect(db.getTable('MailMemory')).toHaveLength(0);
  });

test.each(['otd-2025-10-1', 'otd-2025-10-02', 'otd-2020-10-2', 'otd-2027-10-2'])(
  'an ineligible card %s never writes a row', async id => {
    seedMail();
    expect((await dismiss(id)).status).toBe(404);
    expect(db.getTable('MailMemory')).toHaveLength(0);
  });

test('UUID callers can dismiss their stored row but cannot touch another owner', async () => {
  db.seedTable('MailMemory', [{ id: STORED, user_id: OWNER,
    memory_type: 'on_this_day', reference_date: '2025-10-02',
    headline: 'Earlier record', dismissed: false }]);
  expect((await dismiss(STORED, OTHER)).status).toBe(404);
  expect(db.getTable('MailMemory')[0].dismissed).toBe(false);
  expect((await dismiss(STORED)).status).toBe(200);
  expect(db.getTable('MailMemory')[0].dismissed).toBe(true);
});

test('foreign and other-type dismissals do not hide the current anniversary', async () => {
  seedMail();
  db.seedTable('MailMemory', [
    { id: STORED, user_id: OTHER, memory_type: 'on_this_day',
      reference_date: '2025-10-02', dismissed: true },
    { id: 'ed310001-0000-4000-8000-000000000201', user_id: OWNER,
      memory_type: 'year_in_mail', reference_date: '2025-10-02', dismissed: true },
  ]);
  expect((await read()).body.memories[0].dismissed).toBe(false);
});

test.each(['read', 'dismiss'])('failed stored-row %s is an error, never false success', async action => {
  seedMail();
  const original = db.from.bind(db);
  jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = original(table);
    if (table === 'MailMemory') builder.then = (yes, no) => Promise.resolve({
      data: null, error: { message: 'Synthetic private database failure' },
    }).then(yes, no);
    return builder;
  });
  const res = await (action === 'read' ? read() : dismiss());
  expect(res.status).toBe(500);
  expect(JSON.stringify(res.body)).not.toContain('private database failure');
  expect(db.getTable('MailMemory')).toHaveLength(0);
});

test('failed upsert is not reported as a completed dismissal', async () => {
  seedMail();
  const original = db.from.bind(db);
  jest.spyOn(db, 'from').mockImplementation(table => {
    const builder = original(table);
    if (table === 'MailMemory') {
      const upsert = builder.upsert.bind(builder);
      builder.upsert = (...args) => {
        upsert(...args);
        builder.then = (yes, no) => Promise.resolve({
          data: null, error: { message: 'Synthetic private write failure' },
        }).then(yes, no);
        return builder;
      };
    }
    return builder;
  });
  expect((await dismiss()).status).toBe(500);
  expect(db.getTable('MailMemory')).toHaveLength(0);
});
