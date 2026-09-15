import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { AUTH_SESSION_CHANGE_KEY, payments } from '@pantopus/api';
import type { GigTipPreview, GigTipRequest, GigTipProgress, GigTipReceipt } from '@pantopus/api';
import TipModal, { verifyTipProgress } from '../src/components/payments/TipModal';
import CompletionFlow from '../src/components/gig-detail/CompletionFlow';
const router = { push: jest.fn(), replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('next/image', () => () => null);
jest.mock('../src/components/FileUpload', () => () => null);
jest.mock('../src/components/payments/StripeConnectOnboarding', () => () => null);
jest.mock('../src/components/ui/toast-store', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

type Saved = { value: GigTipRequest; revision: string };
const mockSaved = new Map<string, Saved>();
let mockBeforeLoad: (() => Promise<void>) | undefined;
let mockBeforeProtect: (() => Promise<void>) | undefined;
let mockBeforeClear: (() => void) | undefined;
let mockRevision = 0;
jest.mock('../src/components/home/tasks/TaskRecoveryStorage', () => ({
  ProtectedRecoverySlot: class {
    private key: string;
    constructor(scope: string[]) { this.key = JSON.stringify(scope); }
    async load() { await mockBeforeLoad?.(); return mockSaved.get(this.key) ?? null; }
    async retain(value: GigTipRequest, current: () => boolean, expected?: Saved) {
      await mockBeforeProtect?.();
      if (!current() || (mockSaved.get(this.key)?.revision ?? null) !== (expected?.revision ?? null)) throw new Error('Protected original changed');
      const saved = { value: JSON.parse(JSON.stringify(value)), revision: `revision-${++mockRevision}` };
      mockSaved.set(this.key, saved); return saved;
    }
    async clear(expected: Saved, current: () => boolean) {
      mockBeforeClear?.();
      if (!current() || mockSaved.get(this.key)?.revision !== expected.revision) throw new Error('Protected original changed');
      mockSaved.delete(this.key);
    }
  },
}));
let token: string | null = '__session__';
let origin = 'https://app.test';
const listeners = new Set<() => void>();
jest.mock('@pantopus/api', () => ({
  payments: { createTip: jest.fn(), getTipPreview: jest.fn(), getTipRequest: jest.fn() },
  getAuthToken: () => token, getApiBaseUrl: () => origin, AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
}));
let mockSheet: { beforeConfirm: () => Promise<boolean>; onSuccess: () => Promise<void>; onError: () => void; onClose: () => void; isCurrent: () => boolean };
jest.mock('../src/components/payments/StripeProvider', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/components/payments/GigPaymentSetup', () => ({ __esModule: true, default: (props: typeof mockSheet & { amount: number; tipRequestId: string }) => {
  mockSheet = props; return <div>Existing card confirmation {props.amount} {props.tipRequestId}</div>;
} }));
const actor = '11111111-1111-4111-8111-111111111111';
const worker = '22222222-2222-4222-8222-222222222222';
const gig = '33333333-3333-4333-8333-333333333333';
const requestId = '55555555-5555-4555-8555-555555555555';
const otherId = '66666666-6666-4666-8666-666666666666';
const session = 'a'.repeat(64);
const key = JSON.stringify(['gig-tip-original-v1', origin, actor, gig]);
const preview: GigTipPreview = { actorId: actor, sessionScope: session, terms: { gigId: gig, payerId: actor, payeeId: worker, ownerConfirmedAt: '2026-09-14T10:00:00Z' },
  eligible: true, unavailableReason: null, activeRequestId: null, legacyPaymentId: null, minimumAmountCents: 50, maximumAmountCents: 99999999, remainingTipSlots: 3 };
const original: GigTipRequest = { requestId, paymentId: requestId, gigId: gig, payerId: actor, payeeId: worker, amountCents: 500, currency: 'usd', terms: preview.terms, paymentMethodId: null };
const pending: GigTipProgress = { actorId: actor, sessionScope: session, request: original, status: 'pending', paymentStatus: 'authorize_pending', providerStatus: 'processing', paymentIntentId: 'pi_tip', canRetry: false, canCancel: true, receipt: null };
const checkout: GigTipProgress = { ...pending, providerStatus: 'requires_payment_method', checkout: { paymentIntentId: 'pi_tip', clientSecret: 'pi_tip_secret_synthetic', customer: 'cus_tip', ephemeralKey: 'ek_synthetic', publishableKey: 'pk_test_synthetic' } };
const done: GigTipProgress = { ...pending, status: 'succeeded', paymentStatus: 'captured_hold', providerStatus: 'succeeded', canCancel: false,
  receipt: { requestId, paymentId: requestId, gigId: gig, payerId: actor, payeeId: worker, amountCents: 500, currency: 'usd', status: 'succeeded', paymentIntentId: 'pi_tip', chargeId: 'ch_tip', amountChargedCents: 500 } };
