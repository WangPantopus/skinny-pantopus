import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import type { Payment } from '@pantopus/types';
import GigPaymentRefundPanel from '@/components/payments/GigPaymentRefundPanel';
import { recoveryKey, type RefundRequest, type RefundHistory } from '@/components/payments/refundRecovery';

jest.mock('@pantopus/api', () => ({
  payments: { getPaymentRefunds: jest.fn(), refundPayment: jest.fn() },
  getApiBaseUrl: jest.fn(), onTokenChange: jest.fn(), AUTH_SESSION_CHANGE_KEY: 'pantopus_auth_session_change',
}));
const getHistory = jest.mocked(api.payments.getPaymentRefunds);
const refund = jest.mocked(api.payments.refundPayment);
const requestId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const payment: Payment = {
  id: 'payment-one', payer_id: 'payer', payee_id: 'worker', gig_id: 'gig-one',
  amount_total: 3100, amount_subtotal: 3100, amount_platform_fee: 310, amount_to_payee: 2790,
  refunded_amount: 0, currency: 'usd', payment_type: 'gig_payment', payment_status: 'captured_hold',
  captured_at: '2026-09-09T12:00:00Z', created_at: '', updated_at: '',
};
const request = (changes: Partial<RefundRequest> = {}): RefundRequest => ({
  requestId, paymentId: payment.id, operation: 'refund', amountCents: 3100, currency: 'usd',
  status: 'pending', providerRefundId: null, canRetry: true, reversalStatus: null,
  requestedAmountCents: null, reason: 'requested_by_customer', description: null, ...changes,
});
const history = (requests: RefundRequest[] = [], changes: Partial<Payment> = {}): RefundHistory => ({
  requests, refunds: [], payment: { ...payment, ...changes },
});
const result = (r = request()) => ({ success: r.status === 'succeeded', refundRequest: r, refund: null, payment });

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  jest.mocked(api.getApiBaseUrl).mockReturnValue('https://api.test');
  jest.mocked(api.onTokenChange).mockReturnValue(() => {});
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: jest.fn(() => requestId) });
  getHistory.mockResolvedValue(history());
  refund.mockResolvedValue(result());
});

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Request a refund' }));
}
async function confirm() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm refund request' })); });
}

test('history is read without mutation, then an explicit confirmation sends the remaining-amount request', async () => {
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  expect(refund).not.toHaveBeenCalled();
  await confirm();
  expect(refund).toHaveBeenCalledWith(payment.id, 'requested_by_customer', undefined, { requestId });
  expect(screen.getByText('$31.00 refund is pending.')).toBeInTheDocument();
  expect(screen.queryByText(/refund completed/)).not.toBeInTheDocument();
});

test('two fast confirmations issue one provider-facing request', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void;
  refund.mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  const button = screen.getByRole('button', { name: 'Confirm refund request' });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(refund).toHaveBeenCalledTimes(1);
  await act(async () => resolve(result()));
});

test('a partial refund uses integer cents and confirms the exact original terms', async () => {
  refund.mockResolvedValue(result(request({ requestedAmountCents: 1250, amountCents: 1250 })));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '12.50' } });
  await confirm();
  expect(refund).toHaveBeenCalledWith(payment.id, 'requested_by_customer', 1250, { requestId });
  expect(screen.getByText('$12.50 refund is pending.')).toBeInTheDocument();
});

test.each(['-1', '0.49', '31.01', '1.234', '1e2'])('invalid refund amount %s never posts', async (amount) => {
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: amount } });
  await confirm();
  expect(refund).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('lost response survives restart and an empty history read never creates a new request identity', async () => {
  refund.mockRejectedValueOnce(new Error('Connection lost'));
  const mounted = render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '12.50' } });
  await confirm();
  expect(screen.getByRole('alert')).toHaveTextContent('not confirmed');
  mounted.unmount();
  refund.mockResolvedValue(result(request({ requestedAmountCents: 1250, amountCents: 1250 })));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry this request' }));
  await waitFor(() => expect(refund).toHaveBeenCalledTimes(2));
  expect(refund.mock.calls[1]).toEqual(refund.mock.calls[0]);
  expect(screen.queryByRole('button', { name: 'Request a refund' })).not.toBeInTheDocument();
});

test('cold pending history retains omitted amount and original description without automatically retrying', async () => {
  getHistory.mockResolvedValue(history([request({ requestId: secondId, description: 'Original server description' })]));
  refund.mockResolvedValue(result(request({ requestId: secondId, description: 'Original server description' })));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  const retry = await screen.findByRole('button', { name: 'Retry this request' });
  expect(refund).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(retry));
  expect(refund).toHaveBeenCalledWith(payment.id, 'requested_by_customer', undefined,
    { requestId: secondId, description: 'Original server description' });
  expect(localStorage.getItem(recoveryKey('payer', payment.id, 'https://api.test'))).toBeNull();
});

test('an unverified history blocks new refunds', async () => {
  getHistory.mockResolvedValue(history([], { id: 'another-payment' }));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
  expect(screen.queryByRole('button', { name: 'Request a refund' })).not.toBeInTheDocument();
  expect(refund).not.toHaveBeenCalled();
});

test('a mismatched final request cannot show completed or retire the original recovery identity', async () => {
  refund.mockResolvedValue(result(request({ requestId: secondId, status: 'succeeded', canRetry: false })));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  await confirm();
  expect(screen.getByRole('alert')).toHaveTextContent('not confirmed');
  expect(screen.queryByText(/refund completed/)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(recoveryKey('payer', payment.id, 'https://api.test'))!).requestId).toBe(requestId);
});

