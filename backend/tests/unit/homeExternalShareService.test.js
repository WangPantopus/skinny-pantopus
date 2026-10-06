const crypto = require('crypto');
const db = require('../__mocks__/supabaseAdmin');
const storage = require('../../services/homeDocumentStorage');
const service = require('../../services/homeExternalShareService');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const token = 'a'.repeat(64);
const documentId = 'ddf00000-0000-4000-8000-000000000601';
const document = { id: documentId, title: 'Shared document', mime_type: 'application/pdf',
  _document: { home_id: 'home', document_id: documentId, key_id: 'replacement-version',
    sha256: 'b'.repeat(64), bucket_name: 'private-bucket', version: 'version' } };
beforeEach(() => { db.resetTables(); jest.restoreAllMocks(); });

test.each(['guest', 'scoped'])('%s issuance uses one authenticated transaction and returns only its new raw token', async kind => {
  const rpc = jest.fn(async () => ({ data: { ok: true, record: { id: 'share', token_hash: 'hidden', passcode_hash: 'hidden', resource_bindings: {} } } }));
  db.setRpcMock(rpc);
  const result = await service.mutate({ homeId: 'home', actorId: 'actor', kind, action: 'create',
    payload: { label: 'Test', passcode: '123456', token_hash: 'forged', passcode_hash: 'forged' } });
  expect(result.record).toEqual({ id: 'share' });
  expect(result.token).toMatch(/^[a-f0-9]{64}$/);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('mutate_home_external_share', expect.objectContaining({
    p_home_id: 'home', p_actor_id: 'actor', p_kind: kind, p_action: 'create', p_share_id: null,
    p_payload: { label: 'Test', token_hash: hash(result.token), passcode_hash: hash('123456') },
  }));
});
test.each(['list', 'revoke'])('%s never returns an old raw token or stored hashes', async action => {
  db.setRpcMock(async () => ({ data: { ok: true, record: { id: 'share', token_hash: 'private' },
    records: [{ id: 'share', passcode_hash: 'private' }] } }));
  const result = await service.mutate({ homeId: 'home', actorId: 'actor', kind: 'guest', action, shareId: 'share' });
  expect(result.token).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('private');
});
test('guest document view replaces storage descriptors with a hashed receipt URL', async () => {
  const rpc = jest.fn(async () => ({ data: { ok: true, view: { pass: { label: 'Guest' }, sections: { docs: [document] } } } }));
  db.setRpcMock(rpc);
  const result = await service.read({ kind: 'guest', token, recipientId: 'recipient', passcode: 'passcode' });
  const url = result.sections.docs[0].url;
  const receipt = url.split('/')[4];
  expect(url).toMatch(/^\/api\/homes\/shared-documents\/[a-f0-9]{64}\//);
  expect(JSON.stringify(result)).not.toContain('_document');
  expect(JSON.stringify(result)).not.toContain('private-bucket');
  expect(rpc).toHaveBeenCalledWith('read_home_external_share', {
    p_kind: 'guest', p_token_hash: hash(token), p_recipient_id: 'recipient',
    p_passcode_hash: hash('passcode'), p_receipt_hash: hash(receipt),
  });
});
test('download authorizes before storage and again before returning exact version bytes', async () => {
  const calls = [];
  const rpc = jest.fn(async () => { calls.push('authorize'); return { data: { ok: true, document } }; });
  db.setRpcMock(rpc);
  const download = jest.spyOn(storage, 'download').mockImplementation(async () => { calls.push('download'); return Buffer.from('PDF'); });
  const result = await service.download({ receipt: token, documentId, recipientId: 'recipient' });
  expect(calls).toEqual(['authorize', 'download', 'authorize']);
  expect(rpc.mock.calls[0][1].p_consume).toBeUndefined();
  expect(rpc.mock.calls[1][1].p_consume).toBe(true);
  expect(download).toHaveBeenCalledWith({ homeId: 'home', documentId: 'replacement-version', sha256: 'b'.repeat(64), bucketName: 'private-bucket' });
  expect(result.bytes.toString()).toBe('PDF');
});
test.each(['revoked', 'replaced'])('download withholds already fetched bytes when access is %s during storage read', async change => {
  let n = 0;
  db.setRpcMock(async () => ({ data: ++n === 1 ? { ok: true, document }
    : change === 'revoked' ? { ok: false, code: 'SHARE_REVOKED', status: 410 }
      : { ok: true, document: { ...document, _document: { ...document._document, version: 'changed' } } } }));
  jest.spyOn(storage, 'download').mockResolvedValue(Buffer.from('must-not-return'));
  await expect(service.download({ receipt: token, documentId })).rejects.toMatchObject({
    code: change === 'revoked' ? 'SHARE_REVOKED' : 'SHARE_RESOURCE_DENIED',
  });
});
test('initial document denial never fetches private storage', async () => {
  db.setRpcMock(async () => ({ data: { ok: false, code: 'SHARE_DENIED', status: 403 } }));
  const download = jest.spyOn(storage, 'download');
  await expect(service.download({ receipt: token, documentId })).rejects.toMatchObject({ statusCode: 403 });
  expect(download).not.toHaveBeenCalled();
});
test.each([
  [null, null, 'SHARE_UNAVAILABLE'], [{}, null, 'SHARE_UNAVAILABLE'],
  [null, { code: '22P02', message: 'synthetic confidential provider error' }, 'SHARE_INVALID'],
  [null, { code: '55P03', message: 'synthetic confidential provider error' }, 'SHARE_UNAVAILABLE'],
  [{ ok: false, code: 'synthetic confidential provider error' }, null, 'SHARE_UNAVAILABLE'],
])('malformed/provider result fails closed without provider detail', async (data, error, code) => {
  db.setRpcMock(async () => ({ data, error }));
  const from = jest.spyOn(db, 'from');
  await expect(service.read({ kind: 'scoped', token })).rejects.toMatchObject({ code });
  expect(from).not.toHaveBeenCalled();
});
test.each(['short', {}, null, 'a'.repeat(65)])('invalid bearer token %p never reaches storage or SQL', async bad => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  await expect(service.read({ kind: 'guest', token: bad })).rejects.toMatchObject({ statusCode: 400 });
  expect(rpc).not.toHaveBeenCalled();
});

