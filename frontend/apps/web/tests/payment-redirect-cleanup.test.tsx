import { render, screen } from '@testing-library/react';
import { usePaymentRedirectCleanup } from '../src/hooks/usePaymentRedirectCleanup';

// The page owns cleanup regardless of whether an authorization form is needed.
function ReturnedPage({ paymentStatus }: { paymentStatus: string }) {
  usePaymentRedirectCleanup();
  return <p>{paymentStatus === 'authorized' ? 'Worker can start' : 'Checking payment'}</p>;
}
test.each(['authorized', 'authorize_pending', 'authorization_failed'])('provider return with %s removes all temporary secrets and preserves exact bid navigation', (paymentStatus) => {
  window.history.replaceState({ saved: 'navigation' }, '', '/app/gigs/gig-a?action=payment_setup&bid=bid-a&payment_intent=pi_a&payment_intent_client_secret=pi_a_secret_temporary&setup_intent=seti_a&setup_intent_client_secret=seti_a_secret_temporary&redirect_status=succeeded#payment-checkout');
  render(<ReturnedPage paymentStatus={paymentStatus} />);
  expect(window.location.pathname + window.location.search + window.location.hash)
    .toBe('/app/gigs/gig-a?action=payment_setup&bid=bid-a#payment-checkout');
  expect(window.history.state).toEqual({ saved: 'navigation' });
  expect(screen.getByText(paymentStatus === 'authorized' ? 'Worker can start' : 'Checking payment')).toBeInTheDocument();
});
