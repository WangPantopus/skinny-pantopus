const db = require('./__mocks__/supabaseAdmin');
const storage = require('../services/homeTaskMediaStorage');
jest.mock('../services/homeTaskMediaStorage', () => ({ ...jest.requireActual('../services/homeTaskMediaStorage'),
  prepare: jest.fn(), upload: jest.fn(), download: jest.fn(), remove: jest.fn() }));
const media = require('../services/homeTaskMediaService');
const args = { homeId: 'ddf10001-0000-4000-8000-000000000100', taskId: 'ddf10001-0000-4000-8000-000000000200',
  actorId: 'ddf10001-0000-4000-8000-000000000001', uploadId: 'ddf10001-0000-4000-8000-000000000300' };
const attempt = 'ddf10001-0000-4000-8000-000000000400';
const file = { originalname: 'private.txt', mimetype: 'text/plain', buffer: Buffer.from('test') };
const detail = storage.inspect(file);
const ref = { upload_id: args.uploadId, home_id: args.homeId, task_id: args.taskId, bucket: 'private-test',
  sha256: detail.sha256, size: 4, mime_type: 'text/plain', upload_attempt: attempt, cleanup_claim: attempt };
const record = state => ({ id: args.uploadId, home_id: args.homeId, task_id: args.taskId, uploaded_by: args.actorId,
  file_name: 'private.txt', file_size: 4, mime_type: 'text/plain', state, available: state === 'ready', cleanup_pending: state === 'retired' });
