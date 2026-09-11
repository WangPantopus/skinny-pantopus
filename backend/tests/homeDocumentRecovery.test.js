const db = require('./__mocks__/supabaseAdmin');
const storage = require('../services/homeDocumentStorage');
const recovery = require('../jobs/homeDocumentRecovery');
const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const home = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sha = 'a'.repeat(64);
let file; let rpc; let previousBucket;
beforeEach(() => {
  previousBucket = process.env.HOME_DOCUMENTS_BUCKET;
  process.env.HOME_DOCUMENTS_BUCKET = 'private-recovery-test';
  file = { id, home_id: home, is_deleted: true, file_path: `${home}/${id}/${sha}`,
    metadata: { storage_contract: 'home_document_v1', storage_bucket: 'private-recovery-test',
      upload_sha256: sha, storage_cleanup_claim: 'claim' } };
  rpc = jest.fn(async name => ({ error: null, data: name === 'home_document_cleanup_candidates' ? [id]
    : name === 'claim_home_document_cleanup' ? structuredClone(file) : true }));
  db.setRpcMock(rpc);
  jest.spyOn(storage, 'remove').mockResolvedValue();
});
afterEach(() => {
  jest.restoreAllMocks();
  if (previousBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET;
  else process.env.HOME_DOCUMENTS_BUCKET = previousBucket;
});
test('removes only a claimed derived private object and acknowledges that attempt', async () => {
  expect(await recovery()).toEqual({ selected: 1, removed: 1, pending: 0, skipped: 0 });
  expect(storage.remove).toHaveBeenCalledWith({ homeId: home, documentId: id, sha256: sha, bucketName: 'private-recovery-test' });
  expect(rpc).toHaveBeenLastCalledWith('finish_home_document_cleanup', { p_file_id: id, p_claim: 'claim', p_succeeded: true });
});
test('does nothing without a configured bucket', async () => {
  delete process.env.HOME_DOCUMENTS_BUCKET;
  await recovery(); expect(rpc).not.toHaveBeenCalled();
});
test('a replaced version uses its retained unique storage key rather than its tombstone UUID', async () => {
  file.metadata.storage_key_id = home;
  file.file_path = `${home}/${home}/${sha}`;
  expect(await recovery()).toMatchObject({ removed: 1 });
  expect(storage.remove).toHaveBeenCalledWith({ homeId: home, documentId: home, sha256: sha, bucketName: 'private-recovery-test' });
});
test('selection failure performs no provider mutation', async () => {
  rpc.mockResolvedValue({ error: { message: 'private database error' } });
  await expect(recovery()).rejects.toThrow('Home document recovery selection unavailable');
  expect(storage.remove).not.toHaveBeenCalled();
});
test('a publication winning the claim race leaves its bytes untouched', async () => {
  file = null;
  expect(await recovery()).toMatchObject({ skipped: 1, removed: 0 });
  expect(storage.remove).not.toHaveBeenCalled();
});
test.each(['active', 'path', 'bucket', 'identity'])('rejects an invalid %s claim before storage', async kind => {
  if (kind === 'active') file.is_deleted = false;
  if (kind === 'path') file.file_path = 'somewhere/else';
  if (kind === 'bucket') file.metadata.storage_bucket = 'other-bucket';
  if (kind === 'identity') file.id = home;
  expect(await recovery()).toMatchObject({ pending: 1, removed: 0 });
  expect(storage.remove).not.toHaveBeenCalled();
});
test('provider failure stays pending and does not claim successful removal', async () => {
  storage.remove.mockRejectedValue(new Error('private provider message'));
  expect(await recovery()).toMatchObject({ pending: 1, removed: 0 });
  expect(rpc).toHaveBeenLastCalledWith('finish_home_document_cleanup', { p_file_id: id, p_claim: 'claim', p_succeeded: false });
});
test('a lost acknowledgement or late upload retains pending status', async () => {
  rpc.mockImplementation(async name => ({ error: null, data: name === 'home_document_cleanup_candidates' ? [id]
    : name === 'claim_home_document_cleanup' ? structuredClone(file) : false }));
  expect(await recovery()).toMatchObject({ pending: 1, removed: 0 });
});
