import React from 'react';
import { render, screen } from '@testing-library/react';
import PaymentBreakdown from '@/components/payments/PaymentBreakdown';
import type { Payment, PaymentStatus } from '@pantopus/types';

const payment = (status: PaymentStatus): Payment => ({
  id: 'payment-one', payer_id: 'payer', payee_id: 'worker', gig_id: 'gig-one',
  amount_total: 3100, amount_subtotal: 3100, amount_platform_fee: 310,
  amount_to_payee: 2790, currency: 'usd', payment_type: 'gig_payment',
  payment_status: status, created_at: '', updated_at: '',
});

test.each<PaymentStatus>(['setup_pending', 'authorize_pending', 'authorization_failed', 'canceled', 'pending'])(
  '%s never claims a captured charge', (status) => {
    render(<PaymentBreakdown payment={payment(status)} />);
    expect(screen.getByText('Payment total')).toBeInTheDocument();
    expect(screen.queryByText(/charged/i)).not.toBeInTheDocument();
  },
);

test.each<[PaymentStatus, string]>([
  ['authorized', 'Authorization hold'], ['capture_pending', 'Capture pending'],
  ['captured_hold', 'Task charged'], ['refunded_partial', 'Task charged'],
])('the payer sees %s as %s', (status, label) => {
  render(<PaymentBreakdown payment={payment(status)} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText('Platform fee (included)')).toBeInTheDocument();
  expect(screen.queryByText('Service fee')).not.toBeInTheDocument();
});

test('a held payment does not claim the worker has received its earnings', () => {
  render(<PaymentBreakdown payment={payment('authorized')} perspective="payee" />);
  expect(screen.getByText('Expected earnings')).toBeInTheDocument();
  expect(screen.getByText('$27.90')).toBeInTheDocument();
  expect(screen.queryByText('You earn')).not.toBeInTheDocument();
});

test('a pending release of an uncaptured hold does not claim a charge', () => {
  render(<PaymentBreakdown payment={payment('refund_pending')} />);
  expect(screen.getByText('Payment total')).toBeInTheDocument();
  expect(screen.queryByText(/charged/i)).not.toBeInTheDocument();
});

test('a pending refund keeps the captured task amount visible', () => {
  render(<PaymentBreakdown payment={{ ...payment('refund_pending'), captured_at: '2026-09-09T12:00:00Z' }} />);
  expect(screen.getByText('Task charged')).toBeInTheDocument();
});

const partial = (): Payment => ({
  ...payment('refunded_partial'), refunded_amount: 1000, payee_release_status: 'wallet_credited',
  wallet_settlement: { id: '22222222-2222-4222-8222-222222222222', paymentId: 'payment-one',
    status: 'credited', amountCents: 1890, currency: 'usd', refundBasisCents: 1000, createdAt: '2026-09-10T00:00:00Z' },
});

test('a partial refund separates the original worker amount from the exact wallet credit', () => {
  render(<PaymentBreakdown payment={partial()} perspective="payee" />);
  expect(screen.getByText('Original expected earnings')).toBeInTheDocument();
  expect(screen.getByText('Credited to wallet')).toBeInTheDocument();
  expect(screen.getByText('$18.90')).toBeInTheDocument();
  expect(screen.getByText('Refunded to payer')).toBeInTheDocument();
  expect(screen.queryByText('Net')).not.toBeInTheDocument();
});

test('later refunds never rewrite a historical credit into a fictitious current wallet balance', () => {
  render(<PaymentBreakdown payment={{ ...partial(), refunded_amount: 2000, tip_amount: 500 }} perspective="payee" />);
  expect(screen.getByText('$18.90')).toBeInTheDocument();
  expect(screen.getByText(/later adjustments and separate tips/)).toBeInTheDocument();
  expect(screen.queryByText('$23.90')).not.toBeInTheDocument();
});

test.each([
  { paymentId: 'another-payment' }, { amountCents: -1 }, { amountCents: 3101 },
  { refundBasisCents: 1001 }, { currency: 'eur' }, { createdAt: 'invalid' },
])('a mismatched wallet receipt is not displayed as a verified credit: %j', (change) => {
  const p = partial();
  render(<PaymentBreakdown payment={{ ...p, wallet_settlement: { ...p.wallet_settlement!, ...change } }} perspective="payee" />);
  expect(screen.queryByText('Credited to wallet')).not.toBeInTheDocument();
  expect(screen.getByText(/final wallet credit is not confirmed/)).toBeInTheDocument();
});

test('the payer retains the captured-money net without exposing a worker wallet credit', () => {
  render(<PaymentBreakdown payment={partial()} perspective="payer" />);
  expect(screen.getByText('Net')).toBeInTheDocument();
  expect(screen.getByText('$21.00')).toBeInTheDocument();
  expect(screen.queryByText('Credited to wallet')).not.toBeInTheDocument();
});

test('an exact zero-earnings settlement does not claim that money was credited', () => {
  const p = partial();
  render(<PaymentBreakdown payment={{ ...p, refunded_amount: 3100, payee_release_status: 'no_earnings',
    wallet_settlement: { ...p.wallet_settlement!, status: 'no_earnings', amountCents: 0, refundBasisCents: 3100 } }} perspective="payee" />);
  expect(screen.getByText('Remaining worker earnings')).toBeInTheDocument();
  expect(screen.getByText('$0.00')).toBeInTheDocument();
  expect(screen.queryByText('Credited to wallet')).not.toBeInTheDocument();
  expect(screen.getByText('Refunds left no worker earnings to release.')).toBeInTheDocument();
});
