import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GigPaymentSetup from '@/components/payments/GigPaymentSetup';

const mockConfirm = jest.fn();
jest.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => ({ confirmPayment: mockConfirm }),
  useElements: () => ({}),
  PaymentElement: () => <div>Card entry</div>,
}));
jest.mock('@pantopus/api', () => ({ payments: { completePaymentSetup: jest.fn() } }));

test('provider redirect retains exact selected bid and completion awaits the receipt', async () => {
  mockConfirm.mockResolvedValue({});
  let finish!: () => void;
  const confirmation = new Promise<void>((resolve) => { finish = resolve; });
  const onSuccess = jest.fn(() => confirmation);
  render(<GigPaymentSetup clientSecret="test-secret" isSetupIntent={false} gigId="gig/one" bidId="bid?two" amount={3100} onSuccess={onSuccess} onClose={jest.fn()} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Authorize $31.00' })); });
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
    confirmParams: { return_url: 'http://localhost/app/gigs/gig%2Fone?payment=authorized&bid=bid%3Ftwo' },
    redirect: 'if_required',
  }));
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Authorize $31.00' })).toBeEnabled();
});

const tipRequestId = '55555555-5555-4555-8555-555555555555';
const tipProps = { clientSecret: 'pi_tip_secret_synthetic', isSetupIntent: false, intentPurpose: 'tip' as const, tipRequestId,
  gigId: 'gig/one', amount: 500, onSuccess: jest.fn(), onClose: jest.fn(), beforeConfirm: jest.fn(async () => true), isCurrent: () => true };
beforeEach(() => { jest.clearAllMocks(); mockConfirm.mockResolvedValue({}); tipProps.beforeConfirm.mockResolvedValue(true); });

test('tip reuses card entry with charge copy and retains its original UUID through the provider return', async () => {
  render(<GigPaymentSetup {...tipProps} />);
  expect(screen.getByText('Confirm Tip')).toBeInTheDocument();
  expect(screen.getByText(/Your card will be charged when you confirm/)).toBeInTheDocument();
  expect(screen.queryByText(/will be held on your card/)).not.toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm tip $5.00' })); });
  expect(tipProps.beforeConfirm).toHaveBeenCalledTimes(1);
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
    confirmParams: { return_url: `http://localhost/app/gigs/gig%2Fone?tip_request=${tipRequestId}` }, redirect: 'if_required',
  }));
  expect(tipProps.onSuccess).toHaveBeenCalledTimes(1);
});

test('tip cannot submit without the original operation and both session guards', async () => {
  const view = render(<GigPaymentSetup {...tipProps} beforeConfirm={undefined} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm tip $5.00' })); });
  expect(mockConfirm).not.toHaveBeenCalled();
  view.rerender(<GigPaymentSetup {...tipProps} tipRequestId={undefined} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm tip $5.00' })); });
  expect(mockConfirm).not.toHaveBeenCalled();
});

test('a failed pre-confirm check prevents SDK submission', async () => {
  tipProps.beforeConfirm.mockResolvedValue(false); render(<GigPaymentSetup {...tipProps} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm tip $5.00' })); });
  expect(mockConfirm).not.toHaveBeenCalled(); expect(tipProps.onSuccess).not.toHaveBeenCalled();
});

test('session retirement while the pre-confirm request is in flight prevents SDK submission', async () => {
  let finish!: (value: boolean) => void; let current = true;
  tipProps.beforeConfirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<GigPaymentSetup {...tipProps} isCurrent={() => current} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm tip $5.00' })); });
  current = false; await act(async () => finish(true));
  expect(mockConfirm).not.toHaveBeenCalled(); expect(tipProps.onSuccess).not.toHaveBeenCalled();
});

test('duplicate clicks submit once and an old SDK reply cannot publish completion', async () => {
  let finish!: (value: object) => void; let current = true;
  mockConfirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<GigPaymentSetup {...tipProps} isCurrent={() => current} />);
  const button = screen.getByRole('button', { name: 'Confirm tip $5.00' });
  await act(async () => { fireEvent.click(button); fireEvent.click(button); });
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  current = false; await act(async () => finish({})); expect(tipProps.onSuccess).not.toHaveBeenCalled();
});

test('an SDK error cannot report a paid tip', async () => {
  mockConfirm.mockResolvedValueOnce({ error: { message: 'Synthetic interrupted confirmation' } });
  const onError = jest.fn(); render(<GigPaymentSetup {...tipProps} onError={onError} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm tip $5.00' })); });
  expect(onError).toHaveBeenCalledWith('Synthetic interrupted confirmation'); expect(tipProps.onSuccess).not.toHaveBeenCalled();
});
