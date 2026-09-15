import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { AUTH_SESSION_CHANGE_KEY, payments, gigs, upload } from '@pantopus/api';
import type { GigTipPreview, GigTipRequest, GigTipProgress, GigTipReceipt } from '@pantopus/api';
import { toast } from '../src/components/ui/toast-store';
import TipModal, { verifyTipProgress } from '../src/components/payments/TipModal';
import CompletionFlow, { type CompletionFlowHandle } from '../src/components/gig-detail/CompletionFlow';
const router = { push: jest.fn(), replace: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('next/image', () => () => null);
jest.mock('../src/components/FileUpload', () => ({ __esModule: true, CompletionProofImage: () => null, default: function MockFileUpload({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  return <button onClick={() => onFilesSelected([new File(['proof'], 'work.jpg', { type: 'image/jpeg' })])}>Pick synthetic proof</button>;
} }));
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
  gigs: { markGigCompleted: jest.fn(), confirmGigCompletion: jest.fn(), checkNoShow: jest.fn() },
  upload: { uploadGigCompletionMedia: jest.fn() },
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

describe('existing completion submission retries', () => {
  const submitted = jest.fn();
  const uploadProof = jest.mocked(upload.uploadGigCompletionMedia), mark = jest.mocked(gigs.markGigCompleted);
  function openProof(pick = true) {
    const ref = React.createRef<CompletionFlowHandle>();
    const result = render(<CompletionFlow ref={ref} gigId={gig} gig={{ accepted_by: worker, price: 0 }}
      isOwner={false} isWorker currentUserId={worker} gigStatus="in_progress" paymentLifecycleStatus="none"
      onStatusChange={submitted} onOpenChat={jest.fn()} />);
    act(() => ref.current!.markCompleted());
    if (pick) fireEvent.click(screen.getByRole('button', { name: 'Pick synthetic proof' }));
    return { ...result, ref };
  }
  const clickSubmit = async () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mark Complete' })); });
  beforeEach(() => {
    uploadProof.mockResolvedValue({ media: [{ file_url: 'https://proof.test/original.jpg' }] } as Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>);
    mark.mockResolvedValue({ gig: { id: gig, status: 'completed' } } as Awaited<ReturnType<typeof gigs.markGigCompleted>>);
  });
  test('a lost completion reply retries the same uploaded references', async () => {
    mark.mockRejectedValueOnce(new Error('Lost completion reply')); openProof();
    await clickSubmit(); await waitFor(() => expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeEnabled());
    await clickSubmit(); await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1));
    expect(uploadProof).toHaveBeenCalledTimes(1); expect(mark).toHaveBeenCalledTimes(2);
    expect(mark.mock.calls[1]).toEqual(mark.mock.calls[0]);
  });
  test('an upload returned after account change cannot submit completion', async () => {
    const held = deferred<Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>>();
    uploadProof.mockReturnValue(held.promise); openProof(); await clickSubmit();
    act(() => { token = 'other-session'; listeners.forEach(fn => fn()); });
    await act(async () => held.resolve({ media: [{ file_url: 'https://proof.test/original.jpg' }] } as Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>));
    expect(mark).not.toHaveBeenCalled(); expect(submitted).not.toHaveBeenCalled();
  });
  test.each(['marker', 'origin', 'unmount', 'cancel'])('late upload cannot submit after %s', async change => {
    const held = deferred<Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>>();
    uploadProof.mockReturnValue(held.promise); const page = openProof(); await clickSubmit();
    act(() => {
      if (change === 'marker') localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'replacement');
      if (change === 'origin') origin = 'https://other.test';
      if (change === 'unmount') page.unmount();
      if (change === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    await act(async () => held.resolve({ media: [{ file_url: 'https://proof.test/original.jpg' }] } as Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>));
    expect(mark).not.toHaveBeenCalled(); expect(submitted).not.toHaveBeenCalled();
  });
  test('late completion success cannot update a replacement account', async () => {
    const held = deferred<Awaited<ReturnType<typeof gigs.markGigCompleted>>>(); mark.mockReturnValue(held.promise);
    openProof(); await clickSubmit(); await waitFor(() => expect(mark).toHaveBeenCalledTimes(1));
    act(() => { token = 'replacement'; listeners.forEach(fn => fn()); });
    await act(async () => held.resolve({ gig: { id: gig, status: 'completed' } } as Awaited<ReturnType<typeof gigs.markGigCompleted>>));
    expect(submitted).not.toHaveBeenCalled(); expect(screen.queryByText('Submit Completion')).not.toBeInTheDocument();
  });
  test('canceling an old upload cannot clear a newer submission guard', async () => {
    const old = deferred<Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>>();
    const next = deferred<Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>>();
    uploadProof.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const page = openProof(); await clickSubmit();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    act(() => page.ref.current!.markCompleted()); fireEvent.click(screen.getByRole('button', { name: 'Pick synthetic proof' }));
    await clickSubmit();
    await act(async () => old.resolve({ media: [{ file_url: 'https://proof.test/old.jpg' }] } as Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>));
    expect(mark).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await act(async () => next.resolve({ media: [{ file_url: 'https://proof.test/new.jpg' }] } as Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>));
    expect(mark).toHaveBeenCalledTimes(1); expect(mark.mock.calls[0][1]?.photos).toEqual(['https://proof.test/new.jpg']);
  });
  test('missing upload receipts cannot silently complete without the selected proof', async () => {
    uploadProof.mockResolvedValueOnce({ message: 'Synthetic incomplete upload', media: [] });
    openProof(); await clickSubmit(); expect(mark).not.toHaveBeenCalled();
    await clickSubmit(); expect(uploadProof).toHaveBeenCalledTimes(2); expect(mark).toHaveBeenCalledTimes(1);
  });
  test('duplicate clicks admit only one upload and completion request', async () => {
    const held = deferred<Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>>(); uploadProof.mockReturnValue(held.promise);
    openProof(); const button = screen.getByRole('button', { name: 'Mark Complete' });
    act(() => { fireEvent.click(button); fireEvent.click(button); }); expect(uploadProof).toHaveBeenCalledTimes(1);
    await act(async () => held.resolve({ media: [{ file_url: 'https://proof.test/original.jpg' }] } as Awaited<ReturnType<typeof upload.uploadGigCompletionMedia>>));
    expect(mark).toHaveBeenCalledTimes(1);
  });
  test('the existing optional no-file submission still works', async () => {
    openProof(false); await clickSubmit(); expect(uploadProof).not.toHaveBeenCalled();
    expect(mark).toHaveBeenCalledWith(gig, { note: undefined, photos: undefined }); expect(submitted).toHaveBeenCalledTimes(1);
  });
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
  test('fresh completed-task entry discovers an older tip after current worker and confirmation disappear', async () => {
    getPreview.mockResolvedValue({ ...preview, eligible: false, unavailableReason: 'LEGACY_REVIEW', legacyPaymentId: requestId,
      terms: { ...preview.terms, payeeId: null, ownerConfirmedAt: null } });
    read.mockResolvedValue(legacyPending);
    render(<CompletionFlow {...completionProps} gig={{ accepted_by: null, owner_confirmed_at: null }} />);
    const button = await screen.findByRole('button', { name: 'Check tip status' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(mockSaved.get(key)?.value).toEqual(legacyOriginal); expect(create).not.toHaveBeenCalled();
    expect(crypto.randomUUID).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: '$10' })).toBeDisabled();
  });
  test('fresh entry with no pending payment does not open a new tip automatically', async () => {
    render(<CompletionFlow {...completionProps} />);
    await waitFor(() => expect(getPreview).toHaveBeenCalledTimes(1));
    expect(read).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(0);
    expect(screen.queryByText(/Leave a tip/)).not.toBeInTheDocument();
  });
  test.each(['cookie', 'origin'])('late cold-tip discovery cannot open after %s changes', async change => {
    const held = deferred<GigTipPreview>(); getPreview.mockReturnValue(held.promise);
    render(<CompletionFlow {...completionProps} />);
    await waitFor(() => expect(getPreview).toHaveBeenCalledTimes(1));
    act(() => { if (change === 'cookie') localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'changed'); else origin = 'https://other.test'; });
    await act(async () => held.resolve({ ...preview, eligible: false, unavailableReason: 'LEGACY_REVIEW', legacyPaymentId: requestId }));
    expect(read).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(mockSaved.size).toBe(0);
    expect(screen.queryByText(/Leave a tip/)).not.toBeInTheDocument();
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


describe('existing owner confirmation request lifetime', () => {
  const ownerProps = { gigId: gig, gig: { user_id: actor, accepted_by: worker, price: 12.5, completion_review: 'a'.repeat(64) },
    isOwner: true, isWorker: false, currentUserId: actor, gigStatus: 'completed', paymentLifecycleStatus: 'authorized', onOpenChat: jest.fn() };
  test.each(['token event', 'silent token', 'session marker', 'origin', 'owner role', 'dismissal', 'unmount'])('late owner success is retired after %s', async change => {
    const held = deferred<Awaited<ReturnType<typeof gigs.confirmGigCompletion>>>();
    jest.mocked(gigs.confirmGigCompletion).mockReturnValue(held.promise);
    const changed = jest.fn(), ref = React.createRef<CompletionFlowHandle>();
    const page = render(<CompletionFlow {...ownerProps} ref={ref} onStatusChange={changed} />);
    act(() => ref.current!.confirmCompletion());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Approve' }));
    await waitFor(() => expect(gigs.confirmGigCompletion).toHaveBeenCalledTimes(1));
    if (change === 'token event') act(() => { token = 'replacement'; listeners.forEach(fn => fn()); });
    if (change === 'silent token') token = 'replacement';
    if (change === 'session marker') localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'replacement');
    if (change === 'origin') origin = 'https://replacement.test';
    if (change === 'owner role') page.rerender(<CompletionFlow {...ownerProps} ref={ref} isOwner={false} onStatusChange={changed} />);
    if (change === 'dismissal') fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));
    if (change === 'unmount') page.unmount();
    await act(async () => held.resolve({ gig: { id: gig, owner_confirmed_at: preview.terms.ownerConfirmedAt } } as unknown as Awaited<ReturnType<typeof gigs.confirmGigCompletion>>));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '$5' })).not.toBeInTheDocument();
  });
  test('an open review retains its original version through a newer page projection and retry', async () => {
    const ref = React.createRef<CompletionFlowHandle>();
    jest.mocked(gigs.confirmGigCompletion).mockRejectedValue({ message: 'Reopen and review the current work', statusCode: 409 });
    const page = render(<CompletionFlow {...ownerProps} ref={ref} />);
    act(() => ref.current!.confirmCompletion());
    page.rerender(<CompletionFlow {...ownerProps} gig={{ ...ownerProps.gig, completion_review: 'b'.repeat(64), price: 20 }} ref={ref} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Approve' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm & Approve' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Approve' }));
    await waitFor(() => expect(gigs.confirmGigCompletion).toHaveBeenCalledTimes(2));
    expect(toast.error).toHaveBeenCalledWith('Reopen and review the current work');
    for (const call of jest.mocked(gigs.confirmGigCompletion).mock.calls) expect(call[1]?.expectedReview).toBe('a'.repeat(64));
    expect(screen.queryByRole('button', { name: '$5' })).not.toBeInTheDocument();
  });
  test('a retired owner failure cannot alert the replacement account', async () => {
    let reject!: (error: Error) => void;
    jest.mocked(gigs.confirmGigCompletion).mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const ref = React.createRef<CompletionFlowHandle>();
    render(<CompletionFlow {...ownerProps} ref={ref} />);
    act(() => ref.current!.confirmCompletion()); fireEvent.click(screen.getByRole('button', { name: 'Confirm & Approve' }));
    act(() => { token = 'replacement'; listeners.forEach(fn => fn()); });
    await act(async () => reject(new Error('Old request failed')));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText('Review Work')).not.toBeInTheDocument();
  });
  test('silent session replacement before approval sends no confirmation', () => {
    const ref = React.createRef<CompletionFlowHandle>(); render(<CompletionFlow {...ownerProps} ref={ref} />);
    act(() => ref.current!.confirmCompletion()); localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'replacement');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Approve' }));
    expect(gigs.confirmGigCompletion).not.toHaveBeenCalled();
  });
  test('current owner success preserves the existing completion and tip flow', async () => {
    jest.mocked(gigs.confirmGigCompletion).mockResolvedValue({ gig: { id: gig, owner_confirmed_at: preview.terms.ownerConfirmedAt } } as unknown as Awaited<ReturnType<typeof gigs.confirmGigCompletion>>);
    const changed = jest.fn(), ref = React.createRef<CompletionFlowHandle>(); render(<CompletionFlow {...ownerProps} ref={ref} onStatusChange={changed} />);
    act(() => ref.current!.confirmCompletion()); fireEvent.click(screen.getByRole('button', { name: 'Confirm & Approve' }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: '$5' })).toBeInTheDocument();
  });

});
