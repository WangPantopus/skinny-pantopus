import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import * as api from '@pantopus/api';
import { useMailVerification } from '@/hooks/useMailVerification';
import MailVerificationFlow from '@/components/address/MailVerificationFlow';

jest.mock('@pantopus/api', () => ({
  addressValidation: {
    startMailVerification: jest.fn(),
    resendMailVerification: jest.fn(),
    getMailVerificationStatus: jest.fn(),
    confirmMailVerification: jest.fn(),
  },
}));
const addressId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const verificationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const start = api.addressValidation.startMailVerification as jest.Mock;
const getStatus = api.addressValidation.getMailVerificationStatus as jest.Mock;
const confirm = api.addressValidation.confirmMailVerification as jest.Mock;
const uncertain = {
  statusCode: 503,
  data: { delivery_unknown: true, verification_id: verificationId, address_id: addressId },
};
beforeEach(() => { jest.clearAllMocks(); start.mockRejectedValue(uncertain); });

test('an uncertain send keeps code entry available for the same verification', async () => {
  const { result } = renderHook(() => useMailVerification({ addressId }));
  await act(async () => result.current.sendCode());
  expect(result.current.phase).toBe('pending');
  expect(result.current.deliveryUnknown).toBe(true);
  expect(result.current.verificationId).toBe(verificationId);
  confirm.mockResolvedValue({ status: 'confirmed' });
  await act(async () => result.current.confirmCode('123456'));
  expect(confirm).toHaveBeenCalledWith({ verification_id: verificationId, code: '123456' });
  expect(result.current.phase).toBe('success');
});

test('checking a recovered receipt refreshes status without another send', async () => {
  const { result } = renderHook(() => useMailVerification({ addressId }));
  await act(async () => result.current.sendCode());
  getStatus.mockResolvedValue({
    verification_id: verificationId, status: 'pending',
    expires_at: '2027-01-01T00:00:00Z', cooldown_until: new Date(0).toISOString(), resends_remaining: 3,
  });
  await act(async () => result.current.refreshDeliveryStatus());
  expect(result.current.deliveryUnknown).toBe(false);
  expect(result.current.resendsRemaining).toBe(3);
  expect(start).toHaveBeenCalledTimes(1);
  expect(api.addressValidation.resendMailVerification).not.toHaveBeenCalled();
});

test('an unrelated address cannot replace the current verification destination', async () => {
  start.mockRejectedValue({ ...uncertain, data: { ...uncertain.data, address_id: 'unrelated-address' } });
  const { result } = renderHook(() => useMailVerification({ addressId }));
  await act(async () => result.current.sendCode());
  expect(result.current.phase).toBe('start');
  expect(result.current.verificationId).toBeNull();
});

test('the pending screen states uncertainty and offers checking and code entry', async () => {
  render(<MailVerificationFlow addressId={addressId} onBack={jest.fn()} onVerified={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
  expect(await screen.findByRole('heading', { name: 'Checking mail delivery' })).toBeInTheDocument();
  expect(screen.queryByText('Code sent!')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enter code' })).toBeEnabled();
  getStatus.mockResolvedValue({ verification_id: verificationId, status: 'pending', delivery_unknown: true, resends_remaining: 3 });
  fireEvent.click(screen.getByRole('button', { name: 'Check delivery status' }));
  await act(async () => {});
  expect(getStatus).toHaveBeenCalledWith(verificationId);
  expect(api.addressValidation.resendMailVerification).not.toHaveBeenCalled();
});
