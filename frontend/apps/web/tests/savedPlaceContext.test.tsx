import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
const savedPlaces = jest.fn();
const preview = jest.fn();
let userId = 'u1';
jest.mock('@pantopus/api', () => ({
  users: { getMyProfile: () => Promise.resolve({ id: userId }) },
  onTokenChange: () => () => {},
  savedPlaces: { getSavedPlaces: () => savedPlaces(), remove: jest.fn() },
  place: { getPublicPlacePreview: (...args: unknown[]) => preview(...args) },
}));
jest.mock('@/components/place/StartFunnel', () => ({ PreviewBody: () => <p>Public address information</p> }));
import SavedPlaceContext from '../src/components/place/SavedPlaceContext';
const place = { id: 's1', user_id: 'u1', label: '120 Example St', latitude: 45.5, longitude: -122.6 };
function show(id?: string) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SavedPlaceContext savedPlaceId={id} /></QueryClientProvider>); }
beforeEach(() => { userId = 'u1'; jest.clearAllMocks(); savedPlaces.mockResolvedValue({ savedPlaces: [place] }); preview.mockResolvedValue({ status: 'ready' }); });
it('opens a saved preview on return and hands its id to explicit home setup', async () => {
  show('s1');
  expect(await screen.findByText('120 Example St')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Set up this home' }));
  expect(push).toHaveBeenCalledWith('/app/homes/new?savedPlace=s1');
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
