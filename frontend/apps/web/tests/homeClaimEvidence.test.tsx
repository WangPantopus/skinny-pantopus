import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { claimEvidence } from '@pantopus/api';
import ClaimEvidenceReview from '../src/components/home/ClaimEvidenceReview';

const listeners = new Set<() => void>();
jest.mock('@pantopus/api', () => ({ onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, AUTH_SESSION_CHANGE_KEY: 'test-session', claimEvidence: { inspectClaimEvidence: jest.fn(), readClaimEvidence: jest.fn(), verifyClaimEvidence: jest.fn() } }));
const api = claimEvidence as jest.Mocked<typeof claimEvidence>;
const scope = { actor_id: 'reviewer', session_scope: 'a'.repeat(64), home_id: 'home-1', claim_id: 'claim-1' };
const reviewToken = 'b'.repeat(64);
const inspection = 'c'.repeat(64);
const bytes = new Blob(['%PDF-test'], { type: 'application/pdf' });
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:private-test') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  api.inspectClaimEvidence.mockResolvedValue({ bytes, inspection });
  api.verifyClaimEvidence.mockResolvedValue({ review_token: 'd'.repeat(64), replayed: false, record: {} as never });
});
function show(onVerified = jest.fn(async () => undefined)) {
  return { onVerified, ...render(<ClaimEvidenceReview scope={scope} evidenceId="evidence-1" reviewToken={reviewToken} platformAdmin onVerified={onVerified} />) };
}
async function inspect() {
  fireEvent.click(screen.getByRole('button', { name: 'Open private document' }));
  await screen.findByTitle('Private claim evidence');
}
test('opening exact private bytes never automatically verifies evidence or approves a claim', async () => {
  const { onVerified } = show();
  await inspect();
  expect(api.inspectClaimEvidence).toHaveBeenCalledWith(scope, 'evidence-1', reviewToken, true);
  expect(screen.getByTitle('Private claim evidence')).toHaveAttribute('sandbox', '');
  expect(screen.getByRole('button', { name: 'Confirm evidence verification' })).toBeDisabled();
  expect(api.verifyClaimEvidence).not.toHaveBeenCalled();
  expect(onVerified).not.toHaveBeenCalled();
});
test('explicit inspection confirmation sends the exact snapshot and receipt once', async () => {
  const { onVerified } = show();
  await inspect();
  fireEvent.click(screen.getByRole('checkbox'));
  const button = screen.getByRole('button', { name: 'Confirm evidence verification' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  expect(api.verifyClaimEvidence).toHaveBeenCalledTimes(1);
  expect(api.verifyClaimEvidence).toHaveBeenCalledWith(scope, 'evidence-1', reviewToken, inspection, true);
});
test('unknown verification result keeps the exact inspection available for retry', async () => {
  api.verifyClaimEvidence.mockRejectedValueOnce(new Error('Could not confirm the review. Retry.'));
  const { onVerified } = show();
  await inspect(); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm evidence verification' }));
  await screen.findByRole('alert');
  expect(onVerified).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm evidence verification' }));
  await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  expect(api.inspectClaimEvidence).toHaveBeenCalledTimes(1);
  expect(api.verifyClaimEvidence.mock.calls[0]).toEqual(api.verifyClaimEvidence.mock.calls[1]);
});
test('session denial after download does not expose bytes or an inspection control', async () => {
  api.inspectClaimEvidence.mockRejectedValue(new Error('Session changed. Reopen the claim.'));
  show(); fireEvent.click(screen.getByRole('button', { name: 'Open private document' }));
  await screen.findByRole('alert');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
test('a retained old context discards delayed bytes instead of binding a replacement session', async () => {
  let resolve!: (value: { bytes: Blob; inspection: string }) => void;
  api.inspectClaimEvidence.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { rerender, onVerified } = show();
  fireEvent.click(screen.getByRole('button', { name: 'Open private document' }));
  rerender(<ClaimEvidenceReview scope={{ ...scope, session_scope: 'e'.repeat(64) }} evidenceId="evidence-1" reviewToken={reviewToken} platformAdmin onVerified={onVerified} />);
  resolve({ bytes, inspection });
  await screen.findByRole('alert');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(api.verifyClaimEvidence).not.toHaveBeenCalled();
});
test('repeated open taps share one in-flight byte request and revoke the local object URL on unmount', async () => {
  let resolve!: (value: { bytes: Blob; inspection: string }) => void;
  api.inspectClaimEvidence.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { unmount } = show();
  const button = screen.getByRole('button', { name: 'Open private document' });
  fireEvent.click(button); fireEvent.click(button);
  expect(api.inspectClaimEvidence).toHaveBeenCalledTimes(1);
  resolve({ bytes, inspection }); await screen.findByTitle('Private claim evidence');
  unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-test');
});

test('verified evidence can be opened without creating another inspection or verification action', async () => {
  api.readClaimEvidence.mockResolvedValue(bytes);
  render(<ClaimEvidenceReview scope={scope} evidenceId="evidence-1" reviewToken={reviewToken} platformAdmin alreadyVerified onVerified={jest.fn()} />);
  await inspect();
  expect(api.readClaimEvidence).toHaveBeenCalledWith(scope, 'evidence-1', true);
  expect(api.inspectClaimEvidence).not.toHaveBeenCalled();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm evidence verification' })).not.toBeInTheDocument();
});

test('session invalidation hides already fetched bytes and cannot rebind the old review', async () => {
  show(); await inspect();
  act(() => [...listeners].forEach(fn => fn()));
  expect(screen.queryByTitle('Private claim evidence')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Reopen the claim');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-test');
  expect(api.verifyClaimEvidence).not.toHaveBeenCalled();
});