const canceled: GigTipProgress = { ...done, status: 'canceled', paymentStatus: 'canceled', providerStatus: null, paymentIntentId: null,
  receipt: { ...done.receipt!, status: 'canceled', paymentIntentId: null, chargeId: null, amountChargedCents: 0 } };
const create = jest.mocked(payments.createTip), read = jest.mocked(payments.getTipRequest), getPreview = jest.mocked(payments.getTipPreview);
const onSuccess = jest.fn(), onClose = jest.fn();
const props = { actorId: actor, workerId: worker, gigId: gig, workerName: 'Worker', onSuccess, onClose };
function seed(value = original) { const saved = { value, revision: `revision-${++mockRevision}` }; mockSaved.set(key, saved); return saved; }
function show() { return render(<TipModal {...props} />); }
async function submit() {
  await waitFor(() => expect(screen.getByRole('button', { name: '$5' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '$5' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tip $5.00' })); });
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.resetAllMocks(); listeners.clear(); localStorage.clear(); mockSaved.clear(); mockRevision = 0;
  token = '__session__'; origin = 'https://app.test'; mockBeforeProtect = undefined; mockBeforeClear = undefined; mockBeforeLoad = undefined;
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: jest.fn(() => requestId) });
  getPreview.mockResolvedValue(preview); read.mockResolvedValue(pending); create.mockResolvedValue(pending);
});

test('opening only reads eligibility and explicit submission retains the exact original before POST', async () => {
  show(); await waitFor(() => expect(getPreview).toHaveBeenCalledWith(gig)); expect(create).not.toHaveBeenCalled();
  create.mockImplementation(async body => {
    expect(mockSaved.get(key)?.value).toEqual(original);
    expect(body).toEqual({ requestId, gigId: gig, amount: 500, paymentMethodId: null, expectedActorId: actor, expectedSessionScope: session, expectedTerms: preview.terms, mode: 'resume' });
    return pending;
  });
  await submit(); await screen.findByRole('button', { name: 'Check tip status' });
  expect(onSuccess).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: '$10' })).toBeDisabled();
});

test('SDK secrets are transient and intent creation alone cannot report a paid tip', async () => {
  create.mockResolvedValue(checkout); show(); await submit();
  expect(await screen.findByText(/Existing card confirmation/)).toBeInTheDocument();
  expect(mockSaved.get(key)?.value).toEqual(original);
  expect(JSON.stringify([...mockSaved.values()])).not.toMatch(/secret|ek_synthetic|pk_test/);
  expect(localStorage.length).toBe(0); expect(onSuccess).not.toHaveBeenCalled();
});

test('lost creation and local404 survive remount and retry the same UUID and frozen amount', async () => {
  create.mockRejectedValueOnce(new Error('Lost reply')); const first = show(); await submit();
  await screen.findByRole('button', { name: 'Retry same tip' }); first.unmount();
  read.mockRejectedValueOnce({ statusCode: 404 }); show();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry same tip' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(create.mock.calls[1]).toEqual(create.mock.calls[0]); expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  expect(screen.getByPlaceholderText('0.00')).toBeDisabled(); expect(onSuccess).not.toHaveBeenCalled();
});

test('recovery reads the saved original, and explicit check uses that ID without create mode', async () => {
  seed(); show(); fireEvent.click(await screen.findByRole('button', { name: 'Check tip status' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ requestId, mode: 'check', amount: 500 })));
  expect(read).toHaveBeenCalledWith(requestId); expect(getPreview).not.toHaveBeenCalled(); expect(crypto.randomUUID).not.toHaveBeenCalled();
});

test('only the verified final receipt clears recovery and publishes the original amount once', async () => {
  seed(); read.mockResolvedValue(done); show(); await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(500));
  expect(onSuccess).toHaveBeenCalledTimes(1); expect(mockSaved.size).toBe(0); expect(create).not.toHaveBeenCalled();
});

