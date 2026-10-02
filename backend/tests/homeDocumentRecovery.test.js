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
test('retired lease evidence retains its exact cleanup key after Home and applicant deletion', async () => {
  file.home_id = null;
  file.user_id = null;
  file.metadata.storage_contract = 'home_lease_evidence_v1';
  file.metadata.original_home_id = home;
  expect(await recovery()).toMatchObject({ removed: 1 });
  expect(storage.remove).toHaveBeenCalledWith({ homeId: home, documentId: id, sha256: sha, bucketName: 'private-recovery-test' });
});
test('lease evidence cannot redirect cleanup using a document replacement key', async () => {
  file.metadata.storage_contract = 'home_lease_evidence_v1';
  file.metadata.original_home_id = home;
  file.metadata.storage_key_id = home;
  file.file_path = `${home}/${home}/${sha}`;
  expect(await recovery()).toMatchObject({ removed: 0, pending: 1 });
  expect(storage.remove).not.toHaveBeenCalled();
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

// Ordinary chat uses the same scheduled recovery surface, with its own
// persistence/provenance contract. Extend the existing recovery suite.
describe('deleted chat current-object recovery', () => {
  const { s3Client, S3_BUCKET, S3_STORAGE_NAMESPACE } = require('../config/aws');
  const service = require('../services/s3Service');
  const room = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let objectPresent; let objectMetadata; let provider;
  beforeEach(() => {
    file = { id, user_id: owner, is_deleted: true, file_type: 'chat_file',
      file_path: `chat/${room}/${owner}/${id}/${sha}.png`, metadata: { room_id: room,
        ...service.chatFileStorageReference(id, owner, room, `chat/${room}/${owner}/${id}/${sha}.png`, sha),
        storage_cleanup_fenced: true, storage_cleanup_claim: 'owned-claim' } };
    objectPresent = true; objectMetadata = service.chatFileObjectMetadata(id, owner, sha);
    provider = jest.spyOn(s3Client, 'send').mockImplementation(async command => {
      if (command.constructor.name === 'DeleteObjectCommand') { objectPresent = false; return {}; }
      if (!objectPresent) { const error = new Error('absent'); error.name = 'NotFound'; error.$metadata = { httpStatusCode: 404 }; throw error; }
      return { Metadata: objectMetadata };
    });
    rpc.mockImplementation(async name => ({ error: null, data: name === 'chat_file_cleanup_candidates' ? [id]
      : name === 'claim_chat_file_cleanup' ? structuredClone(file) : true }));
  });
  test('verifies ownership and current absence before acknowledging, without a history claim', async () => {
    expect(await recovery.chatFiles()).toEqual({ selected: 1, acknowledged: 1, pending: 0, skipped: 0 });
    expect(provider.mock.calls.map(([c]) => c.constructor.name)).toEqual(['HeadObjectCommand', 'DeleteObjectCommand', 'HeadObjectCommand']);
    expect(rpc).toHaveBeenLastCalledWith('finish_chat_file_cleanup', { p_file_id: id, p_claim: 'owned-claim', p_current_absent: true });
    expect(await service.removeDeletedChatFile(file)).toEqual({ currentObjectAbsent: true, versionHistoryVerified: false });
  });
  test('missing current bytes can recover a lost acknowledgement', async () => {
    objectPresent = false;
    expect(await recovery.chatFiles()).toMatchObject({ acknowledged: 1 });
    expect(provider.mock.calls.map(([c]) => c.constructor.name)).toEqual(['HeadObjectCommand']);
  });
  test.each(['owner', 'namespace', 'bucket', 'claim', 'version'])('does not delete an unverified %s object', async kind => {
    if (kind === 'owner') objectMetadata['pantopus-owner-id'] = room;
    if (kind === 'namespace') file.metadata.storage_namespace = S3_STORAGE_NAMESPACE + '-other';
    if (kind === 'bucket') file.metadata.storage_bucket = S3_BUCKET + '-other';
    if (kind === 'claim') file.metadata.storage_cleanup_claim = null;
    if (kind === 'version') provider.mockResolvedValue({ VersionId: 'retained-version', Metadata: objectMetadata });
    expect(await recovery.chatFiles()).toMatchObject({ acknowledged: 0, pending: 1 });
    expect(provider.mock.calls.some(([c]) => c.constructor.name === 'DeleteObjectCommand')).toBe(false);
  });
  test('provider failure remains retryable and never acknowledges absence', async () => {
    provider.mockRejectedValue(new Error('provider unavailable'));
    expect(await recovery.chatFiles()).toMatchObject({ pending: 1, acknowledged: 0 });
    expect(rpc).toHaveBeenLastCalledWith('finish_chat_file_cleanup', { p_file_id: id, p_claim: 'owned-claim', p_current_absent: false });
  });
  test('a successful delete reply with retained bytes is not an acknowledgement', async () => {
    provider.mockImplementation(async command => command.constructor.name === 'DeleteObjectCommand' ? {} : { Metadata: objectMetadata });
    expect(await recovery.chatFiles()).toMatchObject({ pending: 1, acknowledged: 0 });
  });
  test('lost persistence acknowledgement stays pending', async () => {
    rpc.mockImplementation(async name => ({ error: name === 'finish_chat_file_cleanup' ? { message: 'unavailable' } : null,
      data: name === 'chat_file_cleanup_candidates' ? [id] : name === 'claim_chat_file_cleanup' ? structuredClone(file) : true }));
    expect(await recovery.chatFiles()).toMatchObject({ pending: 1, acknowledged: 0 });
  });
  test('a reference winning the claim race skips storage', async () => {
    file = null;
    expect(await recovery.chatFiles()).toMatchObject({ skipped: 1, acknowledged: 0 });
    expect(provider).not.toHaveBeenCalled();
  });
});
