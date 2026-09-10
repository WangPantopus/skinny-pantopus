import { act, render, cleanup } from '@testing-library/react';
import { SocketProvider } from '../src/contexts/SocketContext';
import { useDesktopNotifications } from '../src/hooks/useDesktopNotifications';

type Listener = (value?: unknown) => void;
const sockets: Array<ReturnType<typeof makeSocket>> = [];
const authListeners = new Set<Listener>();
const push = jest.fn();
const router = { push };
let token: string | null = '__session__';
function makeSocket() {
  const listeners = new Map<string, Listener>();
  return {
    listeners, disconnect: jest.fn(),
    on: jest.fn((event: string, listener: Listener) => { listeners.set(event, listener); }),
    off: jest.fn((event: string) => { listeners.delete(event); }),
  };
}
jest.mock('socket.io-client', () => ({ io: () => { const socket = makeSocket(); sockets.push(socket); return socket; } }));
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => token, getApiBaseUrl: () => 'https://app.test',
  AUTH_SESSION_CHANGE_KEY: 'pantopus_auth_session_change',
  onTokenChange: (listener: Listener) => { authListeners.add(listener); return () => authListeners.delete(listener); },
}));
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/contexts/BadgeContext', () => ({ useBadges: () => ({ notifications: 2 }) }));

class BrowserAlert {
  static permission: NotificationPermission = 'granted';
  static requestPermission = jest.fn().mockResolvedValue('granted');
  static created: BrowserAlert[] = [];
  close = jest.fn();
  onclick: (() => void) | null = null;
  constructor(readonly title: string, readonly options: NotificationOptions) { BrowserAlert.created.push(this); }
}
const originalNotification = Object.getOwnPropertyDescriptor(window, 'Notification');
function Probe() { useDesktopNotifications(); return null; }
function show() { return render(<SocketProvider><Probe /></SocketProvider>); }
const note = { id: 'note-1', user_id: 'user-1', title: 'Beacon update', body: 'Exact post', link: '/post/post-1' };
function publish(event = 'notification:alert', value = note) {
  act(() => sockets[sockets.length - 1].listeners.get(event)?.(value));
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); sockets.length = 0; authListeners.clear();
  token = '__session__'; BrowserAlert.created = []; BrowserAlert.permission = 'granted';
  Object.defineProperty(window, 'Notification', { configurable: true, value: BrowserAlert });
  jest.spyOn(document, 'hasFocus').mockReturnValue(false);
  jest.spyOn(window, 'focus').mockImplementation(() => {});
});
afterEach(() => {
  cleanup(); jest.useRealTimers(); jest.restoreAllMocks();
  if (originalNotification) Object.defineProperty(window, 'Notification', originalNotification);
  else Reflect.deleteProperty(window, 'Notification');
});

test('in-app events never become browser alerts; an eligible alert opens the exact post', () => {
  show(); publish('notification:new'); expect(BrowserAlert.created).toHaveLength(0);
  publish(); expect(BrowserAlert.created).toHaveLength(1);
  expect(BrowserAlert.created[0].options.body).toBe('Exact post');
  act(() => BrowserAlert.created[0].onclick?.());
  expect(push).toHaveBeenCalledWith('/app/feed/post/post-1');
});
test('duplicate relay events cannot alert again after the browser popup closes', () => {
  show(); publish(); act(() => jest.advanceTimersByTime(5001)); publish();
  expect(BrowserAlert.created).toHaveLength(1); expect(BrowserAlert.created[0].close).toHaveBeenCalled();
});
test('focused or denied browser does not alert', () => {
  show(); jest.mocked(document.hasFocus).mockReturnValue(true); publish();
  jest.mocked(document.hasFocus).mockReturnValue(false); publish();
  BrowserAlert.permission = 'denied'; publish('notification:alert', { ...note, id: 'note-2' });
  expect(BrowserAlert.created).toHaveLength(0);
});
test.each(['same-tab', 'cross-tab'])('%s cookie session replacement retires socket, alerts and callbacks even with the same marker', (source) => {
  show(); publish(); const oldSocket = sockets[0];
  const retained = oldSocket.listeners.get('notification:alert'); const alert = BrowserAlert.created[0];
  act(() => {
    if (source === 'same-tab') [...authListeners].forEach((listener) => listener());
    else window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change', newValue: 'replacement' }));
  });
  expect(oldSocket.disconnect).toHaveBeenCalled(); expect(sockets).toHaveLength(2);
  expect(alert.close).toHaveBeenCalled();
  act(() => { alert.onclick?.(); retained?.({ ...note, id: 'old-late' }); });
  expect(push).not.toHaveBeenCalled(); expect(BrowserAlert.created).toHaveLength(1);
  publish('notification:alert', { ...note, id: 'current', user_id: 'user-2' });
  expect(BrowserAlert.created).toHaveLength(2);
});
test('logout closes the old connection without starting a replacement', () => {
  show(); publish(); token = null;
  act(() => [...authListeners].forEach((listener) => listener()));
  expect(sockets).toHaveLength(1); expect(sockets[0].disconnect).toHaveBeenCalled();
  expect(BrowserAlert.created[0].close).toHaveBeenCalled();
});
test('malformed navigation cannot execute an arbitrary browser location', () => {
  show(); publish('notification:alert', { ...note, link: 'javascript:alert(1)' });
  expect(BrowserAlert.created[0].onclick).toBeNull(); expect(push).not.toHaveBeenCalled();
});