test.each([{ amountCents: 501 }, { amountChargedCents: 0 }, { requestId: otherId }, { paymentId: otherId }, { gigId: otherId },
  { payerId: worker }, { payeeId: actor }, { currency: 'eur' }, { paymentIntentId: 'pi_other' }, { chargeId: null }, { status: 'canceled' }])('mismatched receipt retains recovery: %j', async patch => {
  seed(); read.mockResolvedValue({ ...done, receipt: { ...done.receipt!, ...patch } as GigTipReceipt }); show();
  await screen.findByText(/receipt is inconsistent/); expect(onSuccess).not.toHaveBeenCalled(); expect(mockSaved.get(key)?.value).toEqual(original);
});

test.each([{ paymentStatus: 'authorize_pending' }, { receipt: null }, { canRetry: true }, { checkout: checkout.checkout }, { sessionScope: 'b'.repeat(64) }])('inconsistent success cannot replace current progress: %j', patch => {
  expect(() => verifyTipProgress({ ...done, ...patch }, gig, actor, requestId, session, original)).toThrow();
});

test('a refund or dispute receipt is retained in history without a new sent toast', async () => {
  seed(); read.mockResolvedValue({ ...done, paymentStatus: 'refunded_full' }); show();
  await screen.findByText(/current refund or dispute status/); expect(onSuccess).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(onClose).toHaveBeenCalledTimes(1);
});

test('cancel after a lost admission sends the original ID and only a zero-charge receipt closes it', async () => {
  create.mockRejectedValueOnce(new Error('Lost reply')); show(); await submit();
  create.mockResolvedValueOnce(canceled);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel tip' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'cancel', requestId, amount: 500 }));
  expect(mockSaved.size).toBe(0); expect(onSuccess).not.toHaveBeenCalled();
});

test('failed protected storage prevents provider submission', async () => {
  mockBeforeProtect = async () => { throw new Error('Storage unavailable'); }; show(); await submit();
  await screen.findByText('Storage unavailable'); expect(create).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(0);
});

test('session replacement during protected retention prevents saving and sending', async () => {
  const held = deferred<void>(); mockBeforeProtect = jest.fn(() => held.promise); show();
  await waitFor(() => expect(screen.getByRole('button', { name: '$5' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '$5' })); fireEvent.click(screen.getByRole('button', { name: 'Tip $5.00' }));
  await waitFor(() => expect(mockBeforeProtect).toHaveBeenCalled());
  act(() => { token = 'new-session'; listeners.forEach(fn => fn()); }); await act(async () => held.resolve());
  expect(create).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(0);
});

test.each(['cookie', 'token', 'origin', 'task', 'unmount'])('late receipt cannot complete or clear original after %s change', async change => {
  const held = deferred<GigTipProgress>(); create.mockReturnValueOnce(held.promise); const view = show(); await submit();
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  act(() => {
    if (change === 'cookie') localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'new-session');
    if (change === 'token') { token = 'new-session'; listeners.forEach(fn => fn()); }
    if (change === 'origin') origin = 'https://other.test';
  });
  if (change === 'task') view.rerender(<TipModal {...props} gigId={otherId} />);
  if (change === 'unmount') view.unmount();
  await act(async () => held.resolve(done));
  expect(onSuccess).not.toHaveBeenCalled(); expect(mockSaved.get(key)?.value).toEqual(original);
});

test('cookie replacement before its event prevents a first submission', async () => {
  show(); await waitFor(() => expect(screen.getByRole('button', { name: '$5' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '$5' })); localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'new-session');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tip $5.00' })); });
  expect(create).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(0);
});

test('a changed tab revision cannot be cleared by a delayed receipt', async () => {
  seed(); const held = deferred<GigTipProgress>(); read.mockReturnValueOnce(held.promise); show();
  await waitFor(() => expect(read).toHaveBeenCalled()); const newer = seed({ ...original, amountCents: 1000 });
  await act(async () => held.resolve(done));
  await screen.findByText(/Another tab changed/); expect(mockSaved.get(key)).toEqual(newer); expect(onSuccess).not.toHaveBeenCalled();
});

test('a competing clear transaction cannot delete the replacement original', async () => {
  seed(); read.mockResolvedValue(done); mockBeforeClear = () => { seed({ ...original, requestId: otherId, paymentId: otherId }); };
  show(); await screen.findByText('Protected original changed'); expect(mockSaved.get(key)?.value.requestId).toBe(otherId); expect(onSuccess).not.toHaveBeenCalled();
});

