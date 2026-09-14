import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AUTH_SESSION_CHANGE_KEY, payments } from '@pantopus/api';
import TipModal from '../src/components/payments/TipModal';

let token: string | null = '__session__';
const listeners = new Set<() => void>();
jest.mock('@pantopus/api', () => ({
  payments: { createTip: jest.fn(), refreshTipPaymentStatus: jest.fn() },
  getAuthToken: () => token, getApiBaseUrl: () => 'https://app.test', AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
}));
const create = jest.mocked(payments.createTip);
const refresh = jest.mocked(payments.refreshTipPaymentStatus);
const onSuccess = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  token = '__session__'; localStorage.clear();
  create.mockResolvedValue({ success: true, paymentId: 'tip-payment', clientSecret: 'synthetic-secret' });
  refresh.mockResolvedValue({ paymentStatus: 'authorize_pending', previousPaymentStatus: 'authorize_pending', changed: false, stripeStatus: 'requires_payment_method' });
});
function show() {
  const view = render(<TipModal gigId="gig-a" workerName="Worker" onSuccess={onSuccess} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '$5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tip $5.00' }));
  return view;
}

test('a created PaymentIntent and client secret are not a paid tip', async () => {
  show();
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(onSuccess).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledWith('tip-payment');
  expect(screen.getByText(/not been confirmed as paid/)).toBeInTheDocument();
});

test('checking an unconfirmed tip reads the same payment without creating another', async () => {
  show();
  const check = await screen.findByRole('button', { name: 'Check tip status' });
  refresh.mockResolvedValue({ paymentStatus: 'captured_hold', previousPaymentStatus: 'authorize_pending', changed: true, stripeStatus: 'succeeded' });
  fireEvent.click(check);
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(500));
  expect(create).toHaveBeenCalledTimes(1);
  expect(refresh.mock.calls).toEqual([['tip-payment'], ['tip-payment']]);
});

test('a provider success without a confirmed local paid state cannot report success', async () => {
  refresh.mockResolvedValue({ paymentStatus: 'authorize_pending', previousPaymentStatus: 'authorize_pending', changed: false, stripeStatus: 'succeeded' });
  show();
  await act(async () => {});
  expect(onSuccess).not.toHaveBeenCalled();
});

test('a lost status response retains the payment and selected amount for checking', async () => {
  refresh.mockRejectedValueOnce(new Error('Response interrupted'));
  show();
  const check = await screen.findByRole('button', { name: 'Check tip status' });
  expect(screen.getByRole('button', { name: '$10' })).toBeDisabled();
  expect(screen.getByPlaceholderText('0.00')).toBeDisabled();
  fireEvent.click(check);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  expect(create).toHaveBeenCalledTimes(1);
  expect(onSuccess).not.toHaveBeenCalled();
});

test('a lost creation reply blocks another creation in this modal', async () => {
  create.mockRejectedValueOnce(new Error('Response interrupted'));
  show();
  await screen.findByText(/result is not confirmed/);
  expect(screen.getByRole('button', { name: 'Tip $5.00' })).toBeDisabled();
  expect(create).toHaveBeenCalledTimes(1);
  expect(onSuccess).not.toHaveBeenCalled();
});

test('a late paid status after closing the modal cannot report success', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof payments.refreshTipPaymentStatus>>) => void;
  refresh.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = show();
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  view.unmount();
  await act(async () => resolve({ paymentStatus: 'captured_hold', previousPaymentStatus: 'authorize_pending', changed: true, stripeStatus: 'succeeded' }));
  expect(onSuccess).not.toHaveBeenCalled();
});

test('changing the task while confirmation is pending cannot apply the old tip to the new task', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof payments.refreshTipPaymentStatus>>) => void;
  refresh.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = show();
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  view.rerender(<TipModal gigId="gig-b" workerName="Different worker" onSuccess={onSuccess} onClose={jest.fn()} />);
  await act(async () => resolve({ paymentStatus: 'captured_hold', previousPaymentStatus: 'authorize_pending', changed: true, stripeStatus: 'succeeded' }));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Check tip status' })).toBeDisabled();
});

test('a cookie session change before its storage event prevents a new payment', async () => {
  render(<TipModal gigId="gig-a" workerName="Worker" onSuccess={onSuccess} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '$5' }));
  localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'replacement-session');
  fireEvent.click(screen.getByRole('button', { name: 'Tip $5.00' }));
  await act(async () => {});
  expect(create).not.toHaveBeenCalled();
});

test('a replaced session cannot display an old paid response or continue checking it', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof payments.refreshTipPaymentStatus>>) => void;
  refresh.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  show();
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  act(() => { token = 'replacement'; listeners.forEach(fn => fn()); });
  await act(async () => resolve({ paymentStatus: 'captured_hold', previousPaymentStatus: 'authorize_pending', changed: true, stripeStatus: 'succeeded' }));
  expect(onSuccess).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Check tip status' })).toBeDisabled();
});
