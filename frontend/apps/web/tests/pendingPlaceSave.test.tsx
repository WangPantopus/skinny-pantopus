import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { bindPendingPlace, clearPendingPlaces, readPendingPlace, stashPendingPlace } from '../src/components/place/pendingPlace';
const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: jest.fn() }) }));
const create = jest.fn();
jest.mock('@pantopus/api', () => ({ savedPlaces: { create: (...args: unknown[]) => create(...args) } }));
import PendingPlaceSaver from '../src/components/place/PendingPlaceSaver';
const ADDRESS = { label: '120 Example St, Portland, OR', latitude: 45.5, longitude: -122.6, city: 'Portland', state: 'OR' };
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

it('preserves the preview across a new tab while keeping the address out of its identifier', () => {
  const id = stashPendingPlace(ADDRESS)!;
  sessionStorage.clear();
  expect(id).not.toContain('Example');
  expect(readPendingPlace(id)).toMatchObject(ADDRESS);
});

it('never auto-saves, preserves failed intent through remount, and clears only after success', async () => {
  const id = stashPendingPlace(ADDRESS)!;
  const onSaved = jest.fn();
  create.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ savedPlace: { id: 's1', user_id: 'u1', ...ADDRESS } });
  const first = render(<StrictMode><PendingPlaceSaver previewId={id} userId="u1" onSaved={onSaved} /></StrictMode>);
  expect(await screen.findByText(ADDRESS.label)).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save privately' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  expect(readPendingPlace(id)).not.toBeNull();
  first.unmount();
  render(<PendingPlaceSaver previewId={id} userId="u1" onSaved={onSaved} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Save privately' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenLastCalledWith({ ...ADDRESS, expectedUserId: 'u1' });
  expect(readPendingPlace(id)).toBeNull();
});

it('does not save twice when clicked again while in flight', async () => {
  const id = stashPendingPlace(ADDRESS)!;
  create.mockReturnValue(new Promise(() => {}));
  render(<PendingPlaceSaver previewId={id} userId="u1" onSaved={jest.fn()} />);
  const save = await screen.findByRole('button', { name: 'Save privately' });
  fireEvent.click(save); fireEvent.click(save);
  expect(create).toHaveBeenCalledTimes(1);
});

it('hides and discards a preview bound to a different account', async () => {
  const id = stashPendingPlace(ADDRESS)!;
  bindPendingPlace(id, 'u1');
  render(<PendingPlaceSaver previewId={id} userId="u2" onSaved={jest.fn()} />);
  expect(await screen.findByText('This preview is no longer available')).toBeInTheDocument();
  expect(screen.queryByText(ADDRESS.label)).not.toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
  expect(readPendingPlace(id)).toBeNull();
});

it('cancel, signout cleanup, and expiration remove pending intent', async () => {
  const id = stashPendingPlace(ADDRESS)!;
  render(<PendingPlaceSaver previewId={id} userId="u1" onSaved={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
  expect(readPendingPlace(id)).toBeNull();
  const next = stashPendingPlace(ADDRESS)!;
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60_000);
  expect(readPendingPlace(next)).toBeNull(); now.mockRestore();
  const last = stashPendingPlace(ADDRESS)!;
  clearPendingPlaces();
  expect(readPendingPlace(last)).toBeNull();
});

it('refuses to continue if browser storage is disabled', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(stashPendingPlace(ADDRESS)).toBeNull(); spy.mockRestore();
});

it('does not consume a preview when a save response cannot be confirmed', async () => {
  const id = stashPendingPlace(ADDRESS)!;
  create.mockResolvedValue({});
  render(<PendingPlaceSaver previewId={id} userId="u1" onSaved={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Save privately' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The save could not be confirmed');
  expect(readPendingPlace(id)).not.toBeNull();
});
