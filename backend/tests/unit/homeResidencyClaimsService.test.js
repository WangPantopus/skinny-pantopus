const db = require('../../config/supabaseAdmin');
const service = require('../../services/homeResidencyClaimsService');
const home = 'ddc27300-0000-4000-8000-000000000100';
const actor = 'ddc27300-0000-4000-8000-000000000001';
const id = n => `ddc27300-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n = 2) => ({ id: id(200 + n), home_id: home, user_id: id(n), status: 'pending',
  created_at: '2026-09-13T12:34:56.123456Z', claimed_role: 'household', claimant: { id: id(n), username: `public_${n}`, name: null } });
const result = (claims = [row()]) => ({ ok: true, home_id: home, actor_id: actor, claims });
const run = value => { db.rpc.mockResolvedValue({ data: value, error: null }); return service.list({ homeId: home, actorId: actor }); };
beforeEach(() => { db.rpc = jest.fn(); });

test('a complete authorized empty result remains distinct from failures and malformed collections', async () => {
  await expect(run(result([]))).resolves.toEqual({ home_id: home, actor_id: actor, claims: [] });
  for (const claims of [undefined, null, false, 0, '', {}, '[]']) {
    await expect(run({ ...result(), claims })).rejects.toMatchObject({ code: 'RESIDENCY_CLAIMS_UNAVAILABLE', statusCode: 503 });
  }
});
test('explicit safe projection strips upstream secrets instead of spreading claim or account rows', async () => {
  const claim = row(); claim.claimed_address = 'PRIVATE ADDRESS'; claim.review_note = 'PRIVATE NOTE';
  claim.postcard_id = id(600); claim.claimant.email = 'private@example.invalid'; claim.claimant.city = 'PRIVATE LOCALITY';
  const actual = await run({ ...result([claim]), diagnostic: 'PRIVATE OPERATOR LOG' });
  expect(actual).toEqual({ home_id: home, actor_id: actor, claims: [row()] });
  expect(JSON.stringify(actual)).not.toContain('PRIVATE');
});
test('required identity, pending status, nullable fields and profile bindings are strict JSON values', async () => {
  const changes = [ { id: [id(202)] }, { home_id: id(101) }, { user_id: [id(2)] },
    { status: 'verified' }, { status: ['pending'] }, { claimed_role: ['household'] }, { claimed_role: 'member' },
    { claimed_role: undefined }, { claimant: undefined }, { claimant: [] },
    { claimant: { ...row().claimant, id: id(3) } }, { claimant: { ...row().claimant, name: 'Legal account name' } },
    { claimant: { id: id(2), username: 'public_2' } }, { claimant: { ...row().claimant, username: false } },
    { claimant: { ...row().claimant, username: 'a'.repeat(101) } } ];
  for (const change of changes) await expect(run(result([{ ...row(), ...change }]))).rejects.toMatchObject({ statusCode: 503 });
  for (const claimed_role of ['household', 'renter', null]) {
    await expect(run(result([{ ...row(), claimed_role, claimant: null }]))).resolves.toMatchObject({ claims: [{ claimed_role, claimant: null }] });
  }
  await expect(run(result([{ ...row(), claimant: { ...row().claimant, username: null } }]))).resolves.toMatchObject({ claims: [{ claimant: { username: null } }] });
});
test('noncanonical and impossible date values fail rather than being normalized', async () => {
  for (const created_at of [undefined, false, [], '2026-02-30T00:00:00.000000Z', '2025-02-29T00:00:00.000000Z',
    '0000-01-01T00:00:00.000000Z', '2026-09-13T24:00:00.000000Z', '2026-09-13T00:60:00.000000Z',
    '2026-09-13T00:00:60.000000Z', '2026-09-13T00:00:00Z', '2026-09-13T00:00:00.000000+00:00', 'infinity']) {
    await expect(run(result([{ ...row(), created_at }]))).rejects.toMatchObject({ statusCode: 503 });
  }
  await expect(run(result([{ ...row(), created_at: '2024-02-29T00:00:00.000001Z' }]))).resolves.toHaveProperty('claims');
});
test('complete queue has no implicit page-size cutoff and preserves deterministic microsecond/id order', async () => {
  const claims = Array.from({ length: 30 }, (_, i) => row(40 - i));
  await expect(run(result(claims))).resolves.toMatchObject({ claims });
  await expect(run(result(claims.toReversed()))).rejects.toMatchObject({ statusCode: 503 });
  await expect(run(result([row(), row()]))).rejects.toMatchObject({ statusCode: 503 });
  await expect(run(result([{ ...row(3), user_id: id(2), claimant: row().claimant }, row()]))).rejects.toMatchObject({ statusCode: 503 });
  await expect(run(result([{ ...row(), created_at: '2026-09-13T12:34:56.123457Z' }, row(3)]))).resolves.toHaveProperty('claims');
});
test('accepted legacy null creation dates remain unavailable dates, ordered last without invention', async () => {
  const claims = [row(), { ...row(4), created_at: null }, { ...row(3), created_at: null }];
  await expect(run(result(claims))).resolves.toMatchObject({ claims });
  await expect(run(result([claims[1], claims[0]]))).rejects.toMatchObject({ statusCode: 503 });
  await expect(run(result([claims[0], claims[2], claims[1]]))).rejects.toMatchObject({ statusCode: 503 });
});
test('foreign actor/Home envelope, array ok and malformed RPC responses are unavailable', async () => {
  for (const value of [null, [], { ...result(), home_id: id(101) }, { ...result(), actor_id: id(3) }, { ...result(), ok: ['true'] }]) {
    await expect(run(value)).rejects.toMatchObject({ statusCode: 503 });
  }
  db.rpc.mockResolvedValue({ data: result(), error: { message: 'PRIVATE DATABASE FAILURE' } });
  await expect(service.list({ homeId: home, actorId: actor })).rejects.not.toHaveProperty('message', 'PRIVATE DATABASE FAILURE');
  db.rpc.mockRejectedValue(Error('PRIVATE CONNECTION'));
  await expect(service.list({ homeId: home, actorId: actor })).rejects.toMatchObject({ code: 'RESIDENCY_CLAIMS_UNAVAILABLE' });
});
test('only exact authoritative error/status pairs reach clients', async () => {
  for (const [code, status] of [['RESIDENCY_CLAIMS_INVALID', 400], ['HOME_NOT_FOUND', 404], ['MEMBERS_MANAGE_REQUIRED', 403], ['RESIDENCY_CLAIMS_UNAVAILABLE', 503]]) {
    await expect(run({ ok: false, code, status, error: 'PRIVATE DB DIAGNOSTIC' })).rejects.toMatchObject({ code, statusCode: status });
    await expect(run({ ok: false, code, status: 500 })).rejects.toMatchObject({ code: 'RESIDENCY_CLAIMS_UNAVAILABLE', statusCode: 503 });
  }
  await expect(run({ ok: false, code: 'UNKNOWN', status: 403 })).rejects.toMatchObject({ statusCode: 503 });
});
test('invalid client identities never reach SQL and uppercase valid identities normalize once', async () => {
  for (const homeId of [null, undefined, [home], '', 'bad']) await expect(service.list({ homeId, actorId: actor })).rejects.toMatchObject({ statusCode: 400 });
  await expect(service.list({ homeId: home, actorId: [actor] })).rejects.toMatchObject({ statusCode: 400 });
  expect(db.rpc).not.toHaveBeenCalled();
  db.rpc.mockResolvedValue({ data: result(), error: null });
  await service.list({ homeId: home.toUpperCase(), actorId: actor.toUpperCase() });
  expect(db.rpc).toHaveBeenCalledWith('list_home_current_residency_claims', { p_home_id: home, p_actor_id: actor });
});
test('error responses never reuse arbitrary upstream text or an empty claims field', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  service.sendError(res, { code: 'MEMBERS_MANAGE_REQUIRED', statusCode: 403, message: 'PRIVATE' });
  expect(res.status).toHaveBeenCalledWith(403); expect(res.json.mock.calls[0][0]).not.toHaveProperty('claims');
  expect(res.json.mock.calls[0][0].error).not.toContain('PRIVATE');
  service.sendError(res, { code: ['MEMBERS_MANAGE_REQUIRED'], statusCode: 403 });
  expect(res.status).toHaveBeenLastCalledWith(503);
});
