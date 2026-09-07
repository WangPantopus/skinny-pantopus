import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const getViewer = jest.fn();
const getFollowing = jest.fn();
const searchProfiles = jest.fn();
const mute = jest.fn();
const unfollow = jest.fn();
let tokenChanged: () => void;
jest.mock('@pantopus/api', () => ({
  users: { getMyProfile: () => getViewer() },
  personas: {
    getMyFollowing: (...args: unknown[]) => getFollowing(...args),
    muteFollowing: (...args: unknown[]) => mute(...args),
    unfollowPersona: (...args: unknown[]) => unfollow(...args),
  },
  identitySearch: {
    searchProfiles: (...args: unknown[]) => searchProfiles(...args),
  },
  onTokenChange: (callback: () => void) => {
    tokenChanged = callback;
    return () => {};
  },
}));
jest.mock('@/lib/featureFlags', () => ({
  webFeatureFlags: { persona: false },
}));
import Beacons from '../src/app/(app)/app/beacons/page';
const item = {
  membershipId: 'm1',
  persona: {
    id: 'b1',
    handle: 'garden',
    displayName: 'Garden club',
    status: 'active',
  },
  mutedUntil: null,
  paidTier: null,
  latestPost: { id: 'p1', snippet: 'Seed swap on Saturday' },
  unreadCount: 2,
};
const response = (items: unknown[] = []) => ({
  items,
  counts: { totalFollowing: items.length, unreadBeacons: 0 },
  pagination: { hasMore: false, nextOffset: null },
});
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Beacons />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  jest.clearAllMocks();
  getViewer.mockResolvedValue({ id: 'u1' });
  getFollowing.mockResolvedValue(response());
  searchProfiles.mockResolvedValue({ results: [] });
  mute.mockResolvedValue({});
  unfollow.mockResolvedValue({});
});
async function search(value = 'garden') {
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Beacon name or handle' }),
    { target: { value } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
}
it('searches public profiles without a home or creator setup and preserves the public route', async () => {
  searchProfiles.mockResolvedValue({
    results: [
      {
        id: 'p1',
        type: 'public_profile',
        href: '/@garden',
        title: 'Garden club',
      },
      {
        id: 'p2',
        type: 'local_profile',
        href: '/private-neighbor',
        title: 'Private neighbor',
      },
      {
        id: 'p3',
        type: 'public_profile',
        href: 'https://elsewhere.test',
        title: 'Unsafe route',
      },
    ],
  });
  show();
  await search();
  expect(searchProfiles).toHaveBeenCalledWith({
    q: 'garden',
    scope: 'public_profiles',
    limit: 20,
  });
  expect(
    await screen.findByRole('link', { name: /Garden club/ }),
  ).toHaveAttribute('href', '/@garden');
  expect(screen.queryByText('Private neighbor')).not.toBeInTheDocument();
  expect(screen.queryByText('Unsafe route')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'My Beacon' }),
  ).not.toBeInTheDocument();
  expect(unfollow).not.toHaveBeenCalled();
  expect(mute).not.toHaveBeenCalled();
});
it('shows separate retryable search and following failures without reporting empty results', async () => {
  getFollowing
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(response([item]));
  searchProfiles
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ results: [] });
  show();
  await search();
  expect(
    await screen.findByText('Beacon search is unavailable right now.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
  expect(
    await screen.findByText(/No public Beacons matched/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry following' }));
  expect(
    await screen.findByRole('link', { name: 'Garden club' }),
  ).toBeInTheDocument();
});
it('preserves the exact update and applies mute only after an explicit action', async () => {
  getFollowing.mockResolvedValue(response([item]));
  show();
  expect(
    await screen.findByRole('link', { name: /Seed swap/ }),
  ).toHaveAttribute('href', '/app/feed?surface=personas&post=p1');
  expect(mute).not.toHaveBeenCalled();
  getFollowing.mockResolvedValue(
    response([{ ...item, mutedUntil: '2099-01-01T00:00:00Z' }]),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mute for 7 days' }));
  await screen.findByRole('button', { name: 'Unmute' });
  expect(mute).toHaveBeenCalledWith('b1', 7);
  fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));
  await waitFor(() => expect(mute).toHaveBeenLastCalledWith('b1', null));
});
it('keeps following visible after a failed unfollow and permits retry', async () => {
  getFollowing.mockResolvedValue(response([item]));
  unfollow.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Unfollow' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'couldn’t update this follow',
  );
  expect(screen.getByRole('link', { name: 'Garden club' })).toBeInTheDocument();
  getFollowing.mockResolvedValue(response());
  fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Garden club' }),
    ).not.toBeInTheDocument(),
  );
  expect(unfollow).toHaveBeenCalledTimes(2);
});
it('routes paid followers to membership management instead of a free unfollow', async () => {
  getFollowing.mockResolvedValue(
    response([
      { ...item, paidTier: { rank: 2, name: 'Members', priceCents: 500 } },
    ]),
  );
  show();
  expect(
    await screen.findByRole('link', { name: 'Manage membership' }),
  ).toHaveAttribute('href', '/app/audience/membership/b1');
  expect(
    screen.queryByRole('button', { name: 'Unfollow' }),
  ).not.toBeInTheDocument();
});
it('clears previous-account results and searches on token changes', async () => {
  getFollowing.mockResolvedValue(response([item]));
  show();
  await screen.findByRole('link', { name: 'Garden club' });
  getViewer.mockResolvedValue({ id: 'u2' });
  getFollowing.mockResolvedValue(response());
  await act(async () => {
    tokenChanged();
  });
  await screen.findByText(/Your followed Beacons will appear here/);
  expect(
    screen.queryByRole('link', { name: 'Garden club' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('');
});
it('paginates without carrying another page’s followers forward', async () => {
  getFollowing
    .mockResolvedValueOnce({
      ...response([item]),
      pagination: { hasMore: true, nextOffset: 20 },
    })
    .mockResolvedValue(response());
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
  await screen.findByText('No more Beacons on this page.');
  expect(getFollowing).toHaveBeenLastCalledWith({
    limit: 20,
    offset: 20,
    sort: 'activity',
  });
  expect(
    screen.queryByRole('link', { name: 'Garden club' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
});

it('supports dotted Beacon handles and links to audience notifications', async () => {
  searchProfiles.mockResolvedValue({
    results: [
      {
        id: 'dotted',
        type: 'public_profile',
        href: '/@maya.builds',
        title: 'Maya Builds',
      },
    ],
  });
  show();
  await search('maya.builds');
  expect(
    await screen.findByRole('link', { name: /Maya Builds/ }),
  ).toHaveAttribute('href', '/@maya.builds');
  expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
    'href',
    '/app/notifications?context=audience',
  );
});
