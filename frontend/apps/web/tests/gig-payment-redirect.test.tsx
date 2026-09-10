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
