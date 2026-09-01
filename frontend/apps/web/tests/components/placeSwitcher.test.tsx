/**
 * W2.4 — Place multi-home switcher.
 *
 * Asserts the switcher contract on the authed Place dashboard:
 *   1. A resident with 2+ places gets a switch affordance in the header
 *      that opens a "Switch place" sheet listing each place with its
 *      Verified / Claimed status, plus an "Add a place" row.
 *   2. Picking a different place RE-QUERIES the PlaceIntelligence
 *      contract for the selected home (the core W2.4 requirement).
 *   3. "Add a place" routes to /app/homes/new.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, prefetch: jest.fn() }),
  usePathname: () => '/app/place',
  useSearchParams: () => new URLSearchParams(),
}));

const apiMock = require('@pantopus/api');
const PlaceDashboard = require('../../src/components/place/PlaceDashboard').default;

// PlaceIntelligence stub keyed by home id — enough for the view to render.
const LABEL: Record<string, string> = {
  'home-1': '1421 SE Oak St, Portland',
  'home-2': '88 Marine Dr, Astoria',
};
function makeIntel(homeId: string) {
  return {
    place: {
      label: LABEL[homeId] ?? homeId,
      line1: LABEL[homeId] ?? homeId,
      city: 'Portland',
      state: 'OR',
      postal_code: '97214',
    },
    tier: 'T4',
    region_supported: true,
    generated_at: new Date().toISOString(),
    groups: [],
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.getAuthToken.mockReturnValue('test-token');
  apiMock.homes.getPrimaryHome.mockResolvedValue({ home: { id: 'home-1' } });
  apiMock.homes.getMyHomes.mockResolvedValue({
    homes: [
      { id: 'home-1', address: '1421 SE Oak St', city: 'Portland', state: 'OR', occupancy: { verification_status: 'verified' } },
      { id: 'home-2', address: '88 Marine Dr', city: 'Astoria', state: 'OR', occupancy: { verification_status: 'pending' } },
    ],
  });
  apiMock.place.getPlaceIntelligence.mockImplementation((id: string) => Promise.resolve(makeIntel(id)));
});

afterEach(() => cleanup());

async function renderDashboardOnPrimary() {
  renderWithClient(<PlaceDashboard />);
  // The dashboard lands on the primary home first.
  await screen.findByRole('button', { name: /1421 SE Oak St, Portland/i });
  await waitFor(() => expect(apiMock.place.getPlaceIntelligence).toHaveBeenCalledWith('home-1'));
}

describe('W2.4 — Place multi-home switcher', () => {
  test('lists the resident places with status + an Add a place row', async () => {
    await renderDashboardOnPrimary();

    fireEvent.click(screen.getByRole('button', { name: /1421 SE Oak St, Portland/i }));

    const sheet = await screen.findByRole('dialog', { name: /switch place/i });
    expect(sheet).toBeInTheDocument();
    // Each place row carries its trust status. Scope to the sheet — the
    // verified (T4) dashboard behind it also surfaces a "Verified" Identity chip.
    expect(within(sheet).getByText('Verified')).toBeInTheDocument();
    expect(within(sheet).getByText('Claimed')).toBeInTheDocument();
    // The active place is labelled, and the other place is offered.
    expect(within(sheet).getByText('Current place')).toBeInTheDocument();
    expect(within(sheet).getByText('88 Marine Dr')).toBeInTheDocument();
    expect(within(sheet).getByText('Add a place')).toBeInTheDocument();
  });

  test('switching re-queries the contract for the selected home', async () => {
    await renderDashboardOnPrimary();
    expect(apiMock.place.getPlaceIntelligence).not.toHaveBeenCalledWith('home-2');

    // Open the switcher and pick the other place.
    fireEvent.click(screen.getByRole('button', { name: /1421 SE Oak St, Portland/i }));
    await screen.findByRole('dialog', { name: /switch place/i });
    fireEvent.click(screen.getByRole('button', { name: /88 Marine Dr/i }));

    // The dashboard re-queries PlaceIntelligence for the newly selected home.
    await waitFor(() => expect(apiMock.place.getPlaceIntelligence).toHaveBeenCalledWith('home-2'));
    // And renders that place.
    await screen.findByRole('button', { name: /88 Marine Dr, Astoria/i });
  });

  test('Add a place routes to /app/homes/new', async () => {
    await renderDashboardOnPrimary();

    fireEvent.click(screen.getByRole('button', { name: /1421 SE Oak St, Portland/i }));
    await screen.findByRole('dialog', { name: /switch place/i });
    fireEvent.click(screen.getByRole('button', { name: /add a place/i }));

    expect(mockPush).toHaveBeenCalledWith('/app/homes/new');
  });
});
