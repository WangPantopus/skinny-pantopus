import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import * as api from '@pantopus/api';
import AssignedGigAuthorization from '../src/components/payments/AssignedGigAuthorization';
import CompletionFlow, { type CompletionFlowHandle } from '../src/components/gig-detail/CompletionFlow';

const listeners = new Set<() => void>();
const confirmPayment = jest.fn();
const stripe = { confirmPayment, confirmSetup: jest.fn() };
const elements = {};
const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => stripe, useElements: () => elements,
  PaymentElement: () => <div data-testid="provider-card-form">Provider card form</div>,
}));
jest.mock('../src/components/payments/StripeProvider', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => '__session__', getApiBaseUrl: () => 'https://app.test', AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  payments: { getPaymentForGig: jest.fn(), refreshPaymentStatus: jest.fn(), continueAuthorization: jest.fn() },
  gigs: { checkNoShow: jest.fn().mockResolvedValue(null) },
}));

const actor = '11111111-1111-4111-8111-111111111111';
const payer = '22222222-2222-4222-8222-222222222222';
const worker = '33333333-3333-4333-8333-333333333333';
const gig = '44444444-4444-4444-8444-444444444444';
const paymentId = '55555555-5555-4555-8555-555555555555';
const attemptId = '66666666-6666-4666-8666-666666666666';
const sessionScope = 'a'.repeat(64);
const terms = { expectedActorId: actor, expectedSessionScope: sessionScope,
  expectedPaymentId: paymentId, expectedPayerId: payer, expectedPayeeId: worker, expectedAmountCents: 1234, currency: 'usd' };
const payment = { id: paymentId, payer_id: payer, payee_id: worker, gig_id: gig, amount_total: 1234, currency: 'USD' };
const action = { actorId: actor, sessionScope, payerId: payer, payeeId: worker, gigId: gig, paymentId,
  authorizationAttemptId: attemptId, paymentIntentId: 'pi_original', amountCents: 1234, currency: 'usd',
  paymentStatus: 'authorize_pending', providerStatus: 'requires_action', authorizationReady: false,
  alreadyAuthorized: false, cancellationPending: false, authorizationAvailableAt: null,
  recoveryState: 'action_required', canRetry: true, clientSecret: 'pi_original_secret_ephemeral' };
const ready = { ...action, paymentStatus: 'authorized', providerStatus: 'requires_capture',
  authorizationReady: true, alreadyAuthorized: true, recoveryState: 'ready', canRetry: false, clientSecret: undefined };
const response = (value: unknown) => value as Awaited<ReturnType<typeof api.payments.refreshPaymentStatus>>;
const onAuthorized = jest.fn();
function show() { return render(<AssignedGigAuthorization gigId={gig} actorId={actor} payeeId={worker} onAuthorized={onAuthorized} />); }
async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Continue authorization' }));
  await screen.findByTestId('provider-card-form');
}
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear(); window.localStorage.clear();
  jest.mocked(api.payments.getPaymentForGig).mockResolvedValue({ payment, stateInfo: null } as Awaited<ReturnType<typeof api.payments.getPaymentForGig>>);
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response(action));
  jest.mocked(api.payments.continueAuthorization).mockResolvedValue(response(action));
  confirmPayment.mockResolvedValue({});
});

