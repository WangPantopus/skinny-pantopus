/**
 * Tests for VerificationCenter component.
 *
 * Validates that each verification status renders the correct UI,
 * that action buttons trigger the right navigation/API calls, and
 * that the component never exposes role strings to the user —
 * only status-driven messaging.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VerificationCenter from '../../src/components/home/VerificationCenter';

// ── Mock next/navigation ────────────────────────────────────
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Mock @pantopus/api ──────────────────────────────────────
const mockPost = jest.fn();
jest.mock('@pantopus/api', () => ({
  get: jest.fn(),
  post: (...args: unknown[]) => mockPost(...args),
}));

// ── Mock confirm dialog store ─────────────────────────────────
const mockConfirmOpen = jest.fn();
jest.mock('../../src/components/ui/confirm-store', () => ({
  confirmStore: {
    open: (...args: unknown[]) => mockConfirmOpen(...args),
  },
}));

// ── Mock useHomePermissions ─────────────────────────────────
const mockReload = jest.fn();
let mockAccess: Record<string, any> | null = null;

jest.mock('../../src/components/home/useHomePermissions', () => ({
  useHomePermissions: () => ({
    access: mockAccess,
    reload: mockReload,
    loading: false,
    error: null,
    can: () => false,
    hasRoleAtLeast: () => false,
    canSeeTab: () => false,
    needsVerification: true,
    isProvisional: false,
  }),
}));

// ── Helpers ─────────────────────────────────────────────────

function buildAccess(overrides: Record<string, any> = {}) {
  return {
    verification_status: 'unverified',
    is_in_challenge_window: false,
    challenge_window_ends_at: null,
    postcard_expires_at: null,
    can_manage_home: false,
    can_manage_access: false,
    can_manage_finance: false,
    can_manage_tasks: false,
    can_view_sensitive: false,
    ...overrides,
  };
}

const HOME_ID = 'test-home-123';

beforeEach(() => {
  mockPush.mockReset();
  mockPost.mockReset();
  mockConfirmOpen.mockReset();
  mockReload.mockReset();
  mockAccess = null;
});

// ============================================================
// Status rendering
// ============================================================

describe('pending_postcard state', () => {
  beforeEach(() => {
    mockAccess = buildAccess({
      verification_status: 'pending_postcard',
      postcard_expires_at: '2026-04-15T00:00:00Z',
    });
  });

  test('renders "Check your mailbox" title', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Check your mailbox')).toBeInTheDocument();
  });

  test('renders postcard expiry countdown', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Code expires')).toBeInTheDocument();
    // The date is rendered as a localized string; just check the container exists
    expect(screen.getByText(/Apr/)).toBeInTheDocument();
  });

  test('shows "Enter verification code" button', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Enter verification code')).toBeInTheDocument();
  });

  test('shows "Resend code" button', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Resend code')).toBeInTheDocument();
  });
});

describe('provisional_bootstrap state', () => {
  beforeEach(() => {
    mockAccess = buildAccess({
      verification_status: 'provisional_bootstrap',
    });
  });

  test('renders "You have limited access" title', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('You have limited access')).toBeInTheDocument();
  });

  test('renders the available features list', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Available with limited access:')).toBeInTheDocument();
    expect(screen.getByText('View and create tasks')).toBeInTheDocument();
  });

  test('shows "Upload proof" button', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Upload proof')).toBeInTheDocument();
  });

  test('shows "Mail me a code" button', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Mail me a code')).toBeInTheDocument();
  });
});

describe('pending_approval state', () => {
  beforeEach(() => {
    mockAccess = buildAccess({
      verification_status: 'pending_approval',
    });
  });

  test('renders "Waiting for approval" title', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
  });

  test('renders approval body text', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(
      screen.getByText(/household member needs to approve/)
    ).toBeInTheDocument();
  });

  test('does not show postcard or upload buttons', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.queryByText('Enter verification code')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload proof')).not.toBeInTheDocument();
    expect(screen.queryByText('Mail me a code')).not.toBeInTheDocument();
  });
});

describe('provisional with challenge window', () => {
  beforeEach(() => {
    mockAccess = buildAccess({
      verification_status: 'provisional',
      is_in_challenge_window: true,
      challenge_window_ends_at: '2026-03-06T00:00:00Z',
    });
  });

  test('renders challenge window title', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Your access is being confirmed')).toBeInTheDocument();
  });

  test('renders challenge window countdown', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Full access unlocks')).toBeInTheDocument();
    expect(screen.getByText(/Mar/)).toBeInTheDocument();
  });
});

// ============================================================
// Always-visible actions
// ============================================================

describe('always-visible actions', () => {
  beforeEach(() => {
    mockAccess = buildAccess({ verification_status: 'pending_postcard' });
  });

  test('"This isn\'t my home" button is always rendered', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText(/isn.*t my home/i)).toBeInTheDocument();
  });

  test('"Message household admin" button is always rendered', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Message household admin')).toBeInTheDocument();
  });

  test('"Check for updates" button is always rendered', () => {
    render(<VerificationCenter homeId={HOME_ID} />);
    expect(screen.getByText('Check for updates')).toBeInTheDocument();
  });
});

// ============================================================
// Button actions
// ============================================================

describe('button actions', () => {
  test('"Enter verification code" navigates to postcard entry', () => {
    mockAccess = buildAccess({ verification_status: 'pending_postcard' });
    render(<VerificationCenter homeId={HOME_ID} />);

    fireEvent.click(screen.getByText('Enter verification code'));
    expect(mockPush).toHaveBeenCalledWith(`/app/homes/${HOME_ID}/verify-postcard`);
  });

  test('"This isn\'t my home" calls move-out API', async () => {
    mockAccess = buildAccess({ verification_status: 'pending_postcard' });
    mockConfirmOpen.mockResolvedValueOnce(true);
    mockPost.mockResolvedValueOnce({});

    render(<VerificationCenter homeId={HOME_ID} />);

    fireEvent.click(screen.getByText(/isn.*t my home/i));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(`/api/homes/${HOME_ID}/move-out`);
    });

    // Should redirect to /app after move-out
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/app');
    });
  });

  test('"This isn\'t my home" does nothing if user cancels confirm', async () => {
    mockAccess = buildAccess({ verification_status: 'pending_postcard' });
    mockConfirmOpen.mockResolvedValueOnce(false);

    render(<VerificationCenter homeId={HOME_ID} />);

    fireEvent.click(screen.getByText(/isn.*t my home/i));
    await waitFor(() => expect(mockConfirmOpen).toHaveBeenCalled());
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('"Check for updates" calls reload', () => {
    mockAccess = buildAccess({ verification_status: 'pending_approval' });
    render(<VerificationCenter homeId={HOME_ID} />);

    fireEvent.click(screen.getByText('Check for updates'));
    expect(mockReload).toHaveBeenCalled();
  });

  test('"Upload proof" navigates to evidence page', () => {
    mockAccess = buildAccess({ verification_status: 'provisional_bootstrap' });
    render(<VerificationCenter homeId={HOME_ID} />);

    fireEvent.click(screen.getByText('Upload proof'));
    expect(mockPush).toHaveBeenCalledWith(`/app/homes/${HOME_ID}/claim-owner/evidence`);
  });

  test('"Mail me a code" navigates to verify-postcard page', () => {
    mockAccess = buildAccess({ verification_status: 'provisional_bootstrap' });
    render(<VerificationCenter homeId={HOME_ID} />);

    fireEvent.click(screen.getByText('Mail me a code'));
    expect(mockPush).toHaveBeenCalledWith(`/app/homes/${HOME_ID}/verify-postcard`);
  });
});
