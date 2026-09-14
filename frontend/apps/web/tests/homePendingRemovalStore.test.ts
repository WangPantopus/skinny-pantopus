import { PendingRemovalStore } from '../src/components/home/member-removals/PendingRemovalStore';
import { openTaskRecoveryDatabase, readTaskRecoveryValue } from '../src/components/home/tasks/TaskRecoveryStorage';

jest.mock('../src/components/home/tasks/TaskRecoveryStorage', () => ({
  openTaskRecoveryDatabase: jest.fn(),
  readTaskRecoveryValue: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  jest.mocked(openTaskRecoveryDatabase).mockResolvedValue({} as IDBDatabase);
});

test.each([null, false, 0, ''])('present malformed recovery value %p is kept and cannot look empty', async value => {
  jest.mocked(readTaskRecoveryValue).mockResolvedValueOnce(value);
  const store = new PendingRemovalStore('http://127.0.0.1:18080', '10000000-0000-4000-8000-000000000001');
  await expect(store.load()).rejects.toThrow('could not be read. It has been kept');
  expect(readTaskRecoveryValue).toHaveBeenCalledTimes(1);
});

test('only an absent recovery record is an empty slot', async () => {
  jest.mocked(readTaskRecoveryValue).mockResolvedValueOnce(undefined);
  const store = new PendingRemovalStore('http://127.0.0.1:18080', '10000000-0000-4000-8000-000000000001');
  await expect(store.load()).resolves.toBeNull();
});
import { TextEncoder } from 'node:util';
