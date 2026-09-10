import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import type { GigStopPreview, GigStopProgress, GigStopRequest } from '@pantopus/api';
import GigStopDialog from '../src/components/gig-detail/GigStopDialog';
import { retainStopRequest, stopRecoveryKey, verifyStopProgress } from '../src/components/gig-detail/gigStopRecovery';

const listeners = new Set<() => void>();
let token: string | null = '__session__';
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => token, getApiBaseUrl: () => 'https://app.test', AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  gigs: { getGigStopPreview: jest.fn(), getGigStopRequest: jest.fn(), submitGigStopRequest: jest.fn() },
}));
const actor = '11111111-1111-4111-8111-111111111111';
const worker = '22222222-2222-4222-8222-222222222222';
const gig = '33333333-3333-4333-8333-333333333333';
const payment = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const otherId = '66666666-6666-4666-8666-666666666666';
const session = 'a'.repeat(64);
const key = stopRecoveryKey('https://app.test', actor, gig);
const preview: GigStopPreview = { actorId: actor, sessionScope: session, action: 'cancel', eligible: true,
  unavailableReason: null, financialAction: 'release', activeRequestId: null,
  terms: { gigId: gig, ownerId: actor, workerId: worker, paymentId: payment, amountCents: 1234, currency: 'usd',
    gigStatus: 'assigned', acceptedAt: '2026-09-10T10:00:00Z', acceptedBidId: otherId, policy: 'standard', policyFeeCents: 0 } };
const request: GigStopRequest = { requestId, gigId: gig, actorId: actor, action: 'cancel', terms: preview.terms,
  reason: 'changed_plans', rollbackMode: null, financialAction: 'release' };
const pending: GigStopProgress = { actorId: actor, sessionScope: session, requestId, action: 'cancel', status: 'pending',
  financialStatus: 'release_pending', canRetry: true, request, receipt: null };
const done: GigStopProgress = { ...pending, status: 'completed', financialStatus: 'released', canRetry: false,
  receipt: { requestId, gigId: gig, paymentId: payment, ownerId: actor, workerId: worker,
    amountCents: 1234, currency: 'usd', action: 'cancel', gigStatus: 'cancelled', financialStatus: 'released' } };
const onCompleted = jest.fn();
function show() { return render(<GigStopDialog gigId={gig} actorId={actor} action="cancel" isOwner onClose={jest.fn()} onCompleted={onCompleted} />); }
async function submitNew() {
  fireEvent.change(await screen.findByRole('combobox', { name: 'Reason' }), { target: { value: 'changed_plans' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel task' })); });
}
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear(); localStorage.clear(); token = '__session__';
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: jest.fn(() => requestId) });
  jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue(preview);
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue(pending);
  jest.mocked(api.gigs.submitGigStopRequest).mockResolvedValue(pending);
});

test('opening reads current terms; explicit submission saves exact identity before POST and retains a pending outcome', async () => {
  show(); await screen.findByRole('combobox');
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
  jest.mocked(api.gigs.submitGigStopRequest).mockImplementation(async (_, body) => {
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
    expect(body).toEqual({ requestId, action: 'cancel', expectedActorId: actor, expectedSessionScope: session,
      expectedTerms: preview.terms, reason: 'changed_plans', rollbackMode: null });
    return pending;
  });
  await submitNew();
  await screen.findByText('The payment hold release is pending. The task action is not complete yet.');
  expect(onCompleted).not.toHaveBeenCalled();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry this request' })).toBeInTheDocument();
});

test('lost POST response survives closing and a GET404, then retries the same original request', async () => {
  jest.mocked(api.gigs.submitGigStopRequest).mockRejectedValueOnce(new Error('interrupted'));
  const first = show(); await submitNew(); await screen.findByRole('alert'); first.unmount();
  jest.mocked(api.gigs.getGigStopRequest).mockRejectedValueOnce({ statusCode: 404 });
  show(); const retry = await screen.findByRole('button', { name: 'Retry this request' });
  await act(async () => { fireEvent.click(retry); });
  await waitFor(() => expect(api.gigs.submitGigStopRequest).toHaveBeenCalledTimes(2));
  expect(jest.mocked(api.gigs.submitGigStopRequest).mock.calls[0]).toEqual(jest.mocked(api.gigs.submitGigStopRequest).mock.calls[1]);
  expect(onCompleted).not.toHaveBeenCalled();
});

test('confirmed exact completion clears recovery and reports success once', async () => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue(done);
  show(); await screen.findByText('The task is cancelled. The payment hold release is confirmed.');
  expect(onCompleted).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(key)).toBeNull();
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
});

