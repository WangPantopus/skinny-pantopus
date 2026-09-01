// ============================================================
// middleware/validate.js — credential redaction (security review S5).
//
// The 400 body AND the warn-level log line carry `rejectedValue`. Before this
// guard, a password one character over the limit, an over-length resume grant,
// an OAuth `code` or a DPoP/step-up `signature` was echoed and logged verbatim.
// ============================================================

const Joi = require('joi');
const validate = require('../../middleware/validate');
const logger = require('../__mocks__/logger');

function run(schema, body) {
  const req = { body, method: 'POST', originalUrl: '/api/test' };
  let status = null;
  let payload = null;
  const res = {
    status(code) { status = code; return this; },
    json(obj) { payload = obj; return this; },
  };
  let nexted = false;
  validate(schema)(req, res, () => { nexted = true; });
  return { status, payload, nexted, req };
}

const detailFor = (payload, field) => payload.details.find((d) => d.field === field);

describe('validate() redacts credential-bearing fields', () => {
  const SECRET = 'correct horse battery staple correct horse battery staple correct horse battery staple 0123456789';

  test.each([
    ['password', Joi.object({ password: Joi.string().max(8).required() }), { password: SECRET }],
    ['currentPassword', Joi.object({ currentPassword: Joi.string().max(8).required() }), { currentPassword: SECRET }],
    ['newPassword', Joi.object({ newPassword: Joi.string().max(8).required() }), { newPassword: SECRET }],
    ['refreshToken', Joi.object({ refreshToken: Joi.string().max(8).required() }), { refreshToken: SECRET }],
    ['idToken', Joi.object({ idToken: Joi.string().max(8).required() }), { idToken: SECRET }],
    ['grant', Joi.object({ grant: Joi.string().max(8).required() }), { grant: SECRET }],
    ['signature', Joi.object({ signature: Joi.string().max(8).required() }), { signature: SECRET }],
    ['code', Joi.object({ code: Joi.string().max(8).required() }), { code: SECRET }],
  ])('%s is never echoed', (field, schema, body) => {
    const { status, payload } = run(schema, body);
    expect(status).toBe(400);
    const detail = detailFor(payload, field);
    expect(detail.rejectedValue).toBe('[redacted]');
    expect(JSON.stringify(payload)).not.toContain(SECRET);
  });

  test('nested credentials are redacted by their leaf name', () => {
    const schema = Joi.object({ device: Joi.object({ attestation: Joi.object({ token: Joi.string().max(4) }) }) });
    const { payload } = run(schema, { device: { attestation: { token: SECRET } } });
    expect(detailFor(payload, 'device.attestation.token').rejectedValue).toBe('[redacted]');
  });

  test('the log line does not carry the secret either', () => {
    logger.warn.mockClear?.();
    run(Joi.object({ password: Joi.string().max(8).required() }), { password: SECRET });
    const logged = JSON.stringify(logger.warn.mock?.calls ?? []);
    expect(logged).not.toContain(SECRET);
  });

  test('a Joi message that quotes the value is scrubbed too', () => {
    const schema = Joi.object({ grant: Joi.string().valid('only-this').required() });
    const { payload } = run(schema, { grant: SECRET });
    expect(JSON.stringify(payload)).not.toContain(SECRET);
  });

  test('non-sensitive fields keep their rejected value (debuggability)', () => {
    const schema = Joi.object({ device: Joi.object({ keyBacking: Joi.string().valid('tee').required() }).required() });
    const { payload } = run(schema, { device: { keyBacking: 'nonsense' } });
    expect(detailFor(payload, 'device.keyBacking').rejectedValue).toBe('nonsense');
  });

  test('valid bodies still pass through with stripUnknown applied', () => {
    const schema = Joi.object({ password: Joi.string().required() });
    const { nexted, req } = run(schema, { password: 'ok' });
    expect(nexted).toBe(true);
    expect(req.body).toEqual({ password: 'ok' });
  });
});
