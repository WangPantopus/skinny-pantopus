const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: (...args) => mockCreateTransport(...args) }));

const originalEnv = { ...process.env };
const smtp = { SMTP_HOST: 'smtp.test.local', SMTP_USER: 'test', SMTP_PASS: 'test' };
const message = { to: 'test@example.com', subject: 'Verify', text: 'secret-auth-link', html: '<p>secret-auth-link</p>' };

function loadService(env = {}) {
  jest.resetModules();
  process.env = { ...originalEnv };
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'APP_ENV', 'NODE_ENV', 'EMAIL_DELIVERY_MODE']) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
  mockCreateTransport.mockReturnValue({ sendMail: mockSendMail, verify: mockVerify });
  return require('../../services/emailService');
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSendMail.mockResolvedValue({ messageId: 'smtp-id', accepted: ['test@example.com'] });
  mockVerify.mockResolvedValue(true);
});
afterAll(() => { process.env = originalEnv; });

test.each([
  {},
  { NODE_ENV: 'development' },
  { NODE_ENV: 'production' },
  { NODE_ENV: 'production', APP_ENV: 'staging' },
  { NODE_ENV: 'development', APP_ENV: 'staging', EMAIL_DELIVERY_MODE: 'log' },
  { NODE_ENV: 'test', APP_ENV: 'production', EMAIL_DELIVERY_MODE: 'log' },
])('missing SMTP cannot claim delivery for %j', async (env) => {
  const service = loadService(env);
  expect(await service.checkDeliveryAvailability()).toMatchObject({ available: false });
  expect(await service.sendEmail(message)).toEqual({ success: false, error: 'EMAIL_UNAVAILABLE' });
  expect(mockSendMail).not.toHaveBeenCalled();
});

test('explicit local preview is marked and does not log auth links', async () => {
  const service = loadService({ NODE_ENV: 'development', EMAIL_DELIVERY_MODE: 'log' });
  expect(await service.checkDeliveryAvailability()).toEqual({ available: true, preview: true });
  expect(await service.sendEmail(message)).toMatchObject({ success: true, preview: true });
  const logger = require('../../utils/logger');
  expect(JSON.stringify([logger.info.mock.calls, logger.debug.mock.calls])).not.toContain('secret-auth-link');
  expect(mockSendMail).not.toHaveBeenCalled();
});

test('SMTP readiness authenticates without sending a message', async () => {
  const service = loadService({ ...smtp, APP_ENV: 'staging', NODE_ENV: 'production' });
  expect(await service.checkDeliveryAvailability()).toEqual({ available: true });
  expect(mockVerify).toHaveBeenCalledTimes(1);
  expect(mockSendMail).not.toHaveBeenCalled();
  expect(await service.sendEmail(message)).toEqual({ success: true, messageId: 'smtp-id' });
});

test('unreachable SMTP is unavailable without exposing provider details', async () => {
  const service = loadService(smtp);
  mockVerify.mockRejectedValue(new Error('private SMTP details'));
  expect(await service.checkDeliveryAvailability()).toEqual({ available: false, code: 'EMAIL_UNAVAILABLE' });
});

test('SMTP failure after readiness cannot become simulated success', async () => {
  const service = loadService(smtp);
  expect(await service.checkDeliveryAvailability()).toEqual({ available: true });
  mockSendMail.mockRejectedValue(new Error('private provider response'));
  expect(await service.sendEmail(message)).toEqual({ success: false, error: 'EMAIL_SEND_FAILED' });
});

test('a transport that accepts no recipients is not successful', async () => {
  const service = loadService(smtp);
  mockSendMail.mockResolvedValue({ accepted: [], rejected: ['test@example.com'] });
  expect(await service.sendEmail(message)).toEqual({ success: false, error: 'EMAIL_REJECTED' });
});

test('transport construction failure fails closed', async () => {
  const service = loadService(smtp);
  jest.resetModules();
  mockCreateTransport.mockImplementation(() => { throw new Error('bad config'); });
  const broken = require('../../services/emailService');
  expect(await broken.sendEmail(message)).toEqual({ success: false, error: 'EMAIL_UNAVAILABLE' });
  expect(await broken.checkDeliveryAvailability()).toMatchObject({ available: false });
  expect(service).toBeDefined();
});
