const { runSmoke } = require('../../../scripts/push-smoke');

const token = 'private-device-token';
let sender;
let output;
let deps;

beforeEach(() => {
  sender = {
    isConfigured: jest.fn(() => true),
    sendMany: jest.fn(async () => ({ invalidTokens: [], acceptedTokens: [token] })),
    close: jest.fn(),
  };
  output = { log: jest.fn(), error: jest.fn() };
  deps = { senders: { apns: sender, fcm: sender, expo: sender }, env: {}, output };
});

it('checks configuration without a token or send', async () => {
  expect(await runSmoke(['--check', '--platform', 'ios'], deps)).toBe(0);
  expect(sender.sendMany).not.toHaveBeenCalled();
  expect(output.log).toHaveBeenCalledWith(expect.stringContaining('credentials are not yet verified'));
});

it('fails a configuration check when credentials are absent', async () => {
  sender.isConfigured.mockReturnValue(false);
  expect(await runSmoke(['--check', '--platform', 'android'], deps)).toBe(1);
  expect(sender.sendMany).not.toHaveBeenCalled();
});

it.each([
  [], ['--token', token], ['--platform', 'wrong', '--token', token],
  ['--provider', 'typo', '--token', token], ['--platform', 'ios'],
  ['--platform', 'ios', '--unknown', token], ['--platform', 'ios', '--token'],
])('rejects invalid or incomplete arguments before sending: %j', async (...argv) => {
  expect(await runSmoke(argv, deps)).toBe(2);
  expect(sender.sendMany).not.toHaveBeenCalled();
});

it('requires acceptance of the exact device token and preserves the post destination', async () => {
  deps.env.PUSH_SMOKE_TOKEN = token;
  expect(await runSmoke(['--platform', 'android', '--link', '/post/test-post'], deps)).toBe(0);
  expect(sender.sendMany).toHaveBeenCalledWith([token], expect.objectContaining({
    data: { type: 'system', link: '/post/test-post' },
  }));
  expect(output.log).toHaveBeenCalledWith(expect.stringContaining('Device delivery is still unverified'));
  expect(JSON.stringify(output.log.mock.calls)).not.toContain(token);
  expect(sender.close).toHaveBeenCalledTimes(1);
});

it.each([
  { invalidTokens: [] },
  { invalidTokens: [], acceptedTokens: [] },
  { invalidTokens: [], acceptedTokens: ['another-device'] },
  undefined,
])('does not interpret lack of invalid tokens as acceptance: %j', async (result) => {
  sender.sendMany.mockResolvedValue(result);
  expect(await runSmoke(['--platform', 'ios', '--token', token], deps)).toBe(1);
  expect(output.error).toHaveBeenCalledWith(expect.stringContaining('acceptance was not confirmed'));
  expect(sender.close).toHaveBeenCalledTimes(1);
});

it('reports an invalid token without printing it', async () => {
  sender.sendMany.mockResolvedValue({ invalidTokens: [token], acceptedTokens: [] });
  expect(await runSmoke(['--platform', 'ios', '--token', token], deps)).toBe(1);
  expect(output.error).toHaveBeenCalledWith(expect.stringContaining('invalid/unregistered'));
  expect(JSON.stringify(output.error.mock.calls)).not.toContain(token);
});

it('closes the transport after an exception without printing sensitive exception contents', async () => {
  sender.sendMany.mockRejectedValue(new Error(`request failed for ${token}`));
  expect(await runSmoke(['--platform', 'ios', '--token', token], deps)).toBe(1);
  expect(sender.close).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(output.error.mock.calls)).not.toContain(token);
});

it('supports legacy Expo token inference', async () => {
  const expoToken = 'ExponentPushToken[designated-device]';
  sender.sendMany.mockResolvedValue({ invalidTokens: [], acceptedTokens: [expoToken] });
  expect(await runSmoke(['--token', expoToken], deps)).toBe(0);
  expect(output.log).toHaveBeenCalledWith('Provider: expo');
});
