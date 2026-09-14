const express = require('express');
const request = require('supertest');
jest.mock('../services/homeClaimEvidenceService', () => ({ authorize: jest.fn(), upload: jest.fn(), list: jest.fn(), download: jest.fn(), verify: jest.fn(), remove: jest.fn(),
  sendError: (res, error) => res.status(error.statusCode || 503).json({ code: error.code || 'CLAIM_EVIDENCE_UNAVAILABLE' }) }));
const evidence = require('../services/homeClaimEvidenceService');
const register = require('../routes/homeClaimEvidenceRoutes');
const { getRequestSessionScope } = require('../utils/requestSessionScope');
const homeId = 'ddc90000-0000-4000-8000-000000000100';
const claimId = 'ddc90000-0000-4000-8000-000000000200';
const actorId = 'ddc90000-0000-4000-8000-000000000001';
const uploadId = 'ddc90000-0000-4000-8000-000000000300';
const token = 'synthetic-claim-session';
const fingerprint = getRequestSessionScope({ user: { id: actorId }, headers: { authorization: `Bearer ${token}` } }).session_scope;
const path = `/home-claim-evidence/${homeId}/${claimId}`;
const uploadPath = `/ownership-evidence/${homeId}/${claimId}`;
let app;
beforeEach(() => {
  jest.clearAllMocks(); app = express(); app.use(express.json());
  register(app, { verifyToken: (req, res, next) => {
    if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: actorId }; next();
  }, evidenceUploadLimiter: (req, res, next) => next() });
  evidence.authorize.mockResolvedValue({ can_verify: false });
  evidence.upload.mockResolvedValue({ id: uploadId, home_id: homeId, claim_id: claimId, status: 'pending' });
  evidence.list.mockResolvedValue({ evidence: [] });
});
const authenticated = query => query.set('Authorization', `Bearer ${token}`).set('x-pantopus-session-scope', fingerprint);
test('private upload binds one file, original upload id, exact claimant and evidence type without a verification write', async () => {
  const result = await authenticated(request(app).post(uploadPath)).field('upload_id', uploadId).field('evidence_type', 'lease')
    .attach('file', Buffer.from('exact private bytes'), 'lease.txt');
  expect(result.status).toBe(200); expect(result.body.evidence.status).toBe('pending');
  expect(evidence.authorize).toHaveBeenCalledWith({ homeId, claimId, actorId, uploadId: undefined, platformAdmin: false }, 'upload');
  expect(evidence.upload).toHaveBeenCalledWith({ homeId, claimId, actorId, uploadId, evidenceType: 'lease', platformAdmin: false }, expect.objectContaining({ buffer: Buffer.from('exact private bytes') }));
  expect(evidence.verify).not.toHaveBeenCalled();
});
test('authentication and current authority denial happen before multipart provider processing', async () => {
  let result = await request(app).post(uploadPath).attach('file', Buffer.from('private'), 'lease.txt');
  expect(result.status).toBe(401); expect(evidence.authorize).not.toHaveBeenCalled();
  evidence.authorize.mockRejectedValue({ statusCode: 403, code: 'CLAIM_EVIDENCE_DENIED' });
  result = await authenticated(request(app).post(uploadPath)).attach('file', Buffer.from('private'), 'lease.txt');
  expect(result.status).toBe(403); expect(evidence.upload).not.toHaveBeenCalled();
});
test('extra file parts cannot reach storage', async () => {
  const result = await authenticated(request(app).post(uploadPath)).field('upload_id', uploadId).field('evidence_type', 'lease')
    .attach('file', Buffer.from('one'), 'one.txt').attach('file', Buffer.from('two'), 'two.txt');
  expect(result.status).toBe(400); expect(evidence.upload).not.toHaveBeenCalled();
});
test('metadata response returns only a server-issued current actor/session fingerprint', async () => {
  const result = await authenticated(request(app).get(path));
  expect(result.status).toBe(200); expect(result.body.claim_session).toEqual({ home_id: homeId, claim_id: claimId, actor_id: actorId, session_scope: fingerprint });
  expect(result.text).not.toContain(token); expect(result.headers['cache-control']).toBe('private, no-store');
});
test.each(['get', 'post', 'delete'])('missing or stale required session stops %s before evidence or provider work', async method => {
  const route = method === 'get' ? `${path}/${uploadId}/download` : method === 'post' ? `${path}/${uploadId}/verify` : `${path}/${uploadId}`;
  for (const scope of [undefined, 'a'.repeat(64)]) {
    const query = request(app)[method](route).set('Authorization', `Bearer ${token}`);
    if (scope) query.set('x-pantopus-session-scope', scope);
    const result = await query;
    expect(result.status).toBe(409); expect(result.body.code).toBe('SESSION_SCOPE_CHANGED');
  }
  expect(evidence.download).not.toHaveBeenCalled(); expect(evidence.verify).not.toHaveBeenCalled(); expect(evidence.remove).not.toHaveBeenCalled();
});
test('inspected bytes use private attachment delivery and only the exact service receipt', async () => {
  evidence.download.mockResolvedValue({ record: { mime_type: 'text/plain', file_name: 'private.txt' }, bytes: Buffer.from('exact evidence'), inspection: 'c'.repeat(64) });
  const result = await authenticated(request(app).get(`${path}/${uploadId}/download?review=platform&review_token=${'b'.repeat(64)}`));
  expect(result.status).toBe(200); expect(result.text).toBe('exact evidence');
  expect(result.headers['cache-control']).toBe('private, no-store'); expect(result.headers['x-content-type-options']).toBe('nosniff');
  expect(result.headers['content-disposition']).toContain('attachment;'); expect(result.headers['x-claim-evidence-inspection']).toBe('c'.repeat(64));
  expect(evidence.download).toHaveBeenCalledWith({ homeId, claimId, actorId, uploadId, platformAdmin: true, reviewToken: 'b'.repeat(64) });
});
test('byte denial returns no inspection capability or redirect', async () => {
  evidence.download.mockRejectedValue({ statusCode: 403, code: 'CLAIM_EVIDENCE_DENIED' });
  const result = await authenticated(request(app).get(`${path}/${uploadId}/download`));
  expect(result.status).toBe(403); expect(result.headers.location).toBeUndefined(); expect(result.headers['x-claim-evidence-inspection']).toBeUndefined();
});
test('explicit verification forwards exact snapshot and inspection without an approval action', async () => {
  evidence.verify.mockResolvedValue({ ok: true, action: 'verify_evidence', upload_id: uploadId });
  const result = await authenticated(request(app).post(`${path}/${uploadId}/verify?review=platform`)).send({ review_token: 'b'.repeat(64), inspection: 'c'.repeat(64) });
  expect(result.status).toBe(200); expect(result.body.action).toBe('verify_evidence');
  expect(evidence.verify).toHaveBeenCalledWith({ homeId, claimId, actorId, uploadId, platformAdmin: true, reviewToken: 'b'.repeat(64), inspection: 'c'.repeat(64) });
});
test('retirement cleanup failure remains a retryable failure', async () => {
  evidence.remove.mockRejectedValue({ statusCode: 503, code: 'CLAIM_EVIDENCE_UNAVAILABLE' });
  const result = await authenticated(request(app).delete(`${path}/${uploadId}`));
  expect(result.status).toBe(503);
});