test('cold load only checks status; explicit continue opens the actual form with exact delegated payer terms', async () => {
  show(); await screen.findByRole('button', { name: 'Continue authorization' });
  expect(api.payments.continueAuthorization).not.toHaveBeenCalled(); expect(confirmPayment).not.toHaveBeenCalled();
  expect(screen.getByText('Task amount: $12.34 USD.')).toBeInTheDocument();
  await openForm();
  expect(api.payments.continueAuthorization).toHaveBeenCalledWith(gig, terms);
  expect(screen.getByRole('button', { name: 'Authorize $12.34' })).toBeInTheDocument();
  expect(window.localStorage.length).toBe(0);
});
test('provider completion reports success only after exact server authorization', async () => {
  show(); await openForm();
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValueOnce(response(action)).mockResolvedValue(response(ready));
  fireEvent.click(screen.getByRole('button', { name: 'Authorize $12.34' }));
  await waitFor(() => expect(onAuthorized).toHaveBeenCalledTimes(1));
  expect(confirmPayment).toHaveBeenCalledTimes(1);
  expect(api.payments.refreshPaymentStatus).toHaveBeenCalledTimes(3);
  expect(screen.queryByTestId('provider-card-form')).not.toBeInTheDocument();
});
test('a pending provider receipt stays pending after SDK completion', async () => {
  show(); await openForm();
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValueOnce(response(action)).mockResolvedValue(response({ ...action,
    clientSecret: undefined, providerStatus: 'processing', recoveryState: 'pending', canRetry: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Authorize $12.34' }));
  await screen.findByText('Authorization is pending. Check its status before continuing.');
  expect(onAuthorized).not.toHaveBeenCalled(); expect(screen.queryByTestId('provider-card-form')).not.toBeInTheDocument();
});
test('scheduled authorization shows its opening time without presenting a new hold', async () => {
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response({ ...action,
    clientSecret: undefined, providerStatus: null, paymentIntentId: null, paymentStatus: 'ready_to_authorize',
    recoveryState: 'pending', canRetry: false, authorizationAvailableAt: '2026-09-15T12:00:00.000Z' }));
  show(); await screen.findByText(/No new hold will be created before then/);
  expect(screen.queryByRole('button', { name: 'Continue authorization' })).not.toBeInTheDocument();
  expect(confirmPayment).not.toHaveBeenCalled(); expect(onAuthorized).not.toHaveBeenCalled();
});
test('an admitted cancellation cannot expose a reusable SDK secret or success', async () => {
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response({ ...action,
    clientSecret: undefined, providerStatus: 'requires_capture', paymentStatus: 'authorization_failed',
    recoveryState: 'pending', canRetry: false, cancellationPending: true }));
  show(); await screen.findByText('The authorization is being canceled. Check its status before continuing.');
  expect(screen.queryByRole('button', { name: 'Continue authorization' })).not.toBeInTheDocument();
  expect(onAuthorized).not.toHaveBeenCalled();
});
test.each([
  { amountCents: 1235 }, { paymentId: worker }, { actorId: payer }, { payerId: actor },
  { payeeId: actor }, { authorizationReady: true }, { clientSecret: 'pi_other_secret_bad' },
  { cancellationPending: true }, { authorizationAvailableAt: 'not-a-date' },
  { sessionScope: undefined },
])('mismatched recovery receipt cannot open SDK or report success: %j', async (change) => {
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response({ ...action, ...change }));
  show(); await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Continue authorization' })).not.toBeInTheDocument();
  expect(onAuthorized).not.toHaveBeenCalled(); expect(confirmPayment).not.toHaveBeenCalled();
});
test('a lost resume response can be checked without starting another authorization', async () => {
  show(); jest.mocked(api.payments.continueAuthorization).mockRejectedValueOnce(new Error('Connection interrupted'));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue authorization' }));
  await screen.findByRole('alert');
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response(ready));
  fireEvent.click(screen.getByRole('button', { name: 'Check payment status' }));
  await waitFor(() => expect(onAuthorized).toHaveBeenCalledTimes(1));
  expect(api.payments.continueAuthorization).toHaveBeenCalledTimes(1); expect(confirmPayment).not.toHaveBeenCalled();
});
test('a same-actor replacement session cannot silently replace the opening server proof before its storage event', async () => {
  show(); await screen.findByRole('button', { name: 'Continue authorization' });
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response({ ...ready, sessionScope: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: 'Check payment status' }));
  await screen.findByRole('alert'); expect(onAuthorized).not.toHaveBeenCalled();
  jest.mocked(api.payments.continueAuthorization).mockRejectedValue(new Error('Your signed-in session changed. Reopen this screen.'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue authorization' }));
  await screen.findByText('Your signed-in session changed. Reopen this screen.');
  expect(api.payments.continueAuthorization).toHaveBeenCalledWith(gig, terms);
  expect(confirmPayment).not.toHaveBeenCalled();
});
test('session change during SDK confirmation fences late callbacks and closes the form', async () => {
  let complete!: (value: unknown) => void;
  confirmPayment.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  show(); await openForm(); fireEvent.click(screen.getByRole('button', { name: 'Authorize $12.34' }));
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  act(() => [...listeners].forEach((fn) => fn()));
  await act(async () => { complete({}); });
  expect(screen.queryByTestId('provider-card-form')).not.toBeInTheDocument();
  expect(onAuthorized).not.toHaveBeenCalled(); expect(api.payments.refreshPaymentStatus).toHaveBeenCalledTimes(2);
});
test('repeated form submissions share one SDK operation', async () => {
  let complete!: (value: unknown) => void;
  confirmPayment.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  show(); await openForm(); const form = screen.getByRole('button', { name: 'Authorize $12.34' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(1));
  await act(async () => { complete({ error: { message: 'Bank declined' } }); });
  expect(onAuthorized).not.toHaveBeenCalled();
});
test('a changed provider operation after the SDK cannot report completion for the old one', async () => {
  show(); await openForm();
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValueOnce(response(action)).mockResolvedValue(response({ ...ready, paymentIntentId: 'pi_replacement' }));
  fireEvent.click(screen.getByRole('button', { name: 'Authorize $12.34' }));
  await screen.findByText(/payment operation changed/); expect(onAuthorized).not.toHaveBeenCalled();
});
test.each([
  { sessionScope: 'b'.repeat(64) }, { actorId: payer },
  { paymentIntentId: 'pi_replaced', clientSecret: 'pi_replaced_secret_temporary' },
])('the open form checks the actual session and operation before SDK confirmation: %j', async (change) => {
  show(); await openForm();
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response({ ...action, ...change }));
  fireEvent.click(screen.getByRole('button', { name: 'Authorize $12.34' }));
  await screen.findByRole('alert'); expect(confirmPayment).not.toHaveBeenCalled(); expect(onAuthorized).not.toHaveBeenCalled();
});
test('an authorization completed elsewhere while the form was open is checked without confirming twice', async () => {
  show(); await openForm();
  jest.mocked(api.payments.refreshPaymentStatus).mockResolvedValue(response(ready));
  fireEvent.click(screen.getByRole('button', { name: 'Authorize $12.34' }));
  await waitFor(() => expect(onAuthorized).toHaveBeenCalledTimes(1));
  expect(confirmPayment).not.toHaveBeenCalled(); expect(screen.queryByTestId('provider-card-form')).not.toBeInTheDocument();
});
test('closing the payment form does not cancel the gig or claim authorization', async () => {
  show(); await openForm(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByTestId('provider-card-form')).not.toBeInTheDocument();
  expect(onAuthorized).not.toHaveBeenCalled(); expect(confirmPayment).not.toHaveBeenCalled();
});
test.each(['authorize_pending', 'canceled'])('the assigned completion panel exposes %s recovery and retains its parent action callbacks', async (paymentStatus) => {
  const ref = createRef<CompletionFlowHandle>();
  render(<CompletionFlow ref={ref} gigId={gig} gig={{ price: 12.34, accepted_by: worker, payment_status: paymentStatus }}
    isOwner isWorker={false} currentUserId={actor} gigStatus="assigned" paymentLifecycleStatus={paymentStatus}
    onOpenChat={() => {}} />);
  await screen.findByRole('button', { name: 'Continue authorization' });
  expect(ref.current?.openCancelModal).toEqual(expect.any(Function));
  expect(ref.current?.startWork).toEqual(expect.any(Function));
  expect(ref.current?.markCompleted).toEqual(expect.any(Function));
  expect(ref.current?.confirmCompletion).toEqual(expect.any(Function));
});
test('a cancelled task does not offer an authorization restart', () => {
  render(<CompletionFlow gigId={gig} gig={{ price: 12.34, accepted_by: worker, payment_status: 'canceled' }}
    isOwner isWorker={false} currentUserId={actor} gigStatus="cancelled" paymentLifecycleStatus="canceled" onOpenChat={() => {}} />);
  expect(screen.queryByRole('region', { name: 'Assigned payment authorization' })).not.toBeInTheDocument();
  expect(api.payments.refreshPaymentStatus).not.toHaveBeenCalled();
});