const personalTypes = ['allergy', 'medical_condition', 'medication', 'power_of_attorney'];
const safeTypes = ['shutoff_water', 'shutoff_gas', 'shutoff_electric', 'breaker_map', 'extinguisher',
  'first_aid', 'evac_plan', 'emergency_contacts', 'other', 'contact', 'pet_medical'];
const emergency = type => ({ type, info_type: type, label: `Fixture ${type}`, location: 'Fixture cabinet',
  location_in_home: 'Fixture cabinet' });

test('guest emergency projection retains utility/contact/pet care while omitting personal rows from old bindings', async () => {
  db.setRpcMock(async () => ({ data: { ok: true, view: { pass: { label: 'Guest' }, sections: {
    emergency: [...safeTypes, ...personalTypes].map(type => ({ ...emergency(type), details: { private: 'must-not-return' } })),
    parking: 'Driveway',
  } } } }));
  const result = await service.read({ kind: 'guest', token });
  expect(result.sections.emergency).toEqual(safeTypes.map(emergency));
  expect(result.sections.parking).toBe('Driveway');
  expect(JSON.stringify(result)).not.toContain('must-not-return');
  for (const type of personalTypes) expect(JSON.stringify(result)).not.toContain(`Fixture ${type}`);
});

test.each([null, {}, 'private', [{ label: 'private' }], [null], [emergency('unknown')],
  [{ ...emergency('contact'), info_type: 'medication' }],
  [{ ...emergency('contact'), location_in_home: 'different' }]])(
  'malformed guest emergency section %p fails closed without its payload', async section => {
    db.setRpcMock(async () => ({ data: { ok: true, view: { pass: {}, sections: { emergency: section } } } }));
    await expect(service.read({ kind: 'guest', token })).rejects.toMatchObject({ code: 'SHARE_UNAVAILABLE', statusCode: 503 });
  });

// The real HomeScopedGrant check and issuance reject HomeEmergency. These
// malformed RPC responses exercise the API boundary, not a reachable SQL grant.
test.each(personalTypes)('a malformed scoped Emergency %s response never returns personal data', async type => {
  db.setRpcMock(async () => ({ data: { ok: true, view: {
    grant: { resource_type: 'HomeEmergency', can_view: true }, resource: emergency(type),
  } } }));
  await expect(service.read({ kind: 'scoped', token })).rejects.toMatchObject({ code: 'SHARE_RESOURCE_DENIED', statusCode: 403 });
});

test.each([undefined, 'HomeEmergency', 'HomeAccessSecret', 'unknown'])(
  'scoped resource type %p must match the existing issuance allowlist', async type => {
    db.setRpcMock(async () => ({ data: { ok: true, view: { grant: { resource_type: type }, resource: emergency('contact') } } }));
    await expect(service.read({ kind: 'scoped', token })).rejects.toMatchObject({ code: 'SHARE_RESOURCE_DENIED' });
  });

test('supported scoped documents keep the private receipt URL and refuse a disguised Emergency payload', async () => {
  db.setRpcMock(async () => ({ data: { ok: true, view: { grant: { resource_type: 'HomeDocument' }, resource: document } } }));
  const result = await service.read({ kind: 'scoped', token });
  expect(result.resource.url).toMatch(/^\/api\/homes\/shared-documents\/[a-f0-9]{64}\//);
  expect(result.resource._document).toBeUndefined();
  db.setRpcMock(async () => ({ data: { ok: true, view: { grant: { resource_type: 'HomeTask' }, resource: emergency('medication') } } }));
  await expect(service.read({ kind: 'scoped', token })).rejects.toMatchObject({ code: 'SHARE_RESOURCE_DENIED' });
});
