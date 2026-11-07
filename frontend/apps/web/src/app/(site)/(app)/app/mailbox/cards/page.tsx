import SendCardFlow from '@/components/mailbox/cards/SendCardFlow';

/**
 * Send a Christmas card (launch keys holiday_cards + mailbox; the middleware turns this page away while either is
 * off). One card a day; once it's sent, this page shows today's card. ?design= comes from a public card page: that
 * picture is already chosen (launch key card_table).
 */
export default async function SendChristmasCardPage({ searchParams }: { searchParams: Promise<{ design?: string | string[] }> }) {
  const { design } = await searchParams;
  return <SendCardFlow chosenDesign={typeof design === 'string' ? design : null} />;
}
