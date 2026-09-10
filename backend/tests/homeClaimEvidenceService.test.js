const db = require('./__mocks__/supabaseAdmin');
const storage = require('../services/homeClaimEvidenceStorage');
jest.mock('../services/homeClaimEvidenceStorage', () => ({ ...jest.requireActual('../services/homeClaimEvidenceStorage'),
  prepare: jest.fn(), upload: jest.fn(), download: jest.fn(), remove: jest.fn() }));
const media = require('../services/homeClaimEvidenceService');
const args = { homeId: 'ddf10001-0000-4000-8000-000000000100', claimId: 'ddf10001-0000-4000-8000-000000000200',
  actorId: 'ddf10001-0000-4000-8000-000000000001', evidenceType: 'deed', uploadId: 'ddf10001-0000-4000-8000-000000000300' };
const attempt = 'ddf10001-0000-4000-8000-000000000400';
const file = { originalname: 'private.txt', mimetype: 'text/plain', buffer: Buffer.from('test') };
const detail = storage.inspect(file);
const ref = { upload_id: args.uploadId, home_id: args.homeId, claim_id: args.claimId, bucket: 'private-test',
  sha256: detail.sha256, size: 4, mime_type: 'text/plain', upload_attempt: attempt, cleanup_claim: attempt };
const record = state => ({ id: args.uploadId, home_id: args.homeId, claim_id: args.claimId, uploaded_by: args.actorId,
  file_name: 'private.txt', file_size: 4, mime_type: 'text/plain', status: 'pending', evidence_type: 'deed', provider: 'manual', eligible_for_review: false, state, available: state === 'ready', cleanup_pending: state === 'retired' });
