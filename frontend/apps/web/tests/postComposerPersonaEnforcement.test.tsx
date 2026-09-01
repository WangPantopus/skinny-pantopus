/**
 * P2.4 — Personal-zone composer enforcement.
 *
 * Asserts unified-IA §4.1's hard rule: the personal-zone PostComposer
 * NEVER offers the user's persona as a posting-as option, even if the
 * /api/posts/identities response surfaces one (stale cache, future
 * regression, alternate caller).
 *
 *   1. The Posting-as picker filters out persona-typed identity rows.
 *   2. If selectedIdentity is initially set to a persona row, the
 *      composer auto-resets to a Personal/Home/Business identity
 *      (defense-in-depth for stale localStorage / migration).
 *   3. The personal-zone audience options are nearby/connections/
 *      followers — none persona-specific.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();
const mockPrefetch = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, prefetch: mockPrefetch, replace: jest.fn() }),
  usePathname: () => '/app/feed',
  useSearchParams: () => new URLSearchParams(),
}));

// Stub heavy sub-components so the composer renders in jsdom without
// pulling AI / media / location subtrees.
jest.mock('@/components/ai-assistant', () => ({
  InlineDraftHelper: () => null,
}));
jest.mock('@/components/feed/composer/MediaUpload', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/feed/PostLocationPicker', () => ({
  __esModule: true,
  default: () => null,
}));

const apiMock = require('@pantopus/api');

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => cleanup());

const PERSONAL = { type: 'personal', id: 'user-1', name: 'Maya', imageUrl: null };
const HOME     = { type: 'home',     id: 'home-1', name: 'Riverside Apt', role: 'owner', imageUrl: null };
const BUSINESS = { type: 'business', id: 'biz-1',  name: 'Maya Bakery',  role: 'owner', imageUrl: null };
const PERSONA  = { type: 'persona',  id: 'persona-1', name: '@mayabuilds', role: 'followers', imageUrl: null };

function renderComposer() {
  const PostComposer = require('../src/components/feed/PostComposer').default;
  return render(
    <PostComposer
      onPost={jest.fn().mockResolvedValue(undefined)}
      isPosting={false}
      user={{ name: 'Maya', username: 'mayabuilds' }}
    />,
  );
}

async function expandToPicker() {
  // The composer renders an IntentSelector while collapsed; the
  // "Posting as" picker is gated on f.expanded. Click any intent to
  // expand it.
  const askIntent = await screen.findByRole('button', { name: /^Ask$/ });
  act(() => { askIntent.click(); });
  // Open the "Change" picker.
  const change = await screen.findByRole('button', { name: /^Change$/ });
  act(() => { change.click(); });
}

describe('PostComposer — personal-zone persona enforcement (P2.4)', () => {
  test('the Posting-as picker filters out persona rows from getPostingIdentities', async () => {
    apiMock.posts.getPostingIdentities.mockResolvedValue({
      identities: [PERSONAL, HOME, BUSINESS, PERSONA],
    });

    renderComposer();
    await waitFor(() => {
      expect(apiMock.posts.getPostingIdentities).toHaveBeenCalled();
    });
    await expandToPicker();

    // Personal/Home/Business chips render; persona NEVER does.
    await waitFor(() => {
      expect(screen.getByTestId('posting-identity-personal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('posting-identity-home')).toBeInTheDocument();
    expect(screen.getByTestId('posting-identity-business')).toBeInTheDocument();
    expect(screen.queryByTestId('posting-identity-persona')).not.toBeInTheDocument();
  });

  test('a stale persona-typed selectedIdentity is auto-reset to the personal identity', async () => {
    // Server returns persona FIRST so the initial fallback would, without
    // the §4.1 filter, end up persona. The defense-in-depth filter must
    // reject persona before it can be selected.
    apiMock.posts.getPostingIdentities.mockResolvedValue({
      identities: [PERSONA, PERSONAL, HOME],
    });

    renderComposer();
    await waitFor(() => {
      expect(apiMock.posts.getPostingIdentities).toHaveBeenCalled();
    });
    await expandToPicker();

    // The visible "Posting as: ..." chip must reference the personal
    // identity, never the persona handle. The picker open also confirms
    // the persona chip never gets rendered.
    await waitFor(() => {
      expect(screen.getByTestId('posting-identity-personal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('posting-identity-persona')).not.toBeInTheDocument();
    expect(screen.getByText(/Posting as:/)).toHaveTextContent('Maya');
  });

  test('GLOBAL_AUDIENCE_OPTIONS source has no persona key (none of the personal-zone audiences are persona-specific)', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'src',
      'components/feed/PostComposer.tsx',
    );
    const source = fs.readFileSync(file, 'utf8');
    // The audience map is keyed by PersonalPostAs — must NOT carry a
    // persona entry.
    expect(source).toMatch(/Record<PersonalPostAs/);
    // No `persona:` key in the audience map (the regex tolerates any
    // whitespace before the brace).
    const optionsBlock = source.match(/GLOBAL_AUDIENCE_OPTIONS[\s\S]*?\n\};/);
    expect(optionsBlock).not.toBeNull();
    expect(optionsBlock![0]).not.toMatch(/^\s*persona:\s*\[/m);
    // The personal-zone post-submit handler types as PersonalPostAs.
    expect(source).toMatch(/let targetPostAs: PersonalPostAs = 'personal'/);
  });
});
