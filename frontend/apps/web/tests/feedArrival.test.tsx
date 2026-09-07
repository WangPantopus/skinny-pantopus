import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const feed = jest.fn();
const eligibility = jest.fn();
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => 'session', users: { getMyProfile: () => Promise.resolve({ id: 'u1' }) },
  posts: { getFeedV2: (...args: unknown[]) => feed(...args), checkPlaceEligibility: (...args: unknown[]) => eligibility(...args) },
}));
import { useFeedData } from '../src/hooks/useFeedData';
it('opens Beacon browsing without an address and restores a changed surface', async () => {
  feed.mockResolvedValue({ posts: [], pagination: { hasMore: false } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const options = { viewingLat: null, viewingLng: null, userLat: null, userLng: null, gpsTimestamp: null, radiusMiles: null, showToast: jest.fn() };
  const { result, rerender } = renderHook(({ surface }: { surface: 'personas' | 'connections' }) => useFeedData({ ...options, initialSurface: surface }), { wrapper, initialProps: { surface: 'personas' } });
  await waitFor(() => expect(feed).toHaveBeenCalledWith({ surface: 'personas', limit: 20 }));
  expect(result.current.surface).toBe('personas');
  expect(eligibility).not.toHaveBeenCalled();
  rerender({ surface: 'connections' });
  await waitFor(() => expect(feed).toHaveBeenCalledWith({ surface: 'connections', limit: 20 }));
});