test.each([
  { amountCents: 1235 }, { workerId: actor }, { paymentId: worker }, { requestId: otherId },
  { action: 'worker_release' }, { gigStatus: 'open' }, { financialStatus: 'refunded' }, { currency: 'eur' },
])('mismatched completed receipt never reports success or erases recovery: %j', async (change) => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue({ ...done, receipt: { ...done.receipt, ...change } } as GigStopProgress);
  show(); await screen.findByRole('alert');
  expect(onCompleted).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
  expect(screen.queryByRole('button', { name: 'Retry this request' })).not.toBeInTheDocument();
});

test('same-account session replacement retires a late completion and all controls', async () => {
  let resolve!: (result: GigStopProgress) => void;
  jest.mocked(api.gigs.submitGigStopRequest).mockReturnValue(new Promise((done) => { resolve = done; }));
  show(); await submitNew(); await waitFor(() => expect(api.gigs.submitGigStopRequest).toHaveBeenCalledTimes(1));
  act(() => listeners.forEach((listener) => listener()));
  await act(async () => resolve(done));
  expect(onCompleted).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Check status' })).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Close and reopen');
});

test('a fresh same-actor session recovers original terms with new server proof', async () => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue({ ...pending, sessionScope: 'b'.repeat(64) });
  jest.mocked(api.gigs.submitGigStopRequest).mockResolvedValue({ ...done, sessionScope: 'b'.repeat(64) });
  show(); const retry = await screen.findByRole('button', { name: 'Retry this request' });
  await act(async () => { fireEvent.click(retry); });
  await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
  expect(api.gigs.submitGigStopRequest).toHaveBeenCalledWith(gig, expect.objectContaining({ requestId,
    expectedSessionScope: 'b'.repeat(64), expectedTerms: request.terms }));
});

test('same cookie marker replacement blocks submission before a delayed storage event', async () => {
  show(); fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'changed_plans' } });
  const submit = screen.getByRole('button', { name: 'Cancel task' });
  localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'replacement-session');
  fireEvent.click(submit);
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByRole('alert')).toHaveTextContent('Close and reopen');
});

test.each([408, 429, 503])('temporary status failure retains the request for a later exact read: %s', async (statusCode) => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockRejectedValueOnce({ statusCode });
  show(); await screen.findByRole('alert');
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
  fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
  await screen.findByRole('button', { name: 'Retry this request' });
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
});

test('unavailable or unverified policy never fabricates zero fee or permits submission', async () => {
  jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue({ ...preview, eligible: false, financialAction: 'review',
    unavailableReason: 'fee_review_required', terms: { ...preview.terms, policyFeeCents: 200 } });
  show(); await screen.findByText(/Current policy fee: \$2.00/);
  expect(screen.queryByRole('button', { name: 'Cancel task' })).not.toBeInTheDocument();
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
});

test('only explicit STOP_ACTIVE can replace an unknown local request', async () => {
  const activeRequest = { ...request, requestId: otherId };
  jest.mocked(api.gigs.submitGigStopRequest).mockRejectedValue({ statusCode: 409,
    data: { code: 'STOP_ACTIVE', activeRequestId: otherId } });
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue({ ...pending, requestId: otherId, request: activeRequest });
  show(); await submitNew();
  await screen.findByRole('button', { name: 'Retry this request' });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(activeRequest);
  expect(onCompleted).not.toHaveBeenCalled();
});

test('foreign original actor can be viewed but cannot be offered Retry', () => {
  expect(() => verifyStopProgress({ ...pending, request: { ...request, actorId: worker } }, gig, actor, requestId, session)).toThrow();
  expect(verifyStopProgress({ ...pending, canRetry: false, request: { ...request, actorId: worker } }, gig, actor, requestId, session).canRetry).toBe(false);
});

test('an unknown rejected request can recover a competing operation only through explicit same-ID retry and STOP_ACTIVE', async () => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockRejectedValueOnce({ statusCode: 404 });
  jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue({ ...preview, eligible: false,
    financialAction: 'none', activeRequestId: otherId, unavailableReason: 'STOP_ACTIVE' });
  const active = { ...request, requestId: otherId };
  jest.mocked(api.gigs.submitGigStopRequest).mockRejectedValue({ statusCode: 409, data: { code: 'STOP_ACTIVE', activeRequestId: otherId } });
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue({ ...pending, requestId: otherId, request: active });
  show(); const retry = await screen.findByRole('button', { name: 'Retry this request' });
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
  fireEvent.click(retry);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!)).toEqual(active));
  expect(api.gigs.submitGigStopRequest).toHaveBeenCalledWith(gig, expect.objectContaining({ requestId, expectedTerms: request.terms }));
  expect(onCompleted).not.toHaveBeenCalled();
});

test('storage retains only nonsecret original fields', () => {
  retainStopRequest(key, { ...request, sessionScope: session, clientSecret: 'do-not-store',
    terms: { ...request.terms, providerSecret: 'do-not-store' } } as GigStopRequest);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
});
