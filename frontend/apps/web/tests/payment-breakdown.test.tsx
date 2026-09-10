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