test('an active conflict requires explicit verified adoption, using the latest exact original revision', async () => {
  const other = { ...pending, request: { ...original, requestId: otherId, paymentId: otherId, amountCents: 1000 } };
  create.mockRejectedValueOnce({ statusCode: 409, data: { code: 'TIP_ACTIVE', activeRequestId: otherId } }); read.mockResolvedValue(other);
  show(); await submit(); const adopt = await screen.findByRole('button', { name: 'View pending tip' });
  expect(mockSaved.get(key)?.value).toEqual(original); fireEvent.click(adopt);
  await screen.findByRole('button', { name: 'Check tip status' }); expect(mockSaved.get(key)?.value).toEqual(other.request);
  expect(read.mock.calls).toEqual([[otherId], [otherId]]); expect(create).toHaveBeenCalledTimes(1);
});

test('recovery from a provider return is a local read and never trusts a URL success', async () => {
  render(<TipModal {...props} recoveryRequestId={requestId} />);
  await screen.findByRole('button', { name: 'Check tip status' });
  expect(read).toHaveBeenCalledWith(requestId); expect(getPreview).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(onSuccess).not.toHaveBeenCalled();
});

const legacyOriginal: GigTipRequest = { ...original, source: 'legacy', terms: { ...original.terms, ownerConfirmedAt: null } };
const legacyPending: GigTipProgress = { ...pending, request: legacyOriginal, status: 'needs_review' };
test('older tip preview recovers the existing protected identity and check-only command', async () => {
  getPreview.mockResolvedValue({ ...preview, eligible: false, unavailableReason: 'LEGACY_REVIEW', legacyPaymentId: requestId });
  read.mockResolvedValue(legacyPending); create.mockResolvedValue(legacyPending); show();
  const button = await screen.findByRole('button', { name: 'Check tip status' });
  await waitFor(() => expect(button).toBeEnabled()); expect(mockSaved.get(key)?.value).toEqual(legacyOriginal);
  expect(create).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: '$10' })).toBeDisabled();
  fireEvent.click(button);
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ requestId, mode: 'check', amount: 500,
    expectedTerms: { ...original.terms, ownerConfirmedAt: null } })));
  expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(screen.queryByText(/Existing card confirmation/)).not.toBeInTheDocument();
});
test('older canceled receipt clears only the existing protected original', async () => {
  seed(legacyOriginal); read.mockResolvedValue(legacyPending);
  create.mockResolvedValue({ ...canceled, request: legacyOriginal, paymentIntentId: 'pi_tip', providerStatus: 'canceled',
    receipt: { ...canceled.receipt!, paymentIntentId: 'pi_tip' } }); show();
  const button = await screen.findByRole('button', { name: 'Cancel tip' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ requestId, mode: 'cancel' }));
  expect(mockSaved.size).toBe(0); expect(onSuccess).not.toHaveBeenCalled();
});
test('older missing provider identity closes the picker while keeping recovery', async () => {
  seed(legacyOriginal); read.mockResolvedValue({ ...legacyPending, paymentIntentId: null, canCancel: false }); show();
  const button = await screen.findByRole('button', { name: 'Close' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  expect(onClose).toHaveBeenCalledTimes(1); expect(create).not.toHaveBeenCalled(); expect(mockSaved.get(key)?.value).toEqual(legacyOriginal);
});
test.each([{ canRetry: true }, { checkout: checkout.checkout }, { request: { ...legacyOriginal, source: undefined } },
  { request: { ...legacyOriginal, terms: original.terms } }, { request: { ...legacyOriginal, paymentMethodId: 'pm_tip' } }])(
  'older malformed or confirmable response cannot replace recovery: %j', patch => {
    expect(() => verifyTipProgress({ ...legacyPending, ...patch }, gig, actor, requestId, session, legacyOriginal)).toThrow();
  });
test('older original surviving a local404 never enables a new charge', async () => {
  seed(legacyOriginal); read.mockRejectedValueOnce({ statusCode: 404 }); show();
  const button = await screen.findByRole('button', { name: 'Check tip status' });
  await waitFor(() => expect(button).toBeEnabled()); create.mockResolvedValue(legacyPending); fireEvent.click(button);
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ requestId, mode: 'check' })));
  expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(mockSaved.get(key)?.value).toEqual(legacyOriginal);
});