test('requires-action and a misleading success boolean never show a completed refund', async () => {
  refund.mockResolvedValue({ ...result(request({ status: 'requires_action' })), success: true });
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  await confirm();
  expect(screen.getByText(/refund needs additional action/)).toBeInTheDocument();
  expect(screen.queryByText(/refund completed/)).not.toBeInTheDocument();
});

test('a verified completed receipt retires recovery and updates only the matching payment', async () => {
  const onPaymentChanged = jest.fn();
  const updated = { ...payment, payment_status: 'refunded_full' as const, refunded_amount: 3100 };
  refund.mockResolvedValue({ ...result(request({ status: 'succeeded', canRetry: false })), payment: updated });
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} onPaymentChanged={onPaymentChanged} />);
  await openForm();
  await confirm();
  expect(screen.getByText(/\$31.00 refund completed/)).toBeInTheDocument();
  expect(localStorage.getItem(recoveryKey('payer', payment.id, 'https://api.test'))).toBeNull();
  expect(onPaymentChanged).toHaveBeenCalledWith(updated);
  expect(screen.queryByRole('button', { name: 'Request a refund' })).not.toBeInTheDocument();
});

test('an uncaptured authorization presents a hold release and never promises a returned charge', async () => {
  const held = { ...payment, payment_status: 'authorized' as const, captured_at: undefined };
  getHistory.mockResolvedValue(history([], held));
  refund.mockResolvedValue({ ...result(request({ operation: 'release', status: 'succeeded', canRetry: false })),
    payment: { ...held, payment_status: 'canceled' } });
  render(<GigPaymentRefundPanel actorId="payer" payment={held} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Release authorization hold' }));
  expect(screen.queryByLabelText(/Amount/)).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm hold release' })));
  expect(screen.getByText(/authorization hold released. This was not a captured charge/)).toBeInTheDocument();
  expect(screen.queryByText(/refund completed/)).not.toBeInTheDocument();
});

test('late completion cannot update a different account or consume its recovery', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void;
  refund.mockReturnValue(new Promise((r) => { resolve = r; }));
  const onPaymentChanged = jest.fn();
  const view = render(<GigPaymentRefundPanel actorId="payer" payment={payment} onPaymentChanged={onPaymentChanged} />);
  await openForm();
  await confirm();
  view.rerender(<GigPaymentRefundPanel actorId="other" payment={payment} onPaymentChanged={onPaymentChanged} />);
  await act(async () => resolve(result(request({ status: 'succeeded', canRetry: false }))));
  expect(onPaymentChanged).not.toHaveBeenCalled();
  expect(screen.queryByText(/refund completed/)).not.toBeInTheDocument();
  expect(localStorage.getItem(recoveryKey('payer', payment.id, 'https://api.test'))).not.toBeNull();
});

test('storage failure prevents a new request from being sent', async () => {
  const store = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  try {
    render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
    await openForm();
    await confirm();
    expect(refund).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Allow local storage');
  } finally { store.mockRestore(); }
});

test('a same-user session replacement fences late completion and further mutation', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void;
  refund.mockReturnValue(new Promise((r) => { resolve = r; }));
  const onPaymentChanged = jest.fn();
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} onPaymentChanged={onPaymentChanged} />);
  await openForm();
  await confirm();
  act(() => jest.mocked(api.onTokenChange).mock.calls[0][0](null));
  await act(async () => resolve(result(request({ status: 'succeeded', canRetry: false }))));
  expect(onPaymentChanged).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('session or connection changed');
  expect(screen.queryByText(/refund completed/)).not.toBeInTheDocument();
});

test('an API origin change blocks submission from the existing form', async () => {
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  jest.mocked(api.getApiBaseUrl).mockReturnValue('https://another-api.test');
  await confirm();
  expect(refund).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('session or connection changed');
});

test('another tab replacing authentication invalidates the open refund form', async () => {
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: api.AUTH_SESSION_CHANGE_KEY, newValue: 'changed' })));
  expect(screen.getByRole('alert')).toHaveTextContent('session or connection changed');
  expect(refund).not.toHaveBeenCalled();
});

test('a local identity with changed original terms cannot be silently replaced by history', async () => {
  localStorage.setItem(recoveryKey('payer', payment.id, 'https://api.test'), JSON.stringify({
    requestId, requestedAmountCents: 500, reason: 'requested_by_customer', description: null,
  }));
  getHistory.mockResolvedValue(history([request({ requestedAmountCents: 1000, amountCents: 1000 })]));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
  expect(screen.queryByRole('button', { name: 'Retry this request' })).not.toBeInTheDocument();
});

test.each(['OTHER_CONFLICT', 'REFUND_ACTIVE'])('409 %s only replaces an uncertain identity with explicit active-operation proof', async (code) => {
  const other = request({ requestId: secondId });
  refund.mockRejectedValueOnce({ statusCode: 409, data: { code, refundRequest: other } });
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  await openForm();
  await confirm();
  const saved = localStorage.getItem(recoveryKey('payer', payment.id, 'https://api.test'));
  expect(saved === null).toBe(code === 'REFUND_ACTIVE');
  getHistory.mockResolvedValue(history([other]));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check status' })));
  refund.mockResolvedValue(result(code === 'REFUND_ACTIVE' ? other : request()));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry this request' })));
  expect(refund.mock.calls[1][3]?.requestId).toBe(code === 'REFUND_ACTIVE' ? secondId : requestId);
});

test('historical small policy refunds remain readable without offering an unavailable payer retry', async () => {
  getHistory.mockResolvedValue(history([request({ requestedAmountCents: 25, amountCents: 25, canRetry: false })]));
  render(<GigPaymentRefundPanel actorId="payer" payment={payment} />);
  expect(await screen.findByText('$0.25 refund is pending.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry this request' })).not.toBeInTheDocument();
  expect(refund).not.toHaveBeenCalled();
});