const ok = data => ({ data, error: null });
const receipt = state => ok({ ok: true, record: record(state), storage: ref });
const read = () => ok({ ok: true, home_id: args.homeId, claim_id: args.claimId, records: [record('ready')], storage: ref, can_verify: true, review_token: 'a'.repeat(64) });
const deny = () => ok({ ok: false, code: 'CLAIM_EVIDENCE_DENIED', status: 403 });
let calls;
let originalRpc;
beforeEach(() => {
  jest.clearAllMocks(); calls = [];
  originalRpc = db.rpc;
  db.rpc = jest.fn();
  storage.prepare.mockResolvedValue({ bucket: ref.bucket }); storage.upload.mockResolvedValue(undefined);
  storage.download.mockResolvedValue(file.buffer); storage.remove.mockResolvedValue(undefined);
  db.rpc.mockImplementation(async (name, values) => {
    calls.push(values?.p_action || name);
    if (name === 'authorize_home_claim_evidence') return ok({ ok: true, home_id: args.homeId, claim_id: args.claimId, can_verify: true, review_token: 'a'.repeat(64) });
    if (name === 'mutate_home_claim_evidence') return receipt(values.p_action === 'retire' ? 'retired' : values.p_action === 'finalize' ? 'ready' : 'reserved');
    if (name === 'get_home_claim_evidence') return read();
    return ok(true);
  });
});
afterEach(() => { db.rpc = originalRpc; });
test('reserves before bytes, finalizes and records completion', async () => {
  storage.upload.mockImplementation(async () => expect(calls).toEqual(['authorize_home_claim_evidence', 'reserve', 'begin_upload']));
  expect(await media.upload(args, file)).toMatchObject(record('ready'));
  expect(calls).toEqual(['authorize_home_claim_evidence', 'reserve', 'begin_upload', 'finalize', 'note_home_claim_evidence_upload_finished']);
});
test('ready lost-response retry does not rewrite bytes', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, claim_id: args.claimId, can_verify: true, review_token: 'a'.repeat(64) })).mockResolvedValueOnce(receipt('ready'));
  expect((await media.upload(args, file)).state).toBe('ready'); expect(storage.upload).not.toHaveBeenCalled();
});
test('permission loss before bytes prevents provider writes', async () => {
  db.rpc.mockResolvedValueOnce(deny()); await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 403 });
  expect(storage.prepare).not.toHaveBeenCalled(); expect(storage.upload).not.toHaveBeenCalled();
});
test('quota failure prevents provider writes', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, claim_id: args.claimId, can_verify: true, review_token: 'a'.repeat(64) }))
    .mockResolvedValueOnce({ error: { code: 'P0001', message: 'FILE_QUOTA_EXCEEDED' } });
  await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 413 }); expect(storage.upload).not.toHaveBeenCalled();
});
test('failed upload retains reservation and notes possible late completion', async () => {
  storage.upload.mockRejectedValue(storage.failure('HOME_CLAIM_EVIDENCE_UPLOAD_UNAVAILABLE', 'Retry upload.'));
  await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 503 });
  expect(calls).not.toContain('finalize'); expect(calls.at(-1)).toBe('note_home_claim_evidence_upload_finished');
});
test('revocation after bytes does not report successful publication', async () => {
  const base = db.rpc.getMockImplementation();
  db.rpc.mockImplementation((name, values) => values?.p_action === 'finalize' ? deny() : base(name, values));
  await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 403 });
  expect(storage.upload).toHaveBeenCalledTimes(1); expect(calls.at(-1)).toBe('note_home_claim_evidence_upload_finished');
});
test('download rechecks access after storage bytes', async () => {
  expect(await media.download(args)).toEqual({ record: expect.objectContaining(record('ready')), bytes: file.buffer, inspection: undefined });
  expect(calls).toEqual(['get_home_claim_evidence', 'get_home_claim_evidence']);
});
test('revocation during download withholds fetched bytes', async () => {
  db.rpc.mockResolvedValueOnce(read()).mockResolvedValueOnce(deny());
  await expect(media.download(args)).rejects.toMatchObject({ statusCode: 403 }); expect(storage.download).toHaveBeenCalledTimes(1);
});
test('storage identity drift after download withholds bytes', async () => {
  db.rpc.mockResolvedValueOnce(read()).mockResolvedValueOnce(ok({ ...read().data, storage: { ...ref, sha256: 'b'.repeat(64) } }));
  await expect(media.download(args)).rejects.toMatchObject({ statusCode: 503 });
});
test('cross-claim successful receipt fails before storage', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ...read().data, storage: { ...ref, claim_id: args.homeId } }));
  await expect(media.download(args)).rejects.toMatchObject({ statusCode: 503 }); expect(storage.download).not.toHaveBeenCalled();
});
test('safe DTO removes accidental private RPC columns', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ...read().data, records: [{ ...record('ready'), file_url: 'https://private.invalid', file_key: 'private', sha256: 'a' }] }));
  const result = await media.list(args);
  for (const field of ['file_url', 'file_key', 'sha256']) expect(result.evidence[0]).not.toHaveProperty(field);
  expect(result).not.toHaveProperty('storage');
});
test('removal retires before bytes and acknowledges exact claim', async () => {
  storage.remove.mockImplementation(async () => expect(calls).toEqual(['retire']));
  expect((await media.remove(args)).cleanup_pending).toBe(false);
  expect(db.rpc).toHaveBeenLastCalledWith('finish_home_claim_evidence_cleanup', { p_upload_id: args.uploadId, p_claim: attempt, p_succeeded: true });
});
test('failed cleanup stays recoverable', async () => {
  storage.remove.mockRejectedValue(storage.failure('HOME_CLAIM_EVIDENCE_DELETE_UNAVAILABLE', 'Retry removal.'));
  await expect(media.remove(args)).rejects.toMatchObject({ statusCode: 503 });
  expect(db.rpc).toHaveBeenLastCalledWith('finish_home_claim_evidence_cleanup', { p_upload_id: args.uploadId, p_claim: attempt, p_succeeded: false });
});
test('stale cleanup acknowledgement cannot report success', async () => {
  db.rpc.mockResolvedValueOnce(receipt('retired')).mockResolvedValueOnce(ok(false));
  await expect(media.remove(args)).rejects.toMatchObject({ statusCode: 503 });
});
test('recovery skips reclaimed candidates and exposes counts only', async () => {
  const old = process.env.HOME_DOCUMENTS_BUCKET; process.env.HOME_DOCUMENTS_BUCKET = ref.bucket;
  try {
    db.rpc.mockResolvedValueOnce(ok([args.uploadId, attempt])).mockResolvedValueOnce(ok(ref)).mockResolvedValueOnce(ok(true)).mockResolvedValueOnce(ok(null));
    expect(await media.recover()).toEqual({ selected: 2, removed: 1, failed: 0, skipped: 1 });
  } finally { if (old === undefined) delete process.env.HOME_DOCUMENTS_BUCKET; else process.env.HOME_DOCUMENTS_BUCKET = old; }
});