test('SDK confirmation is checked both before and after, and success awaits a matching receipt', async () => {
  create.mockResolvedValue(checkout); show(); await submit(); const sheet = mockSheet;
  let allowed = false; await act(async () => { allowed = await sheet.beforeConfirm(); }); expect(allowed).toBe(true);
  expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ requestId, mode: 'check' }));
  create.mockResolvedValue(pending); await act(async () => { await sheet.onSuccess(); });
  expect(onSuccess).not.toHaveBeenCalled(); await screen.findByRole('button', { name: 'Check tip status' });
  create.mockResolvedValue(done); fireEvent.click(screen.getByRole('button', { name: 'Check tip status' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(500)); expect(mockSaved.size).toBe(0);
});

test('SDK cannot confirm after checkout identity changes or session replacement', async () => {
  create.mockResolvedValue(checkout); show(); await submit(); const sheet = mockSheet;
  create.mockResolvedValue({ ...checkout, checkout: { ...checkout.checkout!, customer: 'cus_other' } });
  let allowed = true; await act(async () => { allowed = await sheet.beforeConfirm(); }); expect(allowed).toBe(false);
  expect(screen.queryByText(/Existing card confirmation/)).not.toBeInTheDocument();
  act(() => { token = 'other'; listeners.forEach(fn => fn()); }); await act(async () => { await sheet.onSuccess(); });
  expect(onSuccess).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(1); expect(create).toHaveBeenCalledTimes(2);
});

test('dismissing card entry keeps the original and performs no implicit cancellation', async () => {
  create.mockResolvedValue(checkout); show(); await submit(); act(() => mockSheet.onClose());
  await screen.findByRole('button', { name: 'Check tip status' }); expect(mockSaved.get(key)?.value).toEqual(original); expect(create).toHaveBeenCalledTimes(1);
});

test('strict effect remount recovers once without deleting an original from retired initialization', async () => {
  seed(); read.mockResolvedValue(done); render(<React.StrictMode><TipModal {...props} /></React.StrictMode>);
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1)); expect(mockSaved.size).toBe(0); expect(create).not.toHaveBeenCalled();
});


describe('existing completion page tip recovery entry', () => {
  const completionProps = { gigId: gig, gig: { accepted_by: worker, owner_confirmed_at: preview.terms.ownerConfirmedAt },
    isOwner: true, isWorker: false, currentUserId: actor, gigStatus: 'completed', paymentLifecycleStatus: 'captured_hold', onOpenChat: jest.fn() };
  const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {} });
    window.history.replaceState({}, '', `/app/gigs/${gig}`);
  });
  afterEach(() => {
    if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
    window.history.replaceState({}, '', '/');
  });
  test('reopens a retained original on the actual completion component', async () => {
    seed(); render(<CompletionFlow {...completionProps} />);
    await screen.findByRole('button', { name: 'Check tip status' });
    expect(read).toHaveBeenCalledWith(requestId); expect(create).not.toHaveBeenCalled();
  });
  test('provider return strips transient provider query values and uses only the original request identity', async () => {
    window.history.replaceState({}, '', `/app/gigs/${gig}?tip_request=${requestId}&payment_intent_client_secret=synthetic&payment_intent=pi_tip&redirect_status=succeeded`);
    render(<CompletionFlow {...completionProps} />);
    await screen.findByRole('button', { name: 'Check tip status' });
    expect(router.replace).toHaveBeenCalledWith(`/app/gigs/${gig}?tip_request=${requestId}`);
    expect(read).toHaveBeenCalledWith(requestId); expect(create).not.toHaveBeenCalled(); expect(onSuccess).not.toHaveBeenCalled();
  });
  test.each(['cookie', 'token', 'actor'])('a delayed saved-original lookup cannot open after %s replacement', async change => {
    seed(); const held = deferred<void>(); mockBeforeLoad = jest.fn(() => held.promise);
    const view = render(<CompletionFlow {...completionProps} />);
    await waitFor(() => expect(mockBeforeLoad).toHaveBeenCalled());
    act(() => {
      if (change === 'cookie') localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'new');
      if (change === 'token') listeners.forEach(fn => fn());
    });
    if (change === 'actor') view.rerender(<CompletionFlow {...completionProps} currentUserId={otherId} />);
    await act(async () => held.resolve());
    expect(screen.queryByText(/Leave a tip/)).not.toBeInTheDocument(); expect(read).not.toHaveBeenCalled();
  });
});