const ok = data => ({ data, error: null });
const receipt = state => ok({ ok: true, record: record(state), storage: ref });
const read = () => ok({ ok: true, home_id: args.homeId, task_id: args.taskId, records: [record('ready')], storage: ref, can_upload: true });
const deny = () => ok({ ok: false, code: 'HOME_RECORD_DENIED', status: 403 });
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
    if (name === 'authorize_home_task_media') return ok({ ok: true, home_id: args.homeId, task_id: args.taskId, can_upload: true });
    if (name === 'mutate_home_task_media') return receipt(values.p_action === 'retire' ? 'retired' : values.p_action === 'finalize' ? 'ready' : 'reserved');
    if (name === 'get_home_task_media') return read();
    return ok(true);
  });
});
afterEach(() => { db.rpc = originalRpc; });
test('reserves before bytes, finalizes and records completion', async () => {
  storage.upload.mockImplementation(async () => expect(calls).toEqual(['authorize_home_task_media', 'reserve', 'begin_upload']));
  expect(await media.upload(args, file)).toMatchObject(record('ready'));
  expect(calls).toEqual(['authorize_home_task_media', 'reserve', 'begin_upload', 'finalize', 'note_home_task_media_upload_finished']);
});
test('ready lost-response retry does not rewrite bytes', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, task_id: args.taskId, can_upload: true })).mockResolvedValueOnce(receipt('ready'));
  expect((await media.upload(args, file)).state).toBe('ready'); expect(storage.upload).not.toHaveBeenCalled();
});
test('permission loss before bytes prevents provider writes', async () => {
  db.rpc.mockResolvedValueOnce(deny()); await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 403 });
  expect(storage.prepare).not.toHaveBeenCalled(); expect(storage.upload).not.toHaveBeenCalled();
});
test('quota failure prevents provider writes', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, task_id: args.taskId, can_upload: true }))
    .mockResolvedValueOnce({ error: { code: 'P0001', message: 'FILE_QUOTA_EXCEEDED' } });
  await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 413 }); expect(storage.upload).not.toHaveBeenCalled();
});
test('failed upload retains reservation and notes possible late completion', async () => {
  storage.upload.mockRejectedValue(storage.failure('HOME_TASK_MEDIA_UPLOAD_UNAVAILABLE', 'Retry upload.'));
  await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 503 });
  expect(calls).not.toContain('finalize'); expect(calls.at(-1)).toBe('note_home_task_media_upload_finished');
});
test('revocation after bytes does not report successful publication', async () => {
  const base = db.rpc.getMockImplementation();
  db.rpc.mockImplementation((name, values) => values?.p_action === 'finalize' ? deny() : base(name, values));
  await expect(media.upload(args, file)).rejects.toMatchObject({ statusCode: 403 });
  expect(storage.upload).toHaveBeenCalledTimes(1); expect(calls.at(-1)).toBe('note_home_task_media_upload_finished');
});
test('download rechecks access after storage bytes', async () => {
  expect(await media.download(args)).toEqual({ record: expect.objectContaining(record('ready')), bytes: file.buffer });
  expect(calls).toEqual(['get_home_task_media', 'get_home_task_media']);
});
test('revocation during download withholds fetched bytes', async () => {
  db.rpc.mockResolvedValueOnce(read()).mockResolvedValueOnce(deny());
  await expect(media.download(args)).rejects.toMatchObject({ statusCode: 403 }); expect(storage.download).toHaveBeenCalledTimes(1);
});
test('storage identity drift after download withholds bytes', async () => {
  db.rpc.mockResolvedValueOnce(read()).mockResolvedValueOnce(ok({ ...read().data, storage: { ...ref, sha256: 'b'.repeat(64) } }));
  await expect(media.download(args)).rejects.toMatchObject({ statusCode: 503 });
});
test('cross-task successful receipt fails before storage', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ...read().data, storage: { ...ref, task_id: args.homeId } }));
  await expect(media.download(args)).rejects.toMatchObject({ statusCode: 503 }); expect(storage.download).not.toHaveBeenCalled();
});
test('safe DTO removes accidental private RPC columns', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ...read().data, records: [{ ...record('ready'), file_url: 'https://private.invalid', file_key: 'private', sha256: 'a' }] }));
  const result = await media.list(args);
  for (const field of ['file_url', 'file_key', 'sha256']) expect(result.media[0]).not.toHaveProperty(field);
  expect(result).not.toHaveProperty('storage');
});
test('removal retires before bytes and acknowledges exact claim', async () => {
  storage.remove.mockImplementation(async () => expect(calls).toEqual(['retire']));
  expect((await media.remove(args)).cleanup_pending).toBe(false);
  expect(db.rpc).toHaveBeenLastCalledWith('finish_home_task_media_cleanup', { p_upload_id: args.uploadId, p_claim: attempt, p_succeeded: true });
});
test('failed cleanup stays recoverable', async () => {
  storage.remove.mockRejectedValue(storage.failure('HOME_TASK_MEDIA_DELETE_UNAVAILABLE', 'Retry removal.'));
  await expect(media.remove(args)).rejects.toMatchObject({ statusCode: 503 });
  expect(db.rpc).toHaveBeenLastCalledWith('finish_home_task_media_cleanup', { p_upload_id: args.uploadId, p_claim: attempt, p_succeeded: false });
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
test('task deletion retires and drains attachments before deleting the record', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, task_id: args.taskId, cleanup: [ref] }))
    .mockResolvedValueOnce(ok(true)).mockResolvedValueOnce(ok({ ok: true, record: { id: args.taskId, home_id: args.homeId } }));
  storage.remove.mockImplementation(async () => expect(db.rpc).toHaveBeenCalledTimes(1));
  expect((await media.deleteTask(args)).record.id).toBe(args.taskId);
  expect(db.rpc.mock.calls.map(call => call[0])).toEqual(['retire_home_task_media_for_delete', 'finish_home_task_media_cleanup', 'delete_home_task_after_media']);
});
test('failed task cleanup retains the task and does not attempt deletion', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, task_id: args.taskId, cleanup: [ref] })).mockResolvedValueOnce(ok(true));
  storage.remove.mockRejectedValue(storage.failure('HOME_TASK_MEDIA_DELETE_UNAVAILABLE', 'Retry removal.'));
  await expect(media.deleteTask(args)).rejects.toMatchObject({ statusCode: 503 });
  expect(db.rpc.mock.calls.map(call => call[0])).not.toContain('delete_home_task_after_media');
});
test('attachment-free task deletion does not require configured storage', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, task_id: args.taskId, cleanup: [] }))
    .mockResolvedValueOnce(ok({ ok: true, record: { id: args.taskId, home_id: args.homeId } }));
  await media.deleteTask(args); expect(storage.prepare).not.toHaveBeenCalled(); expect(storage.remove).not.toHaveBeenCalled();
});
test('concurrent new attachment causes one bounded cleanup retry before task deletion', async () => {
  const batch = ok({ ok: true, home_id: args.homeId, task_id: args.taskId, cleanup: [] });
  db.rpc.mockResolvedValueOnce(batch).mockResolvedValueOnce(ok({ ok: false, code: 'HOME_TASK_MEDIA_CLEANUP_REQUIRED', status: 409 }))
    .mockResolvedValueOnce(batch).mockResolvedValueOnce(ok({ ok: true, record: { id: args.taskId, home_id: args.homeId } }));
  await media.deleteTask(args); expect(db.rpc).toHaveBeenCalledTimes(4);
});
test('cross-Home task cleanup receipt fails before provider removal', async () => {
  db.rpc.mockResolvedValueOnce(ok({ ok: true, home_id: args.homeId, task_id: args.taskId, cleanup: [{ ...ref, home_id: args.taskId }] }));
  await expect(media.deleteTask(args)).rejects.toMatchObject({ statusCode: 503 }); expect(storage.remove).not.toHaveBeenCalled();
});
