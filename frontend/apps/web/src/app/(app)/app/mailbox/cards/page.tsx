import SendCardFlow from '@/components/mailbox/cards/SendCardFlow';

/**
 * Send a Christmas card (launch keys holiday_cards + mailbox; the middleware turns this page away while either is
 * off). One card a day; once it's sent, this page shows today's card.
 */
export default function SendChristmasCardPage() {
  return <SendCardFlow />;
}
