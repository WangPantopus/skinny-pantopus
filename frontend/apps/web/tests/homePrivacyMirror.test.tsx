// ============================================================
// The privacy mirror page: a resident sees their home as a neighbor
// does — street and first name only — from the real serializer. The
// page must show exactly what the API returned and name what is hidden.
// ============================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import HomePrivacyMirrorPage from '@/app/(app)/app/homes/[id]/privacy/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'h1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/app/homes/h1/privacy',
}));

const mirrorMock = api.identityCenter.getHomeMirror as jest.Mock;

const MIRROR = {
  surface: 'home',
  viewer: 'neighbor',
  viewer_label: 'A neighbor who is not in your household',
  discoverable: true,
  home: { id: 'h1', name: 'Home', address: 'NW Lacamas Dr', address_redacted: true, city: 'Camas', state: 'WA', zipcode: null, home_type: 'house', visibility: 'public_preview', description: null, created_at: null },
  owner: { id: 'u1', username: 'yp', name: 'Yingpeng', profile_picture_url: null },
  hidden: [
    { key: 'house_number', label: 'Your house number and unit' },
    { key: 'zipcode', label: 'Your zip code' },
    { key: 'surname', label: 'Your last name' },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HomePrivacyMirrorPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => mirrorMock.mockReset());

it('renders the neighbor card from the API — street and first name — and the hidden list', async () => {
  mirrorMock.mockResolvedValue(MIRROR);
  renderPage();
  expect(await screen.findByText('Yingpeng')).toBeInTheDocument();
  expect(screen.getByTestId('mirror-address')).toHaveTextContent('NW Lacamas Dr · Camas, WA');
  expect(screen.getByText(/street only, no house number/i)).toBeInTheDocument();
  for (const h of MIRROR.hidden) expect(screen.getByText(h.label)).toBeInTheDocument();
  // The promise sits under the card, and the page never invents a number.
  expect(screen.getByText(/never a house number or unit/i)).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/2518|98607/);
  expect(mirrorMock).toHaveBeenCalledWith('h1');
});

it('says so when the home is not discoverable at all', async () => {
  mirrorMock.mockResolvedValue({ ...MIRROR, discoverable: false });
  renderPage();
  expect(await screen.findByText(/not discoverable right now/i)).toBeInTheDocument();
});

it('shows the members-only error with a retry', async () => {
  mirrorMock.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce(MIRROR);
  renderPage();
  expect(await screen.findByRole('alert')).toHaveTextContent(/only a member of this home/i);
  fireEvent.click(screen.getByRole('button', { name: /try again/i }));
  await waitFor(() => expect(screen.getByText('Yingpeng')).toBeInTheDocument());
});
