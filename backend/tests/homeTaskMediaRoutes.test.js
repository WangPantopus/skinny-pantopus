const express = require('express');
const request = require('supertest');
jest.mock('../services/homeTaskMediaService', () => ({ authorize: jest.fn(), upload: jest.fn(), list: jest.fn(), download: jest.fn(), remove: jest.fn(),
  sendError: (res, error) => res.status(error.statusCode || 503).json({ code: error.code || 'HOME_TASK_MEDIA_UNAVAILABLE' }) }));
const media = require('../services/homeTaskMediaService');
const register = require('../routes/homeTaskMediaRoutes');
const homeId = 'ddf10001-0000-4000-8000-000000000100'; const taskId = 'ddf10001-0000-4000-8000-000000000200';
const actorId = 'ddf10001-0000-4000-8000-000000000001'; const uploadId = 'ddf10001-0000-4000-8000-000000000300';
let app;
beforeEach(() => {
  jest.clearAllMocks(); app = express(); const router = express.Router();
  register(router, { verifyToken: (req, res, next) => { if (req.headers.authorization !== 'Bearer synthetic') return res.status(401).json({ error: 'Unauthorized' }); req.user = { id: actorId }; next(); }, uploadLimiter: (req, res, next) => next() });
  app.use(router); media.authorize.mockResolvedValue({ can_upload: true });
  media.upload.mockResolvedValue({ id: uploadId, home_id: homeId, task_id: taskId, available: true });
});
const path = `/home-task-media/${homeId}/${taskId}`;
test('authenticated single-file upload binds route/task and saved upload ID', async () => {
  const result = await request(app).post(path).set('Authorization', 'Bearer synthetic').field('upload_id', uploadId).attach('file', Buffer.from('task bytes'), 'task.txt');
  expect(result.status).toBe(200); expect(result.body.media[0].id).toBe(uploadId);
  expect(media.authorize).toHaveBeenCalledWith({ homeId, taskId, actorId, uploadId: undefined }, true);
  expect(media.upload).toHaveBeenCalledWith({ homeId, taskId, actorId, uploadId }, expect.objectContaining({ originalname: 'task.txt', buffer: Buffer.from('task bytes') }));
});
test('absent credentials never reach task or provider processing', async () => {
  const result = await request(app).post(path).field('upload_id', uploadId).attach('file', Buffer.from('task bytes'), 'task.txt');
  expect(result.status).toBe(401); expect(media.authorize).not.toHaveBeenCalled(); expect(media.upload).not.toHaveBeenCalled();
});
test('current task denial stops multipart before upload', async () => {
  media.authorize.mockRejectedValue({ statusCode: 403, code: 'HOME_RECORD_WRITE_DENIED' });
  const result = await request(app).post(path).set('Authorization', 'Bearer synthetic').field('upload_id', uploadId).attach('file', Buffer.from('task bytes'), 'task.txt');
  expect(result.status).toBe(403); expect(media.upload).not.toHaveBeenCalled();
});
test('extra file parts are rejected without any provider call', async () => {
  const result = await request(app).post(path).set('Authorization', 'Bearer synthetic').field('upload_id', uploadId)
    .attach('file', Buffer.from('one'), 'one.txt').attach('file', Buffer.from('two'), 'two.txt');
  expect(result.status).toBe(400); expect(media.upload).not.toHaveBeenCalled();
});
test('download is authenticated no-store attachment bytes', async () => {
  media.download.mockResolvedValue({ record: { mime_type: 'text/plain', file_name: 'private.txt' }, bytes: Buffer.from('exact task bytes') });
  const result = await request(app).get(`${path}/${uploadId}/download`).set('Authorization', 'Bearer synthetic');
  expect(result.status).toBe(200); expect(result.text).toBe('exact task bytes');
  expect(result.headers['cache-control']).toBe('private, no-store'); expect(result.headers['x-content-type-options']).toBe('nosniff');
  expect(result.headers['content-disposition']).toContain('attachment;');
});
test('private metadata list is authenticated and cannot be cached', async () => {
  const metadata = { media: [{ id: uploadId, home_id: homeId, task_id: taskId, file_name: 'private.txt', available: true }] };
  media.list.mockResolvedValue(metadata);
  const result = await request(app).get(path).set('Authorization', 'Bearer synthetic');
  expect(result.status).toBe(200); expect(result.body).toEqual(metadata);
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(media.list).toHaveBeenCalledWith({ homeId, taskId, actorId, uploadId: undefined });
});
test('download revocation does not send bytes or redirect', async () => {
  media.download.mockRejectedValue({ statusCode: 403, code: 'HOME_RECORD_DENIED' });
  const result = await request(app).get(`${path}/${uploadId}/download`).set('Authorization', 'Bearer synthetic');
  expect(result.status).toBe(403); expect(result.headers.location).toBeUndefined();
});
test('failed removal stays a retryable error', async () => {
  media.remove.mockRejectedValue({ statusCode: 503, code: 'HOME_TASK_MEDIA_DELETE_UNAVAILABLE' });
  const result = await request(app).delete(`${path}/${uploadId}`).set('Authorization', 'Bearer synthetic');
  expect(result.status).toBe(503);
});

test('session confirmation contains exact requested Home/task and verified actor without a credential', async () => {
  const result = await request(app).get(`/home-task-media-session/${homeId}?task_id=${taskId}`).set('Authorization', 'Bearer synthetic');
  expect(result.status).toBe(200); expect(result.body).toMatchObject({ home_id: homeId, task_id: taskId, actor_id: actorId, session_scope: expect.stringMatching(/^[0-9a-f]{64}$/) });
  expect(result.text).not.toContain('Bearer'); expect(result.headers['cache-control']).toBe('private, no-store');
});
test('stale expected session blocks both upload and download before task/provider work', async () => {
  let result = await request(app).post(path).set('Authorization', 'Bearer synthetic').set('x-pantopus-session-scope', 'a'.repeat(64));
  expect(result.status).toBe(409); expect(media.authorize).not.toHaveBeenCalled(); expect(media.upload).not.toHaveBeenCalled();
  result = await request(app).get(`${path}/${uploadId}/download`).set('Authorization', 'Bearer synthetic').set('x-pantopus-session-scope', 'a'.repeat(64));
  expect(result.status).toBe(409); expect(media.download).not.toHaveBeenCalled();
});
