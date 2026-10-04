import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
const savedPlaces = jest.fn();
const preview = jest.fn();
const create = jest.fn();
const remove = jest.fn();
let userId = 'u1';
jest.mock('@pantopus/api', () => ({
  users: { getMyProfile: () => Promise.resolve({ id: userId }) },
  onTokenChange: () => () => {},
  savedPlaces: { getSavedPlaces: () => savedPlaces(), create: (...args: unknown[]) => create(...args), remove: (...args: unknown[]) => remove(...args) },
  place: { getPublicPlacePreview: (...args: unknown[]) => preview(...args) },
}));
jest.mock('@/components/place/StartFunnel', () => ({ PreviewBody: () => <p>Public address information</p> }));
import SavedPlaceContext from '../src/components/place/SavedPlaceContext';
import { queryKeys } from '../src/lib/query-keys';
const place = { id: 's1', user_id: 'u1', label: '120 Example St', latitude: 45.5, longitude: -122.6 };
function show(id?: string, client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), previewId?: string) {
  return render(<QueryClientProvider client={client}><SavedPlaceContext savedPlaceId={id} previewId={previewId} /></QueryClientProvider>);
}
beforeEach(() => { userId = 'u1'; jest.clearAllMocks(); savedPlaces.mockResolvedValue({ savedPlaces: [place] }); preview.mockResolvedValue({ status: 'ready' }); });
it('opens a saved preview on return and hands its id to explicit home setup', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = show('s1', client);
  expect(await screen.findByText('120 Example St')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Set up this home' }));
  expect(push).toHaveBeenCalledWith('/app/homes/new?savedPlace=s1');
  client.setQueryData(queryKeys.hubToday(), { location: { source: 'saved_place' } });
  remove.mockResolvedValue({ message: 'Saved place removed' });
  fireEvent.click(screen.getByRole('button', { name: 'Remove saved place' }));
  await waitFor(() => expect(client.getQueryState(queryKeys.hubToday())?.isInvalidated).toBe(true));
  expect(remove).toHaveBeenCalledWith('s1');
  view.unmount();

  const previewId = '11111111-1111-4111-8111-111111111111';
  localStorage.setItem(`pantopus:place-preview:${previewId}`, JSON.stringify({ ...place, city: 'Portland', state: 'OR',
    id: previewId, userId: null, expiresAt: Date.now() + 60_000 }));
  create.mockResolvedValue({ savedPlace: place });
  client.setQueryData(queryKeys.hubToday(), { location: { source: 'none' } });
  show(undefined, client, previewId);
  fireEvent.click(await screen.findByRole('button', { name: /Save/ }));
  await waitFor(() => expect(create).toHaveBeenCalled());
  await waitFor(() => expect(client.getQueryState(queryKeys.hubToday())?.isInvalidated).toBe(true));
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ expectedUserId: 'u1', latitude: 45.5, longitude: -122.6 }));
  expect(localStorage.getItem(`pantopus:place-preview:${previewId}`)).toBeNull();
});
it('keeps the saved address visible when public intelligence cannot refresh', async () => {
  preview.mockRejectedValue(new Error('offline')); show();
  expect(await screen.findByText('120 Example St')).toBeInTheDocument();
  expect(await screen.findByText('Your address is saved. We could not refresh its public information.')).toBeInTheDocument();
});
it('does not render cached places from a different account', async () => {
  userId = 'u2'; show('s1');
  expect(await screen.findByText('This saved place is unavailable')).toBeInTheDocument();
  expect(screen.queryByText('120 Example St')).not.toBeInTheDocument();
  expect(preview).not.toHaveBeenCalled();
});