test('inspection receipt is recorded only after exact bytes and a current reviewer snapshot', async () => {
  const base = db.rpc.getMockImplementation();
  db.rpc.mockImplementation((name, values) => name === 'record_home_claim_evidence_inspection'
    ? ok({ ok: true, home_id: args.homeId, claim_id: args.claimId, upload_id: args.uploadId,
      review_token: values.p_review_token, inspection_recorded: true }) : base(name, values));
  const result = await media.download({ ...args, reviewToken: 'a'.repeat(64), platformAdmin: true });
  expect(result.bytes).toEqual(file.buffer);
  expect(result.inspection).toMatch(/^[a-f0-9]{64}$/);
  const saved = db.rpc.mock.calls.find(([name]) => name === 'record_home_claim_evidence_inspection')[1];
  expect(saved).toMatchObject({ p_actor_id: args.actorId, p_home_id: args.homeId, p_claim_id: args.claimId,
    p_upload_id: args.uploadId, p_platform_admin: true, p_review_token: 'a'.repeat(64) });
  expect(saved.p_receipt_hash).toBe(require('crypto').createHash('sha256').update(result.inspection).digest('hex'));
  expect(saved.p_receipt_hash).not.toBe(result.inspection);
  expect(storage.download).toHaveBeenCalledTimes(1);
});

test('a stale displayed snapshot cannot fetch bytes or mint an inspection', async () => {
  await expect(media.download({ ...args, reviewToken: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'CLAIM_REVIEW_CHANGED' });
  expect(storage.download).not.toHaveBeenCalled();
  expect(db.rpc.mock.calls.some(([name]) => name === 'record_home_claim_evidence_inspection')).toBe(false);
});

test('a changed snapshot during byte download withholds bytes and its inspection', async () => {
  db.rpc.mockResolvedValueOnce(read()).mockResolvedValueOnce(ok({ ...read().data, review_token: 'b'.repeat(64) }));
  await expect(media.download({ ...args, reviewToken: 'a'.repeat(64) })).rejects.toMatchObject({ code: 'CLAIM_REVIEW_CHANGED' });
  expect(storage.download).toHaveBeenCalledTimes(1);
  expect(db.rpc.mock.calls.some(([name]) => name === 'record_home_claim_evidence_inspection')).toBe(false);
});

test('an uncertain inspection write cannot expose its capability or fetched bytes', async () => {
  const base = db.rpc.getMockImplementation();
  db.rpc.mockImplementation((name, values) => name === 'record_home_claim_evidence_inspection' ? { error: { code: 'timeout' } } : base(name, values));
  await expect(media.download({ ...args, reviewToken: 'a'.repeat(64) })).rejects.toMatchObject({ statusCode: 503 });
});

test('verification requires the exact inspected receipt and does not approve the claim', async () => {
  db.rpc.mockResolvedValue(ok({ ok: true, home_id: args.homeId, claim_id: args.claimId, upload_id: args.uploadId,
    action: 'verify_evidence', review_token: 'b'.repeat(64), replayed: false,
    record: { ...record('ready'), status: 'verified', eligible_for_review: true } }));
  const result = await media.verify({ ...args, reviewToken: 'a'.repeat(64), inspection: 'c'.repeat(64), platformAdmin: true });
  expect(result.record.status).toBe('verified');
  expect(db.rpc).toHaveBeenCalledTimes(1);
  expect(db.rpc).toHaveBeenCalledWith('verify_home_claim_evidence', { p_home_id: args.homeId, p_claim_id: args.claimId,
    p_actor_id: args.actorId, p_upload_id: args.uploadId, p_platform_admin: true, p_review_token: 'a'.repeat(64),
    p_receipt_hash: require('crypto').createHash('sha256').update('c'.repeat(64)).digest('hex') });
});

test.each([null, '', 'not-an-inspection'])('missing inspection %s cannot verify', async inspection => {
  await expect(media.verify({ ...args, reviewToken: 'a'.repeat(64), inspection })).rejects.toMatchObject({ code: 'CLAIM_EVIDENCE_INSPECTION_REQUIRED' });
  expect(db.rpc).not.toHaveBeenCalled();
});

test('a mismatched verification receipt never reports success', async () => {
  db.rpc.mockResolvedValue(ok({ ok: true, home_id: args.homeId, claim_id: args.homeId, upload_id: args.uploadId,
    action: 'verify_evidence', review_token: 'b'.repeat(64), replayed: false,
    record: { ...record('ready'), status: 'verified', eligible_for_review: true } }));
  await expect(media.verify({ ...args, reviewToken: 'a'.repeat(64), inspection: 'c'.repeat(64) })).rejects.toMatchObject({ statusCode: 503 });
});
